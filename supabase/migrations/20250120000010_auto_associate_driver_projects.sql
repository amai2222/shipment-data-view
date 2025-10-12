-- 创建自动关联司机项目的功能
-- 文件: supabase/migrations/20250120000010_auto_associate_driver_projects.sql

-- 1. 创建查找司机对应项目的函数
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

-- 2. 创建批量更新司机项目关联的函数
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

-- 3. 创建预览司机项目关联的函数
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

-- 4. 创建司机分页查询函数（包含项目关联信息）
-- 先删除可能存在的旧函数
DROP FUNCTION IF EXISTS public.get_drivers_paginated(integer, integer, text);

CREATE OR REPLACE FUNCTION public.get_drivers_paginated(
    p_page_number integer DEFAULT 1,
    p_page_size integer DEFAULT 30,
    p_search_text text DEFAULT ''
)
RETURNS TABLE(
    id uuid,
    name text,
    license_plate text,
    phone text,
    project_ids uuid[],
    created_at timestamp with time zone,
    total_records bigint
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
    v_offset integer;
    v_total_count bigint;
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 获取总记录数
    SELECT COUNT(*) INTO v_total_count
    FROM public.drivers d
    WHERE p_search_text = '' OR p_search_text IS NULL OR (
        d.name ILIKE '%' || p_search_text || '%' OR
        d.license_plate ILIKE '%' || p_search_text || '%' OR
        d.phone ILIKE '%' || p_search_text || '%'
    );
    
    -- 返回分页数据
    RETURN QUERY
    SELECT 
        d.id,
        d.name,
        d.license_plate,
        d.phone,
        COALESCE(
            ARRAY_AGG(dp.project_id) FILTER (WHERE dp.project_id IS NOT NULL),
            '{}'::uuid[]
        ) as project_ids,
        d.created_at,
        v_total_count as total_records
    FROM public.drivers d
    LEFT JOIN public.driver_projects dp ON d.id = dp.driver_id
    WHERE p_search_text = '' OR p_search_text IS NULL OR (
        d.name ILIKE '%' || p_search_text || '%' OR
        d.license_plate ILIKE '%' || p_search_text || '%' OR
        d.phone ILIKE '%' || p_search_text || '%'
    )
    GROUP BY d.id, d.name, d.license_plate, d.phone, d.created_at
    ORDER BY d.created_at DESC
    LIMIT p_page_size OFFSET v_offset;
END;
$function$;

-- 5. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_logistics_records_driver_lookup 
ON public.logistics_records (driver_name, license_plate, driver_phone);

CREATE INDEX IF NOT EXISTS idx_driver_projects_driver_id 
ON public.driver_projects (driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_projects_project_id 
ON public.driver_projects (project_id);
