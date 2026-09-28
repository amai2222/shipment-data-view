-- =============================================================================
-- 五流合一：货主发货 → 多日运输 → 签收；商流/单证/资金接到现有物流
-- 须先：create_multimodal_schema.sql、create_order_flow.sql
-- 整文件可一次性执行
-- =============================================================================

-- ---------- 货主 ----------
CREATE TABLE IF NOT EXISTS tielu.cargo_owner (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  tax_id            text,
  contact_name      text,
  phone             text,
  address           text,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive')),
  remark            text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.cargo_owner IS '货主档案（商流主体）';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_cargo_owner_name
  ON tielu.cargo_owner (name);

ALTER TABLE tielu.customer_order
  ADD COLUMN IF NOT EXISTS cargo_owner_id uuid;
ALTER TABLE tielu.customer_order
  ADD COLUMN IF NOT EXISTS consignee_name text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tielu_order_owner') THEN
    ALTER TABLE tielu.customer_order
      ADD CONSTRAINT fk_tielu_order_owner
      FOREIGN KEY (cargo_owner_id) REFERENCES tielu.cargo_owner (id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------- 发货指令（货主确认发货，可跨多日） ----------
CREATE TABLE IF NOT EXISTS tielu.shipping_order (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES tielu.customer_order (id) ON DELETE CASCADE,
  cargo_owner_id      uuid REFERENCES tielu.cargo_owner (id) ON DELETE SET NULL,
  ship_no             text NOT NULL,                 -- 发货单号
  cargo_name          text,
  origin_place        text,
  dest_place          text,
  plan_weight_t       numeric(14, 3) NOT NULL,
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN (
                        'draft',       -- 货主未确认
                        'confirmed',   -- 已确认发货
                        'shipping',    -- 已开始装运
                        'received',    -- 计划吨已全部签收
                        'closed',
                        'cancelled'
                      )),
  confirmed_at        timestamptz,
  remark              text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.shipping_order IS '货主发货指令：一批货可以分多日走完';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_ship_no
  ON tielu.shipping_order (ship_no);

CREATE INDEX IF NOT EXISTS idx_tielu_ship_order
  ON tielu.shipping_order (order_id);

-- 按日计划行（如每天 1200 吨）
CREATE TABLE IF NOT EXISTS tielu.shipping_order_line (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_order_id   uuid NOT NULL REFERENCES tielu.shipping_order (id) ON DELETE CASCADE,
  plan_date           date NOT NULL,
  plan_weight_t       numeric(14, 3) NOT NULL,
  remark              text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.shipping_order_line IS '发货指令的每日计划；实绩用 fulfillment 核销';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_ship_line_date
  ON tielu.shipping_order_line (shipping_order_id, plan_date);

-- 实际发出：每个箱核销到哪一天的计划
CREATE TABLE IF NOT EXISTS tielu.shipping_fulfillment (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_order_id       uuid NOT NULL REFERENCES tielu.shipping_order (id) ON DELETE CASCADE,
  shipping_order_line_id  uuid REFERENCES tielu.shipping_order_line (id) ON DELETE SET NULL,
  container_id            uuid REFERENCES tielu.rail_container (id) ON DELETE SET NULL,
  waybill_id              uuid REFERENCES tielu.rail_waybill (id) ON DELETE SET NULL,
  weight_t                numeric(14, 3),
  departed_at             timestamptz,             -- 对应制票/发端发出
  received_at             timestamptz,             -- 收货签收
  status                  text NOT NULL DEFAULT 'planned'
                          CHECK (status IN (
                            'planned',
                            'departed',    -- 已随火车/汽车发出
                            'in_transit',
                            'arrived',
                            'received',    -- 货主/收货人签收
                            'shortage',
                            'cancelled'
                          )),
  created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.shipping_fulfillment IS '货主发货实绩：一箱一行，从发走到签收';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_fulfill_container
  ON tielu.shipping_fulfillment (container_id)
  WHERE container_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tielu_fulfill_ship
  ON tielu.shipping_fulfillment (shipping_order_id);

CREATE INDEX IF NOT EXISTS idx_tielu_fulfill_line
  ON tielu.shipping_fulfillment (shipping_order_line_id);

ALTER TABLE tielu.rail_waybill
  ADD COLUMN IF NOT EXISTS shipping_order_id uuid;
ALTER TABLE tielu.rail_container
  ADD COLUMN IF NOT EXISTS shipping_order_id uuid;
ALTER TABLE tielu.logistics_event
  ADD COLUMN IF NOT EXISTS shipping_order_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tielu_waybill_ship') THEN
    ALTER TABLE tielu.rail_waybill
      ADD CONSTRAINT fk_tielu_waybill_ship
      FOREIGN KEY (shipping_order_id) REFERENCES tielu.shipping_order (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tielu_container_ship') THEN
    ALTER TABLE tielu.rail_container
      ADD CONSTRAINT fk_tielu_container_ship
      FOREIGN KEY (shipping_order_id) REFERENCES tielu.shipping_order (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tielu_event_ship') THEN
    ALTER TABLE tielu.logistics_event
      ADD CONSTRAINT fk_tielu_event_ship
      FOREIGN KEY (shipping_order_id) REFERENCES tielu.shipping_order (id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------- 单证流 ----------
CREATE TABLE IF NOT EXISTS tielu.doc_record (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid REFERENCES tielu.customer_order (id) ON DELETE SET NULL,
  shipping_order_id   uuid REFERENCES tielu.shipping_order (id) ON DELETE SET NULL,
  waybill_id          uuid REFERENCES tielu.rail_waybill (id) ON DELETE SET NULL,
  trip_id             uuid REFERENCES tielu.truck_trip (id) ON DELETE SET NULL,
  doc_type            text NOT NULL
                      CHECK (doc_type IN (
                        'shipping_order',  -- 发货指令
                        'rail_waybill',    -- 铁路大票
                        'highway_waybill', -- 公路运单
                        'rail_invoice',    -- 铁路发票
                        'vat_invoice',     -- 我方向货主开票
                        'pod',             -- 签收/回单
                        'other'
                      )),
  doc_no              text,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'issued', 'received', 'archived', 'void')),
  issued_at           timestamptz,
  file_path           text,
  remark              text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.doc_record IS '单证台账：发货单、大票、公路单、发票、回单';

CREATE INDEX IF NOT EXISTS idx_tielu_doc_ship
  ON tielu.doc_record (shipping_order_id, doc_type);

-- ---------- 资金流 ----------
CREATE TABLE IF NOT EXISTS tielu.fin_ar (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_owner_id      uuid REFERENCES tielu.cargo_owner (id) ON DELETE SET NULL,
  order_id            uuid REFERENCES tielu.customer_order (id) ON DELETE SET NULL,
  shipping_order_id   uuid REFERENCES tielu.shipping_order (id) ON DELETE SET NULL,
  amount              numeric(14, 2) NOT NULL,
  tax_amt             numeric(14, 2),
  invoice_no          text,
  due_date            date,
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'issued', 'partial', 'paid', 'void')),
  remark              text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.fin_ar IS '应收货主：运费结算';

CREATE TABLE IF NOT EXISTS tielu.fin_ap (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_type         text NOT NULL
                      CHECK (vendor_type IN ('railway', 'truck', 'handling', 'other')),
  vendor_name         text,
  order_id            uuid REFERENCES tielu.customer_order (id) ON DELETE SET NULL,
  waybill_id          uuid REFERENCES tielu.rail_waybill (id) ON DELETE SET NULL,
  trip_id             uuid REFERENCES tielu.truck_trip (id) ON DELETE SET NULL,
  amount              numeric(14, 2) NOT NULL,
  tax_amt             numeric(14, 2),
  invoice_no          text,
  due_date            date,
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'confirmed', 'partial', 'paid', 'void')),
  remark              text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.fin_ap IS '应付铁路/车队/装卸';

CREATE TABLE IF NOT EXISTS tielu.fin_payment (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction           text NOT NULL CHECK (direction IN ('in', 'out')),
  amount              numeric(14, 2) NOT NULL,
  paid_at             date NOT NULL,
  party_name          text,
  method              text,
  ref_no              text,
  remark              text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.fin_payment IS '收款 direction=in；付款 direction=out';

CREATE TABLE IF NOT EXISTS tielu.fin_match (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id          uuid NOT NULL REFERENCES tielu.fin_payment (id) ON DELETE CASCADE,
  ar_id               uuid REFERENCES tielu.fin_ar (id) ON DELETE SET NULL,
  ap_id               uuid REFERENCES tielu.fin_ap (id) ON DELETE SET NULL,
  amount              numeric(14, 2) NOT NULL,
  matched_at          date NOT NULL DEFAULT CURRENT_DATE,
  remark              text
);

COMMENT ON TABLE tielu.fin_match IS '核销：一笔款对一张应收或一张应付';

-- ---------- 货主视角：一箱从发到收 ----------
CREATE OR REPLACE VIEW tielu.v_cargo_box_journey AS
SELECT
  co.name AS cargo_owner,
  so.ship_no,
  sol.plan_date,
  sf.status AS fulfill_status,
  sf.departed_at,
  sf.received_at,
  sf.weight_t,
  c.box_no,
  w.ticket_no,
  w.from_station,
  w.to_station,
  w.issue_date,
  pickup.plate_no AS pickup_plate,
  delivery.plate_no AS delivery_plate,
  st.done_signed
FROM tielu.shipping_fulfillment sf
JOIN tielu.shipping_order so ON so.id = sf.shipping_order_id
LEFT JOIN tielu.shipping_order_line sol ON sol.id = sf.shipping_order_line_id
LEFT JOIN tielu.cargo_owner co ON co.id = so.cargo_owner_id
LEFT JOIN tielu.rail_container c ON c.id = sf.container_id
LEFT JOIN tielu.rail_waybill w ON w.id = coalesce(sf.waybill_id, c.waybill_id)
LEFT JOIN tielu.v_container_flow_status st ON st.container_id = c.id
LEFT JOIN LATERAL (
  SELECT tr.plate_no
  FROM tielu.container_truck ct
  JOIN tielu.truck_trip tr ON tr.id = ct.trip_id
  WHERE ct.container_id = c.id AND ct.leg = 'pickup' AND ct.status = 'active'
  LIMIT 1
) pickup ON true
LEFT JOIN LATERAL (
  SELECT tr.plate_no
  FROM tielu.container_truck ct
  JOIN tielu.truck_trip tr ON tr.id = ct.trip_id
  WHERE ct.container_id = c.id AND ct.leg = 'delivery' AND ct.status = 'active'
  LIMIT 1
) delivery ON true;

COMMENT ON VIEW tielu.v_cargo_box_journey IS '五流执行：货主+发货单+计划日+箱+大票+两端车牌+是否签收';

CREATE OR REPLACE VIEW tielu.v_shipping_order_progress AS
SELECT
  so.id AS shipping_order_id,
  so.ship_no,
  co.name AS cargo_owner,
  so.plan_weight_t,
  so.status,
  coalesce((SELECT sum(l.plan_weight_t) FROM tielu.shipping_order_line l WHERE l.shipping_order_id = so.id), 0) AS line_plan_t,
  coalesce((SELECT sum(f.weight_t) FROM tielu.shipping_fulfillment f WHERE f.shipping_order_id = so.id AND f.status NOT IN ('cancelled')), 0) AS departed_like_t,
  coalesce((SELECT sum(f.weight_t) FROM tielu.shipping_fulfillment f WHERE f.shipping_order_id = so.id AND f.status = 'received'), 0) AS received_t,
  coalesce((SELECT sum(a.amount) FROM tielu.fin_ar a WHERE a.shipping_order_id = so.id AND a.status <> 'void'), 0) AS ar_amt,
  coalesce((
    SELECT sum(m.amount)
    FROM tielu.fin_match m
    JOIN tielu.fin_ar a ON a.id = m.ar_id
    WHERE a.shipping_order_id = so.id
  ), 0) AS ar_matched_amt
FROM tielu.shipping_order so
LEFT JOIN tielu.cargo_owner co ON co.id = so.cargo_owner_id;

COMMENT ON VIEW tielu.v_shipping_order_progress IS '发货指令：计划吨/已发核销吨/已签收吨/应收/已核销';
