-- 修复项目管理中项目状态更新不生效的问题
-- 创建新的函数而不是修改现有函数，确保完美回滚能力

-- 1. 创建新的项目详情查询函数（包含完整字段映射）
CREATE OR REPLACE FUNCTION public.get_projects_with_details_fixed()
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
  -- Projects list with complete field mapping including project_status and effective_quantity_type
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
          'chainId', pp.chain_id,
          'level', pp.level,
          'taxRate', pp.tax_rate,
          'calculationMethod', pp.calculation_method,
          'profitRate', pp.profit_rate,
          'createdAt', pp.created_at,
          'partnerName', p.name
        ) ORDER BY pp.level
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

-- 2. 创建新的项目保存函数（包含完整的字段更新）
CREATE OR REPLACE FUNCTION public.save_project_with_chains_fixed(
  project_id_in uuid,
  project_data jsonb,
  chains_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id uuid;
  chain jsonb;
  v_chain_id uuid;
  partner jsonb;
BEGIN
  IF project_id_in IS NOT NULL THEN
    -- 更新现有项目（包含所有字段）
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
      project_status = project_data->>'project_status',
      effective_quantity_type = project_data->>'effective_quantity_type'
    WHERE id = v_project_id;
  ELSE
    -- 创建新项目（包含所有字段）
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
      COALESCE(project_data->>'project_status', '进行中'),
      project_data->>'name',
      (project_data->>'start_date')::date,
      (project_data->>'end_date')::date,
      project_data->>'manager',
      project_data->>'loading_address',
      project_data->>'unloading_address',
      project_data->>'finance_manager',
      NULLIF(project_data->>'planned_total_tons', '')::numeric,
      project_data->>'cargo_type',
      COALESCE(project_data->>'effective_quantity_type', 'min_value')
    ) RETURNING id INTO v_project_id;
  END IF;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION '无法确定项目ID，操作已回滚。';
  END IF;

  -- 保存项目地址到地点数据库
  PERFORM public.get_or_create_location(project_data->>'loading_address', v_project_id);
  PERFORM public.get_or_create_location(project_data->>'unloading_address', v_project_id);

  -- 删除旧的关系数据
  DELETE FROM public.project_partners WHERE project_id = v_project_id;
  DELETE FROM public.partner_chains WHERE project_id = v_project_id;

  -- 创建新的合作链路和合作方
  FOR chain IN SELECT * FROM jsonb_array_elements(chains_data)
  LOOP
    INSERT INTO public.partner_chains (project_id, chain_name, description, is_default, user_id)
    VALUES (v_project_id, chain->>'chain_name', chain->>'description', (chain->>'is_default')::boolean, auth.uid())
    RETURNING id INTO v_chain_id;

    FOR partner IN SELECT * FROM jsonb_array_elements(chain->'partners')
    LOOP
      INSERT INTO public.project_partners (
        project_id, chain_id, partner_id, level,
        tax_rate, calculation_method, profit_rate, user_id
      )
      VALUES (
        v_project_id, v_chain_id, (partner->>'partner_id')::uuid, (partner->>'level')::integer,
        (partner->>'tax_rate')::numeric, partner->>'calculation_method', (partner->>'profit_rate')::numeric, auth.uid()
      );
    END LOOP;
  END LOOP;
END;
$$;

-- 3. 创建回滚函数（用于快速回滚到原始状态）
CREATE OR REPLACE FUNCTION public.rollback_project_functions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 删除新创建的函数
  DROP FUNCTION IF EXISTS public.get_projects_with_details_fixed();
  DROP FUNCTION IF EXISTS public.save_project_with_chains_fixed();
  DROP FUNCTION IF EXISTS public.rollback_project_functions();
  
  RAISE NOTICE '项目函数已回滚到原始状态';
END;
$$;
