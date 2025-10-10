-- 修复项目管理中项目状态更新不生效的问题
-- 更新save_project_with_chains RPC函数，添加project_status和effective_quantity_type字段更新

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
      cargo_type = project_data->>'cargo_type',
      project_status = project_data->>'project_status',
      effective_quantity_type = project_data->>'effective_quantity_type'
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
