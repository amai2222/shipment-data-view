-- 更新司机分页查询函数，添加车辆照片字段
-- 文件: supabase/migrations/20250120000014_add_vehicle_photos_to_drivers.sql

-- 重新创建司机分页查询函数，包含车辆照片字段
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
    id_card_photos text[],
    driver_license_photos text[],
    qualification_certificate_photos text[],
    driving_license_photos text[],
    transport_license_photos text[],
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
    
    -- 返回分页数据，包含所有照片字段
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
        COALESCE(d.id_card_photos, '{}'::text[]) as id_card_photos,
        COALESCE(d.driver_license_photos, '{}'::text[]) as driver_license_photos,
        COALESCE(d.qualification_certificate_photos, '{}'::text[]) as qualification_certificate_photos,
        COALESCE(d.driving_license_photos, '{}'::text[]) as driving_license_photos,
        COALESCE(d.transport_license_photos, '{}'::text[]) as transport_license_photos,
        d.created_at,
        v_total_count as total_records
    FROM public.drivers d
    LEFT JOIN public.driver_projects dp ON d.id = dp.driver_id
    WHERE p_search_text = '' OR p_search_text IS NULL OR (
        d.name ILIKE '%' || p_search_text || '%' OR
        d.license_plate ILIKE '%' || p_search_text || '%' OR
        d.phone ILIKE '%' || p_search_text || '%'
    )
    GROUP BY d.id, d.name, d.license_plate, d.phone, d.created_at, 
             d.id_card_photos, d.driver_license_photos, d.qualification_certificate_photos,
             d.driving_license_photos, d.transport_license_photos
    ORDER BY d.created_at DESC
    LIMIT p_page_size OFFSET v_offset;
END;
$function$;
