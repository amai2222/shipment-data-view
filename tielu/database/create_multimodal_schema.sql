-- =============================================================================
-- 多式联运核心库（铁路货物运单 + 集装箱 + 公路趟次）
-- PostgreSQL 14+ / Supabase
-- 整文件可一次性执行（DDL，非检查类）
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS tielu;

COMMENT ON SCHEMA tielu IS '铁路大票/多式联运：批次、运单、箱、汽车趟次';

-- -----------------------------------------------------------------------------
-- 1. 批次：一票多式联运（如「1.03丰运网岭6车」）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tielu.shipment_batch (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid,                          -- 甲方委托，见 create_order_flow.sql
  batch_no          text,                          -- 一口价号/客户委托号，如 HB242902e
  name              text NOT NULL,                 -- 业务称呼，如 1.03丰运网岭6车
  cargo_owner       text,                          -- 货权人（记事中的实际货主）
  origin_station    text,
  dest_station      text,
  ship_date         date,
  status            text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_transit', 'completed', 'cancelled')),
  remark            text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.shipment_batch IS '多式联运批次：只做分组收口，不直接绑车牌';
COMMENT ON COLUMN tielu.shipment_batch.batch_no IS '一口价号或委托号；可空，空时用 name+日期区分';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_batch_no
  ON tielu.shipment_batch (batch_no)
  WHERE batch_no IS NOT NULL AND btrim(batch_no) <> '';

CREATE INDEX IF NOT EXISTS idx_tielu_batch_ship_date
  ON tielu.shipment_batch (ship_date);

-- -----------------------------------------------------------------------------
-- 2. 车辆档案（可选，趟次可只写车牌）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tielu.truck_vehicle (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_no          text NOT NULL,
  axle_desc         text,                          -- 如 17.5米、6轴
  fleet_name        text,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.truck_vehicle IS '车辆档案；趟次优先引用 vehicle_id，否则用 plate_no 快照';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_vehicle_plate
  ON tielu.truck_vehicle (plate_no);

-- -----------------------------------------------------------------------------
-- 3. 司机档案（可选）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tielu.driver (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  phone             text,
  id_no             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tielu_driver_phone ON tielu.driver (phone);

-- -----------------------------------------------------------------------------
-- 4. 铁路货物运单（OCR 汇总表一行）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tielu.rail_waybill (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            uuid REFERENCES tielu.shipment_batch (id) ON DELETE SET NULL,
  ticket_no           text NOT NULL,               -- JMBJG0088173
  demand_no           text,                        -- 95306 需求号
  bureau              text,
  transport_type      text,                        -- 集装箱
  issue_date          date,
  ship_date           date,
  from_station        text,
  to_station          text,
  via_route           text,
  shipper             text,
  shipper_agent       text,
  shipper_mobile      text,
  consignee           text,
  consignee_agent     text,
  consignee_mobile    text,
  deliver_days        integer,
  marked_weight       numeric(14, 3),
  loader              text,
  sealer              text,
  pay_method          text,
  pickup_method       text,
  cargo_name          text,
  cargo_detail        text,
  package_type        text,
  pieces_total        numeric(14, 3),
  weight_kg           numeric(14, 3),
  charged_weight_kg   numeric(14, 3),
  box_type            text,
  freight_amt         numeric(14, 2),
  freight_tax         numeric(14, 2),
  stamp_tax           numeric(14, 2),
  station_load_fee    numeric(14, 2),
  insurance_amt       numeric(14, 2),
  total_fee           numeric(14, 2),
  total_fee_cn        text,
  invoice_type        text,
  invoice_title       text,
  tax_id              text,
  invoice_address     text,
  bank_account        text,
  shipper_notes       text,
  carrier_notes       text,
  maker               text,
  tarpaulin_nos       text,                        -- 篷布号顿号拼接
  source_file         text,                        -- PDF 文件名
  source_page         integer,
  ocr_method          text,                        -- text / ocr
  raw_json            jsonb,                       -- 整页解析字段备份
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.rail_waybill IS '铁路货物运单；费用按票结算，不在此表写车牌';
COMMENT ON COLUMN tielu.rail_waybill.ticket_no IS '运单号，全局唯一';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_waybill_ticket
  ON tielu.rail_waybill (ticket_no);

CREATE INDEX IF NOT EXISTS idx_tielu_waybill_batch
  ON tielu.rail_waybill (batch_id);

CREATE INDEX IF NOT EXISTS idx_tielu_waybill_demand
  ON tielu.rail_waybill (demand_no);

CREATE INDEX IF NOT EXISTS idx_tielu_waybill_stations
  ON tielu.rail_waybill (from_station, to_station, issue_date);

-- -----------------------------------------------------------------------------
-- 5. 集装箱（OCR 明细一行；铁公对货主键）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tielu.rail_container (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waybill_id          uuid NOT NULL REFERENCES tielu.rail_waybill (id) ON DELETE CASCADE,
  batch_id            uuid REFERENCES tielu.shipment_batch (id) ON DELETE SET NULL,
  box_no              text NOT NULL,               -- TBJU0916473
  cargo_name          text,
  pieces              numeric(14, 3),
  weight_kg           numeric(14, 3),
  confirmed_weight_kg numeric(14, 3),
  box_type            text,
  rate_no             text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.rail_container IS '集装箱实物；汽车通过 container_truck 关联到本表';
COMMENT ON COLUMN tielu.rail_container.box_no IS '箱号。同一批次内唯一；在途全局避免重复用应用层校验';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_container_box_in_batch
  ON tielu.rail_container (batch_id, box_no)
  WHERE batch_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_container_box_waybill
  ON tielu.rail_container (waybill_id, box_no);

CREATE INDEX IF NOT EXISTS idx_tielu_container_box_no
  ON tielu.rail_container (box_no);

CREATE INDEX IF NOT EXISTS idx_tielu_container_waybill
  ON tielu.rail_container (waybill_id);

-- -----------------------------------------------------------------------------
-- 6. 公路趟次：一辆车跑的一趟（一车两箱只占一行）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tielu.truck_trip (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              uuid REFERENCES tielu.shipment_batch (id) ON DELETE SET NULL,
  vehicle_id            uuid REFERENCES tielu.truck_vehicle (id) ON DELETE SET NULL,
  driver_id             uuid REFERENCES tielu.driver (id) ON DELETE SET NULL,
  plate_no              text NOT NULL,             -- 快照，即使未建车辆档案也能记
  driver_name           text,
  driver_phone          text,
  leg                   text NOT NULL
                        CHECK (leg IN ('pickup', 'delivery', 'highway')),
  -- pickup=发站短驳  delivery=到站配送  highway=纯公路段
  highway_waybill_no    text,                      -- 公路运单/派车单号
  from_place            text,
  to_place              text,
  depart_at             timestamptz,
  arrive_at             timestamptz,
  freight_amt           numeric(14, 2),            -- 本趟公路运费（两箱不拆两份）
  toll_amt              numeric(14, 2),
  other_amt             numeric(14, 2),
  status                text NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'running', 'done', 'cancelled')),
  source_file           text,
  raw_json              jsonb,
  remark                text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.truck_trip IS '汽车一趟：公路费用记在这里；箱数通过关系表体现';
COMMENT ON COLUMN tielu.truck_trip.leg IS 'pickup发站短驳 / delivery到站配送 / highway公路干线';
COMMENT ON COLUMN tielu.truck_trip.freight_amt IS '整车一笔运费；一车两箱不要复制为两行趟次';

CREATE INDEX IF NOT EXISTS idx_tielu_trip_plate_time
  ON tielu.truck_trip (plate_no, depart_at);

CREATE INDEX IF NOT EXISTS idx_tielu_trip_batch
  ON tielu.truck_trip (batch_id);

CREATE INDEX IF NOT EXISTS idx_tielu_trip_leg
  ON tielu.truck_trip (leg, status);

-- -----------------------------------------------------------------------------
-- 7. 箱-车关系：一车两箱 = 同一 trip_id 两行
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tielu.container_truck (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id      uuid NOT NULL REFERENCES tielu.rail_container (id) ON DELETE CASCADE,
  trip_id           uuid NOT NULL REFERENCES tielu.truck_trip (id) ON DELETE CASCADE,
  leg               text NOT NULL
                    CHECK (leg IN ('pickup', 'delivery', 'highway')),
  load_order        smallint,                      -- 本趟装载顺序（1、2、3…，不限两个）
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'replaced', 'cancelled')),
  remark            text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tielu.container_truck IS '箱与汽车趟次多对多；一车两箱=两行同 trip_id';
COMMENT ON COLUMN tielu.container_truck.status IS 'active有效；replaced半路换车后旧行置此状态';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_box_leg_active
  ON tielu.container_truck (container_id, leg)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tielu_trip_container
  ON tielu.container_truck (trip_id, container_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_tielu_ct_trip
  ON tielu.container_truck (trip_id);

CREATE INDEX IF NOT EXISTS idx_tielu_ct_container
  ON tielu.container_truck (container_id);

-- 趟次与关系上的路段必须一致（用触发器保证）
CREATE OR REPLACE FUNCTION tielu.trg_container_truck_leg_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  trip_leg text;
BEGIN
  SELECT t.leg INTO trip_leg FROM tielu.truck_trip t WHERE t.id = NEW.trip_id;
  IF trip_leg IS NULL THEN
    RAISE EXCEPTION '趟次不存在: %', NEW.trip_id;
  END IF;
  IF NEW.leg IS DISTINCT FROM trip_leg THEN
    RAISE EXCEPTION 'container_truck.leg(%) 必须与 truck_trip.leg(%) 一致', NEW.leg, trip_leg;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ct_leg_match ON tielu.container_truck;
CREATE TRIGGER trg_ct_leg_match
  BEFORE INSERT OR UPDATE OF trip_id, leg
  ON tielu.container_truck
  FOR EACH ROW
  EXECUTE PROCEDURE tielu.trg_container_truck_leg_match();

COMMENT ON FUNCTION tielu.trg_container_truck_leg_match() IS '禁止短驳关系挂到配送趟次上';

-- 一趟可挂任意多个箱（发端/收端各自一车多箱）。若库是旧版带 2 箱限制，这里去掉。
DROP TRIGGER IF EXISTS trg_trip_box_count ON tielu.container_truck;
DROP FUNCTION IF EXISTS tielu.trg_trip_box_count();

-- -----------------------------------------------------------------------------
-- 8. OCR 导入日志（可选，追溯文件）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tielu.ocr_import (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file       text NOT NULL,
  imported_at       timestamptz NOT NULL DEFAULT now(),
  waybill_count     integer,
  container_count   integer,
  remark            text
);

-- -----------------------------------------------------------------------------
-- 常用视图
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW tielu.v_container_multimodal AS
SELECT
  b.id AS batch_id,
  b.batch_no,
  b.name AS batch_name,
  w.id AS waybill_id,
  w.ticket_no,
  w.demand_no,
  w.from_station,
  w.to_station,
  w.issue_date,
  w.freight_amt AS rail_freight,
  w.total_fee AS rail_total_fee,
  c.id AS container_id,
  c.box_no,
  c.cargo_name,
  c.weight_kg,
  c.box_type,
  ct.leg,
  ct.status AS link_status,
  tr.id AS trip_id,
  tr.plate_no,
  tr.driver_name,
  tr.freight_amt AS truck_freight,
  tr.highway_waybill_no
FROM tielu.rail_container c
JOIN tielu.rail_waybill w ON w.id = c.waybill_id
LEFT JOIN tielu.shipment_batch b ON b.id = coalesce(c.batch_id, w.batch_id)
LEFT JOIN tielu.container_truck ct ON ct.container_id = c.id AND ct.status = 'active'
LEFT JOIN tielu.truck_trip tr ON tr.id = ct.trip_id;

COMMENT ON VIEW tielu.v_container_multimodal IS '一箱一行：铁路票面 + 当前有效汽车（无车则为空）';

CREATE OR REPLACE VIEW tielu.v_trip_with_boxes AS
SELECT
  tr.id AS trip_id,
  tr.plate_no,
  tr.leg,
  tr.depart_at,
  tr.freight_amt,
  tr.status AS trip_status,
  count(ct.id) FILTER (WHERE ct.status = 'active') AS box_count,
  string_agg(c.box_no, '、' ORDER BY ct.load_order, c.box_no)
    FILTER (WHERE ct.status = 'active') AS box_nos
FROM tielu.truck_trip tr
LEFT JOIN tielu.container_truck ct ON ct.trip_id = tr.id
LEFT JOIN tielu.rail_container c ON c.id = ct.container_id
GROUP BY tr.id;

COMMENT ON VIEW tielu.v_trip_with_boxes IS '一趟一行：箱数与箱号列表；发端/收端均可一车多箱';

CREATE OR REPLACE VIEW tielu.v_batch_cost AS
SELECT
  b.id AS batch_id,
  b.batch_no,
  b.name,
  (SELECT count(*) FROM tielu.rail_waybill w WHERE w.batch_id = b.id) AS waybill_count,
  (SELECT count(*) FROM tielu.rail_container c WHERE c.batch_id = b.id) AS container_count,
  (SELECT count(*) FROM tielu.truck_trip t WHERE t.batch_id = b.id AND t.status <> 'cancelled') AS trip_count,
  coalesce((SELECT sum(w.total_fee) FROM tielu.rail_waybill w WHERE w.batch_id = b.id), 0) AS rail_fee_sum,
  coalesce((SELECT sum(t.freight_amt) FROM tielu.truck_trip t WHERE t.batch_id = b.id AND t.status <> 'cancelled'), 0) AS truck_fee_sum
FROM tielu.shipment_batch b;

COMMENT ON VIEW tielu.v_batch_cost IS '批次费用：铁路按运单合计 + 公路按趟次合计（不按箱拆公路实付）';
