-- ============================================================================
-- 修复后台函数时区问题
-- 创建日期：2025-01-27
-- 说明：修复单日查询和日期存储函数的时区处理，确保不依赖PostgreSQL会话时区
-- 
-- 时区规范：
-- - 前端使用中国时区（UTC+8）：前端显示和用户输入都是中国时区
-- - 后端使用UTC：后端存储和查询都使用UTC
-- 
-- 处理流程：
-- 1. 前端传递：中国时区的日期字符串（如 "2025-11-10"）
-- 2. 后端接收：理解为中国时区的日期
-- 3. 后端存储：转换为UTC存储（如 "2025-11-09 16:00:00+00:00"）
-- 4. 后端查询：使用UTC日期进行查询
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. 修复单日查询函数 - get_payment_requests_filtered
-- ============================================================================
-- 问题：使用 lr.loading_date = p_loading_date 直接比较，依赖会话时区
-- 修复：使用UTC日期范围查询，确保时区一致性
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_payment_requests_filtered(
    p_request_id TEXT DEFAULT NULL,
    p_waybill_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_loading_date DATE DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_project_id TEXT DEFAULT NULL,
    p_license_plate TEXT DEFAULT NULL,
    p_phone_number TEXT DEFAULT NULL,
    p_platform_name TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    request_id TEXT,
    status TEXT,
    notes TEXT,
    logistics_record_ids UUID[],
    record_count INTEGER,
    total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_where_conditions TEXT[] := '{}';
    v_where_clause TEXT := '';
    v_logistics_ids UUID[];
    v_total_count BIGINT;
    v_waybill_numbers TEXT[];
    v_driver_names TEXT[];
    v_license_plates TEXT[];
    v_phone_numbers TEXT[];
BEGIN
    -- 构建基础查询条件（只针对payment_requests表）
    
    -- 申请单号筛选
    IF p_request_id IS NOT NULL AND p_request_id != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.request_id ILIKE %L', '%' || p_request_id || '%'));
    END IF;

    -- 状态筛选
    IF p_status IS NOT NULL AND p_status != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.status = %L', p_status));
    END IF;

    -- 处理需要关联logistics_records的筛选条件
    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' OR
       p_driver_name IS NOT NULL AND p_driver_name != '' OR
       p_loading_date IS NOT NULL OR
       p_project_id IS NOT NULL AND p_project_id != '' OR
       p_license_plate IS NOT NULL AND p_license_plate != '' OR
       p_phone_number IS NOT NULL AND p_phone_number != '' OR
       p_platform_name IS NOT NULL AND p_platform_name != '' THEN
        
        -- 解析批量输入参数（支持逗号、空格或混合分隔）
        IF p_waybill_number IS NOT NULL AND p_waybill_number != '' THEN
            v_waybill_numbers := regexp_split_to_array(trim(p_waybill_number), '[,\s]+');
            v_waybill_numbers := array_remove(v_waybill_numbers, '');
        END IF;
        
        IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
            v_driver_names := regexp_split_to_array(trim(p_driver_name), '[,\s]+');
            v_driver_names := array_remove(v_driver_names, '');
        END IF;
        
        IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
            v_license_plates := regexp_split_to_array(trim(p_license_plate), '[,\s]+');
            v_license_plates := array_remove(v_license_plates, '');
        END IF;
        
        IF p_phone_number IS NOT NULL AND p_phone_number != '' THEN
            v_phone_numbers := regexp_split_to_array(trim(p_phone_number), '[,\s]+');
            v_phone_numbers := array_remove(v_phone_numbers, '');
        END IF;
        
        -- 构建运单筛选条件
        SELECT array_agg(DISTINCT lr.id) INTO v_logistics_ids
        FROM logistics_records lr
        WHERE 
            -- 运单编号筛选（支持批量OR逻辑，查询本平台运单号和其他平台运单号）
            (v_waybill_numbers IS NULL OR 
             EXISTS (
               SELECT 1 FROM unnest(v_waybill_numbers) AS wb_num
               WHERE lr.auto_number ILIKE '%' || wb_num || '%'
                  OR EXISTS (
                       SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext_num
                       WHERE ext_num ILIKE '%' || wb_num || '%'
                     )
             ))
          -- 司机姓名筛选（支持批量OR逻辑）
          AND (v_driver_names IS NULL OR 
               EXISTS (
                 SELECT 1 FROM unnest(v_driver_names) AS driver_name
                 WHERE lr.driver_name ILIKE '%' || driver_name || '%'
               ))
          -- ✅ 修复：装货日期筛选 - 使用UTC日期范围查询，确保时区一致性
          -- 规范：前端使用中国时区，后端使用UTC
          -- 前端通过 convertSingleDateToDateRange() 转换，传递UTC日期字符串（如 "2025-11-09"）
          -- 数据库中的 loading_date 是 timestamptz（UTC存储）
          -- 使用日期范围查询：>= 该日期的UTC 00:00:00 且 < 次日UTC 00:00:00
          AND (p_loading_date IS NULL OR 
               (lr.loading_date >= (p_loading_date::text || ' 00:00:00+00:00')::timestamptz
                AND lr.loading_date < ((p_loading_date + INTERVAL '1 day')::text || ' 00:00:00+00:00')::timestamptz))
          -- 项目筛选
          AND (p_project_id IS NULL OR p_project_id = '' OR lr.project_id::TEXT = p_project_id)
          -- 车牌号筛选（支持批量OR逻辑）
          AND (v_license_plates IS NULL OR 
               EXISTS (
                 SELECT 1 FROM unnest(v_license_plates) AS plate
                 WHERE lr.license_plate ILIKE '%' || plate || '%'
               ))
          -- 电话号码筛选（支持批量OR逻辑）
          AND (v_phone_numbers IS NULL OR 
               EXISTS (
                 SELECT 1 FROM unnest(v_phone_numbers) AS phone
                 WHERE lr.driver_phone ILIKE '%' || phone || '%'
               ))
          -- 平台名称筛选
          AND (p_platform_name IS NULL OR p_platform_name = '' OR
               CASE 
                 WHEN p_platform_name = '本平台' THEN 
                   (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                 ELSE 
                   EXISTS (
                     SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name
                     WHERE platform_name ILIKE '%' || p_platform_name || '%'
                   )
               END);
        
        -- 如果有匹配的运单，添加筛选条件
        IF v_logistics_ids IS NOT NULL AND array_length(v_logistics_ids, 1) > 0 THEN
            v_where_conditions := array_append(v_where_conditions, 
                format('pr.logistics_record_ids && %L', v_logistics_ids));
        ELSE
            -- 如果没有匹配的运单，返回空结果
            v_where_conditions := array_append(v_where_conditions, '1 = 0');
        END IF;
    END IF;

    -- 构建WHERE子句
    IF array_length(v_where_conditions, 1) > 0 THEN
        v_where_clause := 'WHERE ' || array_to_string(v_where_conditions, ' AND ');
    END IF;

    -- 执行查询并返回结果
    RETURN QUERY EXECUTE format('
        WITH filtered_requests AS (
            SELECT 
                pr.id,
                pr.created_at,
                pr.request_id,
                pr.status,
                pr.notes,
                pr.logistics_record_ids,
                COALESCE(array_length(pr.logistics_record_ids, 1), 0) as record_count
            FROM payment_requests pr
            %s
            ORDER BY pr.created_at DESC
            LIMIT %s OFFSET %s
        ),
        total_count AS (
            SELECT COUNT(*) as count
            FROM payment_requests pr
            %s
        )
        SELECT 
            fr.id,
            fr.created_at,
            fr.request_id,
            fr.status,
            fr.notes,
            fr.logistics_record_ids,
            fr.record_count,
            tc.count as total_count
        FROM filtered_requests fr
        CROSS JOIN total_count tc
    ', v_where_clause, p_limit, p_offset, v_where_clause);
END;
$$;

-- ============================================================================
-- 2. 修复单日查询函数 - get_invoice_requests_filtered
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_invoice_requests_filtered(
    p_request_number TEXT DEFAULT NULL,
    p_waybill_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_loading_date DATE DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_project_id TEXT DEFAULT NULL,
    p_license_plate TEXT DEFAULT NULL,
    p_phone_number TEXT DEFAULT NULL,
    p_platform_name TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    request_number TEXT,
    invoicing_partner_id UUID,
    partner_id UUID,
    partner_name TEXT,
    partner_full_name TEXT,
    invoicing_partner_full_name TEXT,
    invoicing_partner_tax_number TEXT,
    tax_number TEXT,
    invoice_number TEXT,
    total_amount NUMERIC,
    record_count INTEGER,
    status TEXT,
    created_by UUID,
    remarks TEXT,
    total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_where_conditions TEXT[] := '{}';
    v_where_clause TEXT := '';
    v_logistics_ids UUID[];
    v_waybill_numbers TEXT[];
    v_driver_names TEXT[];
    v_license_plates TEXT[];
    v_phone_numbers TEXT[];
BEGIN
    -- 构建基础查询条件（针对invoice_requests表）
    
    -- 开票申请单号筛选（支持批量）
    IF p_request_number IS NOT NULL AND p_request_number != '' THEN
        v_waybill_numbers := regexp_split_to_array(trim(p_request_number), '[,\s]+');
        v_waybill_numbers := array_remove(v_waybill_numbers, '');
        
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM unnest(%L::text[]) AS req_num WHERE ir.request_number ILIKE ''%%'' || req_num || ''%%'')', v_waybill_numbers));
    END IF;

    -- 状态筛选
    IF p_status IS NOT NULL AND p_status != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('ir.status = %L', p_status));
    END IF;

    -- 处理需要关联logistics_records的筛选条件
    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' OR
       p_driver_name IS NOT NULL AND p_driver_name != '' OR
       p_loading_date IS NOT NULL OR
       p_project_id IS NOT NULL AND p_project_id != '' OR
       p_license_plate IS NOT NULL AND p_license_plate != '' OR
       p_phone_number IS NOT NULL AND p_phone_number != '' OR
       p_platform_name IS NOT NULL AND p_platform_name != '' THEN
        
        -- 解析批量输入参数（支持逗号、空格或混合分隔）
        IF p_waybill_number IS NOT NULL AND p_waybill_number != '' THEN
            v_waybill_numbers := regexp_split_to_array(trim(p_waybill_number), '[,\s]+');
            v_waybill_numbers := array_remove(v_waybill_numbers, '');
        END IF;
        
        IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
            v_driver_names := regexp_split_to_array(trim(p_driver_name), '[,\s]+');
            v_driver_names := array_remove(v_driver_names, '');
        END IF;
        
        IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
            v_license_plates := regexp_split_to_array(trim(p_license_plate), '[,\s]+');
            v_license_plates := array_remove(v_license_plates, '');
        END IF;
        
        IF p_phone_number IS NOT NULL AND p_phone_number != '' THEN
            v_phone_numbers := regexp_split_to_array(trim(p_phone_number), '[,\s]+');
            v_phone_numbers := array_remove(v_phone_numbers, '');
        END IF;
        
        -- 查询符合条件的logistics_records ID
        SELECT array_agg(DISTINCT lr.id) INTO v_logistics_ids
        FROM logistics_records lr
        WHERE 
            -- 运单编号筛选（支持批量，查询本平台和其他平台运单号）
            (v_waybill_numbers IS NULL OR 
             EXISTS (
               SELECT 1 FROM unnest(v_waybill_numbers) AS wb_num
               WHERE lr.auto_number ILIKE '%' || wb_num || '%'
                  OR EXISTS (
                       SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext_num
                       WHERE ext_num ILIKE '%' || wb_num || '%'
                     )
             ))
            -- 司机姓名筛选（支持批量）
            AND (v_driver_names IS NULL OR 
                 EXISTS (
                   SELECT 1 FROM unnest(v_driver_names) AS driver
                   WHERE lr.driver_name ILIKE '%' || driver || '%'
                 ))
            -- ✅ 修复：装货日期筛选 - 使用UTC日期范围查询，确保时区一致性
            -- 前端传递的是UTC日期字符串（如 "2025-11-09"），需要匹配该UTC日期的所有数据
            -- 数据库中的 loading_date 是 timestamptz（UTC存储）
            -- 使用日期范围查询：>= 该日期的UTC 00:00:00 且 < 次日UTC 00:00:00
            AND (p_loading_date IS NULL OR 
                 (lr.loading_date >= (p_loading_date::text || ' 00:00:00+00:00')::timestamptz
                  AND lr.loading_date < ((p_loading_date + INTERVAL '1 day')::text || ' 00:00:00+00:00')::timestamptz))
            -- 项目筛选
            AND (p_project_id IS NULL OR lr.project_id::text = p_project_id)
            -- 车牌号筛选（支持批量）
            AND (v_license_plates IS NULL OR 
                 EXISTS (
                   SELECT 1 FROM unnest(v_license_plates) AS plate
                   WHERE lr.license_plate ILIKE '%' || plate || '%'
                 ))
            -- 电话号码筛选（支持批量）
            AND (v_phone_numbers IS NULL OR 
                 EXISTS (
                   SELECT 1 FROM unnest(v_phone_numbers) AS phone
                   WHERE lr.driver_phone ILIKE '%' || phone || '%'
                 ))
            -- 平台名称筛选
            AND (p_platform_name IS NULL OR 
                 p_platform_name = '本平台' AND lr.external_tracking_numbers IS NULL OR
                 EXISTS (
                   SELECT 1 FROM unnest(lr.other_platform_names) AS platform
                   WHERE platform = p_platform_name
                 ));

        -- 如果查询到符合条件的运单ID，添加到WHERE条件
        IF v_logistics_ids IS NOT NULL AND array_length(v_logistics_ids, 1) > 0 THEN
            v_where_conditions := array_append(v_where_conditions, 
                format('EXISTS (SELECT 1 FROM invoice_request_details ird WHERE ird.invoice_request_id = ir.id AND ird.logistics_record_id = ANY(%L))', v_logistics_ids));
        ELSE
            -- 如果没有匹配的运单，返回空结果
            v_where_conditions := array_append(v_where_conditions, '1 = 0');
        END IF;
    END IF;

    -- 合并WHERE条件
    IF array_length(v_where_conditions, 1) > 0 THEN
        v_where_clause := 'WHERE ' || array_to_string(v_where_conditions, ' AND ');
    END IF;

    -- 执行查询并返回结果
    RETURN QUERY EXECUTE format('
        WITH filtered_requests AS (
            SELECT 
                ir.id,
                ir.created_at,
                ir.request_number,
                ir.invoicing_partner_id,
                ir.partner_id,
                ir.partner_name,
                ir.partner_full_name,
                ir.invoicing_partner_full_name,
                ir.invoicing_partner_tax_number,
                ir.tax_number,
                ir.invoice_number,
                ir.total_amount,
                ir.record_count,
                ir.status,
                ir.created_by,
                ir.remarks
            FROM invoice_requests ir
            %s
            ORDER BY ir.created_at DESC
            LIMIT %s OFFSET %s
        ),
        total_count AS (
            SELECT COUNT(*) as count
            FROM invoice_requests ir
            %s
        )
        SELECT 
            fr.id,
            fr.created_at,
            fr.request_number,
            fr.invoicing_partner_id,
            fr.partner_id,
            fr.partner_name,
            fr.partner_full_name,
            fr.invoicing_partner_full_name,
            fr.invoicing_partner_tax_number,
            fr.tax_number,
            fr.invoice_number,
            fr.total_amount,
            fr.record_count,
            fr.status,
            fr.created_by,
            fr.remarks,
            tc.count as total_count
        FROM filtered_requests fr
        CROSS JOIN total_count tc
    ', v_where_clause, p_limit, p_offset, v_where_clause);
END;
$$;

-- ============================================================================
-- 3. 修复日期存储函数 - driver_quick_create_waybill
-- ============================================================================
-- 问题：使用 (p_loading_date::text || ' 00:00:00')::timestamp with time zone
--       没有明确指定时区，依赖PostgreSQL会话时区
-- 修复：明确指定中国时区（+08:00），然后PostgreSQL自动转换为UTC存储
-- 说明：前端传递的是中国时区的日期字符串（如 "2025-11-10"），
--       应该理解为中国时区的日期，然后转换为UTC存储
-- ============================================================================

-- 删除所有旧版本的重载函数
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 删除所有 driver_quick_create_waybill 的重载版本
    FOR r IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'driver_quick_create_waybill'
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
        RAISE NOTICE '删除函数: %', r.func_signature;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION driver_quick_create_waybill(
    p_project_id UUID,
    p_loading_location_id UUID,
    p_unloading_location_id UUID,
    p_loading_weight NUMERIC,
    p_unloading_weight NUMERIC DEFAULT NULL,
    p_loading_date DATE DEFAULT CURRENT_DATE,
    p_unloading_date DATE DEFAULT CURRENT_DATE,
    p_remarks TEXT DEFAULT NULL,
    p_chain_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_driver_id UUID;
    v_driver_info RECORD;
    v_drivers_table_id UUID;
    v_vehicle_info RECORD;
    v_project_info RECORD;
    v_loading_location TEXT;
    v_unloading_location TEXT;
    v_auto_number TEXT;
    v_new_id UUID;
    v_chain_id UUID;
    v_billing_type_id BIGINT := 1;
    v_temp_license_plate TEXT;
BEGIN
    v_driver_id := get_current_driver_id();
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '未找到对应的司机档案');
    END IF;

    SELECT id, name, phone INTO v_driver_info FROM internal_drivers WHERE id = v_driver_id;
    IF v_driver_info.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '司机信息不存在');
    END IF;

    SELECT id INTO v_drivers_table_id
    FROM drivers
    WHERE name = v_driver_info.name
      AND phone = v_driver_info.phone
      AND driver_type = 'internal'
    LIMIT 1;

    IF v_drivers_table_id IS NULL THEN
        SELECT v.license_plate INTO v_temp_license_plate
        FROM internal_vehicles v
        INNER JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
        WHERE dvr.driver_id = v_driver_id
        AND dvr.valid_until IS NULL
        AND v.is_active = true
        ORDER BY dvr.valid_from DESC
        LIMIT 1;
        
        INSERT INTO drivers (name, phone, license_plate, driver_type, created_at, updated_at)
        VALUES (v_driver_info.name, v_driver_info.phone, COALESCE(v_temp_license_plate, ''), 'internal', NOW(), NOW())
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_drivers_table_id;
        
        IF v_drivers_table_id IS NULL THEN
            SELECT id INTO v_drivers_table_id
            FROM drivers
            WHERE name = v_driver_info.name
              AND phone = v_driver_info.phone
            LIMIT 1;
        END IF;
    END IF;

    IF v_drivers_table_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '无法在司机表中找到对应记录，请联系管理员');
    END IF;

    SELECT v.id, v.license_plate INTO v_vehicle_info
    FROM internal_vehicles v
    INNER JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
    WHERE dvr.driver_id = v_driver_id
    AND dvr.valid_until IS NULL
    AND v.is_active = true
    ORDER BY dvr.valid_from DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', '您暂未分配主车，请联系车队长');
    END IF;
    IF v_vehicle_info.license_plate IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '您暂未分配主车，请联系车队长');
    END IF;

    SELECT id, name INTO v_project_info FROM projects WHERE id = p_project_id;
    IF v_project_info.name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '项目不存在');
    END IF;

    SELECT name INTO v_loading_location FROM locations WHERE id = p_loading_location_id;
    SELECT name INTO v_unloading_location FROM locations WHERE id = p_unloading_location_id;
    IF v_loading_location IS NULL OR v_unloading_location IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '地点不存在');
    END IF;

    IF p_chain_id IS NOT NULL THEN
        SELECT id, COALESCE(billing_type_id, 1) INTO v_chain_id, v_billing_type_id
        FROM partner_chains
        WHERE id = p_chain_id AND project_id = p_project_id;
        IF v_chain_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', '指定的合作链路不属于该项目');
        END IF;
    ELSE
        SELECT id, COALESCE(billing_type_id, 1) INTO v_chain_id, v_billing_type_id
        FROM partner_chains
        WHERE project_id = p_project_id AND is_default = true
        LIMIT 1;
        IF v_chain_id IS NULL THEN
            SELECT id, COALESCE(billing_type_id, 1) INTO v_chain_id, v_billing_type_id
            FROM partner_chains
            WHERE project_id = p_project_id
            ORDER BY created_at
            LIMIT 1;
        END IF;
    END IF;

    IF v_chain_id IS NULL THEN
        v_billing_type_id := 1;
    END IF;

    v_auto_number := public.generate_auto_number(p_loading_date::TEXT);

    INSERT INTO logistics_records (
        auto_number, project_id, project_name, driver_id, driver_name, driver_phone, license_plate,
        loading_location, unloading_location, loading_location_ids, unloading_location_ids,
        loading_date, unloading_date, loading_weight, unloading_weight, transport_type,
        billing_type_id, chain_id, payment_status, invoice_status, remarks, created_by_user_id
    ) VALUES (
        v_auto_number, p_project_id, v_project_info.name, v_drivers_table_id, v_driver_info.name, v_driver_info.phone, v_vehicle_info.license_plate,
        v_loading_location, v_unloading_location,
        ARRAY[p_loading_location_id], ARRAY[p_unloading_location_id],
        -- ✅ 修复：明确指定中国时区（+08:00），然后PostgreSQL自动转换为UTC存储
        -- 规范：前端使用中国时区，后端使用UTC
        -- 前端传递：中国时区的日期字符串（如 "2025-11-10"），通过 formatChinaDateString() 生成
        -- 后端处理：明确指定 +08:00，理解为中国时区的日期
        -- 存储结果：PostgreSQL自动转换为UTC存储（如 '2025-11-09 16:00:00+00:00'）
        (p_loading_date::text || ' 00:00:00+08:00')::timestamptz,
        (COALESCE(p_unloading_date, p_loading_date)::text || ' 00:00:00+08:00')::timestamptz,
        p_loading_weight, COALESCE(p_unloading_weight, p_loading_weight), '实际运输',
        v_billing_type_id, v_chain_id, 'Unpaid', 'Uninvoiced', p_remarks, auth.uid()
    ) RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'success', true, 'message', '运单创建成功', 'waybill_id', v_new_id,
        'auto_number', v_auto_number, 'driver_name', v_driver_info.name,
        'vehicle', v_vehicle_info.license_plate, 'chain_id', v_chain_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', '创建运单失败：' || SQLERRM);
END;
$$;

-- ============================================================================
-- 4. 修复日期存储函数 - driver_manual_create_waybill
-- ============================================================================
-- 问题：使用 (p_loading_date::text || ' 00:00:00')::timestamp with time zone
--       没有明确指定时区，依赖PostgreSQL会话时区
-- 修复：明确指定中国时区（+08:00），然后PostgreSQL自动转换为UTC存储
-- ============================================================================

-- 删除所有旧版本的重载函数
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 删除所有 driver_manual_create_waybill 的重载版本
    FOR r IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'driver_manual_create_waybill'
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
        RAISE NOTICE '删除函数: %', r.func_signature;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION driver_manual_create_waybill(
    p_project_id UUID,
    p_loading_location_id UUID,
    p_unloading_location_id UUID,
    p_loading_weight NUMERIC,
    p_unloading_weight NUMERIC DEFAULT NULL,
    p_loading_date DATE DEFAULT CURRENT_DATE,
    p_unloading_date DATE DEFAULT CURRENT_DATE,
    p_current_cost NUMERIC DEFAULT 0,
    p_extra_cost NUMERIC DEFAULT 0,
    p_remarks TEXT DEFAULT NULL,
    p_chain_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_driver_id UUID;
    v_driver_info RECORD;
    v_drivers_table_id UUID;
    v_vehicle_info RECORD;
    v_project_info RECORD;
    v_loading_location TEXT;
    v_unloading_location TEXT;
    v_auto_number TEXT;
    v_new_id UUID;
    v_chain_id UUID;
    v_billing_type_id BIGINT := 1;
    v_temp_license_plate TEXT;
BEGIN
    v_driver_id := get_current_driver_id();
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '未找到对应的司机档案');
    END IF;

    SELECT id, name, phone INTO v_driver_info FROM internal_drivers WHERE id = v_driver_id;
    IF v_driver_info.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '司机信息不存在');
    END IF;

    SELECT id INTO v_drivers_table_id
    FROM drivers
    WHERE name = v_driver_info.name
      AND phone = v_driver_info.phone
      AND driver_type = 'internal'
    LIMIT 1;

    IF v_drivers_table_id IS NULL THEN
        SELECT v.license_plate INTO v_temp_license_plate
        FROM internal_vehicles v
        INNER JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
        WHERE dvr.driver_id = v_driver_id
        AND dvr.valid_until IS NULL
        AND v.is_active = true
        ORDER BY dvr.valid_from DESC
        LIMIT 1;
        
        INSERT INTO drivers (name, phone, license_plate, driver_type, created_at, updated_at)
        VALUES (v_driver_info.name, v_driver_info.phone, COALESCE(v_temp_license_plate, ''), 'internal', NOW(), NOW())
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_drivers_table_id;
        
        IF v_drivers_table_id IS NULL THEN
            SELECT id INTO v_drivers_table_id
            FROM drivers
            WHERE name = v_driver_info.name
              AND phone = v_driver_info.phone
            LIMIT 1;
        END IF;
    END IF;

    IF v_drivers_table_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '无法在司机表中找到对应记录，请联系管理员');
    END IF;

    SELECT v.id, v.license_plate INTO v_vehicle_info
    FROM internal_vehicles v
    INNER JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
    WHERE dvr.driver_id = v_driver_id
    AND dvr.valid_until IS NULL
    AND v.is_active = true
    ORDER BY dvr.valid_from DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', '您暂未分配主车，请联系车队长');
    END IF;
    IF v_vehicle_info.license_plate IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '您暂未分配主车，请联系车队长');
    END IF;

    SELECT id, name INTO v_project_info FROM projects WHERE id = p_project_id;
    IF v_project_info.name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '项目不存在');
    END IF;

    SELECT name INTO v_loading_location FROM locations WHERE id = p_loading_location_id;
    SELECT name INTO v_unloading_location FROM locations WHERE id = p_unloading_location_id;
    IF v_loading_location IS NULL OR v_unloading_location IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '地点不存在');
    END IF;

    IF p_chain_id IS NOT NULL THEN
        SELECT id, COALESCE(billing_type_id, 1) INTO v_chain_id, v_billing_type_id
        FROM partner_chains
        WHERE id = p_chain_id AND project_id = p_project_id;
        IF v_chain_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', '指定的合作链路不属于该项目');
        END IF;
    ELSE
        SELECT id, COALESCE(billing_type_id, 1) INTO v_chain_id, v_billing_type_id
        FROM partner_chains
        WHERE project_id = p_project_id AND is_default = true
        LIMIT 1;
        IF v_chain_id IS NULL THEN
            SELECT id, COALESCE(billing_type_id, 1) INTO v_chain_id, v_billing_type_id
            FROM partner_chains
            WHERE project_id = p_project_id
            ORDER BY created_at
            LIMIT 1;
        END IF;
    END IF;

    IF v_chain_id IS NULL THEN
        v_billing_type_id := 1;
    END IF;

    v_auto_number := public.generate_auto_number(p_loading_date::TEXT);

    INSERT INTO logistics_records (
        auto_number, project_id, project_name, driver_id, driver_name, driver_phone, license_plate,
        loading_location, unloading_location, loading_location_ids, unloading_location_ids,
        loading_date, unloading_date, loading_weight, unloading_weight, transport_type,
        billing_type_id, chain_id, payment_status, invoice_status, current_cost, extra_cost,
        payable_cost, remarks, created_by_user_id
    ) VALUES (
        v_auto_number, p_project_id, v_project_info.name, v_drivers_table_id, v_driver_info.name, v_driver_info.phone, v_vehicle_info.license_plate,
        v_loading_location, v_unloading_location,
        ARRAY[p_loading_location_id], ARRAY[p_unloading_location_id],
        -- ✅ 修复：明确指定中国时区（+08:00），然后PostgreSQL自动转换为UTC存储
        -- 规范：前端使用中国时区，后端使用UTC
        -- 前端传递：中国时区的日期字符串（如 "2025-11-10"），通过 formatChinaDateString() 生成
        -- 后端处理：明确指定 +08:00，理解为中国时区的日期
        -- 存储结果：PostgreSQL自动转换为UTC存储（如 '2025-11-09 16:00:00+00:00'）
        (p_loading_date::text || ' 00:00:00+08:00')::timestamptz,
        (COALESCE(p_unloading_date, p_loading_date)::text || ' 00:00:00+08:00')::timestamptz,
        p_loading_weight, COALESCE(p_unloading_weight, p_loading_weight), '实际运输',
        v_billing_type_id, v_chain_id, 'Unpaid', 'Uninvoiced', 
        COALESCE(p_current_cost, 0), COALESCE(p_extra_cost, 0),
        COALESCE(p_current_cost, 0) + COALESCE(p_extra_cost, 0),
        p_remarks, auth.uid()
    ) RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'success', true, 'message', '运单创建成功', 'waybill_id', v_new_id,
        'auto_number', v_auto_number, 'driver_name', v_driver_info.name,
        'vehicle', v_vehicle_info.license_plate, 'chain_id', v_chain_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', '创建运单失败：' || SQLERRM);
END;
$$;

-- ============================================================================
-- 5. 添加函数注释
-- ============================================================================

COMMENT ON FUNCTION public.get_payment_requests_filtered IS '
付款申请单筛选查询函数（已修复时区问题）
- 单日查询使用UTC日期范围查询，确保时区一致性
- 不再依赖PostgreSQL会话时区设置
';

COMMENT ON FUNCTION public.get_invoice_requests_filtered IS '
开票申请单筛选查询函数（已修复时区问题）
- 单日查询使用UTC日期范围查询，确保时区一致性
- 不再依赖PostgreSQL会话时区设置
';

COMMENT ON FUNCTION driver_quick_create_waybill IS '
司机快速创建运单函数（已修复时区问题）
- 日期存储明确指定中国时区（+08:00），然后PostgreSQL自动转换为UTC存储
- 不再依赖PostgreSQL会话时区设置
';

COMMENT ON FUNCTION driver_manual_create_waybill IS '
司机手动创建运单函数（已修复时区问题）
- 日期存储明确指定中国时区（+08:00），然后PostgreSQL自动转换为UTC存储
- 不再依赖PostgreSQL会话时区设置
';

COMMIT;

-- ============================================================================
-- 完成提示
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 后台函数时区问题修复完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复的函数：';
    RAISE NOTICE '1. get_payment_requests_filtered - 单日查询使用UTC日期范围';
    RAISE NOTICE '2. get_invoice_requests_filtered - 单日查询使用UTC日期范围';
    RAISE NOTICE '3. driver_quick_create_waybill - 日期存储明确指定中国时区（+08:00）';
    RAISE NOTICE '4. driver_manual_create_waybill - 日期存储明确指定中国时区（+08:00）';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '- 单日查询：从直接比较改为UTC日期范围查询';
    RAISE NOTICE '- 日期存储：从依赖会话时区改为明确指定中国时区（+08:00）';
    RAISE NOTICE '';
    RAISE NOTICE '现在所有函数都不再依赖PostgreSQL会话时区设置';
    RAISE NOTICE '========================================';
END $$;

