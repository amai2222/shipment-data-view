-- ==========================================
-- 删除 driver_payable_cost 字段
-- ==========================================
-- 创建时间: 2025-01-22
-- 原因: 
--   1. 该字段为历史遗留字段，数据库中的值都是 NULL
--   2. 实际使用的是 payable_cost 字段
--   3. 删除冗余字段，简化表结构
-- 影响:
--   - 代码中虽有引用，但因为值都是 NULL，不影响功能
--   - 真正的司机应收金额存储在 payable_cost 字段中
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步：检查并记录当前状态（可选）
-- ============================================================

DO $$
DECLARE
    v_column_exists BOOLEAN;
    v_total_records INTEGER;
    v_non_null_records INTEGER;
BEGIN
    -- 检查列是否存在
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'logistics_records' 
          AND column_name = 'driver_payable_cost'
    ) INTO v_column_exists;
    
    IF NOT v_column_exists THEN
        RAISE NOTICE '❌ 列 driver_payable_cost 不存在，无需删除';
        RETURN;
    END IF;
    
    -- 统计数据
    SELECT COUNT(*) INTO v_total_records FROM logistics_records;
    SELECT COUNT(*) INTO v_non_null_records FROM logistics_records WHERE driver_payable_cost IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '准备删除 driver_payable_cost 列';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '当前状态：';
    RAISE NOTICE '  • 总记录数：%', v_total_records;
    RAISE NOTICE '  • driver_payable_cost 有值的记录：%', v_non_null_records;
    RAISE NOTICE '  • NULL 值记录：%', v_total_records - v_non_null_records;
    RAISE NOTICE '';
    
    IF v_non_null_records > 0 THEN
        RAISE WARNING '⚠️  发现 % 条记录的 driver_payable_cost 不为 NULL！', v_non_null_records;
        RAISE NOTICE '建议先将这些值迁移到 payable_cost 字段';
    ELSE
        RAISE NOTICE '✅ 所有记录的 driver_payable_cost 都是 NULL，可以安全删除';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================
-- 第二步：删除依赖该列的对象（如果有）
-- ============================================================

-- 检查并删除依赖该列的索引
DO $$
DECLARE
    idx_record RECORD;
BEGIN
    FOR idx_record IN 
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND tablename = 'logistics_records'
          AND indexdef ILIKE '%driver_payable_cost%'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_record.indexname);
        RAISE NOTICE '已删除索引：%', idx_record.indexname;
    END LOOP;
END $$;

-- 检查并删除依赖该列的视图（如果有）
DO $$
DECLARE
    view_record RECORD;
BEGIN
    FOR view_record IN 
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'public'
          AND view_definition ILIKE '%driver_payable_cost%'
    LOOP
        RAISE WARNING '⚠️  视图 % 使用了 driver_payable_cost，可能需要手动修复', view_record.table_name;
    END LOOP;
END $$;

-- ============================================================
-- 第三步：处理依赖视图
-- ============================================================

-- 重新创建 logistics_records_view，不包含 driver_payable_cost
DROP VIEW IF EXISTS public.logistics_records_view;

CREATE OR REPLACE VIEW public.logistics_records_view AS
SELECT 
    lr.id,
    lr.auto_number,
    lr.project_id,
    lr.driver_id,
    lr.chain_id,
    lr.billing_type_id,
    lr.loading_location,
    lr.unloading_location,
    lr.loading_date,
    lr.unloading_date,
    lr.loading_weight,
    lr.unloading_weight,
    lr.current_cost,
    lr.extra_cost,
    lr.payable_cost,  -- 保留这个字段（实际使用的）
    -- driver_payable_cost 已移除
    lr.license_plate,
    lr.transport_type,
    lr.cargo_type,
    lr.remarks,
    lr.payment_status,
    lr.invoice_status,
    lr.user_id,
    lr.created_by_user_id,
    lr.created_at,
    lr.external_tracking_numbers,
    lr.other_platform_names,
    p.name as project_name,
    d.name as driver_name,
    d.phone as driver_phone,
    pc.chain_name
FROM public.logistics_records lr
LEFT JOIN public.projects p ON lr.project_id = p.id
LEFT JOIN public.drivers d ON lr.driver_id = d.id
LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id;

COMMENT ON VIEW public.logistics_records_view IS '运单记录视图（已移除 driver_payable_cost，使用 payable_cost）';

-- ============================================================
-- 第四步：删除列
-- ============================================================

-- 删除 driver_payable_cost 列
ALTER TABLE public.logistics_records 
DROP COLUMN IF EXISTS driver_payable_cost;

-- ============================================================
-- 第五步：验证删除结果
-- ============================================================

DO $$
DECLARE
    v_column_exists BOOLEAN;
BEGIN
    -- 确认列已删除
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'logistics_records' 
          AND column_name = 'driver_payable_cost'
    ) INTO v_column_exists;
    
    IF v_column_exists THEN
        RAISE EXCEPTION '❌ 删除失败：driver_payable_cost 列仍然存在';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ driver_payable_cost 列删除成功';
        RAISE NOTICE '========================================';
        RAISE NOTICE '';
        RAISE NOTICE '后续步骤：';
        RAISE NOTICE '  1. 前端代码：将所有 driver_payable_cost 引用改为 payable_cost';
        RAISE NOTICE '  2. 数据库函数：检查并修复使用该字段的函数';
        RAISE NOTICE '  3. 重新生成类型定义：npx supabase gen types typescript';
        RAISE NOTICE '';
    END IF;
END $$;

COMMIT;

-- ============================================================
-- 完成信息
-- ============================================================

COMMENT ON TABLE public.logistics_records IS '运输记录表（已删除冗余字段 driver_payable_cost）';

-- 记录迁移日志
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '迁移完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '删除内容：';
    RAISE NOTICE '  ✓ logistics_records.driver_payable_cost 列';
    RAISE NOTICE '';
    RAISE NOTICE '保留字段：';
    RAISE NOTICE '  ✓ payable_cost - 司机应收金额（实际使用）';
    RAISE NOTICE '  ✓ current_cost - 当前成本';
    RAISE NOTICE '  ✓ extra_cost - 额外成本';
    RAISE NOTICE '';
    RAISE NOTICE '注意事项：';
    RAISE NOTICE '  ⚠️  需要更新前端代码中的字段引用';
    RAISE NOTICE '  ⚠️  需要检查数据库函数中的引用';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;
