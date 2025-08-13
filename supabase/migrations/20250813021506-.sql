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
  -- Projects list with project_status
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
$function$