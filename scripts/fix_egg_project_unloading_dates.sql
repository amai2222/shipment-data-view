-- ============================================================================
-- 修复"鸡蛋运输"项目的收货日期
-- 功能：将所有"鸡蛋运输"项目的unloading_date设置为loading_date + 48小时
-- 创建日期：2025-01-XX
-- ============================================================================
--
-- 使用说明：
-- 1. 此脚本会查找所有"鸡蛋运输"项目的运单记录
-- 2. 将这些记录的unloading_date设置为loading_date + 48小时
-- 3. 无论unloading_date是否已存在，都会更新
--
-- 注意事项：
-- - 此脚本会更新所有"鸡蛋运输"项目的记录
-- - 包括已有unloading_date的记录也会被更新
-- ============================================================================

-- ============================================================================
-- 第一步：查看需要修复的记录数量（预览）
-- ============================================================================

DO $$
DECLARE
    v_total_egg_records INTEGER;
    v_need_fix_count INTEGER;
    v_already_correct_count INTEGER;
BEGIN
    -- 统计"鸡蛋运输"项目的总记录数
    SELECT COUNT(*) INTO v_total_egg_records
    FROM public.logistics_records
    WHERE project_name = '鸡蛋运输'
      AND loading_date IS NOT NULL;
    
    -- 统计需要修复的记录数（unloading_date不等于loading_date + 48小时）
    SELECT COUNT(*) INTO v_need_fix_count
    FROM public.logistics_records
    WHERE project_name = '鸡蛋运输'
      AND loading_date IS NOT NULL
      AND (
          unloading_date IS NULL
          OR unloading_date != loading_date + INTERVAL '48 hours'
      );
    
    -- 统计已经正确的记录数
    SELECT COUNT(*) INTO v_already_correct_count
    FROM public.logistics_records
    WHERE project_name = '鸡蛋运输'
      AND loading_date IS NOT NULL
      AND unloading_date = loading_date + INTERVAL '48 hours';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 "鸡蛋运输"项目收货日期修复预览';
    RAISE NOTICE '========================================';
    RAISE NOTICE '"鸡蛋运输"项目总记录数：%', v_total_egg_records;
    RAISE NOTICE '需要修复的记录数：%', v_need_fix_count;
    RAISE NOTICE '已经正确的记录数：%', v_already_correct_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- 第二步：修复"鸡蛋运输"项目的收货日期
-- ============================================================================

DO $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    -- 更新所有"鸡蛋运输"项目的unloading_date为loading_date + 48小时
    UPDATE public.logistics_records
    SET unloading_date = loading_date + INTERVAL '48 hours'
    WHERE project_name = '鸡蛋运输'
      AND loading_date IS NOT NULL
      AND (
          unloading_date IS NULL
          OR unloading_date != loading_date + INTERVAL '48 hours'
      );
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RAISE NOTICE '✅ 已修复 % 条"鸡蛋运输"项目的unloading_date（设置为装货日期+48小时）', v_updated_count;
END $$;

-- ============================================================================
-- 第三步：验证修复结果
-- ============================================================================

DO $$
DECLARE
    v_total_egg_records INTEGER;
    v_correct_count INTEGER;
    v_incorrect_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_egg_records
    FROM public.logistics_records
    WHERE project_name = '鸡蛋运输'
      AND loading_date IS NOT NULL;
    
    -- 统计正确的记录数（unloading_date = loading_date + 48小时）
    SELECT COUNT(*) INTO v_correct_count
    FROM public.logistics_records
    WHERE project_name = '鸡蛋运输'
      AND loading_date IS NOT NULL
      AND unloading_date = loading_date + INTERVAL '48 hours';
    
    -- 统计不正确的记录数
    SELECT COUNT(*) INTO v_incorrect_count
    FROM public.logistics_records
    WHERE project_name = '鸡蛋运输'
      AND loading_date IS NOT NULL
      AND (
          unloading_date IS NULL
          OR unloading_date != loading_date + INTERVAL '48 hours'
      );
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 修复完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '"鸡蛋运输"项目总记录数：%', v_total_egg_records;
    RAISE NOTICE '收货日期正确的记录数：%', v_correct_count;
    RAISE NOTICE '收货日期不正确的记录数：%', v_incorrect_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    IF v_incorrect_count > 0 THEN
        RAISE NOTICE '⚠️  仍有 % 条记录不正确，可能原因：', v_incorrect_count;
        RAISE NOTICE '   1. loading_date为NULL';
        RAISE NOTICE '   2. 数据更新失败';
        RAISE NOTICE '';
        RAISE NOTICE '建议执行以下查询查看详情：';
        RAISE NOTICE 'SELECT auto_number, loading_date, unloading_date, unloading_date - loading_date as 时间差';
        RAISE NOTICE 'FROM logistics_records';
        RAISE NOTICE 'WHERE project_name = ''鸡蛋运输''';
        RAISE NOTICE '  AND loading_date IS NOT NULL';
        RAISE NOTICE '  AND (unloading_date IS NULL OR unloading_date != loading_date + INTERVAL ''48 hours'')';
        RAISE NOTICE 'LIMIT 10;';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- 第四步：显示一些示例数据（可选，用于验证）
-- ============================================================================

-- 显示"鸡蛋运输"项目的记录示例
SELECT 
    auto_number as 运单编号,
    loading_date as 装货日期,
    unloading_date as 收货日期,
    unloading_date - loading_date as 时间差,
    driver_name as 司机姓名,
    license_plate as 车牌号
FROM public.logistics_records
WHERE project_name = '鸡蛋运输'
  AND loading_date IS NOT NULL
  AND unloading_date IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
