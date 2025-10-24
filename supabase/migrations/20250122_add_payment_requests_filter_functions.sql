-- ============================================================
-- 申请单管理筛选器后端函数
-- 功能：为申请单管理页面提供高效的筛选查询功能
-- 特点：支持申请单号、运单号、司机、装货日期等多维度筛选
-- ============================================================

-- 1. 创建申请单筛选查询函数
CREATE OR REPLACE FUNCTION public.get_payment_requests_filtered(
    p_request_id TEXT DEFAULT NULL,
    p_waybill_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_loading_date DATE DEFAULT NULL,
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
BEGIN
    -- 构建基础查询条件
    IF p_request_id IS NOT NULL AND p_request_id != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.request_id ILIKE %L', '%' || p_request_id || '%'));
    END IF;

    -- 处理运单号、司机、装货日期筛选（需要关联查询）
    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' OR
       p_driver_name IS NOT NULL AND p_driver_name != '' OR
       p_loading_date IS NOT NULL THEN
        
        -- 构建运单筛选条件
        SELECT array_agg(lr.id) INTO v_logistics_ids
        FROM logistics_records lr
        WHERE (p_waybill_number IS NULL OR p_waybill_number = '' OR lr.auto_number ILIKE '%' || p_waybill_number || '%')
          AND (p_driver_name IS NULL OR p_driver_name = '' OR lr.driver_name ILIKE '%' || p_driver_name || '%')
          AND (p_loading_date IS NULL OR lr.loading_date = p_loading_date);
        
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

-- 2. 创建申请单筛选统计函数
CREATE OR REPLACE FUNCTION public.get_payment_requests_filter_stats(
    p_request_id TEXT DEFAULT NULL,
    p_waybill_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_loading_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_requests BIGINT,
    pending_requests BIGINT,
    approved_requests BIGINT,
    paid_requests BIGINT,
    rejected_requests BIGINT,
    total_waybills BIGINT,
    total_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_where_conditions TEXT[] := '{}';
    v_where_clause TEXT := '';
    v_logistics_ids UUID[];
BEGIN
    -- 构建基础查询条件（与主查询函数相同的逻辑）
    IF p_request_id IS NOT NULL AND p_request_id != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.request_id ILIKE %L', '%' || p_request_id || '%'));
    END IF;

    -- 处理运单号、司机、装货日期筛选
    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' OR
       p_driver_name IS NOT NULL AND p_driver_name != '' OR
       p_loading_date IS NOT NULL THEN
        
        SELECT array_agg(lr.id) INTO v_logistics_ids
        FROM logistics_records lr
        WHERE (p_waybill_number IS NULL OR p_waybill_number = '' OR lr.auto_number ILIKE '%' || p_waybill_number || '%')
          AND (p_driver_name IS NULL OR p_driver_name = '' OR lr.driver_name ILIKE '%' || p_driver_name || '%')
          AND (p_loading_date IS NULL OR lr.loading_date = p_loading_date);
        
        IF v_logistics_ids IS NOT NULL AND array_length(v_logistics_ids, 1) > 0 THEN
            v_where_conditions := array_append(v_where_conditions, 
                format('pr.logistics_record_ids && %L', v_logistics_ids));
        ELSE
            v_where_conditions := array_append(v_where_conditions, '1 = 0');
        END IF;
    END IF;

    -- 构建WHERE子句
    IF array_length(v_where_conditions, 1) > 0 THEN
        v_where_clause := 'WHERE ' || array_to_string(v_where_conditions, ' AND ');
    END IF;

    -- 执行统计查询
    RETURN QUERY EXECUTE format('
        SELECT 
            COUNT(*) as total_requests,
            COUNT(CASE WHEN pr.status = ''Pending'' THEN 1 END) as pending_requests,
            COUNT(CASE WHEN pr.status = ''Approved'' THEN 1 END) as approved_requests,
            COUNT(CASE WHEN pr.status = ''Paid'' THEN 1 END) as paid_requests,
            COUNT(CASE WHEN pr.status = ''Rejected'' THEN 1 END) as rejected_requests,
            COALESCE(SUM(array_length(pr.logistics_record_ids, 1)), 0) as total_waybills,
            COALESCE(SUM(
                (SELECT SUM(lr.payable_cost) 
                 FROM logistics_records lr 
                 WHERE lr.id = ANY(pr.logistics_record_ids))
            ), 0) as total_amount
        FROM payment_requests pr
        %s
    ', v_where_clause);
END;
$$;

-- 3. 创建申请单筛选建议函数（用于自动补全）
CREATE OR REPLACE FUNCTION public.get_payment_requests_suggestions(
    p_type TEXT, -- 'request_id', 'waybill_number', 'driver_name'
    p_query TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    value TEXT,
    count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    CASE p_type
        WHEN 'request_id' THEN
            RETURN QUERY
            SELECT 
                pr.request_id as value,
                COUNT(*) as count
            FROM payment_requests pr
            WHERE pr.request_id ILIKE '%' || p_query || '%'
            GROUP BY pr.request_id
            ORDER BY COUNT(*) DESC, pr.request_id
            LIMIT p_limit;
            
        WHEN 'waybill_number' THEN
            RETURN QUERY
            SELECT 
                lr.auto_number as value,
                COUNT(DISTINCT pr.id) as count
            FROM logistics_records lr
            JOIN payment_requests pr ON lr.id = ANY(pr.logistics_record_ids)
            WHERE lr.auto_number ILIKE '%' || p_query || '%'
            GROUP BY lr.auto_number
            ORDER BY COUNT(DISTINCT pr.id) DESC, lr.auto_number
            LIMIT p_limit;
            
        WHEN 'driver_name' THEN
            RETURN QUERY
            SELECT 
                lr.driver_name as value,
                COUNT(DISTINCT pr.id) as count
            FROM logistics_records lr
            JOIN payment_requests pr ON lr.id = ANY(pr.logistics_record_ids)
            WHERE lr.driver_name ILIKE '%' || p_query || '%'
            GROUP BY lr.driver_name
            ORDER BY COUNT(DISTINCT pr.id) DESC, lr.driver_name
            LIMIT p_limit;
            
        ELSE
            RETURN;
    END CASE;
END;
$$;

-- 4. 创建申请单筛选导出函数
CREATE OR REPLACE FUNCTION public.get_payment_requests_filtered_export(
    p_request_id TEXT DEFAULT NULL,
    p_waybill_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_loading_date DATE DEFAULT NULL,
    p_export_format TEXT DEFAULT 'json' -- 'json', 'csv'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result TEXT;
    v_where_conditions TEXT[] := '{}';
    v_where_clause TEXT := '';
    v_logistics_ids UUID[];
BEGIN
    -- 构建筛选条件（与主查询函数相同的逻辑）
    IF p_request_id IS NOT NULL AND p_request_id != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.request_id ILIKE %L', '%' || p_request_id || '%'));
    END IF;

    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' OR
       p_driver_name IS NOT NULL AND p_driver_name != '' OR
       p_loading_date IS NOT NULL THEN
        
        SELECT array_agg(lr.id) INTO v_logistics_ids
        FROM logistics_records lr
        WHERE (p_waybill_number IS NULL OR p_waybill_number = '' OR lr.auto_number ILIKE '%' || p_waybill_number || '%')
          AND (p_driver_name IS NULL OR p_driver_name = '' OR lr.driver_name ILIKE '%' || p_driver_name || '%')
          AND (p_loading_date IS NULL OR lr.loading_date = p_loading_date);
        
        IF v_logistics_ids IS NOT NULL AND array_length(v_logistics_ids, 1) > 0 THEN
            v_where_conditions := array_append(v_where_conditions, 
                format('pr.logistics_record_ids && %L', v_logistics_ids));
        ELSE
            v_where_conditions := array_append(v_where_conditions, '1 = 0');
        END IF;
    END IF;

    IF array_length(v_where_conditions, 1) > 0 THEN
        v_where_clause := 'WHERE ' || array_to_string(v_where_conditions, ' AND ');
    END IF;

    -- 根据导出格式返回结果
    IF p_export_format = 'json' THEN
        EXECUTE format('
            SELECT json_agg(
                json_build_object(
                    ''id'', pr.id,
                    ''request_id'', pr.request_id,
                    ''created_at'', pr.created_at,
                    ''status'', pr.status,
                    ''notes'', pr.notes,
                    ''record_count'', COALESCE(array_length(pr.logistics_record_ids, 1), 0)
                )
            )::TEXT
            FROM payment_requests pr
            %s
            ORDER BY pr.created_at DESC
        ', v_where_clause) INTO v_result;
    ELSE
        -- CSV格式
        EXECUTE format('
            SELECT string_agg(
                format(''%s,%s,%s,%s,%s,%s'',
                    pr.id,
                    pr.request_id,
                    pr.created_at,
                    pr.status,
                    COALESCE(pr.notes, ''''),
                    COALESCE(array_length(pr.logistics_record_ids, 1), 0)
                ),
                E''\n''
            )
            FROM payment_requests pr
            %s
            ORDER BY pr.created_at DESC
        ', v_where_clause) INTO v_result;
    END IF;

    RETURN COALESCE(v_result, '');
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.get_payment_requests_filtered IS '申请单筛选查询函数，支持多维度筛选';
COMMENT ON FUNCTION public.get_payment_requests_filter_stats IS '申请单筛选统计函数，提供筛选结果的统计信息';
COMMENT ON FUNCTION public.get_payment_requests_suggestions IS '申请单筛选建议函数，用于自动补全功能';
COMMENT ON FUNCTION public.get_payment_requests_filtered_export IS '申请单筛选导出函数，支持JSON和CSV格式导出';
