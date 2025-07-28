-- Drop the existing function first to change return type
DROP FUNCTION IF EXISTS public.save_project_with_chains(uuid, jsonb, jsonb);

-- Optimize projects page performance with a more efficient function
CREATE OR REPLACE FUNCTION public.get_projects_with_details_optimized()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Use a simpler, faster query that leverages indexes
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
$function$;

-- Create a function to save project addresses to location database
CREATE OR REPLACE FUNCTION public.save_project_addresses_to_locations(
    p_project_id uuid,
    p_loading_address text,
    p_unloading_address text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Create/associate loading address
    IF p_loading_address IS NOT NULL AND p_loading_address != '' THEN
        PERFORM public.get_or_create_location_with_project(p_loading_address, p_project_id);
    END IF;
    
    -- Create/associate unloading address  
    IF p_unloading_address IS NOT NULL AND p_unloading_address != '' THEN
        PERFORM public.get_or_create_location_with_project(p_unloading_address, p_project_id);
    END IF;
END;
$function$;

-- Recreate save_project_with_chains to automatically save addresses and return project ID
CREATE OR REPLACE FUNCTION public.save_project_with_chains(project_id_in uuid, project_data jsonb, chains_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_project_id uuid;
    chain jsonb;
    v_chain_id uuid;
    partner jsonb;
BEGIN
    -- Step 1: Handle project information
    IF project_id_in IS NOT NULL THEN
        -- Update existing project
        v_project_id := project_id_in;
        UPDATE public.projects
        SET
            name = project_data->>'name',
            start_date = project_data->>'start_date',
            end_date = project_data->>'end_date',
            manager = project_data->>'manager',
            loading_address = project_data->>'loading_address',
            unloading_address = project_data->>'unloading_address'
        WHERE id = v_project_id;
    ELSE
        -- Create new project
        INSERT INTO public.projects (name, start_date, end_date, manager, loading_address, unloading_address)
        VALUES (
            project_data->>'name',
            project_data->>'start_date',
            project_data->>'end_date',
            project_data->>'manager',
            project_data->>'loading_address',
            project_data->>'unloading_address'
        ) RETURNING id INTO v_project_id;
    END IF;

    -- Step 2: Save project addresses to location database
    PERFORM public.save_project_addresses_to_locations(
        v_project_id,
        project_data->>'loading_address',
        project_data->>'unloading_address'
    );

    -- Step 3: Delete old relationships before creating new ones
    DELETE FROM public.project_partners WHERE project_id = v_project_id;
    DELETE FROM public.partner_chains WHERE project_id = v_project_id;

    -- Step 4: Create new partner chains and partners
    FOR chain IN SELECT * FROM jsonb_array_elements(chains_data)
    LOOP
        -- Insert partner chain
        INSERT INTO public.partner_chains (project_id, chain_name, description, is_default)
        VALUES (
            v_project_id,
            chain->>'chain_name',
            chain->>'description',
            (chain->>'is_default')::boolean
        ) RETURNING id INTO v_chain_id;

        -- Insert partners for this chain
        FOR partner IN SELECT * FROM jsonb_array_elements(chain->'partners')
        LOOP
            INSERT INTO public.project_partners (
                project_id,
                chain_id,
                partner_id,
                level,
                tax_rate,
                calculation_method,
                profit_rate
            )
            VALUES (
                v_project_id,
                v_chain_id,
                (partner->>'partner_id')::uuid,
                (partner->>'level')::integer,
                (partner->>'tax_rate')::numeric,
                partner->>'calculation_method',
                (partner->>'profit_rate')::numeric
            );
        END LOOP;
    END LOOP;

    -- Return the project ID for confirmation
    RETURN jsonb_build_object('project_id', v_project_id);
END;
$function$;