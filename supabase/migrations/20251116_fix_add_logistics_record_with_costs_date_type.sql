-- ============================================================================
-- 修复 add_logistics_record_with_costs 函数的日期类型转换问题
-- 日期：2025-11-16
-- 问题：函数直接使用 p_loading_date 和 p_unloading_date 插入到 timestamptz 列
--       导致类型不匹配错误：column "loading_date" is of type timestamp with time zone but expression is of type text
-- 修复：将日期字符串转换为 timestamptz，明确指定中国时区（+08:00）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_logistics_record_with_costs(
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
BEGIN
  -- 【核心修复】在插入运单前，先检查并确保项目有 `auto_code`
  SELECT auto_code INTO v_project_code FROM public.projects WHERE id = p_project_id;
  IF v_project_code IS NULL OR v_project_code = '' THEN
    v_project_code := UPPER(SUBSTRING(p_project_name, 1, 4));
    UPDATE public.projects SET auto_code = v_project_code WHERE id = p_project_id;
  END IF;

  -- 【关键修复】生成运单自动编号
  v_auto_number := public.generate_auto_number(p_loading_date);

  driver_payable := (COALESCE(p_current_cost, 0) + COALESCE(p_extra_cost, 0));

  INSERT INTO public.logistics_records (
    auto_number,
    project_id,
    project_name,
    chain_id,
    driver_id,
    driver_name,
    loading_location,
    unloading_location,
    loading_date,
    unloading_date,
    loading_weight,
    unloading_weight,
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
    p_driver_id,
    p_driver_name,
    p_loading_location,
    p_unloading_location,
    -- ✅ 修复：将日期字符串转换为 timestamptz，明确指定中国时区（+08:00）
    -- 前端传递：中国时区的日期字符串（如 "2025-11-16"），通过 formatChinaDateString() 生成
    -- 后端处理：明确指定 +08:00，理解为中国时区的日期
    -- 存储结果：PostgreSQL自动转换为UTC存储（如 '2025-11-15 16:00:00+00:00'）
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
    p_current_cost,
    p_extra_cost,
    driver_payable,
    p_license_plate,
    p_driver_phone,
    p_transport_type,
    p_remarks,
    auth.uid()
  ) RETURNING id INTO new_record_id;

  -- 使用更新后的重算函数
  PERFORM public.recalculate_and_update_costs_for_record(new_record_id);

  RETURN new_record_id;
END;
$$;

-- 注释函数（指定完整参数类型列表以避免歧义）
COMMENT ON FUNCTION public.add_logistics_record_with_costs(
    uuid, text, uuid, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, text, text, text, text
) IS '添加运单记录并自动计算成本，修复日期类型转换问题';

