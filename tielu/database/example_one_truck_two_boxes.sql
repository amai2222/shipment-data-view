-- 示例：一张运单两个箱，一辆汽车一趟拉完（一车两箱）
-- 依赖已执行 create_multimodal_schema.sql
-- 可重复执行：按业务键 upsert

INSERT INTO tielu.shipment_batch (id, batch_no, name, cargo_owner, origin_station, dest_station, ship_date, status)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'HB242902e',
  '1.03丰运网岭6车（示例仅1票）',
  '湖南网岭伍零贰饲料有限责任公司',
  '佳木斯（哈）',
  '网岭（广）',
  '2024-01-03',
  'in_transit'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tielu.rail_waybill (
  id, batch_id, ticket_no, demand_no, bureau, transport_type, issue_date,
  from_station, to_station, shipper, consignee, pieces_total, weight_kg,
  charged_weight_kg, freight_amt, total_fee, source_file, source_page, ocr_method
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'JMBJG0088173',
  '604522312283124414',
  '中国铁路哈尔滨局集团有限公司',
  '集装箱',
  '2024-01-03',
  '佳木斯（哈）',
  '网岭（广）',
  '佳木斯鸿发陆港供应链管理有限公司',
  '株洲市双通物流有限公司',
  2, 64000, 64000, 21496.15, 23632,
  '1.03丰运网岭6车(1).pdf', 1, 'text'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tielu.rail_container (id, waybill_id, batch_id, box_no, cargo_name, pieces, weight_kg, box_type, rate_no)
VALUES
  (
    '33333333-3333-3333-3333-333333333331',
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'TBJU0916473', '糙米', 1, 32000, '20’35吨敞顶箱', '4'
  ),
  (
    '33333333-3333-3333-3333-333333333332',
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'TBJU0523286', '糙米', 1, 32000, '20’35吨敞顶箱', '4'
  )
ON CONFLICT (id) DO NOTHING;

-- 一趟车（到站配送），公路运费只记一笔
INSERT INTO tielu.truck_trip (
  id, batch_id, plate_no, driver_name, driver_phone, leg,
  from_place, to_place, depart_at, freight_amt, status, remark
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '湘A12345',
  '张三',
  '13800000000',
  'delivery',
  '网岭站',
  '湖南网岭伍零贰饲料',
  '2024-01-20 08:00+08',
  3500.00,
  'done',
  '一车两箱示例'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tielu.container_truck (container_id, trip_id, leg, load_order, status)
VALUES
  ('33333333-3333-3333-3333-333333333331', '44444444-4444-4444-4444-444444444444', 'delivery', 1, 'active'),
  ('33333333-3333-3333-3333-333333333332', '44444444-4444-4444-4444-444444444444', 'delivery', 2, 'active')
ON CONFLICT DO NOTHING;
