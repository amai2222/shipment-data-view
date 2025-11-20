-- ============================================================================
-- 手动修复现有数据的有效数量
-- 日期：2025-11-20
-- 问题：现有运单的有效数量显示为 0.000
-- 解决：直接更新所有有单价的运单的有效数量
-- ============================================================================

-- 更新所有有单价但有效数量为 0 或 NULL 的运单
DO $$
DECLARE
    v_updated_count INTEGER := 0;
    v_record RECORD;
    v_effective_qty NUMERIC;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '开始修复有效数量';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- 遍历所有有单价但有效数量为 0 或 NULL 的运单
    FOR v_record IN 
        SELECT 
            id,
            unit_price,
            loading_weight,
            unloading_weight,
            project_id,
            chain_id,
            effective_quantity,
            current_cost
        FROM logistics_records
        WHERE unit_price IS NOT NULL 
          AND unit_price > 0
          AND (effective_quantity IS NULL OR effective_quantity = 0)
    LOOP
        -- 计算有效数量
        v_effective_qty := public.get_effective_quantity_for_record_1120(
            v_record.loading_weight,
            v_record.unloading_weight,
            v_record.project_id,
            v_record.chain_id
        );
        
        RAISE NOTICE '运单 %:', v_record.id;
        RAISE NOTICE '  装货: %, 卸货: %', v_record.loading_weight, v_record.unloading_weight;
        RAISE NOTICE '  计算有效数量: % → %', 
            COALESCE(v_record.effective_quantity, 0), 
            COALESCE(v_effective_qty, 0);
        
        -- 更新记录
        UPDATE logistics_records
        SET 
            effective_quantity = v_effective_qty,
            current_cost = CASE 
                WHEN v_effective_qty IS NOT NULL AND v_effective_qty > 0 
                THEN ROUND(unit_price * v_effective_qty, 2)
                ELSE current_cost
            END,
            calculation_mode = 'auto'
        WHERE id = v_record.id;
        
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 修复完成，共更新 % 条记录', v_updated_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- 验证修复结果
DO $$
DECLARE
    v_total_with_price INTEGER;
    v_total_with_qty INTEGER;
    v_total_zero_qty INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_with_price
    FROM logistics_records
    WHERE unit_price IS NOT NULL AND unit_price > 0;
    
    SELECT COUNT(*) INTO v_total_with_qty
    FROM logistics_records
    WHERE unit_price IS NOT NULL 
      AND unit_price > 0 
      AND effective_quantity IS NOT NULL 
      AND effective_quantity > 0;
    
    SELECT COUNT(*) INTO v_total_zero_qty
    FROM logistics_records
    WHERE unit_price IS NOT NULL 
      AND unit_price > 0
      AND (effective_quantity IS NULL OR effective_quantity = 0);
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '验证结果：';
    RAISE NOTICE '========================================';
    RAISE NOTICE '  有单价的运单总数: %', v_total_with_price;
    RAISE NOTICE '  有效数量正常的: %', v_total_with_qty;
    RAISE NOTICE '  有效数量为0的: %', v_total_zero_qty;
    RAISE NOTICE '';
    
    IF v_total_zero_qty > 0 THEN
        RAISE WARNING '⚠️ 仍有 % 条记录的有效数量为0，请检查数据', v_total_zero_qty;
    ELSE
        RAISE NOTICE '✅ 所有记录的有效数量都已正确设置';
    END IF;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- 显示前5条记录作为示例
DO $$
DECLARE
    v_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '示例记录（前5条）：';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    FOR v_record IN
        SELECT 
            substring(id::text, 1, 8) as short_id,
            unit_price,
            effective_quantity,
            current_cost,
            loading_weight,
            unloading_weight
        FROM logistics_records
        WHERE unit_price IS NOT NULL AND unit_price > 0
        ORDER BY updated_at DESC
        LIMIT 5
    LOOP
        RAISE NOTICE '运单 %...', v_record.short_id;
        RAISE NOTICE '  单价: %, 有效数量: %, 运费: %', 
            v_record.unit_price, 
            v_record.effective_quantity, 
            v_record.current_cost;
        RAISE NOTICE '  装货: %, 卸货: %', 
            v_record.loading_weight, 
            v_record.unloading_weight;
        RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE '========================================';
END $$;

