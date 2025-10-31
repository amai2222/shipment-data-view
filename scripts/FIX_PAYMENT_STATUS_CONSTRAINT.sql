-- 修复payment_status字段的check约束，添加Approved值

BEGIN;

-- 查看现有的check约束
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'logistics_records'
  AND conname LIKE '%payment%';

-- 删除旧的payment_status check约束（如果存在）
ALTER TABLE logistics_records 
DROP CONSTRAINT IF EXISTS payment_status_check;

ALTER TABLE logistics_records 
DROP CONSTRAINT IF EXISTS logistics_records_payment_status_check;

-- 创建新的check约束，包含Approved状态
ALTER TABLE logistics_records
ADD CONSTRAINT payment_status_check 
CHECK (payment_status IN ('Unpaid', 'Processing', 'Approved', 'Paid'));

-- 同样修改logistics_partner_costs表的约束
ALTER TABLE logistics_partner_costs 
DROP CONSTRAINT IF EXISTS payment_status_check;

ALTER TABLE logistics_partner_costs 
DROP CONSTRAINT IF EXISTS logistics_partner_costs_payment_status_check;

ALTER TABLE logistics_partner_costs
ADD CONSTRAINT payment_status_check 
CHECK (payment_status IN ('Unpaid', 'Processing', 'Approved', 'Paid'));

COMMIT;

SELECT '约束已更新，现在支持Approved状态' as message;

