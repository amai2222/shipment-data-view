-- ============================================================================
-- 修复历史运单中缺失的收货日期（卸货日期）
-- 功能：将unloading_date为NULL的记录，根据项目名称设置：
--       - "鸡蛋运输"项目：unloading_date = loading_date + 48小时
--       - 其他项目：unloading_date = loading_date
-- 创建日期：2025-01-XX
-- ============================================================================
--
-- 使用说明：
-- 1. 此脚本会查找所有unloading_date为NULL的运单记录
-- 2. 根据项目名称设置unloading_date：
--    - "鸡蛋运输"项目：unloading_date = loading_date + 48小时
--    - 其他项目：unloading_date = loading_date
-- 3. 显示修复统计信息
--
-- 注意事项：
-- - 此脚本是幂等的，可以安全地多次执行
-- - 只会更新unloading_date为NULL的记录
-- - 不会修改已有unloading_date的记录
-- ============================================================================

-- ============================================================================
-- 第一步：查看需要修复的记录数量（预览）
-- ============================================================================

DO $$
DECLARE
    v_missing_count INTEGER;
    v_total_records INTEGER;
    v_egg_missing_count INTEGER;
BEGIN
    -- 统计总运单数
    SELECT COUNT(*) INTO v_total_records
    FROM public.logistics_records;
    
    -- 统计缺失unloading_date的记录数
    SELECT COUNT(*) INTO v_missing_count
    FROM public.logistics_records
    WHERE unloading_date IS NULL
      AND loading_date IS NOT NULL;
    
    -- 统计鸡蛋运输项目中缺失unloading_date的记录数
    SELECT COUNT(*) INTO v_egg_missing_count
    FROM public.logistics_records
    WHERE unloading_date IS NULL
      AND loading_date IS NOT NULL
      AND project_name = '鸡蛋运输';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 收货日期修复预览';
    RAISE NOTICE '========================================';
    RAISE NOTICE '运单表总记录数：%', v_total_records;
    RAISE NOTICE '缺失unloading_date的记录数：%', v_missing_count;
    IF v_egg_missing_count > 0 THEN
        RAISE NOTICE '  其中"鸡蛋运输"项目：% 条（将设置为装货日期+48小时）', v_egg_missing_count;
        RAISE NOTICE '  其他项目：% 条（将设置为装货日期）', v_missing_count - v_egg_missing_count;
    END IF;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- 第二步：修复缺失的收货日期
-- ============================================================================

DO $$
DECLARE
    v_updated_count INTEGER;
    v_egg_project_count INTEGER;
BEGIN
    -- 🔴 特殊规则：项目名称为"鸡蛋运输"的，收货日期 = 装货日期 + 48小时
    UPDATE public.logistics_records
    SET unloading_date = loading_date + INTERVAL '48 hours'
    WHERE unloading_date IS NULL
      AND loading_date IS NOT NULL
      AND project_name = '鸡蛋运输';
    
    GET DIAGNOSTICS v_egg_project_count = ROW_COUNT;
    
    -- 其他项目：收货日期 = 装货日期
    UPDATE public.logistics_records
    SET unloading_date = loading_date
    WHERE unloading_date IS NULL
      AND loading_date IS NOT NULL
      AND (project_name IS NULL OR project_name != '鸡蛋运输');
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RAISE NOTICE '✅ 已修复 % 条记录的unloading_date（鸡蛋运输项目：% 条，其他项目：% 条）', 
        v_egg_project_count + v_updated_count, 
        v_egg_project_count, 
        v_updated_count;
END $$;

-- ============================================================================
-- 第三步：验证修复结果
-- ============================================================================

DO $$
DECLARE
    v_remaining_null_count INTEGER;
    v_total_records INTEGER;
    v_records_with_unloading_date INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_records FROM public.logistics_records;
    
    -- 统计仍然没有unloading_date的记录数
    SELECT COUNT(*) INTO v_remaining_null_count
    FROM public.logistics_records
    WHERE unloading_date IS NULL
      AND loading_date IS NOT NULL;
    
    -- 统计已有unloading_date的记录数
    SELECT COUNT(*) INTO v_records_with_unloading_date
    FROM public.logistics_records
    WHERE unloading_date IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 修复完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '运单表总记录数：%', v_total_records;
    RAISE NOTICE '已有unloading_date的记录数：%', v_records_with_unloading_date;
    RAISE NOTICE '仍缺少unloading_date的记录数：%', v_remaining_null_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    IF v_remaining_null_count > 0 THEN
        RAISE NOTICE '⚠️  仍有 % 条记录缺少unloading_date，可能原因：', v_remaining_null_count;
        RAISE NOTICE '   1. loading_date也为NULL（这种情况不应该存在，因为loading_date是必填字段）';
        RAISE NOTICE '';
        RAISE NOTICE '建议执行以下查询查看详情：';
        RAISE NOTICE 'SELECT id, auto_number, loading_date, unloading_date';
        RAISE NOTICE 'FROM logistics_records';
        RAISE NOTICE 'WHERE unloading_date IS NULL';
        RAISE NOTICE '  AND loading_date IS NOT NULL';
        RAISE NOTICE 'LIMIT 10;';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- 第四步：显示一些示例数据（可选，用于验证）
-- ============================================================================

-- 显示最近修复的10条记录（包括鸡蛋运输项目和其他项目）
SELECT 
    auto_number as 运单编号,
    project_name as 项目名称,
    loading_date as 装货日期,
    unloading_date as 收货日期,
    unloading_date - loading_date as 时间差,
    driver_name as 司机姓名,
    license_plate as 车牌号
FROM public.logistics_records
WHERE unloading_date IS NOT NULL
  AND loading_date IS NOT NULL
  AND (
      -- 显示被修复的记录：收货日期等于装货日期（其他项目）
      unloading_date = loading_date
      OR
      -- 显示被修复的记录：收货日期等于装货日期+48小时（鸡蛋运输项目）
      (project_name = '鸡蛋运输' AND unloading_date = loading_date + INTERVAL '48 hours')
  )
ORDER BY created_at DESC
LIMIT 10;
