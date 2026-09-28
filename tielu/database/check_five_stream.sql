-- 五流合一表结构检查（一条命令执行，仅一张结果表）
-- 复制整个文件内容到 SQL 客户端一次性执行
-- 须已执行 create_five_stream.sql

WITH expected AS (
  SELECT unnest(ARRAY[
    'cargo_owner', 'shipping_order', 'shipping_order_line', 'shipping_fulfillment',
    'doc_record', 'fin_ar', 'fin_ap', 'fin_payment', 'fin_match'
  ]) AS table_name
),
present AS (
  SELECT c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'tielu' AND c.relkind = 'r'
),
expected_views AS (
  SELECT unnest(ARRAY['v_cargo_box_journey', 'v_shipping_order_progress']) AS view_name
),
present_views AS (
  SELECT c.relname AS view_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'tielu' AND c.relkind = 'v'
),
report AS (
  SELECT 10 + row_number() OVER (ORDER BY e.table_name) AS sort_key,
         '1-表' AS section, e.table_name AS metric,
         CASE WHEN p.table_name IS NOT NULL THEN '已建' ELSE '缺失' END AS value,
         CASE WHEN p.table_name IS NOT NULL THEN 'OK' ELSE 'FAIL' END AS status,
         'tielu.' || e.table_name AS detail
  FROM expected e
  LEFT JOIN present p ON p.table_name = e.table_name
  UNION ALL
  SELECT 30 + row_number() OVER (ORDER BY e.view_name),
         '2-视图', e.view_name,
         CASE WHEN p.view_name IS NOT NULL THEN '已建' ELSE '缺失' END,
         CASE WHEN p.view_name IS NOT NULL THEN 'OK' ELSE 'FAIL' END,
         'tielu.' || e.view_name
  FROM expected_views e
  LEFT JOIN present_views p ON p.view_name = e.view_name
  UNION ALL
  SELECT 50, '3-数据', '货主数',
         (SELECT count(*)::text FROM tielu.cargo_owner),
         'OK', '商流主体'
  UNION ALL
  SELECT 51, '3-数据', '发货指令数',
         (SELECT count(*)::text FROM tielu.shipping_order),
         'OK', '货主发货'
  UNION ALL
  SELECT 52, '3-数据', '已签收箱次数',
         (SELECT count(*)::text FROM tielu.shipping_fulfillment WHERE status = 'received'),
         'OK', '货主货已收到'
)
SELECT section, metric, value, status, detail
FROM report
ORDER BY sort_key;
