-- 甲方万吨委托 + 两天发运示意（计划 10000 吨、日计划 1200；示例只写入两天各 64 吨便于看结构）
-- 须已执行 create_multimodal_schema.sql、create_order_flow.sql

INSERT INTO tielu.customer_order (
  id, order_no, party_a, cargo_name, plan_weight_t, daily_plan_weight_t,
  origin_place, dest_place, plan_start_date, plan_end_date, status, remark
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  '甲方2024-001',
  '湖南网岭伍零贰饲料有限责任公司',
  '糙米',
  10000,
  1200,
  '佳木斯',
  '网岭',
  '2024-01-03',
  '2024-01-12',
  'executing',
  '约 9 个发运日；本示例仅演示头两天记账结构'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tielu.order_day (id, order_id, biz_date, plan_weight_t)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '2024-01-03', 1200),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '2024-01-04', 1200)
ON CONFLICT (id) DO NOTHING;

SELECT tielu.log_flow_event(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'order_opened',
  'outbound',
  '2024-01-02 10:00+08',
  '甲方合同',
  10000,
  NULL, NULL, NULL, NULL,
  NULL, NULL, NULL,
  '商务',
  NULL,
  '计划总量1万吨，日均约1200吨火车'
);
