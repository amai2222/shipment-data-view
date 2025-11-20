-- ============================================================================
-- 修复历史数据：计算有效数量和反推单价（简化版）
-- 日期：2025-11-20
-- 说明：只包含核心修复逻辑，无复杂输出
-- ============================================================================

-- 步骤 1：更新所有运单的有效数量
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

-- 步骤 2：为手动模式运单反推单价
UPDATE public.logistics_records
SET 
    unit_price = ROUND(current_cost / NULLIF(effective_quantity, 0), 2),
    calculation_mode = 'manual'
WHERE (unit_price IS NULL OR unit_price = 0)
    AND current_cost IS NOT NULL 
    AND current_cost > 0
    AND effective_quantity IS NOT NULL
    AND effective_quantity > 0;

-- 步骤 3：为还没有设置计算模式的运单设置计算模式
-- 注意：只处理 calculation_mode 为 NULL 的记录，不覆盖步骤2已设置的 manual
UPDATE public.logistics_records
SET calculation_mode = CASE 
    WHEN unit_price IS NOT NULL AND unit_price > 0 THEN 'auto'
    ELSE 'manual'
END
WHERE calculation_mode IS NULL;

-- 显示修复结果统计
SELECT 
    '修复完成' as 状态,
    COUNT(*) as 总运单数,
    COUNT(CASE WHEN calculation_mode = 'auto' THEN 1 END) as 自动模式数量,
    COUNT(CASE WHEN calculation_mode = 'manual' THEN 1 END) as 手动模式数量,
    COUNT(CASE WHEN effective_quantity IS NOT NULL AND effective_quantity > 0 THEN 1 END) as 有有效数量,
    COUNT(CASE WHEN unit_price IS NOT NULL AND unit_price > 0 THEN 1 END) as 有单价
FROM public.logistics_records;

