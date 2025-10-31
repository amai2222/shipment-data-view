-- ============================================================================
-- 删除旧的开票约束（立即修复审批报错）
-- ============================================================================

-- 删除logistics_records表的旧约束
ALTER TABLE public.logistics_records 
DROP CONSTRAINT IF EXISTS logistics_records_invoice_status_check;

-- 删除logistics_partner_costs表的旧约束
ALTER TABLE public.logistics_partner_costs 
DROP CONSTRAINT IF EXISTS logistics_partner_costs_invoice_status_check;

-- 验证结果（应该只剩包含Approved的新约束）
SELECT 
    conrelid::regclass as 表名,
    conname as 约束名,
    pg_get_constraintdef(oid) as 约束定义
FROM pg_constraint 
WHERE (conrelid = 'public.logistics_records'::regclass 
       OR conrelid = 'public.logistics_partner_costs'::regclass)
  AND conname LIKE '%invoice_status%'
ORDER BY conrelid::regclass::text, conname;

-- 完成提示
DO $$ 
BEGIN
    RAISE NOTICE '✅ 旧约束已删除！';
    RAISE NOTICE '✅ 现在只有包含Approved状态的新约束！';
    RAISE NOTICE '';
    RAISE NOTICE '请刷新前端页面并重新测试审批功能！';
END $$;

