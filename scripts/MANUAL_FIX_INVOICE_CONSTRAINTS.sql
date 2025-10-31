-- ============================================================================
-- 手动修复开票约束（如果自动脚本失败）
-- ============================================================================
-- 
-- 说明：如果自动脚本没有成功更新约束，使用此脚本手动修复
-- 
-- ============================================================================

-- 第一步：查找并删除所有invoice_status相关的旧约束

-- 删除logistics_records表的所有invoice_status约束
DO $$ 
DECLARE
    constraint_name TEXT;
BEGIN
    -- 查找所有相关约束
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.logistics_records'::regclass
          AND (conname LIKE '%invoice_status%' OR pg_get_constraintdef(oid) LIKE '%invoice_status%')
    LOOP
        EXECUTE format('ALTER TABLE public.logistics_records DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE '删除约束: %', constraint_name;
    END LOOP;
END $$;

-- 删除logistics_partner_costs表的所有invoice_status约束
DO $$ 
DECLARE
    constraint_name TEXT;
BEGIN
    -- 查找所有相关约束
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.logistics_partner_costs'::regclass
          AND (conname LIKE '%invoice_status%' OR pg_get_constraintdef(oid) LIKE '%invoice_status%')
    LOOP
        EXECUTE format('ALTER TABLE public.logistics_partner_costs DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE '删除约束: %', constraint_name;
    END LOOP;
END $$;

-- 第二步：添加新的约束（包含Approved状态）

-- 为logistics_records添加新约束
ALTER TABLE public.logistics_records 
ADD CONSTRAINT ck_logistics_records_invoice_status 
CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Approved', 'Invoiced'));

-- 为logistics_partner_costs添加新约束
ALTER TABLE public.logistics_partner_costs 
ADD CONSTRAINT ck_logistics_partner_costs_invoice_status 
CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Approved', 'Invoiced'));

-- 第三步：验证
SELECT 
    'logistics_records' as table_name,
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.logistics_records'::regclass
  AND conname = 'ck_logistics_records_invoice_status'

UNION ALL

SELECT 
    'logistics_partner_costs' as table_name,
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'public.logistics_partner_costs'::regclass
  AND conname = 'ck_logistics_partner_costs_invoice_status';

-- 完成提示
DO $$ 
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE '✅ 约束修复完成！';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'logistics_records.invoice_status 现在支持:';
    RAISE NOTICE '  - Uninvoiced (未开票)';
    RAISE NOTICE '  - Processing (已申请开票)';
    RAISE NOTICE '  - Approved (开票审核通过) ← 新增';
    RAISE NOTICE '  - Invoiced (已开票)';
    RAISE NOTICE '';
    RAISE NOTICE '请刷新前端页面并重新测试！';
    RAISE NOTICE '============================================================';
END $$;

