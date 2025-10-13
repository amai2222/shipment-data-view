-- 修复Excel导入时司机项目关联问题
-- 问题：已存在的司机不会被关联到项目，只有新创建的司机才会关联
-- 解决：将关联逻辑移到IF块外，确保所有司机（新建或已存在）都会关联到项目

CREATE OR REPLACE FUNCTION public.import_logistics_data(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    success_records jsonb := '[]'::jsonb;
    failures jsonb := '[]'::jsonb;
    project_record RECORD;
    driver_result RECORD;
    loading_location_id uuid;
    unloading_location_id uuid;
    chain_result RECORD;
    new_record_id uuid;
    record_data jsonb;
    row_index integer := 0;
BEGIN
    -- 处理每条记录
    FOR record_data IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        row_index := row_index + 1;
        BEGIN
            -- 第1步：获取项目信息
            SELECT id, name INTO project_record
            FROM public.projects 
            WHERE name = (record_data->>'project_name') 
            LIMIT 1;

            IF project_record.id IS NULL THEN
                failures := failures || jsonb_build_object(
                    'row_index', row_index,
                    'data', record_data,
                    'error', '项目不存在: ' || (record_data->>'project_name')
                );
                CONTINUE;
            END IF;
            
            -- 第2步：查找或创建司机（根据姓名+车牌+电话三个字段）
            SELECT id, name INTO driver_result
            FROM public.drivers
            WHERE name = (record_data->>'driver_name')
              AND COALESCE(license_plate, '') = COALESCE(record_data->>'license_plate', '')
              AND COALESCE(phone, '') = COALESCE(record_data->>'driver_phone', '')
            LIMIT 1;
            
            -- 如果司机不存在，创建新司机
            IF driver_result.id IS NULL THEN
                INSERT INTO public.drivers (name, license_plate, phone, user_id)
                VALUES (
                    (record_data->>'driver_name'),
                    (record_data->>'license_plate'),
                    (record_data->>'driver_phone'),
                    auth.uid()
                )
                RETURNING id, name INTO driver_result;
            END IF;
            
            -- ✅ 修复：将关联逻辑移到IF块外，确保所有司机都会关联到项目
            -- 无论司机是新创建还是已存在，都要关联到当前项目
            INSERT INTO public.driver_projects (driver_id, project_id, user_id)
            VALUES (driver_result.id, project_record.id, auth.uid())
            ON CONFLICT (driver_id, project_id) DO NOTHING;
            
            -- 第3步：查找或创建装货地点
            SELECT id INTO loading_location_id
            FROM public.locations
            WHERE name = (record_data->>'loading_location')
            LIMIT 1;
            
            IF loading_location_id IS NULL THEN
                INSERT INTO public.locations (name, user_id)
                VALUES ((record_data->>'loading_location'), auth.uid())
                RETURNING id INTO loading_location_id;
            END IF;
            
            -- 第4步：查找或创建卸货地点
            SELECT id INTO unloading_location_id
            FROM public.locations
            WHERE name = (record_data->>'unloading_location')
            LIMIT 1;
            
            IF unloading_location_id IS NULL THEN
                INSERT INTO public.locations (name, user_id)
                VALUES ((record_data->>'unloading_location'), auth.uid())
                RETURNING id INTO unloading_location_id;
            END IF;
            
            -- 第5步：查找合作链路（如果提供）
            IF record_data->>'chain_name' IS NOT NULL AND record_data->>'chain_name' != '' THEN
                SELECT id INTO chain_result
                FROM public.partner_chains
                WHERE project_id = project_record.id 
                  AND chain_name = (record_data->>'chain_name')
                LIMIT 1;
            END IF;
            
            -- 第6步：插入运单记录
            INSERT INTO public.logistics_records (
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
                transport_type,
                license_plate,
                driver_phone,
                remarks,
                user_id,
                external_tracking_numbers,
                other_platform_names
            ) VALUES (
                project_record.id,
                project_record.name,
                chain_result.id,
                driver_result.id,
                driver_result.name,
                record_data->>'loading_location',
                record_data->>'unloading_location',
                (record_data->>'loading_date')::date,
                CASE 
                    WHEN record_data->>'unloading_date' IS NOT NULL 
                    THEN (record_data->>'unloading_date')::date 
                    ELSE NULL 
                END,
                CASE 
                    WHEN record_data->>'loading_weight' ~ '^[0-9]*\.?[0-9]+$' 
                    THEN (record_data->>'loading_weight')::numeric 
                    ELSE NULL 
                END,
                CASE 
                    WHEN record_data->>'unloading_weight' ~ '^[0-9]*\.?[0-9]+$' 
                    THEN (record_data->>'unloading_weight')::numeric 
                    ELSE NULL 
                END,
                CASE 
                    WHEN record_data->>'current_cost' ~ '^[0-9]*\.?[0-9]+$' 
                    THEN (record_data->>'current_cost')::numeric 
                    ELSE NULL 
                END,
                CASE 
                    WHEN record_data->>'extra_cost' ~ '^-?[0-9]*\.?[0-9]+$' 
                    THEN (record_data->>'extra_cost')::numeric 
                    ELSE NULL 
                END,
                COALESCE(record_data->>'transport_type', '实际运输'),
                record_data->>'license_plate',
                record_data->>'driver_phone',
                record_data->>'remarks',
                auth.uid(),
                -- 处理平台运单号数组
                CASE 
                    WHEN record_data->'external_tracking_numbers' IS NOT NULL 
                    THEN ARRAY(SELECT jsonb_array_elements_text(record_data->'external_tracking_numbers'))::text[]
                    ELSE NULL
                END,
                -- 处理平台名称数组
                CASE 
                    WHEN record_data->'other_platform_names' IS NOT NULL 
                    THEN ARRAY(SELECT jsonb_array_elements_text(record_data->'other_platform_names'))::text[]
                    ELSE NULL
                END
            )
            RETURNING id INTO new_record_id;
            
            success_records := success_records || jsonb_build_object(
                'row_index', row_index,
                'record_id', new_record_id
            );
            
        EXCEPTION
            WHEN OTHERS THEN
                failures := failures || jsonb_build_object(
                    'row_index', row_index,
                    'data', record_data,
                    'error', SQLERRM
                );
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', jsonb_array_length(success_records),
        'failures', jsonb_array_length(failures),
        'success_records', success_records,
        'failure_records', failures
    );
END;
$function$;

-- 添加注释说明
COMMENT ON FUNCTION public.import_logistics_data IS '
Excel导入运单数据函数
修复内容：
1. 确保所有司机（新建或已存在）都会关联到项目
2. 支持平台运单信息导入（other_platform_names, external_tracking_numbers）
3. 使用ON CONFLICT DO NOTHING避免重复关联
';

