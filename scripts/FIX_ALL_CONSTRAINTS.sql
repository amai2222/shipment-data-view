-- 完整修复所有payment_status约束

BEGIN;

-- logistics_records表
ALTER TABLE logistics_records 
DROP CONSTRAINT IF EXISTS payment_status_check;

ALTER TABLE logistics_records 
DROP CONSTRAINT IF EXISTS logistics_records_payment_status_check;

ALTER TABLE logistics_records
ADD CONSTRAINT logistics_records_payment_status_check 
CHECK (payment_status IN ('Unpaid', 'Processing', 'Approved', 'Paid'));

-- logistics_partner_costs表
ALTER TABLE logistics_partner_costs 
DROP CONSTRAINT IF EXISTS payment_status_check;

ALTER TABLE logistics_partner_costs 
DROP CONSTRAINT IF EXISTS logistics_partner_costs_payment_status_check;

ALTER TABLE logistics_partner_costs
ADD CONSTRAINT logistics_partner_costs_payment_status_check 
CHECK (payment_status IN ('Unpaid', 'Processing', 'Approved', 'Paid'));

COMMIT;

SELECT '所有约束已更新，支持Approved状态' as message;

