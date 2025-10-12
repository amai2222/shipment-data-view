-- 修复司机项目关联功能
-- 文件: supabase/migrations/20250120000011_fix_driver_project_association.sql

-- 重新创建查找司机对应项目的函数，确保返回所有司机
CREATE OR REPLACE FUNCTION public.find_driver_projects(
    p_driver_ids uuid[]
)
RETURNS TABLE(
    driver_id uuid,
    driver_name text,
    license_plate text,
    project_ids uuid[],
    project_names text[],
    record_count bigint
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        d.id as driver_id,
        d.name as driver_name,
        d.license_plate,
        COALESCE(
            ARRAY_AGG(DISTINCT lr.project_id) FILTER (WHERE lr.project_id IS NOT NULL),
            '{}'::uuid[]
        ) as project_ids,
        COALESCE(
            ARRAY_AGG(DISTINCT lr.project_name) FILTER (WHERE lr.project_name IS NOT NULL),
            '{}'::text[]
        ) as project_names,
        COUNT(lr.id) as record_count
    FROM public.drivers d
    LEFT JOIN public.logistics_records lr ON (
        lr.driver_name = d.name 
        OR lr.license_plate = d.license_plate
        OR lr.driver_phone = d.phone
    )
    WHERE d.id = ANY(p_driver_ids)
    GROUP BY d.id, d.name, d.license_plate;
END;
$function$;

-- 重新创建预览函数，确保汇总数据正确
CREATE OR REPLACE FUNCTION public.preview_driver_project_association(
    p_driver_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'drivers', COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'driver_id', driver_id,
                    'driver_name', driver_name,
                    'license_plate', license_plate,
                    'project_ids', project_ids,
                    'project_names', project_names,
                    'record_count', record_count,
                    'has_projects', array_length(project_ids, 1) > 0
                )
            ),
            '[]'::jsonb
        ),
        'summary', jsonb_build_object(
            'total_drivers', array_length(p_driver_ids, 1),
            'drivers_with_projects', COUNT(*) FILTER (WHERE array_length(project_ids, 1) > 0),
            'drivers_without_projects', COUNT(*) FILTER (WHERE array_length(project_ids, 1) = 0 OR project_ids IS NULL),
            'total_records', SUM(record_count)
        )
    ) INTO v_result
    FROM public.find_driver_projects(p_driver_ids);

    RETURN v_result;
END;
$function$;

-- 重新创建批量关联函数，确保错误处理正确
CREATE OR REPLACE FUNCTION public.batch_associate_driver_projects(
    p_driver_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
    v_updated_count integer := 0;
    v_skipped_count integer := 0;
    driver_info RECORD;
    project_id uuid;
BEGIN
    -- 查找每个司机对应的项目
    FOR driver_info IN 
        SELECT * FROM public.find_driver_projects(p_driver_ids)
    LOOP
        -- 如果找到项目，在driver_projects表中创建关联
        IF array_length(driver_info.project_ids, 1) > 0 THEN
            -- 先删除该司机的现有项目关联
            DELETE FROM public.driver_projects 
            WHERE driver_id = driver_info.driver_id;
            
            -- 插入新的项目关联
            FOREACH project_id IN ARRAY driver_info.project_ids
            LOOP
                INSERT INTO public.driver_projects (driver_id, project_id)
                VALUES (driver_info.driver_id, project_id)
                ON CONFLICT (driver_id, project_id) DO NOTHING;
            END LOOP;
            
            v_updated_count := v_updated_count + 1;
        ELSE
            v_skipped_count := v_skipped_count + 1;
        END IF;
    END LOOP;

    -- 返回结果
    SELECT jsonb_build_object(
        'success', true,
        'updated_count', v_updated_count,
        'skipped_count', v_skipped_count,
        'total_processed', array_length(p_driver_ids, 1),
        'message', format('成功更新 %s 个司机的项目关联，跳过 %s 个未找到项目的司机', v_updated_count, v_skipped_count)
    ) INTO v_result;

    RETURN v_result;
END;
$function$;
