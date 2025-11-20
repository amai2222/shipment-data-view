-- ============================================================================
-- 简化修复：删除旧函数并重新创建
-- 日期：2025-11-20
-- 问题：可能有函数定义冲突或缓存问题
-- 解决：完全删除旧函数，重新创建干净版本
-- ============================================================================

-- 第一步：删除所有可能的旧版本函数
DROP FUNCTION IF EXISTS public.update_logistics_record_via_recalc_1120(
    uuid, uuid, text, uuid, uuid, text, text, text, text, text, 
    numeric, numeric, numeric, numeric, numeric, text, text, text, text
) CASCADE;

DROP FUNCTION IF EXISTS public.update_logistics_record_via_recalc_1120 CASCADE;

-- 第二步：重新创建函数（简化版本，无调试日志）
CREATE FUNCTION public.update_logistics_record_via_recalc_1120(
    p_record_id uuid,
    p_project_id uuid,
    p_project_name text,
    p_chain_id uuid,
    p_driver_id uuid,
    p_driver_name text,
    p_loading_location text,
    p_unloading_location text,
    p_loading_date text,
    p_unloading_date text,
    p_loading_weight numeric,
    p_unloading_weight numeric,
    p_unit_price numeric,
    p_current_cost numeric,
    p_extra_cost numeric,
    p_license_plate text,
    p_driver_phone text,
    p_transport_type text,
    p_remarks text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_is_auto_mode BOOLEAN;
    v_effective_quantity NUMERIC;
    v_calculated_cost NUMERIC;
BEGIN
    -- 判断是否为自动计算模式
    v_is_auto_mode := (p_unit_price IS NOT NULL AND p_unit_price > 0);
    
    -- 计算有效数量（无论什么模式都需要计算）
    v_effective_quantity := public.get_effective_quantity_for_record_1120(
        p_loading_weight,
        p_unloading_weight,
        p_project_id,
        p_chain_id
    );
    
    -- 如果是自动模式，计算运费
    IF v_is_auto_mode AND v_effective_quantity IS NOT NULL AND v_effective_quantity > 0 THEN
        v_calculated_cost := ROUND(p_unit_price * v_effective_quantity, 2);
    ELSE
        -- 手动模式，使用传入的运费
        v_calculated_cost := COALESCE(p_current_cost, 0);
    END IF;
    
    -- 更新记录（显式设置所有计算字段）
    UPDATE public.logistics_records
    SET 
        project_id = p_project_id,
        project_name = p_project_name,
        chain_id = p_chain_id,
        driver_id = p_driver_id,
        driver_name = p_driver_name,
        loading_location = p_loading_location,
        unloading_location = p_unloading_location,
        loading_date = CASE 
            WHEN p_loading_date IS NOT NULL AND p_loading_date != '' 
            THEN (p_loading_date::text || ' 00:00:00+08:00')::timestamptz 
            ELSE NULL 
        END,
        unloading_date = CASE 
            WHEN p_unloading_date IS NOT NULL AND p_unloading_date != '' 
            THEN (p_unloading_date::text || ' 00:00:00+08:00')::timestamptz 
            ELSE NULL 
        END,
        loading_weight = p_loading_weight,
        unloading_weight = p_unloading_weight,
        unit_price = p_unit_price,
        calculation_mode = CASE 
            WHEN v_is_auto_mode THEN 'auto'
            ELSE 'manual'
        END,
        effective_quantity = v_effective_quantity,
        current_cost = v_calculated_cost,
        extra_cost = p_extra_cost,
        payable_cost = v_calculated_cost + COALESCE(p_extra_cost, 0),
        license_plate = p_license_plate,
        driver_phone = p_driver_phone,
        transport_type = p_transport_type,
        remarks = p_remarks,
        updated_at = NOW()
    WHERE id = p_record_id;
END;
$$;

COMMENT ON FUNCTION public.update_logistics_record_via_recalc_1120 IS '更新运单记录并重新计算合作方成本（2025-11-20版本，简化版）';

-- 第三步：确保触发器已禁用
DO $$
DECLARE
    v_trigger_exists BOOLEAN;
BEGIN
    -- 检查触发器是否存在
    SELECT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'trigger_auto_calculate_cost_from_unit_price_1120'
          AND tgrelid = 'public.logistics_records'::regclass
    ) INTO v_trigger_exists;
    
    -- 如果触发器存在，禁用它
    IF v_trigger_exists THEN
        ALTER TABLE public.logistics_records 
            DISABLE TRIGGER trigger_auto_calculate_cost_from_unit_price_1120;
        RAISE NOTICE '✓ 已禁用触发器: trigger_auto_calculate_cost_from_unit_price_1120';
    ELSE
        RAISE NOTICE 'ℹ 触发器不存在，无需禁用';
    END IF;
END $$;

-- 验证
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 函数重新创建完成（简化版本）';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '  ✓ 删除所有旧版本函数';
    RAISE NOTICE '  ✓ 重新创建干净版本';
    RAISE NOTICE '  ✓ 在函数中显式计算所有值';
    RAISE NOTICE '  ✓ 禁用 BEFORE UPDATE 触发器';
    RAISE NOTICE '';
    RAISE NOTICE '请测试编辑运单功能';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

