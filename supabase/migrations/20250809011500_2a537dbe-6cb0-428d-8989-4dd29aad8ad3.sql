-- 1) Create get_my_claim helper used by role/claims functions
CREATE OR REPLACE FUNCTION public.get_my_claim(claim text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  claims jsonb;
BEGIN
  claims := current_setting('request.jwt.claims', true)::jsonb;
  IF claims IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN claims ->> claim;
END;
$$;

-- 2) Update optimized project details function to include new optional fields
CREATE OR REPLACE FUNCTION public.get_projects_with_details_optimized()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'projects', COALESCE(jsonb_agg(
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
          'createdAt', p.created_at
        ) ORDER BY p.created_at DESC
      ), '[]'::jsonb),
      'chains', COALESCE((
        SELECT jsonb_object_agg(
          c.project_id,
          jsonb_agg(
            jsonb_build_object(
              'id', c.id,
              'projectId', c.project_id,
              'chainName', c.chain_name,
              'description', c.description,
              'isDefault', c.is_default,
              'createdAt', c.created_at
            ) ORDER BY c.is_default DESC, c.created_at
          )
        )
        FROM public.partner_chains c
      ), '{}'::jsonb),
      'partners', COALESCE((
        SELECT jsonb_object_agg(
          pp.project_id,
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
          )
        )
        FROM public.project_partners pp
        JOIN public.partners p ON pp.partner_id = p.id
      ), '{}'::jsonb)
    )
    FROM public.projects p
  );
END;
$$;

-- 3) Provide stable wrapper aligning with callers expecting this name
CREATE OR REPLACE FUNCTION public.get_projects_with_details()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN public.get_projects_with_details_optimized();
END;
$$;

-- 4) Update save_project_with_chains to handle planned_total_tons, cargo_type, finance_manager on both update and insert
CREATE OR REPLACE FUNCTION public.save_project_with_chains(
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
      cargo_type = project_data->>'cargo_type'
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
      cargo_type
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
      project_data->>'cargo_type'
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