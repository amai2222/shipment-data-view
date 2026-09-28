-- 篷布表结构检查（一条命令执行，仅一张结果表）
-- 复制整个文件内容到 SQL 客户端一次性执行
-- 须已执行 create_tarpaulin.sql

WITH expected AS (
  SELECT unnest(ARRAY['tarpaulin', 'tarpaulin_use', 'tarpaulin_ledger']) AS table_name
),
present AS (
  SELECT c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'tielu' AND c.relkind = 'r'
),
report AS (
  SELECT 10 AS sort_key, '1-表' AS section, e.table_name AS metric,
         CASE WHEN p.table_name IS NOT NULL THEN '已建' ELSE '缺失' END AS value,
         CASE WHEN p.table_name IS NOT NULL THEN 'OK' ELSE 'FAIL' END AS status,
         'tielu.' || e.table_name AS detail
  FROM expected e
  LEFT JOIN present p ON p.table_name = e.table_name
  UNION ALL
  SELECT 20, '2-视图', 'v_tarpaulin_now',
         CASE WHEN to_regclass('tielu.v_tarpaulin_now') IS NOT NULL THEN '已建' ELSE '缺失' END,
         CASE WHEN to_regclass('tielu.v_tarpaulin_now') IS NOT NULL THEN 'OK' ELSE 'FAIL' END,
         '当前在用篷布'
  UNION ALL
  SELECT 21, '2-函数', 'register_tarps_from_waybill',
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc pr
           JOIN pg_namespace n ON n.oid = pr.pronamespace
           WHERE n.nspname = 'tielu' AND pr.proname = 'register_tarps_from_waybill'
         ) THEN '已建' ELSE '缺失' END,
         CASE WHEN EXISTS (
           SELECT 1 FROM pg_proc pr
           JOIN pg_namespace n ON n.oid = pr.pronamespace
           WHERE n.nspname = 'tielu' AND pr.proname = 'register_tarps_from_waybill'
         ) THEN 'OK' ELSE 'FAIL' END,
         '按运单篷布号建档挂票'
  UNION ALL
  SELECT 30, '3-数据', '篷布档案数',
         (SELECT count(*)::text FROM tielu.tarpaulin),
         'OK',
         '一块布一行'
  UNION ALL
  SELECT 31, '3-数据', '在用挂票数',
         (SELECT count(*)::text FROM tielu.tarpaulin_use WHERE status = 'active'),
         'OK',
         '未收回'
)
SELECT section, metric, value, status, detail
FROM report
ORDER BY sort_key;
