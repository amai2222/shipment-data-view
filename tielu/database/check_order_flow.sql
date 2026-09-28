-- 甲方委托/执行日/收发流水检查（一条命令执行，仅一张结果表）
-- 复制整个文件内容到 SQL 客户端一次性执行
-- 须已执行 create_order_flow.sql

WITH expected AS (
  SELECT unnest(ARRAY['customer_order', 'order_day', 'logistics_event']) AS table_name
),
present AS (
  SELECT c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'tielu' AND c.relkind = 'r'
),
expected_views AS (
  SELECT unnest(ARRAY[
    'v_order_progress', 'v_order_daily_progress', 'v_order_timeline', 'v_container_flow_status'
  ]) AS view_name
),
present_views AS (
  SELECT c.relname AS view_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'tielu' AND c.relkind = 'v'
),
report AS (
  SELECT 10 AS sort_key, '1-表' AS section, e.table_name AS metric,
         CASE WHEN p.table_name IS NOT NULL THEN '已建' ELSE '缺失' END AS value,
         CASE WHEN p.table_name IS NOT NULL THEN 'OK' ELSE 'FAIL' END AS status,
         'tielu.' || e.table_name AS detail
  FROM expected e
  LEFT JOIN present p ON p.table_name = e.table_name
  UNION ALL
  SELECT 20 + row_number() OVER (ORDER BY e.view_name),
         '2-视图', e.view_name,
         CASE WHEN p.view_name IS NOT NULL THEN '已建' ELSE '缺失' END,
         CASE WHEN p.view_name IS NOT NULL THEN 'OK' ELSE 'FAIL' END,
         'tielu.' || e.view_name
  FROM expected_views e
  LEFT JOIN present_views p ON p.view_name = e.view_name
  UNION ALL
  SELECT 40, '3-函数', 'log_flow_event',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc pr
           JOIN pg_namespace n ON n.oid = pr.pronamespace
           WHERE n.nspname = 'tielu' AND pr.proname = 'log_flow_event'
         ) THEN '已建' ELSE '缺失' END,
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc pr
           JOIN pg_namespace n ON n.oid = pr.pronamespace
           WHERE n.nspname = 'tielu' AND pr.proname = 'log_flow_event'
         ) THEN 'OK' ELSE 'FAIL' END,
         '写收发流水'
  UNION ALL
  SELECT 50, '4-数据', '委托笔数',
         (SELECT count(*)::text FROM tielu.customer_order),
         'OK',
         '万吨级合同'
  UNION ALL
  SELECT 51, '4-数据', '执行日行数',
         (SELECT count(*)::text FROM tielu.order_day),
         'OK',
         '每天火车一行计划'
  UNION ALL
  SELECT 52, '4-数据', '流水行数',
         (SELECT count(*)::text FROM tielu.logistics_event),
         'OK',
         '收发动作'
)
SELECT section, metric, value, status, detail
FROM report
ORDER BY sort_key;
