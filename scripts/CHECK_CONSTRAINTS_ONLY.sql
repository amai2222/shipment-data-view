-- 只检查约束
SELECT 
    'logistics_records' as table_name,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.logistics_records'::regclass
  AND (conname LIKE '%invoice_status%' OR pg_get_constraintdef(oid) LIKE '%invoice_status%')

UNION ALL

SELECT 
    'logistics_partner_costs' as table_name,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.logistics_partner_costs'::regclass
  AND (conname LIKE '%invoice_status%' OR pg_get_constraintdef(oid) LIKE '%invoice_status%');

