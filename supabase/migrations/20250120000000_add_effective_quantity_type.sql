-- 为项目表添加有效数量类型字段
-- 这个字段用于配置有效数量的计算方式

-- 1. 创建有效数量类型的枚举
CREATE TYPE public.effective_quantity_type AS ENUM (
    'min_value',    -- 1. 装货数量和卸货数量取较小值
    'loading',      -- 2. 取装货数量
    'unloading'     -- 3. 取卸货数量
);

-- 2. 为 projects 表添加有效数量类型字段
ALTER TABLE public.projects 
ADD COLUMN effective_quantity_type public.effective_quantity_type 
DEFAULT 'min_value' NOT NULL;

-- 3. 为现有项目设置默认值
UPDATE public.projects 
SET effective_quantity_type = 'min_value' 
WHERE effective_quantity_type IS NULL;

-- 4. 添加注释说明
COMMENT ON COLUMN public.projects.effective_quantity_type IS '有效数量计算类型：min_value=取较小值，loading=取装货数量，unloading=取卸货数量';
COMMENT ON TYPE public.effective_quantity_type IS '有效数量计算类型枚举';

-- 5. 更新项目创建和更新函数，支持有效数量类型
CREATE OR REPLACE FUNCTION public.upsert_project_with_details(
  project_id_in UUID DEFAULT NULL,
  project_data JSONB,
  chains_data JSONB DEFAULT '[]'::jsonb,
  partners_data JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_project_id UUID;
  chain JSONB;
  partner JSONB;
BEGIN
  IF project_id_in IS NOT NULL THEN
    v_project_id := project_id_in;
    UPDATE public.projects
    SET
      name = project_data->>'name',
      start_date = (project_data->>'start_date')::date,
      end_date = (project_data->>'end_date')::date,
      manager = project_data->>'manager',
      loading_address = project_data->>'loading_address',
      unloading_address = project_data->>'unloading_address',
      finance_manager = project_data->>'finance_manager',
      planned_total_tons = NULLIF(project_data->>'planned_total_tons', '')::numeric,
      cargo_type = project_data->>'cargo_type',
      effective_quantity_type = COALESCE(
        (project_data->>'effective_quantity_type')::public.effective_quantity_type,
        'min_value'
      )
    WHERE id = v_project_id;
  ELSE
    INSERT INTO public.projects (
      user_id,
      project_status,
      name,
      start_date,
      end_date,
      manager,
      loading_address,
      unloading_address,
      finance_manager,
      planned_total_tons,
      cargo_type,
      effective_quantity_type
    )
    VALUES (
      auth.uid(),
      '进行中',
      project_data->>'name',
      (project_data->>'start_date')::date,
      (project_data->>'end_date')::date,
      project_data->>'manager',
      project_data->>'loading_address',
      project_data->>'unloading_address',
      project_data->>'finance_manager',
      NULLIF(project_data->>'planned_total_tons', '')::numeric,
      project_data->>'cargo_type',
      COALESCE(
        (project_data->>'effective_quantity_type')::public.effective_quantity_type,
        'min_value'
      )
    ) RETURNING id INTO v_project_id;
  END IF;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION '无法确定项目ID，操作已回滚。';
  END IF;

  PERFORM public.get_or_create_location(project_data->>'loading_address', v_project_id);
  PERFORM public.get_or_create_location(project_data->>'unloading_address', v_project_id);

  DELETE FROM public.project_partners WHERE project_id = v_project_id;
  DELETE FROM public.partner_chains WHERE project_id = v_project_id;

  FOR chain IN SELECT * FROM jsonb_array_elements(chains_data)
  LOOP
    INSERT INTO public.partner_chains (
      project_id,
      chain_name,
      description,
      is_default
    ) VALUES (
      v_project_id,
      chain->>'chainName',
      chain->>'description',
      COALESCE((chain->>'isDefault')::boolean, false)
    );
  END LOOP;

  FOR partner IN SELECT * FROM jsonb_array_elements(partners_data)
  LOOP
    INSERT INTO public.project_partners (
      project_id,
      partner_id,
      chain_id,
      level,
      tax_rate,
      calculation_method,
      profit_rate
    ) VALUES (
      v_project_id,
      (partner->>'partnerId')::uuid,
      (partner->>'chainId')::uuid,
      (partner->>'level')::integer,
      NULLIF(partner->>'taxRate', '')::numeric,
      partner->>'calculationMethod',
      NULLIF(partner->>'profitRate', '')::numeric
    );
  END LOOP;

  RETURN v_project_id;
END;
$function$;

-- 6. 更新获取项目详情的函数，包含有效数量类型
CREATE OR REPLACE FUNCTION public.get_projects_with_details_optimized()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  projects_json jsonb;
  chains_json jsonb;
  partners_json jsonb;
BEGIN
  -- Projects list with project_status and effective_quantity_type
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'startDate', p.start_date,
      'endDate', p.end_date,
      'manager', p.manager,
      'loadingAddress', p.loading_address,
      'unloadingAddress', p.unloading_address,
      'autoCode', p.auto_code,
      'plannedTotalTons', p.planned_total_tons,
      'cargoType', p.cargo_type,
      'financeManager', p.finance_manager,
      'projectStatus', p.project_status,
      'effectiveQuantityType', p.effective_quantity_type,
      'createdAt', p.created_at
    ) ORDER BY p.created_at DESC
  ), '[]'::jsonb)
  INTO projects_json
  FROM public.projects p;

  -- Chains grouped per project (no nested aggregates)
  SELECT COALESCE(jsonb_object_agg(project_id, chains_array), '{}'::jsonb)
  INTO chains_json
  FROM (
    SELECT c.project_id,
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'projectId', c.project_id,
          'chainName', c.chain_name,
          'description', c.description,
          'isDefault', c.is_default,
          'createdAt', c.created_at
        ) ORDER BY c.is_default DESC, c.created_at
      ) AS chains_array
    FROM public.partner_chains c
    GROUP BY c.project_id
  ) AS chains_grouped;

  -- Partners grouped per project (no nested aggregates)
  SELECT COALESCE(jsonb_object_agg(project_id, partners_array), '{}'::jsonb)
  INTO partners_json
  FROM (
    SELECT pp.project_id,
      jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'projectId', pp.project_id,
          'partnerId', pp.partner_id,
          'partnerName', p.name,
          'chainId', pp.chain_id,
          'level', pp.level,
          'taxRate', pp.tax_rate,
          'calculationMethod', pp.calculation_method,
          'profitRate', pp.profit_rate,
          'createdAt', pp.created_at
        ) ORDER BY pp.level ASC
      ) AS partners_array
    FROM public.project_partners pp
    JOIN public.partners p ON pp.partner_id = p.id
    GROUP BY pp.project_id
  ) AS partners_grouped;

  RETURN jsonb_build_object(
    'projects', projects_json,
    'chains', chains_json,
    'partners', partners_json
  );
END;
$function$;
