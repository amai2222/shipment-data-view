-- ============================================================================
-- 修复 update_logistics_record_via_recalc_1120 函数
-- 日期：2025-11-20
-- 问题：更新运单时，需要显式设置 calculation_mode，确保单价能正确保存
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_logistics_record_via_recalc_1120(
    p_record_id uuid,
    p_project_id uuid,
    p_project_name text,
    p_chain_id uuid,
    p_driver_id uuid,a
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
BEGIN
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
        -- 显式设置 calculation_mode：有单价则为 auto，否则为 manual
        calculation_mode = CASE 
            WHEN p_unit_price IS NOT NULL AND p_unit_price > 0 THEN 'auto'
            ELSE 'manual'
        END,
        current_cost = p_current_cost,
        extra_cost = p_extra_cost,
        license_plate = p_license_plate,
        driver_phone = p_driver_phone,
        transport_type = p_transport_type,
        remarks = p_remarks,
        updated_at = NOW()
    WHERE id = p_record_id;
    
    -- 触发器会自动重新计算 effective_quantity, current_cost, payable_cost
    -- payable_cost 改变会触发合作方成本重算
END;
$$;

COMMENT ON FUNCTION public.update_logistics_record_via_recalc_1120 IS '更新运单记录并重新计算合作方成本（2025-11-20版本，支持单价功能，已修复 calculation_mode 设置）';

