-- ============================================================================
-- 更新司机分页查询函数，添加照片字段返回
-- 创建时间: 2025-11-22
-- 功能: 确保 get_drivers_paginated_1122 RPC 函数返回司机和车辆照片字段
-- ============================================================================

-- 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS get_drivers_paginated_1122(INTEGER, INTEGER, TEXT);

-- 创建新的分页查询函数
CREATE OR REPLACE FUNCTION get_drivers_paginated_1122(
    p_page_number INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 30,
    p_search_text TEXT DEFAULT ''
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    license_plate TEXT,
    phone TEXT,
    project_ids UUID[],
    id_card_photos JSONB,
    driver_license_photos JSONB,
    qualification_certificate_photos JSONB,
    driving_license_photos JSONB,
    transport_license_photos JSONB,
    created_at TIMESTAMPTZ,
    total_records BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offset INTEGER;
    v_total_count BIGINT;
BEGIN
    -- 计算偏移量
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 获取总记录数
    SELECT COUNT(*)
    INTO v_total_count
    FROM drivers d
    WHERE p_search_text = '' 
       OR d.name ILIKE '%' || p_search_text || '%'
       OR d.license_plate ILIKE '%' || p_search_text || '%'
       OR d.phone ILIKE '%' || p_search_text || '%';
    
    -- 返回分页数据，包含照片字段
    RETURN QUERY
    SELECT 
        d.id,
        d.name,
        d.license_plate,
        d.phone,
        ARRAY(
            SELECT dp.project_id 
            FROM driver_projects dp 
            WHERE dp.driver_id = d.id
        ) AS project_ids,
        COALESCE(d.id_card_photos, '[]'::jsonb) AS id_card_photos,
        COALESCE(d.driver_license_photos, '[]'::jsonb) AS driver_license_photos,
        COALESCE(d.qualification_certificate_photos, '[]'::jsonb) AS qualification_certificate_photos,
        COALESCE(d.driving_license_photos, '[]'::jsonb) AS driving_license_photos,
        COALESCE(d.transport_license_photos, '[]'::jsonb) AS transport_license_photos,
        d.created_at,
        v_total_count AS total_records
    FROM drivers d
    WHERE p_search_text = '' 
       OR d.name ILIKE '%' || p_search_text || '%'
       OR d.license_plate ILIKE '%' || p_search_text || '%'
       OR d.phone ILIKE '%' || p_search_text || '%'
    ORDER BY d.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION get_drivers_paginated_1122 IS '获取司机分页列表（包含照片字段）- 2025-11-22版本';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION get_drivers_paginated_1122 TO authenticated;

