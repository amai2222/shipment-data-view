-- ============================================================================
-- 修复：add_logistics_record_with_costs_1126 函数在插入新运单后自动计算合作方成本
-- 日期：2025-12-01
-- 说明：在插入运单后，手动调用成本计算逻辑，确保合作方成本被正确计算
-- ============================================================================

-- ============================================================================
-- 删除旧版本的函数（如果存在）
-- ============================================================================

DROP FUNCTION IF EXISTS public.add_logistics_record_with_costs_1126(
    uuid, text, uuid, bigint, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text, text, text, text
) CASCADE;

-- ============================================================================
-- 创建新版本的函数 add_logistics_record_with_costs_1126
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_logistics_record_with_costs_1126(
    p_project_id uuid,
    p_project_name text,
    p_chain_id uuid,
    p_billing_type_id bigint,
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
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_record_id uuid;
  driver_payable numeric;
  v_project_code text;
  v_auto_number text;
  v_billing_type_id bigint;
  v_recalc_result jsonb;
BEGIN
  -- ✅ 获取 billing_type_id（如果未传递，则从链路中获取）
  IF p_billing_type_id IS NOT NULL AND p_billing_type_id > 0 THEN
    v_billing_type_id := p_billing_type_id;
  ELSE
    -- 从链路中获取 billing_type_id
    SELECT billing_type_id INTO v_billing_type_id
    FROM public.partner_chains
    WHERE id = p_chain_id;
    
    -- 如果链路中没有，默认为1（计吨）
    v_billing_type_id := COALESCE(v_billing_type_id, 1);
  END IF;

  -- 检查并确保项目有 auto_code
  SELECT auto_code INTO v_project_code FROM public.projects WHERE id = p_project_id;
  IF v_project_code IS NULL OR v_project_code = '' THEN
    v_project_code := UPPER(SUBSTRING(p_project_name, 1, 4));
    UPDATE public.projects SET auto_code = v_project_code WHERE id = p_project_id;
  END IF;

  -- 生成运单自动编号
  v_auto_number := public.generate_auto_number(p_loading_date);

  -- 计算司机应付（这里先使用传入的值，触发器会重新计算）
  driver_payable := (COALESCE(p_current_cost, 0) + COALESCE(p_extra_cost, 0));

  INSERT INTO public.logistics_records (
    auto_number,
    project_id,
    project_name,
    chain_id,
    billing_type_id,
    driver_id,
    driver_name,
    loading_location,
    unloading_location,
    loading_date,
    unloading_date,
    loading_weight,
    unloading_weight,
    unit_price,
    current_cost,
    extra_cost,
    payable_cost,
    license_plate,
    driver_phone,
    transport_type,
    remarks,
    created_by_user_id
  ) VALUES (
    v_auto_number,
    p_project_id,
    p_project_name,
    p_chain_id,
    v_billing_type_id,
    p_driver_id,
    p_driver_name,
    p_loading_location,
    p_unloading_location,
    CASE 
      WHEN p_loading_date IS NOT NULL AND p_loading_date != '' 
      THEN (p_loading_date::text || ' 00:00:00+08:00')::timestamptz 
      ELSE NULL 
    END,
    CASE 
      WHEN p_unloading_date IS NOT NULL AND p_unloading_date != '' 
      THEN (p_unloading_date::text || ' 00:00:00+08:00')::timestamptz 
      ELSE NULL 
    END,
    p_loading_weight,
    p_unloading_weight,
    p_unit_price,
    p_current_cost,
    p_extra_cost,
    driver_payable,
    p_license_plate,
    p_driver_phone,
    p_transport_type,
    p_remarks,
    auth.uid()
  ) RETURNING id INTO new_record_id;

  -- ✅ 修复：触发器会自动计算 effective_quantity, current_cost, payable_cost
  -- ✅ 但是触发器只在 UPDATE 时触发，INSERT 时不会触发合作方成本计算
  -- ✅ 因此需要手动调用批量重算函数来计算合作方成本
  SELECT public.batch_recalculate_partner_costs_1120(ARRAY[new_record_id]) INTO v_recalc_result;
  
  -- 记录日志（可选）
  IF v_recalc_result IS NOT NULL AND (v_recalc_result->>'success')::boolean = false THEN
    RAISE WARNING '合作方成本计算失败: %', v_recalc_result->>'message';
  END IF;
  
  RETURN new_record_id;
END;
$$;

COMMENT ON FUNCTION public.add_logistics_record_with_costs_1126 IS '新建运单并自动计算合作方成本（支持 billing_type_id，_1126版本，已修复：插入后自动计算合作方成本）';

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ add_logistics_record_with_costs_1126 函数已创建';
    RAISE NOTICE '✅ 现在会在插入新运单后自动计算合作方成本';
    RAISE NOTICE '========================================';
END $$;

