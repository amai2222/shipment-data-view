-- 修复所有运单相关计算函数，使其支持新的有效数量类型
-- 包括新增运单、导入运单、编辑运单等所有场景

-- 1. 更新 recalculate_and_update_costs_for_records 函数（批量导入时使用）
CREATE OR REPLACE FUNCTION public.recalculate_and_update_costs_for_records(p_record_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- 删除现有的成本记录
    DELETE FROM public.logistics_partner_costs 
    WHERE logistics_record_id = ANY(p_record_ids);

    -- 批量插入新的成本记录
    WITH records_to_process AS (
        SELECT
            lr.id,
            lr.project_id,
            -- 确定有效链路ID
            COALESCE(lr.chain_id, dc.id) AS effective_chain_id,
            -- 计算基础应付金额
            (COALESCE(lr.current_cost, 0) + COALESCE(lr.extra_cost, 0)) AS base_payable_amount,
            -- 使用项目配置的有效数量类型计算有效数量
            public.calculate_effective_quantity(
                lr.loading_weight, 
                lr.unloading_weight, 
                COALESCE(p.effective_quantity_type, 'min_value')
            ) AS effective_quantity
        FROM
            public.logistics_records lr
        LEFT JOIN -- 查找默认链路
            public.partner_chains dc ON lr.project_id = dc.project_id AND dc.is_default = true
        LEFT JOIN -- 获取项目配置
            public.projects p ON lr.project_id = p.id
        WHERE
            lr.id = ANY(p_record_ids)
    )
    INSERT INTO public.logistics_partner_costs
        (logistics_record_id, partner_id, level, base_amount, payable_amount, tax_rate, user_id)
    SELECT
        rec.id AS logistics_record_id,
        pp.partner_id,
        pp.level,
        rec.base_payable_amount AS base_amount,
        -- 应用公式计算最终金额
        CASE
            WHEN pp.calculation_method = 'profit' THEN
                CASE
                    WHEN rec.effective_quantity > 0 THEN
                        rec.base_payable_amount + (COALESCE(pp.profit_rate, 0) * rec.effective_quantity)
                    ELSE
                        rec.base_payable_amount + COALESCE(pp.profit_rate, 0)
                END
            ELSE -- 默认为税点法
                CASE
                    WHEN pp.tax_rate IS NOT NULL AND pp.tax_rate <> 1 THEN
                        rec.base_payable_amount / (1 - pp.tax_rate)
                    ELSE
                        rec.base_payable_amount
                END
        END AS payable_amount,
        pp.tax_rate,
        auth.uid()
    FROM
        records_to_process rec
    -- 将每条运单与其有效链路上的所有合作方进行连接
    JOIN
        public.project_partners pp ON rec.effective_chain_id = pp.chain_id
    WHERE
        rec.effective_chain_id IS NOT NULL AND rec.base_payable_amount > 0;
END;
$function$;

-- 2. 更新 add_logistics_record_with_costs 函数（新增运单时使用）
CREATE OR REPLACE FUNCTION public.add_logistics_record_with_costs(
    p_project_id uuid, 
    p_project_name text, 
    p_chain_id uuid, 
    p_driver_id uuid, 
    p_driver_name text, 
    p_loading_location text, 
    p_unloading_location text, 
    p_loading_date text, 
    p_loading_weight numeric, 
    p_unloading_weight numeric, 
    p_current_cost numeric, 
    p_license_plate text, 
    p_driver_phone text, 
    p_transport_type text, 
    p_extra_cost numeric, 
    p_remarks text, 
    p_unloading_date text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    p_loading_date,
    p_unloading_date,
    p_loading_weight,
    p_unloading_weight,
    p_current_cost,
    p_extra_cost,
    driver_payable,
    p_license_plate,
    p_driver_phone,
    p_transport_type,
    p_remarks,
    'user'
  ) RETURNING id INTO new_record_id;

  -- 使用更新后的重算函数
  PERFORM public.recalculate_and_update_costs_for_record(new_record_id);
END;
$function$;

-- 3. 更新 update_logistics_record_via_recalc 函数（编辑运单时使用）
CREATE OR REPLACE FUNCTION public.update_logistics_record_via_recalc(
    p_record_id uuid,
    p_project_id uuid,
    p_project_name text,
    p_chain_id uuid,
    p_driver_id uuid,
    p_driver_name text,
    p_loading_location text,
    p_unloading_location text,
    p_loading_date timestamp,
    p_loading_weight numeric,
    p_unloading_weight numeric,
    p_current_cost numeric,
    p_license_plate text,
    p_driver_phone text,
    p_transport_type text,
    p_extra_cost numeric,
    p_remarks text,
    p_unloading_date timestamp
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    driver_payable numeric;
BEGIN
    -- 计算司机应付金额
    driver_payable := (COALESCE(p_current_cost, 0) + COALESCE(p_extra_cost, 0));

    -- 更新运单记录
    UPDATE public.logistics_records SET
        project_id = p_project_id,
        project_name = p_project_name,
        chain_id = p_chain_id,
        driver_id = p_driver_id,
        driver_name = p_driver_name,
        loading_location = p_loading_location,
        unloading_location = p_unloading_location,
        loading_date = p_loading_date,
        unloading_date = p_unloading_date,
        loading_weight = p_loading_weight,
        unloading_weight = p_unloading_weight,
        current_cost = p_current_cost,
        extra_cost = p_extra_cost,
        payable_cost = driver_payable,
        license_plate = p_license_plate,
        driver_phone = p_driver_phone,
        transport_type = p_transport_type,
        remarks = p_remarks
    WHERE id = p_record_id;

    -- 重新计算合作方成本
    PERFORM public.recalculate_and_update_costs_for_record(p_record_id);
END;
$function$;

-- 4. 添加注释说明
COMMENT ON FUNCTION public.recalculate_and_update_costs_for_records IS '批量重新计算合作方成本，使用项目配置的有效数量类型';
COMMENT ON FUNCTION public.add_logistics_record_with_costs IS '添加运单记录并自动计算合作方成本，使用项目配置的有效数量类型';
COMMENT ON FUNCTION public.update_logistics_record_via_recalc IS '更新运单记录并重新计算合作方成本，使用项目配置的有效数量类型';
