-- ============================================================
-- 修复 logistics_partner_costs 表的外键约束
-- ============================================================
-- 问题：当删除 invoice_requests 或 payment_requests 记录时，
--       由于外键约束没有设置 ON DELETE 行为，导致无法删除被引用的记录
-- 解决：删除旧的外键约束，添加新的外键约束并设置 ON DELETE SET NULL
-- ============================================================

BEGIN;

-- 1. 查找并删除 invoice_request_id 的旧外键约束
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- 查找 logistics_partner_costs 表中引用 invoice_requests 的外键约束名称
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'logistics_partner_costs'
        AND kcu.column_name = 'invoice_request_id'
        AND ccu.table_name = 'invoice_requests'
    LIMIT 1;

    -- 如果找到了外键约束，删除它
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.logistics_partner_costs DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE '已删除 invoice_request_id 的旧外键约束: %', constraint_name;
    ELSE
        RAISE NOTICE 'invoice_request_id 未找到需要删除的外键约束';
    END IF;
END $$;

-- 2. 清理无效的 invoice_request_id 引用
-- 将引用不存在记录的 invoice_request_id 设为 NULL
UPDATE public.logistics_partner_costs
SET invoice_request_id = NULL
WHERE invoice_request_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.invoice_requests 
    WHERE id = logistics_partner_costs.invoice_request_id
  );

-- 3. 添加 invoice_request_id 的新外键约束，设置 ON DELETE SET NULL
-- 当删除 invoice_requests 记录时，将 logistics_partner_costs 中的 invoice_request_id 设为 NULL
ALTER TABLE public.logistics_partner_costs
ADD CONSTRAINT fk_logistics_partner_costs_invoice_request_id 
FOREIGN KEY (invoice_request_id) 
REFERENCES public.invoice_requests(id) 
ON DELETE SET NULL;

-- 4. 清理无效的 payment_request_id 引用
-- 将引用不存在记录的 payment_request_id 设为 NULL
UPDATE public.logistics_partner_costs
SET payment_request_id = NULL
WHERE payment_request_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_requests 
    WHERE id = logistics_partner_costs.payment_request_id
  );

-- 5. 为 payment_request_id 添加外键约束（如果还没有的话）
-- 首先删除可能存在的旧约束
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- 查找 logistics_partner_costs 表中引用 payment_requests 的外键约束名称
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'logistics_partner_costs'
        AND kcu.column_name = 'payment_request_id'
        AND ccu.table_name = 'payment_requests'
    LIMIT 1;

    -- 如果找到了外键约束，删除它
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.logistics_partner_costs DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE '已删除 payment_request_id 的旧外键约束: %', constraint_name;
    ELSE
        RAISE NOTICE 'payment_request_id 未找到需要删除的外键约束';
    END IF;
END $$;

-- 6. 添加 payment_request_id 的外键约束，设置 ON DELETE SET NULL
-- 当删除 payment_requests 记录时，将 logistics_partner_costs 中的 payment_request_id 设为 NULL
ALTER TABLE public.logistics_partner_costs
ADD CONSTRAINT fk_logistics_partner_costs_payment_request_id 
FOREIGN KEY (payment_request_id) 
REFERENCES public.payment_requests(id) 
ON DELETE SET NULL;

-- 7. 添加注释
COMMENT ON CONSTRAINT fk_logistics_partner_costs_invoice_request_id 
ON public.logistics_partner_costs 
IS '开票申请ID外键约束，删除开票申请时自动将此字段设为NULL';

COMMENT ON CONSTRAINT fk_logistics_partner_costs_payment_request_id 
ON public.logistics_partner_costs 
IS '付款申请ID外键约束，删除付款申请时自动将此字段设为NULL';

COMMIT;

-- 完成信息
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 外键约束已修复';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复步骤：';
    RAISE NOTICE '1. 清理了无效的 invoice_request_id 引用';
    RAISE NOTICE '2. 清理了无效的 payment_request_id 引用';
    RAISE NOTICE '3. 添加了正确的外键约束';
    RAISE NOTICE '';
    RAISE NOTICE '外键约束详情：';
    RAISE NOTICE '1. invoice_request_id 字段';
    RAISE NOTICE '   - 表: logistics_partner_costs';
    RAISE NOTICE '   - 引用: invoice_requests(id)';
    RAISE NOTICE '   - 行为: ON DELETE SET NULL';
    RAISE NOTICE '';
    RAISE NOTICE '2. payment_request_id 字段';
    RAISE NOTICE '   - 表: logistics_partner_costs';
    RAISE NOTICE '   - 引用: payment_requests(id)';
    RAISE NOTICE '   - 行为: ON DELETE SET NULL';
    RAISE NOTICE '';
    RAISE NOTICE '效果：';
    RAISE NOTICE '- 已清理数据库中的无效引用';
    RAISE NOTICE '- 删除开票申请或付款申请时，相关合作方成本记录的关联ID将自动设为NULL';
    RAISE NOTICE '- 合作方成本记录本身不会被删除，保持数据完整性';
    RAISE NOTICE '';
    RAISE NOTICE '现在可以安全删除 invoice_requests 和 payment_requests 表中的记录了';
    RAISE NOTICE '========================================';
END $$;

