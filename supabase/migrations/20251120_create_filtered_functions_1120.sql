-- ============================================================================
-- 创建筛选函数 _1120 版本
-- 创建日期：2025-11-20
-- 功能：基于 _1116 版本创建 _1120 版本的筛选函数
-- ============================================================================

-- ============================================================================
-- 1. get_payment_requests_filtered_1120
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_payment_requests_filtered_1120(
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
    v_project_ids UUID[];  -- ✅ 存储解析后的项目ID数组
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

COMMENT ON FUNCTION public.get_payment_requests_filtered_1120 IS '筛选付款申请单，支持多个 project_id（逗号分隔的 UUID 字符串）- 1120版本';

-- ============================================================================
-- 2. get_invoice_requests_filtered_1120
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_invoice_requests_filtered_1120(
    p_request_number TEXT DEFAULT NULL,
    p_waybill_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_loading_date TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_project_id TEXT DEFAULT NULL,  -- ✅ 支持逗号分隔的多个 UUID
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
    v_project_ids UUID[];  -- ✅ 存储解析后的项目ID数组
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

COMMENT ON FUNCTION public.get_invoice_requests_filtered_1120 IS '筛选开票申请单，支持多个 project_id（逗号分隔的 UUID 字符串）- 1120版本';

-- ============================================================================
-- 验证
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 筛选函数 _1120 版本已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已创建函数：';
    RAISE NOTICE '  • get_payment_requests_filtered_1120';
    RAISE NOTICE '  • get_invoice_requests_filtered_1120';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

