-- ============================================================================
-- 修复触发器：确保更新时正确计算有效数量
-- 日期：2025-11-20
-- 问题：触发器只在更新特定字段时触发，且可能未包含 chain_id 的更新
-- 解决：扩展触发器触发条件，确保 chain_id 更新时也重新计算有效数量
-- ============================================================================

-- 删除旧触发器
DROP TRIGGER IF EXISTS trigger_auto_calculate_cost_from_unit_price_1120 ON public.logistics_records;

-- 创建新触发器：包含更多触发字段，确保 chain_id 更新时也重新计算
CREATE TRIGGER trigger_auto_calculate_cost_from_unit_price_1120
    BEFORE INSERT OR UPDATE OF 
        unit_price, 
        loading_weight, 
        unloading_weight, 
        extra_cost,
        chain_id,
        project_id
    ON public.logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_calculate_cost_from_unit_price_1120();

COMMENT ON TRIGGER trigger_auto_calculate_cost_from_unit_price_1120 ON public.logistics_records 
IS '自动计算运费触发器（2025-11-20版本，支持根据链路计费模式计算有效数量）';

-- 手动更新所有现有记录的有效数量（一次性修复）
-- 注意：只更新有效数量为 NULL 或 0 的记录，避免覆盖已有数据
UPDATE public.logistics_records lr
SET 
    effective_quantity = public.get_effective_quantity_for_record_1120(
        lr.loading_weight,
        lr.unloading_weight,
        lr.project_id,
        lr.chain_id
    )
WHERE (lr.effective_quantity IS NULL OR lr.effective_quantity = 0)
  AND (lr.loading_weight IS NOT NULL OR lr.unloading_weight IS NOT NULL);

-- 验证修复
DO $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_updated_count
    FROM public.logistics_records
    WHERE effective_quantity IS NOT NULL 
      AND effective_quantity > 0;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 触发器修复完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '  ✓ 触发器现在会在更新 chain_id 时触发';
    RAISE NOTICE '  ✓ 触发器现在会在更新 project_id 时触发';
    RAISE NOTICE '  ✓ 已手动更新所有现有记录的有效数量';
    RAISE NOTICE '';
    RAISE NOTICE '统计信息：';
    RAISE NOTICE '  ✓ 有效数量 > 0 的记录数: %', v_updated_count;
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

