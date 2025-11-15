-- ============================================================================
-- 添加多个 project_id 支持（版本 1116）
-- ============================================================================
-- 功能：修改所有筛选函数，支持多个 project_id（逗号分隔的 UUID 字符串）
-- 日期：2025-11-16
-- ============================================================================

-- ============================================================================
-- 1. get_payment_requests_filtered_1116
-- ============================================================================
-- 支持多个 project_id（逗号分隔的 UUID 字符串）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_payment_requests_filtered_1116(
    p_request_id text DEFAULT NULL::text, 
    p_waybill_number text DEFAULT NULL::text, 
    p_driver_name text DEFAULT NULL::text, 
    p_loading_date text DEFAULT NULL::text, 
    p_status text DEFAULT NULL::text, 
    p_project_id text DEFAULT NULL::text,  -- ✅ 支持逗号分隔的多个 UUID
    p_license_plate text DEFAULT NULL::text, 
    p_phone_number text DEFAULT NULL::text, 
    p_platform_name text DEFAULT NULL::text, 
    p_limit integer DEFAULT 50, 
    p_offset integer DEFAULT 0
)
RETURNS TABLE(id uuid, created_at timestamp with time zone, request_id text, status text, notes text, logistics_record_ids uuid[], record_count integer, total_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_where_conditions TEXT[] := '{}';
    v_where_clause TEXT := '';
    v_logistics_ids UUID[];
    v_total_count BIGINT;
    v_waybill_numbers TEXT[];
    v_driver_names TEXT[];
    v_license_plates TEXT[];
    v_phone_numbers TEXT[];
    v_project_ids UUID[];  -- ✅ 新增：存储解析后的项目ID数组
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

    -- ✅ 解析项目ID（支持逗号分隔的多个UUID）
    IF p_project_id IS NOT NULL AND p_project_id != '' THEN
        v_project_ids := string_to_array(p_project_id, ',')::uuid[];
        -- 移除空值
        v_project_ids := array_remove(v_project_ids, NULL);
    END IF;

    -- 处理需要关联logistics_records的筛选条件
    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' OR
       p_driver_name IS NOT NULL AND p_driver_name != '' OR
       p_loading_date IS NOT NULL AND p_loading_date != '' OR
       (v_project_ids IS NOT NULL AND array_length(v_project_ids, 1) > 0) OR
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
          -- ✅ 修改：装货日期筛选 - 使用 +08:00 时区转换
          AND (p_loading_date IS NULL OR p_loading_date = '' OR 
               (lr.loading_date >= (p_loading_date || ' 00:00:00+08:00')::timestamptz
                AND lr.loading_date < ((p_loading_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second')))
          -- ✅ 修改：项目筛选（支持多个项目ID）
          AND (v_project_ids IS NULL OR array_length(v_project_ids, 1) IS NULL OR lr.project_id = ANY(v_project_ids))
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
        ),
        total_count_cte AS (
            SELECT COUNT(*) as total
            FROM filtered_requests
        )
        SELECT 
            fr.id,
            fr.created_at,
            fr.request_id,
            fr.status,
            fr.notes,
            fr.logistics_record_ids,
            fr.record_count,
            (SELECT total FROM total_count_cte) as total_count
        FROM filtered_requests fr
        ORDER BY fr.created_at DESC
        LIMIT %s
        OFFSET %s
    ', v_where_clause, p_limit, p_offset);
END;
$function$;

COMMENT ON FUNCTION public.get_payment_requests_filtered_1116 IS '筛选付款申请单，支持多个 project_id（逗号分隔的 UUID 字符串）';

-- ============================================================================
-- 2. get_invoice_requests_filtered_1116
-- ============================================================================
-- 支持多个 project_id（逗号分隔的 UUID 字符串或单个 UUID）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_invoice_requests_filtered_1116(
    p_request_number TEXT DEFAULT NULL,
    p_waybill_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_loading_date TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_project_id TEXT DEFAULT NULL,  -- ✅ 改为 TEXT，支持逗号分隔的多个 UUID
    p_license_plate TEXT DEFAULT NULL,
    p_phone_number TEXT DEFAULT NULL,
    p_platform_name TEXT DEFAULT NULL,
    p_invoicing_partner_id UUID DEFAULT NULL,
    p_page_number INTEGER DEFAULT NULL,
    p_page_size INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT NULL,
    p_offset INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_where_clause TEXT := '';
    v_where_conditions TEXT[] := '{}';
    v_logistics_ids UUID[];
    v_waybill_numbers TEXT[];
    v_driver_names TEXT[];
    v_license_plates TEXT[];
    v_phone_numbers TEXT[];
    v_project_ids UUID[];  -- ✅ 新增：存储解析后的项目ID数组
    v_limit INTEGER;
    v_offset INTEGER;
    v_records JSONB;
    v_total_count BIGINT;
    v_page_num INTEGER := 1;
    v_page_sz INTEGER := 20;
BEGIN
    -- 安全地处理分页参数
    IF p_page_number IS NOT NULL THEN
        v_page_num := p_page_number;
    END IF;
    
    IF p_page_size IS NOT NULL THEN
        v_page_sz := p_page_size;
    END IF;
    
    -- 计算分页
    IF p_limit IS NOT NULL AND p_offset IS NOT NULL THEN
        v_limit := p_limit;
        v_offset := p_offset;
    ELSE
        v_limit := v_page_sz;
        v_offset := (v_page_num - 1) * v_page_sz;
    END IF;
    
    -- ✅ 解析项目ID（支持逗号分隔的多个UUID）
    IF p_project_id IS NOT NULL AND p_project_id != '' THEN
        v_project_ids := string_to_array(p_project_id, ',')::uuid[];
        -- 移除空值
        v_project_ids := array_remove(v_project_ids, NULL);
    END IF;
    
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

    -- 开票方筛选
    IF p_invoicing_partner_id IS NOT NULL THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('ir.invoicing_partner_id = %L::uuid', p_invoicing_partner_id));
    END IF;

    -- 处理需要关联logistics_records的筛选条件
    IF (p_waybill_number IS NOT NULL AND p_waybill_number != '') OR
       (p_driver_name IS NOT NULL AND p_driver_name != '') OR
       (p_loading_date IS NOT NULL AND p_loading_date != '') OR
       (v_project_ids IS NOT NULL AND array_length(v_project_ids, 1) > 0) OR
       (p_license_plate IS NOT NULL AND p_license_plate != '') OR
       (p_phone_number IS NOT NULL AND p_phone_number != '') OR
       (p_platform_name IS NOT NULL AND p_platform_name != '') THEN
        
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
                 SELECT 1 FROM unnest(v_waybill_numbers) AS wb
                 WHERE lr.auto_number ILIKE '%' || wb || '%'
                    OR EXISTS (
                        SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext
                        WHERE ext ILIKE '%' || wb || '%'
                    )
             )) AND
            -- 司机姓名筛选（支持批量）
            (v_driver_names IS NULL OR 
             EXISTS (SELECT 1 FROM unnest(v_driver_names) AS dr WHERE lr.driver_name ILIKE '%' || dr || '%')) AND
            -- ✅ 装货日期筛选 - 使用 +08:00 时区转换
            (p_loading_date IS NULL OR p_loading_date = '' OR 
             (lr.loading_date >= (p_loading_date || ' 00:00:00+08:00')::timestamptz 
              AND lr.loading_date < ((p_loading_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second'))) AND
            -- ✅ 修改：项目筛选（支持多个项目ID）
            (v_project_ids IS NULL OR array_length(v_project_ids, 1) IS NULL OR lr.project_id = ANY(v_project_ids)) AND
            -- 车牌号筛选（支持批量）
            (v_license_plates IS NULL OR 
             EXISTS (SELECT 1 FROM unnest(v_license_plates) AS lp WHERE lr.license_plate ILIKE '%' || lp || '%')) AND
            -- 电话筛选（支持批量）
            (v_phone_numbers IS NULL OR 
             EXISTS (SELECT 1 FROM unnest(v_phone_numbers) AS ph WHERE lr.driver_phone ILIKE '%' || ph || '%')) AND
            -- 平台筛选
            (p_platform_name IS NULL OR 
             p_platform_name = '' OR
             (p_platform_name = '本平台' AND lr.external_tracking_numbers IS NULL) OR
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

    -- 获取总数
    EXECUTE 'SELECT COUNT(*)::BIGINT FROM invoice_requests ir ' || v_where_clause 
        INTO v_total_count;

    -- 执行查询并返回结果
    EXECUTE format('
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
                COALESCE(ir.total_received_amount, 0) AS total_received_amount,
                ir.payment_due_date,
                COALESCE(ir.overdue_days, 0) AS overdue_days,
                COALESCE(ir.reminder_count, 0) AS reminder_count,
                COALESCE(ir.reconciliation_status, ''Unreconciled'') AS reconciliation_status,
                ir.record_count,
                ir.status,
                ir.created_by,
                ir.remarks,
                COALESCE(ir.is_merged_request, false) AS is_merged_request,
                COALESCE(ir.merged_count, 0) AS merged_count
            FROM invoice_requests ir
            %s
            ORDER BY ir.created_at DESC
            LIMIT %s OFFSET %s
        ),
        -- ✅ 新增：计算每个申请单的装货日期范围和司机应收合计
        request_stats AS (
            SELECT 
                fr.id,
                -- 装货日期范围：最早日期 - 最晚日期（转换为中国时区显示）
                CASE 
                    WHEN DATE((MIN(lr.loading_date) AT TIME ZONE ''UTC'') AT TIME ZONE ''Asia/Shanghai'') = 
                         DATE((MAX(lr.loading_date) AT TIME ZONE ''UTC'') AT TIME ZONE ''Asia/Shanghai'') THEN
                        -- 如果所有运单都是同一天，只显示一个日期（中国时区日期）
                        TO_CHAR((MIN(lr.loading_date) AT TIME ZONE ''UTC'') AT TIME ZONE ''Asia/Shanghai'', ''YYYY-MM-DD'')
                    ELSE
                        -- 如果有多个日期，显示范围（中国时区日期）
                        TO_CHAR((MIN(lr.loading_date) AT TIME ZONE ''UTC'') AT TIME ZONE ''Asia/Shanghai'', ''YYYY-MM-DD'') || '' ~ '' || 
                        TO_CHAR((MAX(lr.loading_date) AT TIME ZONE ''UTC'') AT TIME ZONE ''Asia/Shanghai'', ''YYYY-MM-DD'')
                END AS loading_date_range,
                -- 司机应收合计：所有运单的payable_cost总和
                COALESCE(SUM(lr.payable_cost), 0) AS total_payable_cost
            FROM filtered_requests fr
            INNER JOIN invoice_request_details ird ON ird.invoice_request_id = fr.id
            INNER JOIN logistics_records lr ON lr.id = ird.logistics_record_id
            GROUP BY fr.id
        )
        SELECT jsonb_agg(
            jsonb_build_object(
                ''id'', fr.id,
                ''created_at'', fr.created_at,
                ''request_number'', fr.request_number,
                ''invoicing_partner_id'', fr.invoicing_partner_id,
                ''partner_id'', fr.partner_id,
                ''partner_name'', fr.partner_name,
                ''partner_full_name'', fr.partner_full_name,
                ''invoicing_partner_full_name'', fr.invoicing_partner_full_name,
                ''invoicing_partner_tax_number'', fr.invoicing_partner_tax_number,
                ''tax_number'', fr.tax_number,
                ''invoice_number'', fr.invoice_number,
                ''total_amount'', fr.total_amount,
                ''total_received_amount'', fr.total_received_amount,
                ''payment_due_date'', fr.payment_due_date,
                ''overdue_days'', fr.overdue_days,
                ''reminder_count'', fr.reminder_count,
                ''reconciliation_status'', fr.reconciliation_status,
                ''record_count'', fr.record_count,
                ''status'', fr.status,
                ''created_by'', fr.created_by,
                ''remarks'', fr.remarks,
                ''loading_date_range'', COALESCE(rs.loading_date_range, ''-''),
                ''total_payable_cost'', COALESCE(rs.total_payable_cost, 0),
                ''is_merged_request'', fr.is_merged_request,
                ''merged_count'', fr.merged_count
            )
        )
        FROM filtered_requests fr
        LEFT JOIN request_stats rs ON rs.id = fr.id
    ', v_where_clause, v_limit, v_offset)
    INTO v_records;

    RETURN jsonb_build_object(
        'success', true,
        'records', COALESCE(v_records, '[]'::jsonb),
        'total_count', v_total_count,
        'page_number', v_page_num,
        'page_size', v_page_sz,
        'total_pages', CEIL(v_total_count::numeric / NULLIF(v_page_sz, 1))
    );
END;
$$;

COMMENT ON FUNCTION public.get_invoice_requests_filtered_1116 IS '筛选开票申请单，支持多个 project_id（逗号分隔的 UUID 字符串）';

-- ============================================================================
-- 3. get_payment_request_data_1116
-- ============================================================================
-- 支持多个 project_id（逗号分隔的 UUID 字符串）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_payment_request_data_1116(
    p_project_id text DEFAULT NULL::text,  -- ✅ 改为 TEXT，支持逗号分隔的多个 UUID
    p_start_date text DEFAULT NULL::text, 
    p_end_date text DEFAULT NULL::text, 
    p_payment_status_array text[] DEFAULT NULL::text[], 
    p_partner_id uuid DEFAULT NULL::uuid, 
    p_driver_name text DEFAULT NULL::text, 
    p_license_plate text DEFAULT NULL::text, 
    p_driver_phone text DEFAULT NULL::text, 
    p_waybill_numbers text DEFAULT NULL::text, 
    p_other_platform_name text DEFAULT NULL::text, 
    p_page_size integer DEFAULT 50, 
    p_page_number integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json jsonb;
    v_offset integer;
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
    v_project_ids uuid[];  -- ✅ 新增：存储解析后的项目ID数组
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- ✅ 解析项目ID（支持逗号分隔的多个UUID）
    IF p_project_id IS NOT NULL AND p_project_id != '' THEN
        v_project_ids := string_to_array(p_project_id, ',')::uuid[];
        -- 移除空值
        v_project_ids := array_remove(v_project_ids, NULL);
    END IF;
    
    -- 解析批量输入参数
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := regexp_split_to_array(trim(p_waybill_numbers), '[,\s]+');
        v_waybill_array := array_remove(v_waybill_array, '');
    END IF;
    
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := regexp_split_to_array(trim(p_driver_name), '[,\s]+');
        v_driver_array := array_remove(v_driver_array, '');
    END IF;
    
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := regexp_split_to_array(trim(p_license_plate), '[,\s]+');
        v_license_array := array_remove(v_license_array, '');
    END IF;
    
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := regexp_split_to_array(trim(p_driver_phone), '[,\s]+');
        v_phone_array := array_remove(v_phone_array, '');
    END IF;

    -- 主查询逻辑
    WITH filtered_records AS (
        SELECT DISTINCT
            lr.*,
            pc.chain_name
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE 1=1
            -- ✅ 修改：项目筛选（支持多个项目ID）
            AND (v_project_ids IS NULL OR array_length(v_project_ids, 1) IS NULL OR lr.project_id = ANY(v_project_ids))
            -- ✅ 修改：使用 +08:00 时区转换
            AND (p_start_date IS NULL OR p_start_date = '' OR 
                 lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz)
            AND (p_end_date IS NULL OR p_end_date = '' OR 
                 lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second'))
            AND (p_payment_status_array IS NULL OR lr.payment_status = ANY(p_payment_status_array))
            AND (p_other_platform_name IS NULL OR 
                (p_other_platform_name = '本平台' AND lr.external_tracking_numbers IS NULL) OR
                p_other_platform_name = ANY(lr.other_platform_names)
            )
            AND (v_waybill_array IS NULL OR (
                lr.auto_number = ANY(v_waybill_array) 
                OR (lr.external_tracking_numbers IS NOT NULL AND lr.external_tracking_numbers && v_waybill_array)
            ))
            AND (v_driver_array IS NULL OR EXISTS (
                SELECT 1 FROM public.drivers d WHERE d.id = lr.driver_id AND d.name = ANY(v_driver_array)
            ))
            AND (v_license_array IS NULL OR lr.license_plate = ANY(v_license_array))
            AND (v_phone_array IS NULL OR lr.driver_phone = ANY(v_phone_array))
            ORDER BY lr.auto_number DESC
            LIMIT p_page_size
            OFFSET v_offset
    ),
    total_count AS (
        SELECT COUNT(DISTINCT lr.id) AS count
        FROM public.logistics_records lr
        WHERE 1=1
            -- ✅ 修改：项目筛选（支持多个项目ID）
            AND (v_project_ids IS NULL OR array_length(v_project_ids, 1) IS NULL OR lr.project_id = ANY(v_project_ids))
            -- ✅ 修改：使用 +08:00 时区转换
            AND (p_start_date IS NULL OR p_start_date = '' OR 
                 lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz)
            AND (p_end_date IS NULL OR p_end_date = '' OR 
                 lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second'))
            AND (p_payment_status_array IS NULL OR lr.payment_status = ANY(p_payment_status_array))
            AND (p_other_platform_name IS NULL OR 
                (p_other_platform_name = '本平台' AND lr.external_tracking_numbers IS NULL) OR
                p_other_platform_name = ANY(lr.other_platform_names)
            )
            AND (v_waybill_array IS NULL OR (
                lr.auto_number = ANY(v_waybill_array) 
                OR (lr.external_tracking_numbers IS NOT NULL AND lr.external_tracking_numbers && v_waybill_array)
            ))
            AND (v_driver_array IS NULL OR EXISTS (
                SELECT 1 FROM public.drivers d WHERE d.id = lr.driver_id AND d.name = ANY(v_driver_array)
            ))
            AND (v_license_array IS NULL OR lr.license_plate = ANY(v_license_array))
            AND (v_phone_array IS NULL OR lr.driver_phone = ANY(v_phone_array))
    ),
    total_payable_cost AS (
        SELECT COALESCE(SUM(payable_cost), 0) AS total FROM filtered_records
    )
    SELECT jsonb_build_object(
        'count', (SELECT count FROM total_count),
        'overview', jsonb_build_object(
            'total_payable_cost', (SELECT total FROM total_payable_cost)
        ),
        'partners', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT 
                    lpc.partner_id, 
                    p.name AS partner_name, 
                    p.full_name, 
                    pbd.bank_account, 
                    pbd.bank_name, 
                    pbd.branch_name,
                    COUNT(DISTINCT lpc.logistics_record_id) AS records_count,
                    SUM(lpc.payable_amount) AS total_payable
                FROM public.logistics_partner_costs lpc
                JOIN public.partners p ON lpc.partner_id = p.id
                LEFT JOIN public.partner_bank_details pbd ON p.id = pbd.partner_id
                WHERE lpc.logistics_record_id IN (SELECT id FROM filtered_records)
                  AND (
                    p_payment_status_array IS NULL
                    OR (
                      CASE 
                        WHEN 'Unpaid' = ANY(p_payment_status_array) THEN lpc.payment_status = 'Unpaid'
                        WHEN 'Processing' = ANY(p_payment_status_array) THEN lpc.payment_status = 'Processing'
                        WHEN 'Paid' = ANY(p_payment_status_array) THEN lpc.payment_status = 'Paid'
                        ELSE lpc.payment_status = 'Unpaid'
                      END
                    )
                  )
                GROUP BY lpc.partner_id, p.name, p.full_name, pbd.bank_account, pbd.bank_name, pbd.branch_name
            ) t
        ),
        'records', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', r.id,
                    'auto_number', r.auto_number,
                    'project_name', r.project_name,
                    'driver_name', r.driver_name,
                    'loading_location', r.loading_location,
                    'unloading_location', r.unloading_location,
                    'loading_date', r.loading_date,
                    'unloading_date', r.unloading_date,
                    'license_plate', r.license_plate,
                    'driver_phone', r.driver_phone,
                    'payable_cost', r.payable_cost,
                    'payment_status', r.payment_status,
                    'invoice_status', r.invoice_status,
                    'cargo_type', r.cargo_type,
                    'loading_weight', r.loading_weight,
                    'unloading_weight', r.unloading_weight,
                    'remarks', r.remarks,
                    'chain_name', r.chain_name,
                    'chain_id', r.chain_id,
                    'partner_costs', (
                        SELECT COALESCE(jsonb_agg(
                            jsonb_build_object(
                                'partner_id', lpc.partner_id,
                                'partner_name', p.name,
                                'level', lpc.level,
                                'payable_amount', lpc.payable_amount,
                                'payment_status', lpc.payment_status,
                                'invoice_status', lpc.invoice_status,
                                'full_name', p.full_name,
                                'bank_account', pbd.bank_account,
                                'bank_name', pbd.bank_name,
                                'branch_name', pbd.branch_name
                            ) ORDER BY lpc.level
                        ), '[]'::jsonb)
                        FROM public.logistics_partner_costs lpc
                        JOIN public.partners p ON lpc.partner_id = p.id
                        LEFT JOIN public.partner_bank_details pbd ON p.id = pbd.partner_id
                        WHERE lpc.logistics_record_id = r.id
                    )
                ) ORDER BY r.auto_number DESC
            ), '[]'::jsonb)
            FROM filtered_records r
        )
    ) INTO result_json;

    RETURN result_json;
END;
$function$;

COMMENT ON FUNCTION public.get_payment_request_data_1116 IS '获取付款申请数据，支持多个 project_id（逗号分隔的 UUID 字符串）';

-- ============================================================================
-- 4. get_filtered_unpaid_ids_1116
-- ============================================================================
-- 支持多个 project_id（逗号分隔的 UUID 字符串）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_filtered_unpaid_ids_1116(
    p_project_id text DEFAULT NULL,  -- ✅ 改为 TEXT，支持逗号分隔的多个 UUID
    p_start_date date DEFAULT NULL::date,
    p_end_date date DEFAULT NULL::date,
    p_partner_id uuid DEFAULT NULL::uuid,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_ids uuid[];
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
    v_project_ids uuid[];  -- ✅ 新增：存储解析后的项目ID数组
BEGIN
    -- ✅ 解析项目ID（支持逗号分隔的多个UUID）
    IF p_project_id IS NOT NULL AND p_project_id != '' THEN
        v_project_ids := string_to_array(p_project_id, ',')::uuid[];
        -- 移除空值
        v_project_ids := array_remove(v_project_ids, NULL);
    END IF;
    
    -- 解析批量输入参数（支持逗号、空格或混合分隔）
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := regexp_split_to_array(trim(p_waybill_numbers), '[,\s]+');
        v_waybill_array := array_remove(v_waybill_array, '');
    END IF;
    
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := regexp_split_to_array(trim(p_driver_name), '[,\s]+');
        v_driver_array := array_remove(v_driver_array, '');
    END IF;
    
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := regexp_split_to_array(trim(p_license_plate), '[,\s]+');
        v_license_array := array_remove(v_license_array, '');
    END IF;
    
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := regexp_split_to_array(trim(p_driver_phone), '[,\s]+');
        v_phone_array := array_remove(v_phone_array, '');
    END IF;

    SELECT array_agg(DISTINCT v.id)
    INTO result_ids
    FROM public.logistics_records_view v
    JOIN public.logistics_records lr ON v.id = lr.id
    WHERE
        lr.payment_status = 'Unpaid' AND
        -- ✅ 修改：项目筛选（支持多个项目ID）
        (v_project_ids IS NULL OR array_length(v_project_ids, 1) IS NULL OR v.project_id = ANY(v_project_ids)) AND
        (p_start_date IS NULL OR v.loading_date::date >= p_start_date) AND
        (p_end_date IS NULL OR v.loading_date::date <= p_end_date) AND
        (v_waybill_array IS NULL OR EXISTS (
            SELECT 1 FROM unnest(v_waybill_array) AS wb_num
            WHERE v.auto_number ILIKE '%' || wb_num || '%'
               OR EXISTS (
                   SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext_num
                   WHERE ext_num ILIKE '%' || wb_num || '%'
               )
        )) AND
        (v_driver_array IS NULL OR EXISTS (
            SELECT 1 FROM unnest(v_driver_array) AS dr_name
            WHERE v.driver_name ILIKE '%' || dr_name || '%'
        )) AND
        (v_license_array IS NULL OR EXISTS (
            SELECT 1 FROM unnest(v_license_array) AS lp
            WHERE v.license_plate ILIKE '%' || lp || '%'
        )) AND
        (v_phone_array IS NULL OR EXISTS (
            SELECT 1 FROM unnest(v_phone_array) AS phone
            WHERE v.driver_phone ILIKE '%' || phone || '%'
        )) AND
        (p_other_platform_name IS NULL OR p_other_platform_name = '' OR
            CASE 
                WHEN p_other_platform_name = '本平台' THEN 
                    (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                ELSE 
                    EXISTS (
                        SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name
                        WHERE platform_name ILIKE '%' || p_other_platform_name || '%'
                    )
            END
        ) AND
        (p_partner_id IS NULL OR EXISTS (
            SELECT 1 FROM public.logistics_partner_costs lpc
            WHERE lpc.logistics_record_id = v.id 
              AND lpc.partner_id = p_partner_id
              AND lpc.payment_status = 'Unpaid'
        ));

    RETURN COALESCE(result_ids, '{}');
END;
$function$;

COMMENT ON FUNCTION public.get_filtered_unpaid_ids_1116 IS '获取未付款运单ID列表，支持多个 project_id（逗号分隔的 UUID 字符串）';

-- ============================================================================
-- 5. get_finance_reconciliation_by_partner_1116
-- ============================================================================
-- 支持多个 project_id（逗号分隔的 UUID 字符串）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_finance_reconciliation_by_partner_1116(
    -- 常规筛选参数
    p_project_id text DEFAULT NULL,  -- ✅ 改为 TEXT，支持逗号分隔的多个 UUID
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_partner_id uuid DEFAULT NULL,
    
    -- 分页参数
    p_page_number integer DEFAULT 1,
    p_page_size integer DEFAULT 50,
    
    -- 高级筛选参数（新增）
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_offset integer;
    v_result jsonb;
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
    v_project_ids uuid[];  -- ✅ 新增：存储解析后的项目ID数组
    v_total_count integer;
    v_total_pages integer;
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- ✅ 解析项目ID（支持逗号分隔的多个UUID）
    IF p_project_id IS NOT NULL AND p_project_id != '' THEN
        v_project_ids := string_to_array(p_project_id, ',')::uuid[];
        -- 移除空值
        v_project_ids := array_remove(v_project_ids, NULL);
    END IF;
    
    -- 解析批量输入参数（支持逗号、空格或混合分隔）
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := regexp_split_to_array(trim(p_waybill_numbers), '[,\s]+');
        v_waybill_array := array_remove(v_waybill_array, '');
    END IF;
    
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := regexp_split_to_array(trim(p_driver_name), '[,\s]+');
        v_driver_array := array_remove(v_driver_array, '');
    END IF;
    
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := regexp_split_to_array(trim(p_license_plate), '[,\s]+');
        v_license_array := array_remove(v_license_array, '');
    END IF;
    
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := regexp_split_to_array(trim(p_driver_phone), '[,\s]+');
        v_phone_array := array_remove(v_phone_array, '');
    END IF;

    -- 主查询：筛选运单记录
    WITH filtered_records AS (
        SELECT DISTINCT lr.id
        FROM public.logistics_records lr
        WHERE 
            -- 基础筛选
            -- ✅ 修改：项目筛选（支持多个项目ID）
            (v_project_ids IS NULL OR array_length(v_project_ids, 1) IS NULL OR lr.project_id = ANY(v_project_ids))
            AND (p_start_date IS NULL OR lr.loading_date::date >= p_start_date)
            AND (p_end_date IS NULL OR lr.loading_date::date <= p_end_date)
            AND (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM public.logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = lr.id 
                AND lpc.partner_id = p_partner_id
            ))
            -- 高级筛选：司机姓名（支持批量）
            AND (v_driver_array IS NULL OR 
                 EXISTS (
                   SELECT 1 FROM unnest(v_driver_array) AS driver
                   WHERE lr.driver_name ILIKE '%' || driver || '%'
                 ))
            -- 高级筛选：车牌号（支持批量）
            AND (v_license_array IS NULL OR 
                 EXISTS (
                   SELECT 1 FROM unnest(v_license_array) AS license
                   WHERE lr.license_plate ILIKE '%' || license || '%'
                 ))
            -- 高级筛选：司机电话（支持批量）
            AND (v_phone_array IS NULL OR 
                 EXISTS (
                   SELECT 1 FROM unnest(v_phone_array) AS phone
                   WHERE lr.driver_phone ILIKE '%' || phone || '%'
                 ))
            -- 高级筛选：运单编号（支持批量，查询本平台和其他平台运单号）
            AND (v_waybill_array IS NULL OR 
                 EXISTS (
                   SELECT 1 FROM unnest(v_waybill_array) AS wb_num
                   WHERE lr.auto_number ILIKE '%' || wb_num || '%'
                      OR EXISTS (
                           SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext_num
                           WHERE ext_num ILIKE '%' || wb_num || '%'
                         )
                 ))
            -- 高级筛选：其他平台名称
            AND (p_other_platform_name IS NULL OR 
                 (p_other_platform_name = '本平台' AND (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) = 0))
                 OR (p_other_platform_name != '本平台' AND p_other_platform_name = ANY(lr.other_platform_names))
            )
    ),
    paginated_records AS (
        SELECT id
        FROM filtered_records
        ORDER BY id DESC
        LIMIT p_page_size
        OFFSET v_offset
    ),
    total_count_cte AS (
        SELECT COUNT(*) as count
        FROM filtered_records
    )
    SELECT 
        jsonb_build_object(
            'records', COALESCE(
                (SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', lr.id,
                        'auto_number', lr.auto_number,
                        'project_name', lr.project_name,
                        'driver_name', lr.driver_name,
                        'loading_location', lr.loading_location,
                        'unloading_location', lr.unloading_location,
                        'loading_date', TO_CHAR(lr.loading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD'),
                        'unloading_date', CASE WHEN lr.unloading_date IS NOT NULL 
                            THEN TO_CHAR(lr.unloading_date AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') 
                            ELSE NULL END,
                        'loading_weight', lr.loading_weight,
                        'unloading_weight', lr.unloading_weight,
                        'current_cost', lr.current_cost,
                        'payable_cost', lr.payable_cost,
                        'extra_cost', lr.extra_cost,
                        'license_plate', lr.license_plate,
                        'driver_phone', lr.driver_phone,
                        'transport_type', lr.transport_type,
                        'remarks', lr.remarks,
                        'chain_name', pc.chain_name,
                        'billing_type_id', lr.billing_type_id,
                        'partner_costs', COALESCE(
                            (SELECT jsonb_agg(
                                jsonb_build_object(
                                    'partner_id', lpc.partner_id,
                                    'partner_name', p.name,
                                    'level', lpc.level,
                                    'payable_amount', lpc.payable_amount
                                ) ORDER BY lpc.level
                            )
                            FROM public.logistics_partner_costs lpc
                            JOIN public.partners p ON lpc.partner_id = p.id
                            WHERE lpc.logistics_record_id = lr.id),
                            '[]'::jsonb
                        )
                    ) ORDER BY lr.auto_number DESC
                )
                FROM paginated_records pr
                JOIN public.logistics_records lr ON pr.id = lr.id
                LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id),
                '[]'::jsonb
            ),
            'overview', jsonb_build_object(
                'total_records', (SELECT count FROM total_count_cte),
                'total_freight', COALESCE(
                    (SELECT SUM(lr.current_cost)
                     FROM filtered_records fr
                     JOIN public.logistics_records lr ON fr.id = lr.id),
                    0
                ),
                'total_extra_cost', COALESCE(
                    (SELECT SUM(lr.extra_cost)
                     FROM filtered_records fr
                     JOIN public.logistics_records lr ON fr.id = lr.id),
                    0
                ),
                'total_driver_receivable', COALESCE(
                    (SELECT SUM(lr.payable_cost)
                     FROM filtered_records fr
                     JOIN public.logistics_records lr ON fr.id = lr.id),
                    0
                )
            ),
            'partner_summary', COALESCE(
                (SELECT jsonb_agg(
                    jsonb_build_object(
                        'partner_id', partner_id,
                        'partner_name', partner_name,
                        'records_count', records_count,
                        'total_payable', total_payable
                    )
                )
                FROM (
                    SELECT 
                        lpc.partner_id,
                        p.name as partner_name,
                        COUNT(DISTINCT lpc.logistics_record_id) as records_count,
                        SUM(lpc.payable_amount) as total_payable
                    FROM filtered_records fr
                    JOIN public.logistics_partner_costs lpc ON fr.id = lpc.logistics_record_id
                    JOIN public.partners p ON lpc.partner_id = p.id
                    GROUP BY lpc.partner_id, p.name
                ) partner_stats),
                '[]'::jsonb
            ),
            'count', (SELECT count FROM total_count_cte),
            'total_pages', CEIL((SELECT count FROM total_count_cte)::numeric / NULLIF(p_page_size, 1))
        )
    INTO v_result;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_finance_reconciliation_by_partner_1116 IS 
'获取运费对账数据，支持多个 project_id（逗号分隔的 UUID 字符串）和高级筛选';

-- ============================================================================
-- 6. batch_recalculate_by_filter_1116
-- ============================================================================
-- 根据筛选条件批量重算合作方成本，支持多个 project_id（逗号分隔的 UUID 字符串）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_recalculate_by_filter_1116(
    p_project_id text DEFAULT NULL,  -- ✅ 改为 TEXT，支持逗号分隔的多个 UUID
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_partner_id uuid DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_record_ids UUID[];
    v_project_ids UUID[];  -- ✅ 新增：存储解析后的项目ID数组
    v_result JSON;
BEGIN
    -- 权限检查
    IF NOT public.is_finance_operator_or_admin() THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有财务、操作员和管理员可以重算成本'
        );
    END IF;
    
    -- ✅ 解析项目ID（支持逗号分隔的多个UUID）
    IF p_project_id IS NOT NULL AND p_project_id != '' THEN
        v_project_ids := string_to_array(p_project_id, ',')::uuid[];
        -- 移除空值
        v_project_ids := array_remove(v_project_ids, NULL);
    END IF;
    
    -- 根据筛选条件获取符合条件的运单ID列表
    SELECT array_agg(DISTINCT lr.id)
    INTO v_record_ids
    FROM public.logistics_records lr
    WHERE 
        -- ✅ 修改：项目筛选（支持多个项目ID）
        (v_project_ids IS NULL OR array_length(v_project_ids, 1) IS NULL OR lr.project_id = ANY(v_project_ids))
        AND (p_start_date IS NULL OR lr.loading_date::date >= p_start_date)
        AND (p_end_date IS NULL OR lr.loading_date::date <= p_end_date)
        AND (p_partner_id IS NULL OR EXISTS (
            SELECT 1 FROM public.logistics_partner_costs lpc
            WHERE lpc.logistics_record_id = lr.id 
            AND lpc.partner_id = p_partner_id
        ));
    
    -- 如果没有符合条件的运单，返回空结果
    IF v_record_ids IS NULL OR array_length(v_record_ids, 1) IS NULL THEN
        RETURN json_build_object(
            'success', true,
            'message', '没有符合条件的运单需要重算',
            'total_count', 0,
            'updated_count', 0,
            'skipped_count', 0,
            'protected_count', 0
        );
    END IF;
    
    -- 调用批量重算函数
    SELECT public.batch_recalculate_partner_costs(v_record_ids) INTO v_result;
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.batch_recalculate_by_filter_1116 IS '根据筛选条件批量重算合作方成本，支持多个 project_id（逗号分隔的 UUID 字符串）';

-- ============================================================================
-- 验证
-- ============================================================================
SELECT '✅ 所有函数已创建：支持多个 project_id（逗号分隔的 UUID 字符串）' AS status;

