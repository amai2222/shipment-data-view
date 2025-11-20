-- ============================================================================
-- 修复运单保存函数：添加 billing_type_id 支持
-- 日期：2025-11-20
-- 问题：保存运单时没有保存 billing_type_id，导致显示单位错误
-- 解决：在新建和更新运单的函数中添加 billing_type_id 参数并保存
-- ============================================================================

-- ============================================================================
-- 第一步：删除旧版本的函数（避免函数名冲突）
-- ============================================================================

-- 删除旧版本的 add_logistics_record_with_costs_1120（所有参数组合）
DROP FUNCTION IF EXISTS public.add_logistics_record_with_costs_1120(
    uuid, text, uuid, uuid, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text, text, text, text
) CASCADE;

DROP FUNCTION IF EXISTS public.add_logistics_record_with_costs_1120 CASCADE;

-- 删除旧版本的 update_logistics_record_via_recalc_1120（所有参数组合）
DROP FUNCTION IF EXISTS public.update_logistics_record_via_recalc_1120(
    uuid, uuid, text, uuid, uuid, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text, text, text, text
) CASCADE;

DROP FUNCTION IF EXISTS public.update_logistics_record_via_recalc_1120 CASCADE;

-- ============================================================================
-- 第二步：创建新版本的函数（包含 billing_type_id 参数）
-- ============================================================================

-- ============================================================================
-- 1. 修复 add_logistics_record_with_costs_1120（新建运单）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_logistics_record_with_costs_1120(
    p_project_id uuid,
    p_project_name text,
    p_chain_id uuid,
    p_billing_type_id bigint,  -- ✅ 新增：计费模式ID参数
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
  v_billing_type_id bigint;  -- ✅ 新增：计费模式ID变量
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
    billing_type_id,  -- ✅ 新增：保存计费模式ID
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
    v_billing_type_id,  -- ✅ 新增：使用计费模式ID
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

  -- 触发器会自动计算 effective_quantity, current_cost, payable_cost
  -- 然后自动触发合作方成本重算
  
  RETURN new_record_id;
END;
$$;

COMMENT ON FUNCTION public.add_logistics_record_with_costs_1120 IS '新建运单并自动计算合作方成本（支持 billing_type_id，_1120版本）';

-- ============================================================================
-- 2. 修复 update_logistics_record_via_recalc_1120（更新运单）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_logistics_record_via_recalc_1120(
    p_record_id uuid,
    p_project_id uuid,
    p_project_name text,
    p_chain_id uuid,
    p_billing_type_id bigint,  -- ✅ 新增：计费模式ID参数
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
    v_billing_type_id bigint;  -- ✅ 计费模式ID变量
    driver_payable numeric;  -- ✅ 司机应付金额
BEGIN
    -- ✅ 获取 billing_type_id（优先使用参数，否则从链路中获取）
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
    
    -- ✅ 计算司机应付金额
    driver_payable := v_calculated_cost + COALESCE(p_extra_cost, 0);
    
    -- 更新记录（显式设置所有计算字段，包括 billing_type_id）
    UPDATE public.logistics_records
    SET 
        project_id = p_project_id,
        project_name = p_project_name,
        chain_id = p_chain_id,
        billing_type_id = v_billing_type_id,  -- ✅ 保存计费模式ID
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
        payable_cost = driver_payable,  -- ✅ 使用计算的司机应付金额
        license_plate = p_license_plate,
        driver_phone = p_driver_phone,
        transport_type = p_transport_type,
        remarks = p_remarks,
        updated_at = NOW()
    WHERE id = p_record_id;
    
    -- ✅ 触发器会自动重新计算合作方成本（不需要手动调用 recalculate_and_update_costs_for_record）
END;
$$;

COMMENT ON FUNCTION public.update_logistics_record_via_recalc_1120 IS '更新运单记录并重新计算合作方成本（支持 billing_type_id，_1120版本）';

-- ============================================================================
-- 验证
-- ============================================================================

-- ✅ add_logistics_record_with_costs_1120 函数已修复
-- ✅ update_logistics_record_via_recalc_1120 函数已修复
-- ✅ 两个函数都支持 billing_type_id 参数
-- ✅ 如果未传递 billing_type_id，会自动从链路中获取

