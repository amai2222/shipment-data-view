-- =============================================================================
-- 篷布档案与使用管理（货运大票篷布号）
-- 须先执行 create_multimodal_schema.sql
-- 整文件可一次性执行
-- =============================================================================

ALTER TABLE tielu.rail_waybill
  ADD COLUMN IF NOT EXISTS tarpaulin_nos text;

COMMENT ON COLUMN tielu.rail_waybill.tarpaulin_nos IS '本票识别到的篷布号，顿号拼接；明细以 tarpaulin_use 为准';

-- 篷布实物档案：一块布一个号
CREATE TABLE IF NOT EXISTS tielu.tarpaulin (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarp_no           text NOT NULL,                 -- ZD22060102
  kind              text NOT NULL DEFAULT 'cover'
                    CHECK (kind IN ('cover', 'pole', 'other')),
  -- cover=篷布 pole=篷杆（记事里常写自备篷布篷杆）
  owner_type        text NOT NULL DEFAULT 'shipper'
                    CHECK (owner_type IN ('shipper', 'railway', 'company')),
  owner_name        text,                          -- 自备时的货主/托运人
  status            text NOT NULL DEFAULT 'idle'
                    CHECK (status IN ('idle', 'bound', 'in_transit', 'overdue', 'lost', 'scrapped')),
  remark            text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.tarpaulin IS '篷布/篷杆档案；号码全局唯一';
COMMENT ON COLUMN tielu.tarpaulin.kind IS 'cover篷布 / pole篷杆';
COMMENT ON COLUMN tielu.tarpaulin.status IS 'idle闲置 bound已挂票 in_transit在途 overdue超期未回 lost丢失 scrapped报废';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_tarp_no
  ON tielu.tarpaulin (tarp_no);

CREATE INDEX IF NOT EXISTS idx_tielu_tarp_status
  ON tielu.tarpaulin (status);

-- 挂在哪张运单/哪个箱（一票可多块布；一块布同时只能有一条 active）
CREATE TABLE IF NOT EXISTS tielu.tarpaulin_use (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarp_id           uuid NOT NULL REFERENCES tielu.tarpaulin (id) ON DELETE RESTRICT,
  waybill_id        uuid REFERENCES tielu.rail_waybill (id) ON DELETE SET NULL,
  container_id      uuid REFERENCES tielu.rail_container (id) ON DELETE SET NULL,
  batch_id          uuid REFERENCES tielu.shipment_batch (id) ON DELETE SET NULL,
  ticket_no         text,
  box_no            text,
  bound_at          timestamptz NOT NULL DEFAULT now(),
  unbound_at        timestamptz,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'returned', 'lost_on_trip', 'cancelled')),
  remark            text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.tarpaulin_use IS '篷布本趟使用：挂运单；到站收回后 status=returned 并写 unbound_at';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_tarp_active_use
  ON tielu.tarpaulin_use (tarp_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_tielu_tarp_use_waybill
  ON tielu.tarpaulin_use (waybill_id);

CREATE INDEX IF NOT EXISTS idx_tielu_tarp_use_tarp
  ON tielu.tarpaulin_use (tarp_id);

-- 流水：入库、挂票、收回、丢失、调拨
CREATE TABLE IF NOT EXISTS tielu.tarpaulin_ledger (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarp_id           uuid NOT NULL REFERENCES tielu.tarpaulin (id) ON DELETE CASCADE,
  action            text NOT NULL
                    CHECK (action IN (
                      'register',   -- 建档
                      'bind',       -- 随大票发出
                      'unbind',     -- 收回
                      'transfer',   -- 调拨货主/站点
                      'lose',       -- 丢失
                      'scrap'       -- 报废
                    )),
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  waybill_id        uuid REFERENCES tielu.rail_waybill (id) ON DELETE SET NULL,
  place_name        text,
  operator_name     text,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.tarpaulin_ledger IS '篷布变动流水，只追加';

CREATE INDEX IF NOT EXISTS idx_tielu_tarp_ledger_tarp_time
  ON tielu.tarpaulin_ledger (tarp_id, occurred_at);

CREATE OR REPLACE VIEW tielu.v_tarpaulin_now AS
SELECT
  t.id AS tarp_id,
  t.tarp_no,
  t.kind,
  t.owner_type,
  t.owner_name,
  t.status AS archive_status,
  u.id AS use_id,
  u.status AS use_status,
  u.ticket_no,
  u.box_no,
  u.bound_at,
  w.from_station,
  w.to_station,
  w.issue_date
FROM tielu.tarpaulin t
LEFT JOIN tielu.tarpaulin_use u ON u.tarp_id = t.id AND u.status = 'active'
LEFT JOIN tielu.rail_waybill w ON w.id = u.waybill_id;

COMMENT ON VIEW tielu.v_tarpaulin_now IS '每块篷布当前状态及挂着的运单';

-- 从运单 tarpaulin_nos 登记并挂票（已存在则跳过重复挂）
CREATE OR REPLACE FUNCTION tielu.register_tarps_from_waybill(p_waybill_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  rec record;
  nos text;
  part text;
  n text;
  tid uuid;
  cnt integer := 0;
BEGIN
  SELECT tarpaulin_nos, ticket_no, batch_id INTO rec
  FROM tielu.rail_waybill WHERE id = p_waybill_id;
  IF rec.tarpaulin_nos IS NULL OR btrim(rec.tarpaulin_nos) = '' THEN
    RETURN 0;
  END IF;
  FOREACH part IN ARRAY string_to_array(replace(rec.tarpaulin_nos, '，', '、'), '、')
  LOOP
    n := upper(btrim(part));
    IF n = '' THEN
      CONTINUE;
    END IF;
    INSERT INTO tielu.tarpaulin (tarp_no, kind, owner_type, status)
    VALUES (n, 'cover', 'shipper', 'bound')
    ON CONFLICT (tarp_no) DO UPDATE SET updated_at = now()
    RETURNING id INTO tid;
    SELECT id INTO tid FROM tielu.tarpaulin WHERE tarp_no = n;
    IF NOT EXISTS (
      SELECT 1 FROM tielu.tarpaulin_use
      WHERE tarp_id = tid AND waybill_id = p_waybill_id AND status = 'active'
    ) THEN
      IF EXISTS (SELECT 1 FROM tielu.tarpaulin_use WHERE tarp_id = tid AND status = 'active') THEN
        RAISE EXCEPTION '篷布 % 已挂在其他运单上，请先收回', n;
      END IF;
      INSERT INTO tielu.tarpaulin_use (tarp_id, waybill_id, batch_id, ticket_no, status)
      VALUES (tid, p_waybill_id, rec.batch_id, rec.ticket_no, 'active');
      UPDATE tielu.tarpaulin SET status = 'bound', updated_at = now() WHERE id = tid;
      INSERT INTO tielu.tarpaulin_ledger (tarp_id, action, waybill_id, note)
      VALUES (tid, 'bind', p_waybill_id, '随大票挂出');
      cnt := cnt + 1;
    END IF;
  END LOOP;
  RETURN cnt;
END;
$$;

COMMENT ON FUNCTION tielu.register_tarps_from_waybill IS '按运单 tarpaulin_nos 建档并挂到本票';
