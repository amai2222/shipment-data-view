-- 修复运单号搜索逻辑
-- 先删除旧函数，然后创建修复版本

-- 1. 删除旧函数
DROP FUNCTION IF EXISTS public.get_payment_requests_filtered(TEXT, TEXT, TEXT, DATE, TEXT, INTEGER, INTEGER);

-- 2. 重新创建申请单筛选查询函数（修复运单号搜索逻辑）
CREATE OR REPLACE FUNCTION public.get_payment_requests_filtered(
    p_request_id TEXT DEFAULT NULL,
    p_waybill_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_loading_date DATE DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
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

    -- 处理运单号、司机、装货日期筛选（需要关联查询）
    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' OR
       p_driver_name IS NOT NULL AND p_driver_name != '' OR
       p_loading_date IS NOT NULL THEN
        
        -- 先查询符合条件的运单ID
        SELECT array_agg(DISTINCT lr.id) INTO v_logistics_ids
        FROM public.logistics_records lr
        WHERE (p_waybill_number IS NULL OR p_waybill_number = '' OR lr.auto_number ILIKE '%' || p_waybill_number || '%')
          AND (p_driver_name IS NULL OR p_driver_name = '' OR lr.driver_name ILIKE '%' || p_driver_name || '%')
          AND (p_loading_date IS NULL OR lr.loading_date = p_loading_date);

        -- 如果有符合条件的运单，添加筛选条件
        IF v_logistics_ids IS NOT NULL AND array_length(v_logistics_ids, 1) > 0 THEN
            -- 使用数组重叠操作符 && 检查 logistics_record_ids 数组中是否包含任何匹配的ID
            v_where_conditions := array_append(v_where_conditions, 
                format('pr.logistics_record_ids && %L', v_logistics_ids));
        ELSE
            -- 如果没有符合条件的运单，返回空结果
            v_where_conditions := array_append(v_where_conditions, '1 = 0');
        END IF;
    END IF;

    -- 构建WHERE子句
    IF array_length(v_where_conditions, 1) > 0 THEN
        v_where_clause := 'WHERE ' || array_to_string(v_where_conditions, ' AND ');
    END IF;

    -- 执行查询并返回结果
    RETURN QUERY EXECUTE format('
        WITH filtered_data AS (
            SELECT 
                pr.id,
                pr.created_at,
                pr.request_id,
                pr.status,
                pr.notes,
                pr.logistics_record_ids,
                array_length(pr.logistics_record_ids, 1) as record_count,
                COUNT(*) OVER() as total_count
            FROM public.payment_requests pr
            %s
            ORDER BY pr.created_at DESC
            LIMIT %s OFFSET %s
        )
        SELECT * FROM filtered_data
    ', v_where_clause, p_limit, p_offset);
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.get_payment_requests_filtered IS '申请单筛选查询函数，支持多维度筛选，修复运单号搜索逻辑';

-- 测试函数是否正常工作
SELECT '运单号搜索逻辑修复完成！' as message;

-- 测试查询示例
-- SELECT * FROM public.get_payment_requests_filtered(
--     p_request_id := NULL,
--     p_waybill_number := 'YDN20250815-081',
--     p_driver_name := NULL,
--     p_loading_date := NULL,
--     p_status := NULL,
--     p_limit := 10,
--     p_offset := 0
-- );
