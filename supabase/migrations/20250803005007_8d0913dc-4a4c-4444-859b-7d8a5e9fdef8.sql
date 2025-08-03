-- Create the missing database functions that the import functionality requires

-- Function to preview imports and check for duplicates
CREATE OR REPLACE FUNCTION public.preview_import_with_duplicates_check(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    record_data jsonb;
    new_records_json jsonb := '[]'::jsonb;
    duplicate_records_json jsonb := '[]'::jsonb;
    error_records_json jsonb := '[]'::jsonb;
    project_exists boolean;
    is_duplicate boolean;
    chain_name_val text;
    loading_date_formatted text;
BEGIN
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        -- 1. Check required fields and if project exists
        IF (record_data->>'project_name') IS NULL OR (record_data->>'project_name') = '' OR
           (record_data->>'driver_name') IS NULL OR (record_data->>'driver_name') = '' OR
           (record_data->>'loading_location') IS NULL OR (record_data->>'loading_location') = '' OR
           (record_data->>'loading_date') IS NULL OR (record_data->>'loading_date') = '' THEN
            error_records_json := error_records_json || jsonb_build_object('record', record_data, 'error', '缺少必填字段');
            CONTINUE;
        END IF;

        SELECT EXISTS (SELECT 1 FROM public.projects WHERE name = (record_data->>'project_name')) INTO project_exists;
        IF NOT project_exists THEN
            error_records_json := error_records_json || jsonb_build_object('record', record_data, 'error', '项目不存在');
            CONTINUE;
        END IF;

        -- 2. Check for duplicates with existing records
        chain_name_val := record_data->>'chain_name';
        loading_date_formatted := (record_data->>'loading_date');

        SELECT EXISTS (
            SELECT 1 FROM public.logistics_records lr
            LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
            WHERE
                lr.project_name = (record_data->>'project_name')
                AND COALESCE(pc.chain_name, '') = COALESCE(chain_name_val, '')
                AND lr.driver_name = (record_data->>'driver_name')
                AND COALESCE(lr.license_plate, '') = COALESCE(record_data->>'license_plate', '')
                AND COALESCE(lr.driver_phone, '') = COALESCE(record_data->>'driver_phone', '')
                AND lr.loading_location = (record_data->>'loading_location')
                AND lr.loading_date::date = loading_date_formatted::date
                AND lr.transport_type = (record_data->>'transport_type')
                AND COALESCE(lr.loading_weight, 0) = COALESCE((record_data->>'loading_weight')::numeric, 0)
        ) INTO is_duplicate;

        -- 3. Categorize records
        IF is_duplicate THEN
            duplicate_records_json := duplicate_records_json || jsonb_build_object('record', record_data);
        ELSE
            new_records_json := new_records_json || jsonb_build_object('record', record_data);
        END IF;

    END LOOP;

    -- 4. Return categorized results
    RETURN jsonb_build_object(
        'new_records', new_records_json,
        'duplicate_records', duplicate_records_json,
        'error_records', error_records_json
    );
END;
$$;

-- Function to batch import logistics records
CREATE OR REPLACE FUNCTION public.batch_import_logistics_records(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    record_data jsonb;
    success_count integer := 0;
    error_count integer := 0;
    errors_json jsonb := '[]'::jsonb;
    project_record record;
    driver_result record;
    chain_id_val uuid;
    loading_date_formatted text;
    unloading_date_formatted text;
    new_record_id uuid;
    v_auto_number text;
    driver_payable numeric;
BEGIN
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        BEGIN
            -- Get project
            SELECT id, name INTO project_record
            FROM public.projects WHERE name = (record_data->>'project_name') LIMIT 1;
            
            -- Get or create driver
            SELECT driver_id, driver_name INTO driver_result
            FROM public.get_or_create_driver(
                (record_data->>'driver_name'), 
                (record_data->>'license_plate'), 
                (record_data->>'driver_phone'), 
                project_record.id
            ) LIMIT 1;
            
            -- Get or create locations
            PERFORM public.get_or_create_location((record_data->>'loading_location'), project_record.id);
            PERFORM public.get_or_create_location((record_data->>'unloading_location'), project_record.id);

            -- Get chain ID
            chain_id_val := NULL;
            IF (record_data->>'chain_name') IS NOT NULL AND (record_data->>'chain_name') != '' THEN
                SELECT id INTO chain_id_val
                FROM public.partner_chains 
                WHERE project_id = project_record.id AND chain_name = (record_data->>'chain_name') 
                LIMIT 1;
            END IF;

            -- Prepare dates
            loading_date_formatted := (record_data->>'loading_date');
            unloading_date_formatted := COALESCE(NULLIF(record_data->>'unloading_date', ''), loading_date_formatted);
            
            -- Generate auto number
            v_auto_number := EXTRACT(YEAR FROM loading_date_formatted::date)::text || 
                           LPAD(EXTRACT(MONTH FROM loading_date_formatted::date)::text, 2, '0') || 
                           LPAD(EXTRACT(DAY FROM loading_date_formatted::date)::text, 2, '0') || 
                           LPAD((EXTRACT(EPOCH FROM NOW()) % 86400)::integer::text, 5, '0');
            
            -- Calculate driver payable
            driver_payable := COALESCE((record_data->>'current_cost')::numeric, 0) + 
                            COALESCE((record_data->>'extra_cost')::numeric, 0);

            -- Insert record
            INSERT INTO public.logistics_records (
                auto_number, project_id, project_name, chain_id, driver_id, driver_name, 
                loading_location, unloading_location, loading_date, unloading_date, 
                loading_weight, unloading_weight, current_cost, extra_cost,
                license_plate, driver_phone, transport_type, remarks, payable_cost, 
                created_by_user_id
            ) VALUES (
                v_auto_number, project_record.id, project_record.name, chain_id_val, 
                driver_result.driver_id, driver_result.driver_name,
                (record_data->>'loading_location'), (record_data->>'unloading_location'),
                loading_date_formatted::timestamptz, unloading_date_formatted::timestamptz,
                NULLIF((record_data->>'loading_weight')::text, '')::numeric, 
                NULLIF((record_data->>'unloading_weight')::text, '')::numeric,
                COALESCE((record_data->>'current_cost')::numeric, 0), 
                COALESCE((record_data->>'extra_cost')::numeric, 0),
                (record_data->>'license_plate'), (record_data->>'driver_phone'),
                COALESCE((record_data->>'transport_type'),'实际运输'), (record_data->>'remarks'),
                driver_payable, 'batch_import_user'
            ) RETURNING id INTO new_record_id;

            -- Recalculate partner costs
            PERFORM public.recalculate_and_update_costs_for_record(new_record_id);
            success_count := success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            errors_json := errors_json || jsonb_build_object('record', record_data, 'error', SQLERRM);
            error_count := error_count + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success_count', success_count, 
        'error_count', error_count, 
        'errors', errors_json
    );
END;
$$;