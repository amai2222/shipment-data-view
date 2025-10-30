-- 更新申请单列表RPC函数，添加申请金额字段
-- 文件：更新申请单列表RPC函数添加申请金额.sql
-- 描述：为 get_payment_requests_filtered 函数添加 max_amount 字段，显示该申请单中金额最高的运单金额

-- 删除现有函数（删除所有重载版本）
DROP FUNCTION IF EXISTS get_payment_requests_filtered(text, text, text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS get_payment_requests_filtered(text, text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS get_payment_requests_filtered(text, text, text, text, text, integer);
DROP FUNCTION IF EXISTS get_payment_requests_filtered(text, text, text, text, text);
DROP FUNCTION IF EXISTS get_payment_requests_filtered();

-- 重新创建函数，添加申请金额字段
CREATE OR REPLACE FUNCTION get_payment_requests_filtered(
  p_request_id text DEFAULT NULL,
  p_waybill_number text DEFAULT NULL,
  p_driver_name text DEFAULT NULL,
  p_loading_date text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_project_id text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  created_at timestamp with time zone,
  request_id text,
  status text,
  notes text,
  logistics_record_ids text[],
  record_count integer,
  total_count bigint,
  max_amount numeric -- 新增：申请金额（最高金额）
)
LANGUAGE plpgsql
SECURITY DEFINER
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

    -- 执行查询并返回结果，添加申请金额字段
    RETURN QUERY EXECUTE format('
        WITH filtered_requests AS (
            SELECT 
                pr.id,
                pr.created_at,
                pr.request_id,
                pr.status,
                pr.notes,
                pr.logistics_record_ids,
                COALESCE(array_length(pr.logistics_record_ids, 1), 0) as record_count,
                -- 计算申请金额：从关联的运单中获取最高金额
                COALESCE(
                    (
                        SELECT MAX(lr.payable_cost)
                        FROM logistics_records lr
                        WHERE lr.id = ANY(pr.logistics_record_ids)
                        AND lr.payable_cost IS NOT NULL
                    ), 0
                )::numeric as max_amount
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
            tc.count as total_count,
            fr.max_amount
        FROM filtered_requests fr
        CROSS JOIN total_count tc
    ', v_where_clause, p_limit, p_offset, v_where_clause);
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION get_payment_requests_filtered IS '获取筛选后的付款申请单列表，包含申请金额字段';

-- 测试函数
SELECT 'get_payment_requests_filtered 函数已更新，添加了 max_amount 字段' as result;
