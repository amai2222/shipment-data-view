-- =============================================================================
-- 甲方委托 + 每日发运 + 收发流水（万吨级分日装火车）
-- 须先执行 create_multimodal_schema.sql
-- 整文件可一次性执行（DDL）
-- =============================================================================

-- 批次挂到甲方委托
ALTER TABLE tielu.shipment_batch
  ADD COLUMN IF NOT EXISTS order_id uuid;

ALTER TABLE tielu.truck_trip
  ADD COLUMN IF NOT EXISTS order_id uuid;

ALTER TABLE tielu.rail_waybill
  ADD COLUMN IF NOT EXISTS order_id uuid;

-- -----------------------------------------------------------------------------
-- 甲方一批货：计划总量（例：10000 吨），不是一天的火车
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tielu.customer_order (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no              text NOT NULL,
  party_a               text NOT NULL,             -- 甲方
  cargo_name            text,
  plan_weight_t         numeric(14, 3) NOT NULL,   -- 计划总吨，如 10000
  daily_plan_weight_t   numeric(14, 3),            -- 参考日计划，如 1200
  origin_place          text,
  dest_place            text,
  plan_start_date       date,
  plan_end_date         date,
  status                text NOT NULL DEFAULT 'executing'
                        CHECK (status IN ('draft', 'executing', 'completed', 'cancelled')),
  remark                text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.customer_order IS '甲方委托：万吨级合同总量；每天火车是执行日，不是本表一行';
COMMENT ON COLUMN tielu.customer_order.plan_weight_t IS '合同计划吨数，如 10000';
COMMENT ON COLUMN tielu.customer_order.daily_plan_weight_t IS '日均计划，如 1200；实际以 order_day 和运单为准';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_customer_order_no
  ON tielu.customer_order (order_no);

-- 补外键（表已存在时）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tielu_batch_order'
  ) THEN
    ALTER TABLE tielu.shipment_batch
      ADD CONSTRAINT fk_tielu_batch_order
      FOREIGN KEY (order_id) REFERENCES tielu.customer_order (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tielu_trip_order'
  ) THEN
    ALTER TABLE tielu.truck_trip
      ADD CONSTRAINT fk_tielu_trip_order
      FOREIGN KEY (order_id) REFERENCES tielu.customer_order (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tielu_waybill_order'
  ) THEN
    ALTER TABLE tielu.rail_waybill
      ADD CONSTRAINT fk_tielu_waybill_order
      FOREIGN KEY (order_id) REFERENCES tielu.customer_order (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tielu_batch_order ON tielu.shipment_batch (order_id);
CREATE INDEX IF NOT EXISTS idx_tielu_waybill_order ON tielu.rail_waybill (order_id);
CREATE INDEX IF NOT EXISTS idx_tielu_trip_order ON tielu.truck_trip (order_id);

-- -----------------------------------------------------------------------------
-- 执行日：这一天计划发多少、实际铁路装了多少
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tielu.order_day (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL REFERENCES tielu.customer_order (id) ON DELETE CASCADE,
  biz_date              date NOT NULL,
  plan_weight_t         numeric(14, 3),            -- 当天计划，如 1200
  remark                text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.order_day IS '委托执行日：计划吨数；实际吨从当日运单/流水汇总，不在本表手填实绩以免对不上';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_order_day
  ON tielu.order_day (order_id, biz_date);

CREATE INDEX IF NOT EXISTS idx_tielu_order_day_date
  ON tielu.order_day (biz_date);

-- -----------------------------------------------------------------------------
-- 收发流水：每一个动作一行（发端装车、装火车、到站、收端配送、签收…）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tielu.logistics_event (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL REFERENCES tielu.customer_order (id) ON DELETE CASCADE,
  order_day_id          uuid REFERENCES tielu.order_day (id) ON DELETE SET NULL,
  event_type            text NOT NULL
                        CHECK (event_type IN (
                          'order_opened',           -- 甲方下单/开委托
                          'pickup_loaded',          -- 发端：货装上汽车
                          'pickup_at_station',      -- 发端：汽车送到发站
                          'rail_loaded',            -- 装上火车/箱进站
                          'rail_departed',          -- 制票/挂运发出（对应运单）
                          'rail_in_transit',        -- 在途节点（可选）
                          'rail_arrived',           -- 火车到站
                          'delivery_loaded',        -- 收端：货装上汽车
                          'delivery_arrived',       -- 收端：送到厂/库
                          'signed',                 -- 收货签收
                          'shortage',               -- 短少
                          'damage',                 -- 货损
                          'note'                    -- 其它说明
                        )),
  direction             text NOT NULL DEFAULT 'outbound'
                        CHECK (direction IN ('outbound', 'inbound', 'internal')),
  -- outbound=发端  inbound=收端  internal=在途/铁路
  occurred_at           timestamptz NOT NULL DEFAULT now(),
  place_name            text,
  weight_t              numeric(14, 3),            -- 本事件涉及吨数
  batch_id              uuid REFERENCES tielu.shipment_batch (id) ON DELETE SET NULL,
  waybill_id            uuid REFERENCES tielu.rail_waybill (id) ON DELETE SET NULL,
  container_id          uuid REFERENCES tielu.rail_container (id) ON DELETE SET NULL,
  trip_id               uuid REFERENCES tielu.truck_trip (id) ON DELETE SET NULL,
  ticket_no             text,
  box_no                text,
  plate_no              text,
  operator_name         text,
  source_file           text,
  note                  text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.logistics_event IS '收发全流程流水：只追加不改历史；吨数、箱、车、票均可空但尽量带上';
COMMENT ON COLUMN tielu.logistics_event.direction IS 'outbound发端 / inbound收端 / internal铁路在途';
COMMENT ON COLUMN tielu.logistics_event.weight_t IS '本动作吨数；签收、短少也记，便于对账';

CREATE INDEX IF NOT EXISTS idx_tielu_event_order_time
  ON tielu.logistics_event (order_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_tielu_event_type
  ON tielu.logistics_event (event_type);

CREATE INDEX IF NOT EXISTS idx_tielu_event_container
  ON tielu.logistics_event (container_id);

CREATE INDEX IF NOT EXISTS idx_tielu_event_waybill
  ON tielu.logistics_event (waybill_id);

-- -----------------------------------------------------------------------------
-- 写入流水时自动带上委托日（按 occurred_at 当地日期，这里用发生日::date）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tielu.ensure_order_day(p_order_id uuid, p_biz_date date, p_plan_t numeric)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
  v_daily numeric;
BEGIN
  SELECT id INTO v_id FROM tielu.order_day
  WHERE order_id = p_order_id AND biz_date = p_biz_date;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  SELECT daily_plan_weight_t INTO v_daily FROM tielu.customer_order WHERE id = p_order_id;
  INSERT INTO tielu.order_day (order_id, biz_date, plan_weight_t)
  VALUES (p_order_id, p_biz_date, coalesce(p_plan_t, v_daily))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION tielu.log_flow_event(
  p_order_id uuid,
  p_event_type text,
  p_direction text,
  p_occurred_at timestamptz,
  p_place text,
  p_weight_t numeric,
  p_waybill_id uuid DEFAULT NULL,
  p_container_id uuid DEFAULT NULL,
  p_trip_id uuid DEFAULT NULL,
  p_batch_id uuid DEFAULT NULL,
  p_ticket_no text DEFAULT NULL,
  p_box_no text DEFAULT NULL,
  p_plate_no text DEFAULT NULL,
  p_operator text DEFAULT NULL,
  p_source_file text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_day uuid;
  v_id uuid;
BEGIN
  v_day := tielu.ensure_order_day(p_order_id, (p_occurred_at AT TIME ZONE 'Asia/Shanghai')::date, NULL);
  INSERT INTO tielu.logistics_event (
    order_id, order_day_id, event_type, direction, occurred_at, place_name, weight_t,
    waybill_id, container_id, trip_id, batch_id,
    ticket_no, box_no, plate_no, operator_name, source_file, note
  ) VALUES (
    p_order_id, v_day, p_event_type, p_direction, p_occurred_at, p_place, p_weight_t,
    p_waybill_id, p_container_id, p_trip_id, p_batch_id,
    p_ticket_no, p_box_no, p_plate_no, p_operator, p_source_file, p_note
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION tielu.log_flow_event IS '记一条收发流水，并确保当天 order_day 存在';

-- -----------------------------------------------------------------------------
-- 进度视图：计划 1 万吨 vs 已装火车 / 已签收 / 剩余
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW tielu.v_order_progress AS
SELECT
  o.id AS order_id,
  o.order_no,
  o.party_a,
  o.cargo_name,
  o.plan_weight_t,
  o.daily_plan_weight_t,
  o.status,
  coalesce((
    SELECT sum(c.weight_kg) / 1000.0
    FROM tielu.rail_container c
    JOIN tielu.rail_waybill w ON w.id = c.waybill_id
    WHERE coalesce(w.order_id, (
      SELECT b.order_id FROM tielu.shipment_batch b WHERE b.id = w.batch_id
    )) = o.id
  ), 0) AS rail_shipped_t,
  coalesce((
    SELECT sum(e.weight_t) FROM tielu.logistics_event e
    WHERE e.order_id = o.id AND e.event_type = 'signed'
  ), 0) AS signed_t,
  coalesce((
    SELECT sum(e.weight_t) FROM tielu.logistics_event e
    WHERE e.order_id = o.id AND e.event_type = 'shortage'
  ), 0) AS shortage_t,
  o.plan_weight_t - coalesce((
    SELECT sum(c.weight_kg) / 1000.0
    FROM tielu.rail_container c
    JOIN tielu.rail_waybill w ON w.id = c.waybill_id
    WHERE coalesce(w.order_id, (
      SELECT b.order_id FROM tielu.shipment_batch b WHERE b.id = w.batch_id
    )) = o.id
  ), 0) AS remain_to_rail_t
FROM tielu.customer_order o;

COMMENT ON VIEW tielu.v_order_progress IS '甲方委托进度：计划吨、已制票发运吨、已签收吨、尚未上火车吨';

CREATE OR REPLACE VIEW tielu.v_order_daily_progress AS
SELECT
  o.id AS order_id,
  o.order_no,
  d.biz_date,
  d.plan_weight_t AS day_plan_t,
  coalesce((
    SELECT sum(c.weight_kg) / 1000.0
    FROM tielu.rail_container c
    JOIN tielu.rail_waybill w ON w.id = c.waybill_id
    WHERE coalesce(w.order_id, (
      SELECT b.order_id FROM tielu.shipment_batch b WHERE b.id = w.batch_id
    )) = o.id
      AND w.issue_date = d.biz_date
  ), 0) AS day_rail_actual_t,
  (
    SELECT count(*) FROM tielu.rail_waybill w
    WHERE coalesce(w.order_id, (
      SELECT b.order_id FROM tielu.shipment_batch b WHERE b.id = w.batch_id
    )) = o.id
      AND w.issue_date = d.biz_date
  ) AS day_waybill_count,
  (
    SELECT count(*) FROM tielu.logistics_event e
    WHERE e.order_id = o.id
      AND e.order_day_id = d.id
  ) AS day_event_count
FROM tielu.customer_order o
JOIN tielu.order_day d ON d.order_id = o.id;

COMMENT ON VIEW tielu.v_order_daily_progress IS '按日：计划吨 vs 当天运单实发吨（对照每天约 1200 吨）';

CREATE OR REPLACE VIEW tielu.v_order_timeline AS
SELECT
  e.id,
  e.order_id,
  o.order_no,
  e.occurred_at,
  e.direction,
  e.event_type,
  e.place_name,
  e.weight_t,
  e.ticket_no,
  e.box_no,
  e.plate_no,
  e.operator_name,
  e.note
FROM tielu.logistics_event e
JOIN tielu.customer_order o ON o.id = e.order_id;

COMMENT ON VIEW tielu.v_order_timeline IS '委托时间线：所有收发动作按时间排列';

CREATE OR REPLACE VIEW tielu.v_container_flow_status AS
SELECT
  c.id AS container_id,
  c.box_no,
  c.weight_kg / 1000.0 AS weight_t,
  w.ticket_no,
  coalesce(w.order_id, b.order_id) AS order_id,
  bool_or(e.event_type = 'pickup_loaded') AS done_pickup_loaded,
  bool_or(e.event_type = 'rail_departed') AS done_rail_departed,
  bool_or(e.event_type = 'rail_arrived') AS done_rail_arrived,
  bool_or(e.event_type = 'delivery_arrived') AS done_delivery_arrived,
  bool_or(e.event_type = 'signed') AS done_signed,
  max(e.occurred_at) AS last_event_at
FROM tielu.rail_container c
JOIN tielu.rail_waybill w ON w.id = c.waybill_id
LEFT JOIN tielu.shipment_batch b ON b.id = w.batch_id
LEFT JOIN tielu.logistics_event e ON e.container_id = c.id
GROUP BY c.id, c.box_no, c.weight_kg, w.ticket_no, w.order_id, b.order_id;

COMMENT ON VIEW tielu.v_container_flow_status IS '按箱看收发节点是否已发生';
