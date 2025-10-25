-- ============================================================
-- 修复付款审核筛选器后端函数
-- 问题：1. 缺少p_project_id参数支持
--      2. 函数可能没有正确部署
--      3. 筛选逻辑需要优化
-- ============================================================

-- 1. 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS public.get_payment_requests_filtered(TEXT, TEXT, TEXT, DATE, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_payment_requests_filtered(TEXT, TEXT, TEXT, DATE, TEXT, TEXT, INTEGER, INTEGER);

-- 2. 重新创建申请单筛选查询函数（支持项目筛选）
CREATE OR REPLACE FUNCTION public.get_payment_requests_filtered(
    p_request_id TEXT DEFAULT NULL,
    p_waybill_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_loading_date DATE DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_project_id TEXT DEFAULT NULL,
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

    -- 状态筛选
    IF p_status IS NOT NULL AND p_status != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.status = %L', p_status));
    END IF;

    -- 处理运单号、司机、装货日期、项目筛选（需要关联查询）
    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' OR
       p_driver_name IS NOT NULL AND p_driver_name != '' OR
       p_loading_date IS NOT NULL OR
       p_project_id IS NOT NULL AND p_project_id != '' THEN
        
        -- 构建运单筛选条件
        SELECT array_agg(lr.id) INTO v_logistics_ids
        FROM logistics_records lr
        WHERE (p_waybill_number IS NULL OR p_waybill_number = '' OR lr.auto_number ILIKE '%' || p_waybill_number || '%')
          AND (p_driver_name IS NULL OR p_driver_name = '' OR lr.driver_name ILIKE '%' || p_driver_name || '%')
          AND (p_loading_date IS NULL OR lr.loading_date = p_loading_date)
          AND (p_project_id IS NULL OR p_project_id = '' OR lr.project_id::TEXT = p_project_id);
        
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

-- 3. 创建测试函数来验证筛选器是否工作
CREATE OR REPLACE FUNCTION public.test_payment_requests_filter(
    p_request_id TEXT DEFAULT NULL,
    p_waybill_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_loading_date DATE DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_project_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    test_type TEXT,
    test_value TEXT,
    result_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- 测试申请单号筛选
    IF p_request_id IS NOT NULL AND p_request_id != '' THEN
        RETURN QUERY
        SELECT 
            'request_id'::TEXT as test_type,
            p_request_id as test_value,
            COUNT(*) as result_count
        FROM payment_requests pr
        WHERE pr.request_id ILIKE '%' || p_request_id || '%';
    END IF;

    -- 测试运单号筛选
    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' THEN
        RETURN QUERY
        SELECT 
            'waybill_number'::TEXT as test_type,
            p_waybill_number as test_value,
            COUNT(DISTINCT pr.id) as result_count
        FROM payment_requests pr
        JOIN logistics_records lr ON lr.id = ANY(pr.logistics_record_ids)
        WHERE lr.auto_number ILIKE '%' || p_waybill_number || '%';
    END IF;

    -- 测试司机筛选
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        RETURN QUERY
        SELECT 
            'driver_name'::TEXT as test_type,
            p_driver_name as test_value,
            COUNT(DISTINCT pr.id) as result_count
        FROM payment_requests pr
        JOIN logistics_records lr ON lr.id = ANY(pr.logistics_record_ids)
        WHERE lr.driver_name ILIKE '%' || p_driver_name || '%';
    END IF;

    -- 测试装货日期筛选
    IF p_loading_date IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            'loading_date'::TEXT as test_type,
            p_loading_date::TEXT as test_value,
            COUNT(DISTINCT pr.id) as result_count
        FROM payment_requests pr
        JOIN logistics_records lr ON lr.id = ANY(pr.logistics_record_ids)
        WHERE lr.loading_date = p_loading_date;
    END IF;

    -- 测试状态筛选
    IF p_status IS NOT NULL AND p_status != '' THEN
        RETURN QUERY
        SELECT 
            'status'::TEXT as test_type,
            p_status as test_value,
            COUNT(*) as result_count
        FROM payment_requests pr
        WHERE pr.status = p_status;
    END IF;

    -- 测试项目筛选
    IF p_project_id IS NOT NULL AND p_project_id != '' THEN
        RETURN QUERY
        SELECT 
            'project_id'::TEXT as test_type,
            p_project_id as test_value,
            COUNT(DISTINCT pr.id) as result_count
        FROM payment_requests pr
        JOIN logistics_records lr ON lr.id = ANY(pr.logistics_record_ids)
        WHERE lr.project_id::TEXT = p_project_id;
    END IF;

    -- 如果没有提供任何筛选条件，返回总数
    IF p_request_id IS NULL AND p_waybill_number IS NULL AND p_driver_name IS NULL 
       AND p_loading_date IS NULL AND p_status IS NULL AND p_project_id IS NULL THEN
        RETURN QUERY
        SELECT 
            'total'::TEXT as test_type,
            'all'::TEXT as test_value,
            COUNT(*) as result_count
        FROM payment_requests pr;
    END IF;
END;
$$;

-- 4. 创建调试函数来检查数据
CREATE OR REPLACE FUNCTION public.debug_payment_requests_data()
RETURNS TABLE (
    data_type TEXT,
    count BIGINT,
    sample_data TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- 检查付款申请总数
    RETURN QUERY
    SELECT 
        'payment_requests_total'::TEXT as data_type,
        COUNT(*) as count,
        'Total payment requests'::TEXT as sample_data
    FROM payment_requests;

    -- 检查运单总数
    RETURN QUERY
    SELECT 
        'logistics_records_total'::TEXT as data_type,
        COUNT(*) as count,
        'Total logistics records'::TEXT as sample_data
    FROM logistics_records;

    -- 检查有运单关联的付款申请
    RETURN QUERY
    SELECT 
        'payment_requests_with_waybills'::TEXT as data_type,
        COUNT(*) as count,
        'Payment requests with logistics records'::TEXT as sample_data
    FROM payment_requests pr
    WHERE pr.logistics_record_ids IS NOT NULL AND array_length(pr.logistics_record_ids, 1) > 0;

    -- 检查运单号样本
    RETURN QUERY
    SELECT 
        'waybill_samples'::TEXT as data_type,
        COUNT(*) as count,
        string_agg(DISTINCT lr.auto_number, ', ') as sample_data
    FROM logistics_records lr
    WHERE lr.auto_number IS NOT NULL AND lr.auto_number != ''
    LIMIT 5;

    -- 检查司机样本
    RETURN QUERY
    SELECT 
        'driver_samples'::TEXT as data_type,
        COUNT(*) as count,
        string_agg(DISTINCT lr.driver_name, ', ') as sample_data
    FROM logistics_records lr
    WHERE lr.driver_name IS NOT NULL AND lr.driver_name != ''
    LIMIT 5;

    -- 检查项目样本
    RETURN QUERY
    SELECT 
        'project_samples'::TEXT as data_type,
        COUNT(*) as count,
        string_agg(DISTINCT p.name, ', ') as sample_data
    FROM projects p
    LIMIT 5;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.get_payment_requests_filtered IS '申请单筛选查询函数，支持多维度筛选（包括项目筛选）';
COMMENT ON FUNCTION public.test_payment_requests_filter IS '测试申请单筛选函数，用于验证筛选逻辑';
COMMENT ON FUNCTION public.debug_payment_requests_data IS '调试函数，用于检查付款申请和运单数据';
