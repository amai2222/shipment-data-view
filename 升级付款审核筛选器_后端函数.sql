-- ============================================================================
-- 升级付款审核和财务付款筛选器 - 后端函数
-- ============================================================================
-- 功能：为 get_payment_requests_filtered 函数添加批量OR搜索支持
-- 参考：付款申请页面的高级筛选功能
-- 新增：车牌号、电话、平台名称筛选，所有字段支持批量OR搜索
-- ============================================================================
-- 执行日期: 2025-10-26
-- ============================================================================

BEGIN;

-- 删除旧版本函数
DROP FUNCTION IF EXISTS get_payment_requests_filtered(text, text, text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS get_payment_requests_filtered(text, text, text, text, text, text, text, text, text, integer, integer);

-- ============================================================================
-- 创建增强版 get_payment_requests_filtered 函数
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_payment_requests_filtered(
    -- 常规筛选参数
    p_request_id text DEFAULT NULL,
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_status text DEFAULT NULL,
    p_project_id text DEFAULT NULL,
    
    -- 高级筛选参数（支持批量）
    p_waybill_numbers text DEFAULT NULL,      -- 运单编号（批量）
    p_driver_name text DEFAULT NULL,          -- 司机（批量）
    p_license_plate text DEFAULT NULL,        -- 车牌号（批量）
    p_driver_phone text DEFAULT NULL,         -- 电话（批量）
    p_other_platform_name text DEFAULT NULL,  -- 平台名称
    
    -- 分页参数
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    created_at timestamp with time zone,
    request_id text,
    status text,
    notes text,
    logistics_record_ids uuid[],
    record_count integer,
    total_count bigint,
    max_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_where_conditions TEXT[] := '{}';
    v_where_clause TEXT := '';
    v_logistics_ids UUID[];
    v_total_count BIGINT;
    -- 批量搜索数组
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
BEGIN
    -- 解析运单编号为数组（支持批量搜索）
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := string_to_array(p_waybill_numbers, ',');
        v_waybill_array := array(SELECT trim(unnest(v_waybill_array)));
    END IF;
    
    -- 解析司机名称为数组（支持批量搜索）
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := string_to_array(p_driver_name, ',');
        v_driver_array := array(SELECT trim(unnest(v_driver_array)));
    END IF;
    
    -- 解析车牌号为数组（支持批量搜索）
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := string_to_array(p_license_plate, ',');
        v_license_array := array(SELECT trim(unnest(v_license_array)));
    END IF;
    
    -- 解析电话为数组（支持批量搜索）
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := string_to_array(p_driver_phone, ',');
        v_phone_array := array(SELECT trim(unnest(v_phone_array)));
    END IF;

    -- 构建基础查询条件（申请单级筛选）
    IF p_request_id IS NOT NULL AND p_request_id != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.request_id ILIKE %L', '%' || p_request_id || '%'));
    END IF;

    -- 状态筛选
    IF p_status IS NOT NULL AND p_status != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.status = %L', p_status));
    END IF;
    
    -- 创建日期范围筛选
    IF p_start_date IS NOT NULL AND p_start_date != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.created_at >= %L::date', p_start_date));
    END IF;
    
    IF p_end_date IS NOT NULL AND p_end_date != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.created_at <= %L::date + interval ''1 day''', p_end_date));
    END IF;

    -- 处理运单级筛选（需要关联查询）
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' OR
       p_driver_name IS NOT NULL AND p_driver_name != '' OR
       p_license_plate IS NOT NULL AND p_license_plate != '' OR
       p_driver_phone IS NOT NULL AND p_driver_phone != '' OR
       p_other_platform_name IS NOT NULL AND p_other_platform_name != '' OR
       p_project_id IS NOT NULL AND p_project_id != '' THEN
        
        -- 构建运单筛选条件（支持批量OR搜索）
        SELECT array_agg(DISTINCT lr.id) INTO v_logistics_ids
        FROM logistics_records lr
        WHERE 
            -- 运单编号批量OR搜索（包括其他平台运单号）
            (p_waybill_numbers IS NULL OR p_waybill_numbers = '' OR 
             lr.auto_number = ANY(v_waybill_array) OR
             (lr.external_tracking_numbers IS NOT NULL AND 
              lr.external_tracking_numbers && v_waybill_array)) AND
            
            -- 司机批量OR搜索
            (p_driver_name IS NULL OR p_driver_name = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_driver_array) AS driver_name
                 WHERE lr.driver_name ILIKE '%' || driver_name || '%'
             )) AND
            
            -- 车牌号批量OR搜索
            (p_license_plate IS NULL OR p_license_plate = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_license_array) AS plate
                 WHERE lr.license_plate ILIKE '%' || plate || '%'
             )) AND
            
            -- 电话批量OR搜索
            (p_driver_phone IS NULL OR p_driver_phone = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_phone_array) AS phone
                 WHERE lr.driver_phone ILIKE '%' || phone || '%'
             )) AND
            
            -- 平台名称筛选
            (p_other_platform_name IS NULL OR p_other_platform_name = '' OR 
             CASE 
                 WHEN p_other_platform_name = '本平台' THEN 
                     (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                 ELSE 
                     EXISTS (SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name 
                            WHERE platform_name ILIKE '%' || p_other_platform_name || '%')
             END) AND
            
            -- 项目筛选
            (p_project_id IS NULL OR p_project_id = '' OR lr.project_id::TEXT = p_project_id);
        
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

COMMENT ON FUNCTION public.get_payment_requests_filtered IS 
'获取筛选后的付款申请单列表（增强版）：支持批量OR搜索、其他平台运单号、动态平台名称筛选';

SELECT '✅ get_payment_requests_filtered 函数升级完成' as 状态;

COMMIT;

-- ============================================================================
-- 测试用例
-- ============================================================================

-- 测试批量运单号搜索
SELECT * FROM get_payment_requests_filtered(
    p_waybill_numbers := 'HDA0648,2021991438,ABC123',
    p_limit := 10
);

-- 测试批量司机搜索
SELECT * FROM get_payment_requests_filtered(
    p_driver_name := '张三,李四,王五',
    p_limit := 10
);

-- 测试批量车牌搜索
SELECT * FROM get_payment_requests_filtered(
    p_license_plate := '京A,京B,沪C',
    p_limit := 10
);

-- 测试综合筛选
SELECT * FROM get_payment_requests_filtered(
    p_status := 'Pending',
    p_driver_name := '张三,李四',
    p_waybill_numbers := 'HDA0648,2021991438',
    p_limit := 10
);

-- ============================================================================
-- 升级说明
-- ============================================================================
-- 
-- 新增参数：
-- - p_start_date        - 开始日期
-- - p_end_date          - 结束日期
-- - p_license_plate     - 车牌号（支持批量）
-- - p_driver_phone      - 电话（支持批量）
-- - p_other_platform_name - 平台名称
--
-- 修改参数：
-- - p_waybill_number → p_waybill_numbers（改为复数，支持批量）
-- - p_loading_date → p_start_date + p_end_date（日期范围）
--
-- 批量搜索逻辑：
-- - 运单号：支持批量 + 其他平台运单号
-- - 司机：支持批量OR
-- - 车牌：支持批量OR
-- - 电话：支持批量OR
--
-- ============================================================================

