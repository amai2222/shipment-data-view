-- ============================================================================
-- 根据运单编号更新 loading_date 和 unloading_date
-- 创建日期：2025-02-05
-- ============================================================================
-- 
-- 问题：运单编号中的日期与 loading_date 不匹配
--       例如：运单号 YDN20251110-010 表示 2025-11-10，但 loading_date 是 2025-11-09 08:00:00+00
-- 
-- 解决方案：
--   1. 从运单编号中提取日期（格式：YDN + YYYYMMDD + - + 序号）
--   2. 将该日期作为中国时间的 0点，转换为 UTC 就是前一天的 16点
--   3. 例如：YDN20251110-010 → 2025-11-10 (中国时间 0点) → 2025-11-09 16:00:00+00 (UTC)
-- 
-- 转换规则：
--   - 运单编号：YDN20251110-010 → 提取日期：2025-11-10
--   - 中国时间：2025-11-10 00:00:00+08
--   - UTC时间：2025-11-09 16:00:00+00
-- ============================================================================

DO $$
DECLARE
    v_updated_count INTEGER := 0;
    v_record RECORD;
    v_auto_number_date TEXT;
    v_target_date DATE;
    v_target_timestamptz TIMESTAMPTZ;
    v_total_records INTEGER;
BEGIN
    RAISE NOTICE '========== 开始根据运单编号更新 loading_date ==========';
    
    -- 步骤1: 统计需要处理的记录数量
    SELECT COUNT(*)
    INTO v_total_records
    FROM public.logistics_records
    WHERE auto_number IS NOT NULL
      AND auto_number ~ '^YDN\d{8}-\d{3}$';  -- 匹配格式：YDN + 8位日期 + - + 3位序号
    
    RAISE NOTICE '找到 % 条符合格式的运单记录需要检查。', v_total_records;
    
    -- 步骤2: 显示更新前示例（最多5条）
    RAISE NOTICE '========== 更新前示例 (最多5条) ==========';
    FOR v_record IN
        SELECT 
            auto_number,
            loading_date,
            unloading_date
        FROM public.logistics_records
        WHERE auto_number IS NOT NULL
          AND auto_number ~ '^YDN\d{8}-\d{3}$'
        ORDER BY auto_number DESC
        LIMIT 5
    LOOP
        -- 从运单编号中提取日期（从第4位开始取8位：YYYYMMDD）
        v_auto_number_date := substring(v_record.auto_number from 4 for 8);
        -- 转换为日期格式
        v_target_date := to_date(v_auto_number_date, 'YYYYMMDD');
        -- 转换为中国时间的 0点，然后转换为 UTC（前一天的 16点）
        v_target_timestamptz := (v_target_date::text || ' 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC';
        
        RAISE NOTICE '  - 运单号: %, 编号日期: %, 当前loading_date: %, 目标loading_date: %',
            v_record.auto_number,
            v_target_date,
            v_record.loading_date,
            v_target_timestamptz;
    END LOOP;
    
    -- 步骤3: 执行批量更新 loading_date
    RAISE NOTICE '========== 开始更新 loading_date ==========';
    
    UPDATE public.logistics_records lr
    SET 
        loading_date = (
            -- 从运单编号中提取日期（从第4位开始取8位：YYYYMMDD）
            -- 转换为中国时间的 0点，然后转换为 UTC（前一天的 16点）
            -- 中国时间 2025-11-10 00:00:00+08 = UTC 2025-11-09 16:00:00+00
            (to_date(substring(lr.auto_number from 4 for 8), 'YYYYMMDD')::text || ' 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC'
        ),
        updated_at = NOW()
    WHERE lr.auto_number IS NOT NULL
      AND lr.auto_number ~ '^YDN\d{8}-\d{3}$'
      AND lr.loading_date IS NOT NULL;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE '已更新 % 条记录的 loading_date。', v_updated_count;
    
    -- 步骤4: 执行批量更新 unloading_date（如果存在）
    UPDATE public.logistics_records lr
    SET 
        unloading_date = (
            -- 使用与 loading_date 相同的逻辑
            (to_date(substring(lr.auto_number from 4 for 8), 'YYYYMMDD')::text || ' 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC'
        ),
        updated_at = NOW()
    WHERE lr.auto_number IS NOT NULL
      AND lr.auto_number ~ '^YDN\d{8}-\d{3}$'
      AND lr.unloading_date IS NOT NULL;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE '已更新 % 条记录的 unloading_date。', v_updated_count;
    
    RAISE NOTICE '========== 更新完成 ==========';
    
    -- 步骤5: 显示更新后示例（最多5条）
    RAISE NOTICE '========== 更新后示例 (最多5条) ==========';
    FOR v_record IN
        SELECT 
            auto_number,
            loading_date,
            unloading_date
        FROM public.logistics_records
        WHERE auto_number IS NOT NULL
          AND auto_number ~ '^YDN\d{8}-\d{3}$'
        ORDER BY auto_number DESC
        LIMIT 5
    LOOP
        RAISE NOTICE '  - 运单号: %, loading_date: %, unloading_date: %',
            v_record.auto_number,
            v_record.loading_date,
            v_record.unloading_date;
    END LOOP;
    
    -- 步骤6: 验证更新结果
    RAISE NOTICE '========== 验证更新结果 ==========';
    
    -- 检查是否有日期不匹配的记录
    SELECT COUNT(*)
    INTO v_updated_count
    FROM public.logistics_records lr
    WHERE lr.auto_number IS NOT NULL
      AND lr.auto_number ~ '^YDN\d{8}-\d{3}$'
      AND lr.loading_date IS NOT NULL
      AND (
          -- 提取运单编号中的日期
          to_date(substring(lr.auto_number from 4 for 8), 'YYYYMMDD') != 
          -- 将 loading_date 转换为中国时区的日期进行比较
          (lr.loading_date AT TIME ZONE 'Asia/Shanghai')::date
      );
    
    IF v_updated_count = 0 THEN
        RAISE NOTICE '✓ 所有记录的 loading_date 已与运单编号中的日期匹配。';
    ELSE
        RAISE NOTICE '✗ 仍有 % 条记录的 loading_date 与运单编号中的日期不匹配，请检查。', v_updated_count;
    END IF;
    
    RAISE NOTICE '========== 脚本执行完成 ==========';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '更新过程中发生错误: %', SQLERRM;
END;
$$;

