-- 多式联运库结构检查（一条命令执行，仅一张结果表）
-- 复制整个文件内容到 SQL 客户端一次性执行

WITH expected_tables AS (
  SELECT unnest(ARRAY[
    'shipment_batch', 'truck_vehicle', 'driver', 'rail_waybill',
    'rail_container', 'truck_trip', 'container_truck', 'ocr_import'
  ]) AS table_name
),
present_tables AS (
  SELECT c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'tielu' AND c.relkind = 'r'
),
expected_views AS (
  SELECT unnest(ARRAY[
    'v_container_multimodal', 'v_trip_with_boxes', 'v_batch_cost'
  ]) AS view_name
),
present_views AS (
  SELECT c.relname AS view_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'tielu' AND c.relkind = 'v'
),
idx AS (
  SELECT indexname
  FROM pg_indexes
  WHERE schemaname = 'tielu'
),
report AS (
  SELECT 10 AS sort_key, '1-结构' AS section, 'schema tielu' AS metric,
         CASE WHEN EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'tielu')
              THEN '存在' ELSE '不存在' END AS value,
         CASE WHEN EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'tielu')
              THEN 'OK' ELSE 'FAIL' END AS status,
         'create_multimodal_schema.sql 会创建该 schema' AS detail
  UNION ALL
  SELECT 20 + row_number() OVER (ORDER BY e.table_name),
         '2-表',
         e.table_name,
         CASE WHEN p.table_name IS NOT NULL THEN '已建' ELSE '缺失' END,
         CASE WHEN p.table_name IS NOT NULL THEN 'OK' ELSE 'FAIL' END,
         'tielu.' || e.table_name
  FROM expected_tables e
  LEFT JOIN present_tables p ON p.table_name = e.table_name
  UNION ALL
  SELECT 40 + row_number() OVER (ORDER BY e.view_name),
         '3-视图',
         e.view_name,
         CASE WHEN p.view_name IS NOT NULL THEN '已建' ELSE '缺失' END,
         CASE WHEN p.view_name IS NOT NULL THEN 'OK' ELSE 'FAIL' END,
         'tielu.' || e.view_name
  FROM expected_views e
  LEFT JOIN present_views p ON p.view_name = e.view_name
  UNION ALL
  SELECT 60, '4-唯一约束', 'uq_tielu_waybill_ticket',
         CASE WHEN EXISTS (SELECT 1 FROM idx WHERE indexname = 'uq_tielu_waybill_ticket')
              THEN '存在' ELSE '缺失' END,
         CASE WHEN EXISTS (SELECT 1 FROM idx WHERE indexname = 'uq_tielu_waybill_ticket')
              THEN 'OK' ELSE 'FAIL' END,
         '运单号全局唯一'
  UNION ALL
  SELECT 61, '4-唯一约束', 'uq_tielu_box_leg_active',
         CASE WHEN EXISTS (SELECT 1 FROM idx WHERE indexname = 'uq_tielu_box_leg_active')
              THEN '存在' ELSE '缺失' END,
         CASE WHEN EXISTS (SELECT 1 FROM idx WHERE indexname = 'uq_tielu_box_leg_active')
              THEN 'OK' ELSE 'FAIL' END,
         '同一箱同一路段仅一趟有效车'
  UNION ALL
  SELECT 70, '5-数据量', '运单行数',
         (SELECT count(*)::text FROM tielu.rail_waybill),
         'OK',
         'OCR 导入后应 > 0'
  UNION ALL
  SELECT 71, '5-数据量', '箱行数',
         (SELECT count(*)::text FROM tielu.rail_container),
         'OK',
         '明细按箱拆分'
  UNION ALL
  SELECT 72, '5-数据量', '趟次行数',
         (SELECT count(*)::text FROM tielu.truck_trip),
         'OK',
         '公路派车后写入'
  UNION ALL
  SELECT 80, '6-一车两箱', '有效关系中同趟箱数>1的趟次数',
         coalesce((
           SELECT count(*)::text FROM (
             SELECT trip_id
             FROM tielu.container_truck
             WHERE status = 'active'
             GROUP BY trip_id
             HAVING count(*) > 1
           ) x
         ), '0'),
         'OK',
         '大于 0 表示已存在一车多箱'
)
SELECT section, metric, value, status, detail
FROM report
ORDER BY sort_key;
