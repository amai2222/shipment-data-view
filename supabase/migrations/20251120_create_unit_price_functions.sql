-- ============================================================================
-- 创建支持单价功能的新版本函数（_1120 版本）
-- 日期：2025-11-20
-- 说明：新函数名添加 _1120 后缀，避免与旧版本冲突
-- ============================================================================

-- ============================================================================
-- 第一步：添加新字段到 logistics_records 表
-- ============================================================================

ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS effective_quantity NUMERIC(10,3),
ADD COLUMN IF NOT EXISTS calculation_mode TEXT DEFAULT 'manual';

COMMENT ON COLUMN public.logistics_records.unit_price IS '单价（元/吨），用于自动计算运费';
COMMENT ON COLUMN public.logistics_records.effective_quantity IS '有效数量（吨），根据项目配置自动计算';
COMMENT ON COLUMN public.logistics_records.calculation_mode IS '计算模式：manual(手动输入) / auto(自动计算)';

ALTER TABLE public.logistics_records
ADD CONSTRAINT check_calculation_mode 
CHECK (calculation_mode IN ('manual', 'auto'));

CREATE INDEX IF NOT EXISTS idx_logistics_records_unit_price 
ON public.logistics_records(unit_price) 
WHERE unit_price IS NOT NULL;

-- ============================================================================
-- 第二步：为旧数据填充默认值
-- ============================================================================

UPDATE public.logistics_records
SET 
    calculation_mode = 'manual',
    effective_quantity = CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = logistics_records.project_id 
            AND p.effective_quantity_type = 'loading'
        ) THEN loading_weight
        WHEN EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = logistics_records.project_id 
            AND p.effective_quantity_type = 'unloading'
        ) THEN unloading_weight
        ELSE 
            CASE 
                WHEN loading_weight IS NOT NULL AND unloading_weight IS NOT NULL 
                THEN LEAST(loading_weight, unloading_weight)
                ELSE COALESCE(unloading_weight, loading_weight, 0)
            END
    END
WHERE calculation_mode IS NULL;

-- ============================================================================
-- 第三步：创建有效数量计算函数
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_effective_quantity_for_record_1120(
    p_loading_weight NUMERIC,
    p_unloading_weight NUMERIC,
    p_project_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_quantity_type public.effective_quantity_type;
    v_result NUMERIC;
BEGIN
    SELECT effective_quantity_type 
    INTO v_quantity_type
    FROM public.projects 
    WHERE id = p_project_id;
    
    v_quantity_type := COALESCE(v_quantity_type, 'min_value');
    
    CASE v_quantity_type
        WHEN 'loading' THEN
            v_result := COALESCE(p_loading_weight, 0);
        WHEN 'unloading' THEN
            v_result := COALESCE(p_unloading_weight, 0);
        ELSE -- 'min_value'
            IF p_loading_weight IS NOT NULL AND p_unloading_weight IS NOT NULL THEN
                v_result := LEAST(p_loading_weight, p_unloading_weight);
            ELSE
                v_result := COALESCE(p_unloading_weight, p_loading_weight, 0);
            END IF;
    END CASE;
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_effective_quantity_for_record_1120 IS '根据项目配置计算运单的有效数量（2025-11-20版本）';

-- ============================================================================
-- 第四步：创建自动计算触发器函数
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_calculate_cost_from_unit_price_1120()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_calculated_cost NUMERIC;
BEGIN
    -- 判断计算模式：有单价则为 auto，否则为 manual
    IF NEW.unit_price IS NOT NULL AND NEW.unit_price > 0 THEN
        NEW.calculation_mode := 'auto';
    ELSE
        NEW.calculation_mode := 'manual';
    END IF;
    
    -- 根据计算模式处理
    IF NEW.calculation_mode = 'auto' THEN
        -- 自动计算模式
        NEW.effective_quantity := public.get_effective_quantity_for_record_1120(
            NEW.loading_weight,
            NEW.unloading_weight,
            NEW.project_id
        );
        
        IF NEW.effective_quantity IS NOT NULL AND NEW.effective_quantity > 0 THEN
            v_calculated_cost := NEW.unit_price * NEW.effective_quantity;
            NEW.current_cost := ROUND(v_calculated_cost, 2);
        ELSE
            NEW.current_cost := 0;
        END IF;
        
        NEW.payable_cost := COALESCE(NEW.current_cost, 0) + COALESCE(NEW.extra_cost, 0);
        
        RAISE NOTICE '✅ 自动计算[项目=%]: 单价=%, 装货=%, 卸货=%, 有效数量=%, 运费=%, 应付=%', 
            NEW.project_id, NEW.unit_price, NEW.loading_weight, NEW.unloading_weight, 
            NEW.effective_quantity, NEW.current_cost, NEW.payable_cost;
    ELSE
        -- 手动输入模式
        NEW.effective_quantity := public.get_effective_quantity_for_record_1120(
            NEW.loading_weight,
            NEW.unloading_weight,
            NEW.project_id
        );
        
        NEW.payable_cost := COALESCE(NEW.current_cost, 0) + COALESCE(NEW.extra_cost, 0);
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_calculate_cost_from_unit_price_1120 IS '自动计算运费触发器函数（2025-11-20版本）';

-- ============================================================================
-- 第五步：创建触发器
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_auto_calculate_cost_from_unit_price_1120 ON public.logistics_records;

CREATE TRIGGER trigger_auto_calculate_cost_from_unit_price_1120
    BEFORE INSERT OR UPDATE OF unit_price, loading_weight, unloading_weight, extra_cost
    ON public.logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_calculate_cost_from_unit_price_1120();

-- ============================================================================
-- 第六步：创建新增运单函数（_1120 版本）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_logistics_record_with_costs_1120(
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

COMMENT ON FUNCTION public.add_logistics_record_with_costs_1120 IS '添加运单记录并自动计算成本（2025-11-20版本，支持单价功能）';

-- ============================================================================
-- 第七步：创建更新运单函数（_1120 版本）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_logistics_record_via_recalc_1120(
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

COMMENT ON FUNCTION public.update_logistics_record_via_recalc_1120 IS '更新运单记录并重新计算合作方成本（2025-11-20版本，支持单价功能）';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 单价功能函数创建完成（_1120 版本）';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '新增字段：';
    RAISE NOTICE '  ✓ unit_price - 单价（元/吨）';
    RAISE NOTICE '  ✓ effective_quantity - 有效数量（吨）';
    RAISE NOTICE '  ✓ calculation_mode - 计算模式';
    RAISE NOTICE '';
    RAISE NOTICE '新增函数：';
    RAISE NOTICE '  ✓ get_effective_quantity_for_record_1120';
    RAISE NOTICE '  ✓ auto_calculate_cost_from_unit_price_1120';
    RAISE NOTICE '  ✓ add_logistics_record_with_costs_1120';
    RAISE NOTICE '  ✓ update_logistics_record_via_recalc_1120';
    RAISE NOTICE '';
    RAISE NOTICE '触发器：';
    RAISE NOTICE '  ✓ trigger_auto_calculate_cost_from_unit_price_1120';
    RAISE NOTICE '';
    RAISE NOTICE '计算逻辑：';
    RAISE NOTICE '  ✓ 有单价 → auto 模式 → 自动计算运费';
    RAISE NOTICE '  ✓ 无单价 → manual 模式 → 手动输入运费';
    RAISE NOTICE '  ✓ 有效数量根据项目配置自动计算';
    RAISE NOTICE '';
    RAISE NOTICE '向后兼容：';
    RAISE NOTICE '  ✓ 旧数据自动设置为 manual 模式';
    RAISE NOTICE '  ✓ 旧函数保持不变，可以回滚';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

