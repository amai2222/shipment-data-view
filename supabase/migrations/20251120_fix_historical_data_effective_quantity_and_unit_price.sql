-- ============================================================================
-- 修复历史数据：计算有效数量和反推单价
-- 日期：2025-11-20
-- 说明：
--   1. 为所有运单计算有效数量（根据项目配置）
--   2. 为手动模式（无单价）的运单反推单价
--   3. 为自动模式（有单价）的运单保持单价不变
-- ============================================================================

DO $$
DECLARE
    v_total_records INTEGER := 0;
    v_updated_records INTEGER := 0;
    v_manual_mode_records INTEGER := 0;
    v_auto_mode_records INTEGER := 0;
    v_no_cost_records INTEGER := 0;
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
    rec RECORD;
    v_zero_quantity INTEGER;
    v_zero_cost INTEGER;
    v_null_unit_price INTEGER;
BEGIN
    v_start_time := clock_timestamp();
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '开始修复历史数据...';
    RAISE NOTICE '开始时间: %', v_start_time;
    RAISE NOTICE '========================================';
    
    -- 统计总记录数
    SELECT COUNT(*) INTO v_total_records FROM public.logistics_records;
    RAISE NOTICE '总运单数: %', v_total_records;
    
    -- ========================================
    -- 步骤 1：更新所有运单的有效数量
    -- ========================================
    RAISE NOTICE '';
    RAISE NOTICE '步骤 1：计算所有运单的有效数量...';
    
    UPDATE public.logistics_records lr
    SET effective_quantity = (
        SELECT 
            CASE 
                -- 根据项目配置的有效数量计算方式
                WHEN p.effective_quantity_type = 'loading' THEN 
                    COALESCE(lr.loading_weight, 0)
                WHEN p.effective_quantity_type = 'unloading' THEN 
                    COALESCE(lr.unloading_weight, 0)
                ELSE -- 'min_value' 或 NULL（默认）
                    CASE 
                        WHEN lr.loading_weight IS NOT NULL AND lr.unloading_weight IS NOT NULL THEN
                            LEAST(lr.loading_weight, lr.unloading_weight)
                        ELSE
                            COALESCE(lr.unloading_weight, lr.loading_weight, 0)
                    END
            END
        FROM public.projects p
        WHERE p.id = lr.project_id
    )
    WHERE lr.project_id IS NOT NULL;
    
    GET DIAGNOSTICS v_updated_records = ROW_COUNT;
    RAISE NOTICE '✅ 已更新 % 条运单的有效数量', v_updated_records;
    
    -- ========================================
    -- 步骤 2：为手动模式运单反推单价
    -- ========================================
    RAISE NOTICE '';
    RAISE NOTICE '步骤 2：为手动模式运单反推单价...';
    
    -- 2.1 处理有运费且有有效数量的手动模式运单
    UPDATE public.logistics_records
    SET 
        unit_price = ROUND(current_cost / NULLIF(effective_quantity, 0), 2),
        calculation_mode = 'manual'
    WHERE (unit_price IS NULL OR unit_price = 0)
        AND current_cost IS NOT NULL 
        AND current_cost > 0
        AND effective_quantity IS NOT NULL
        AND effective_quantity > 0;
    
    GET DIAGNOSTICS v_manual_mode_records = ROW_COUNT;
    RAISE NOTICE '✅ 已为 % 条手动模式运单反推单价', v_manual_mode_records;
    
    -- 2.2 统计无法反推单价的记录（没有运费或有效数量为0）
    SELECT COUNT(*) INTO v_no_cost_records
    FROM public.logistics_records
    WHERE (unit_price IS NULL OR unit_price = 0)
        AND (current_cost IS NULL OR current_cost = 0 OR effective_quantity IS NULL OR effective_quantity = 0);
    
    IF v_no_cost_records > 0 THEN
        RAISE NOTICE '⚠️  有 % 条运单无法反推单价（运费为0或有效数量为0）', v_no_cost_records;
    END IF;
    
    -- ========================================
    -- 步骤 3：确认自动模式运单的计算模式
    -- ========================================
    RAISE NOTICE '';
    RAISE NOTICE '步骤 3：确认自动模式运单...';
    
    UPDATE public.logistics_records
    SET calculation_mode = 'auto'
    WHERE unit_price IS NOT NULL 
        AND unit_price > 0
        AND (calculation_mode IS NULL OR calculation_mode != 'auto');
    
    GET DIAGNOSTICS v_auto_mode_records = ROW_COUNT;
    RAISE NOTICE '✅ 已确认 % 条自动模式运单', v_auto_mode_records;
    
    -- ========================================
    -- 步骤 4：显示统计信息
    -- ========================================
    v_end_time := clock_timestamp();
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '修复完成！统计信息：';
    RAISE NOTICE '========================================';
    RAISE NOTICE '总运单数: %', v_total_records;
    RAISE NOTICE '更新有效数量: % 条', v_updated_records;
    RAISE NOTICE '反推单价（手动模式）: % 条', v_manual_mode_records;
    RAISE NOTICE '确认自动模式: % 条', v_auto_mode_records;
    RAISE NOTICE '无法处理: % 条', v_no_cost_records;
    RAISE NOTICE '耗时: %', v_end_time - v_start_time;
    RAISE NOTICE '========================================';
    
    -- ========================================
    -- 步骤 5：显示详细的数据分布
    -- ========================================
    RAISE NOTICE '';
    RAISE NOTICE '数据分布统计：';
    RAISE NOTICE '----------------------------------------';
    
    -- 按计算模式分类
    RAISE NOTICE '按计算模式分类：';
    FOR rec IN (
        SELECT 
            COALESCE(calculation_mode, 'NULL') as mode,
            COUNT(*) as count,
            ROUND(AVG(unit_price), 2) as avg_unit_price,
            ROUND(AVG(effective_quantity), 2) as avg_quantity,
            ROUND(AVG(current_cost), 2) as avg_cost
        FROM public.logistics_records
        GROUP BY calculation_mode
        ORDER BY mode
    ) LOOP
        RAISE NOTICE '  % 模式: % 条 | 平均单价: % | 平均数量: % | 平均运费: %',
            rec.mode, rec.count, rec.avg_unit_price, rec.avg_quantity, rec.avg_cost;
    END LOOP;
    
    -- 显示有问题的记录
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  需要关注的记录：';
    
    SELECT COUNT(*) INTO v_zero_quantity FROM public.logistics_records WHERE effective_quantity = 0 OR effective_quantity IS NULL;
    SELECT COUNT(*) INTO v_zero_cost FROM public.logistics_records WHERE current_cost = 0 OR current_cost IS NULL;
    SELECT COUNT(*) INTO v_null_unit_price FROM public.logistics_records WHERE unit_price IS NULL OR unit_price = 0;
    
    RAISE NOTICE '  有效数量为0或NULL: % 条', v_zero_quantity;
    RAISE NOTICE '  运费为0或NULL: % 条', v_zero_cost;
    RAISE NOTICE '  单价为0或NULL: % 条', v_null_unit_price;
    
    RAISE NOTICE '========================================';
    
END;
$$;

-- ============================================================================
-- 可选：查询修复后的数据样例
-- ============================================================================

-- 查看最近10条自动模式运单
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '查看修复后的数据样例（自动模式）:';
    RAISE NOTICE '========================================';
END;
$$;

SELECT 
    id as 运单ID,
    ROUND(unit_price::numeric, 2) as 单价,
    ROUND(effective_quantity::numeric, 2) as 有效数量,
    ROUND(current_cost::numeric, 2) as 运费,
    calculation_mode as 计算模式
FROM public.logistics_records
WHERE calculation_mode = 'auto' 
    AND unit_price IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 查看最近10条手动模式运单（反推了单价）
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '查看修复后的数据样例（手动模式）:';
    RAISE NOTICE '========================================';
END;
$$;

SELECT 
    id as 运单ID,
    ROUND(unit_price::numeric, 2) as 单价_反推,
    ROUND(effective_quantity::numeric, 2) as 有效数量,
    ROUND(current_cost::numeric, 2) as 运费,
    calculation_mode as 计算模式
FROM public.logistics_records
WHERE calculation_mode = 'manual' 
    AND unit_price IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 修复完成提示
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 历史数据修复完成！';
    RAISE NOTICE '所有运单的有效数量和单价已更新。';
    RAISE NOTICE '========================================';
END;
$$;

