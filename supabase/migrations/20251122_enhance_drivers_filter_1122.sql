-- ============================================================================
-- 增强司机分页查询函数，支持高级筛选
-- 创建时间: 2025-11-22
-- 功能: 
--   1. 支持货主项目级联筛选
--   2. 支持照片状态筛选（完整/不完整）
--   3. 支持司机姓名、车牌、电话多选筛选（逗号分隔）
--   4. 返回照片状态字段
-- ============================================================================

-- 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS get_drivers_paginated_1122(INTEGER, INTEGER, TEXT);

-- 创建增强版分页查询函数
CREATE OR REPLACE FUNCTION get_drivers_paginated_1122(
    p_page_number INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 30,
    p_search_text TEXT DEFAULT '',                    -- 快速搜索（姓名、车牌、电话）
    p_project_id TEXT DEFAULT NULL,                   -- 项目ID（支持逗号分隔的多个UUID）
    p_photo_status TEXT DEFAULT NULL,                 -- 照片状态：'has'有照片, 'none'没有照片, NULL全部
    p_driver_names TEXT DEFAULT NULL,                 -- 司机姓名（支持逗号分隔，多选）
    p_license_plates TEXT DEFAULT NULL,              -- 车牌号（支持逗号分隔，多选）
    p_phone_numbers TEXT DEFAULT NULL                -- 电话（支持逗号分隔，多选）
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
    photo_status TEXT,                               -- 新增：照片状态
    created_at TIMESTAMPTZ,
    total_records BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_offset INTEGER;
    v_total_count BIGINT;
    v_project_ids UUID[];
    v_driver_name_array TEXT[];
    v_license_plate_array TEXT[];
    v_phone_array TEXT[];
    v_photo_complete BOOLEAN;
BEGIN
    -- 计算偏移量
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 解析项目ID（支持逗号分隔的多个UUID）
    IF p_project_id IS NOT NULL AND p_project_id != '' THEN
        v_project_ids := ARRAY(
            SELECT uuid_val::uuid
            FROM unnest(string_to_array(p_project_id, ',')) AS uuid_val
            WHERE uuid_val ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        );
    END IF;
    
    -- 解析批量输入参数（支持逗号、空格或混合分隔）
    IF p_driver_names IS NOT NULL AND p_driver_names != '' THEN
        v_driver_name_array := regexp_split_to_array(trim(p_driver_names), '[,\s]+');
        v_driver_name_array := array_remove(v_driver_name_array, '');
    END IF;
    
    IF p_license_plates IS NOT NULL AND p_license_plates != '' THEN
        v_license_plate_array := regexp_split_to_array(trim(p_license_plates), '[,\s]+');
        v_license_plate_array := array_remove(v_license_plate_array, '');
    END IF;
    
    IF p_phone_numbers IS NOT NULL AND p_phone_numbers != '' THEN
        v_phone_array := regexp_split_to_array(trim(p_phone_numbers), '[,\s]+');
        v_phone_array := array_remove(v_phone_array, '');
    END IF;
    
    -- 获取总记录数（应用所有筛选条件）
    SELECT COUNT(*)
    INTO v_total_count
    FROM drivers d
    WHERE 
        -- 快速搜索（姓名、车牌、电话）
        (p_search_text = '' OR 
         d.name ILIKE '%' || p_search_text || '%' OR
         d.license_plate ILIKE '%' || p_search_text || '%' OR
         d.phone ILIKE '%' || p_search_text || '%')
        -- 项目筛选（支持多个项目ID）
        AND (
            v_project_ids IS NULL 
            OR array_length(v_project_ids, 1) IS NULL 
            OR EXISTS (
                SELECT 1 FROM driver_projects dp 
                WHERE dp.driver_id = d.id AND dp.project_id = ANY(v_project_ids)
            )
        )
        -- 司机姓名筛选（支持多选，OR逻辑）
        AND (v_driver_name_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_driver_name_array) AS dn_val
                 WHERE d.name ILIKE '%' || dn_val || '%'
             ))
        -- 车牌号筛选（支持多选，OR逻辑）
        AND (v_license_plate_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_license_plate_array) AS lp_val
                 WHERE d.license_plate ILIKE '%' || lp_val || '%'
             ))
        -- 电话筛选（支持多选，OR逻辑）
        AND (v_phone_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_phone_array) AS ph_val
                 WHERE d.phone ILIKE '%' || ph_val || '%'
             ))
        -- 照片状态筛选
        AND (
            p_photo_status IS NULL OR
            p_photo_status = '' OR
            CASE p_photo_status
                WHEN 'has' THEN
                    -- 有照片：至少有一种照片
                    (COALESCE(jsonb_array_length(COALESCE(d.id_card_photos, '[]'::jsonb)), 0) > 0 OR
                     COALESCE(jsonb_array_length(COALESCE(d.driver_license_photos, '[]'::jsonb)), 0) > 0 OR
                     COALESCE(jsonb_array_length(COALESCE(d.qualification_certificate_photos, '[]'::jsonb)), 0) > 0 OR
                     COALESCE(jsonb_array_length(COALESCE(d.driving_license_photos, '[]'::jsonb)), 0) > 0 OR
                     COALESCE(jsonb_array_length(COALESCE(d.transport_license_photos, '[]'::jsonb)), 0) > 0)
                WHEN 'none' THEN
                    -- 没有照片：所有照片都没有
                    (COALESCE(jsonb_array_length(COALESCE(d.id_card_photos, '[]'::jsonb)), 0) = 0 AND
                     COALESCE(jsonb_array_length(COALESCE(d.driver_license_photos, '[]'::jsonb)), 0) = 0 AND
                     COALESCE(jsonb_array_length(COALESCE(d.qualification_certificate_photos, '[]'::jsonb)), 0) = 0 AND
                     COALESCE(jsonb_array_length(COALESCE(d.driving_license_photos, '[]'::jsonb)), 0) = 0 AND
                     COALESCE(jsonb_array_length(COALESCE(d.transport_license_photos, '[]'::jsonb)), 0) = 0)
                ELSE
                    TRUE  -- 全部
            END
        );
    
    -- 返回分页数据，包含照片字段和照片状态
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
        -- 计算照片状态
        CASE 
            WHEN (COALESCE(jsonb_array_length(COALESCE(d.id_card_photos, '[]'::jsonb)), 0) > 0 OR
                  COALESCE(jsonb_array_length(COALESCE(d.driver_license_photos, '[]'::jsonb)), 0) > 0 OR
                  COALESCE(jsonb_array_length(COALESCE(d.qualification_certificate_photos, '[]'::jsonb)), 0) > 0 OR
                  COALESCE(jsonb_array_length(COALESCE(d.driving_license_photos, '[]'::jsonb)), 0) > 0 OR
                  COALESCE(jsonb_array_length(COALESCE(d.transport_license_photos, '[]'::jsonb)), 0) > 0) THEN
                'has'  -- 有照片
            ELSE
                'none'  -- 没有照片
        END AS photo_status,
        d.created_at,
        v_total_count AS total_records
    FROM drivers d
    WHERE 
        -- 快速搜索（姓名、车牌、电话）
        (p_search_text = '' OR 
         d.name ILIKE '%' || p_search_text || '%' OR
         d.license_plate ILIKE '%' || p_search_text || '%' OR
         d.phone ILIKE '%' || p_search_text || '%')
        -- 项目筛选（支持多个项目ID）
        AND (
            v_project_ids IS NULL 
            OR array_length(v_project_ids, 1) IS NULL 
            OR EXISTS (
                SELECT 1 FROM driver_projects dp 
                WHERE dp.driver_id = d.id AND dp.project_id = ANY(v_project_ids)
            )
        )
        -- 司机姓名筛选（支持多选，OR逻辑）
        AND (v_driver_name_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_driver_name_array) AS dn_val
                 WHERE d.name ILIKE '%' || dn_val || '%'
             ))
        -- 车牌号筛选（支持多选，OR逻辑）
        AND (v_license_plate_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_license_plate_array) AS lp_val
                 WHERE d.license_plate ILIKE '%' || lp_val || '%'
             ))
        -- 电话筛选（支持多选，OR逻辑）
        AND (v_phone_array IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_phone_array) AS ph_val
                 WHERE d.phone ILIKE '%' || ph_val || '%'
             ))
        -- 照片状态筛选
        AND (
            p_photo_status IS NULL OR
            p_photo_status = '' OR
            CASE p_photo_status
                WHEN 'has' THEN
                    -- 有照片：至少有一种照片
                    (COALESCE(jsonb_array_length(COALESCE(d.id_card_photos, '[]'::jsonb)), 0) > 0 OR
                     COALESCE(jsonb_array_length(COALESCE(d.driver_license_photos, '[]'::jsonb)), 0) > 0 OR
                     COALESCE(jsonb_array_length(COALESCE(d.qualification_certificate_photos, '[]'::jsonb)), 0) > 0 OR
                     COALESCE(jsonb_array_length(COALESCE(d.driving_license_photos, '[]'::jsonb)), 0) > 0 OR
                     COALESCE(jsonb_array_length(COALESCE(d.transport_license_photos, '[]'::jsonb)), 0) > 0)
                WHEN 'none' THEN
                    -- 没有照片：所有照片都没有
                    (COALESCE(jsonb_array_length(COALESCE(d.id_card_photos, '[]'::jsonb)), 0) = 0 AND
                     COALESCE(jsonb_array_length(COALESCE(d.driver_license_photos, '[]'::jsonb)), 0) = 0 AND
                     COALESCE(jsonb_array_length(COALESCE(d.qualification_certificate_photos, '[]'::jsonb)), 0) = 0 AND
                     COALESCE(jsonb_array_length(COALESCE(d.driving_license_photos, '[]'::jsonb)), 0) = 0 AND
                     COALESCE(jsonb_array_length(COALESCE(d.transport_license_photos, '[]'::jsonb)), 0) = 0)
                ELSE
                    TRUE  -- 全部
            END
        )
    ORDER BY d.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION get_drivers_paginated_1122 IS '获取司机分页列表（支持高级筛选：货主项目、照片状态、司机姓名/车牌/电话多选）- 2025-11-22增强版';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION get_drivers_paginated_1122 TO authenticated;

