-- ============================================================
-- 更新付款申请单筛选函数，支持所有筛选参数
-- 新增参数：车牌号、电话、平台名称
-- 版本：完整版
-- ============================================================

-- 1. 删除旧版本函数（所有可能的签名）
-- 使用DO块来安全删除所有重载版本
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 查找并删除所有名为 get_payment_requests_filtered 的函数
    FOR r IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'get_payment_requests_filtered'
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
        RAISE NOTICE 'Dropped function: %', r.func_signature;
    END LOOP;
END $$;

-- 2. 创建完整版申请单筛选查询函数
CREATE OR REPLACE FUNCTION public.get_payment_requests_filtered(
    p_request_id TEXT DEFAULT NULL,           -- 申请单号
    p_waybill_number TEXT DEFAULT NULL,       -- 运单编号
    p_driver_name TEXT DEFAULT NULL,          -- 司机姓名（支持批量，逗号分隔）
    p_loading_date DATE DEFAULT NULL,         -- 装货日期
    p_status TEXT DEFAULT NULL,               -- 申请单状态
    p_project_id TEXT DEFAULT NULL,           -- 项目ID
    p_license_plate TEXT DEFAULT NULL,        -- 车牌号（支持批量，逗号分隔）
    p_phone_number TEXT DEFAULT NULL,         -- 电话号码（支持批量，逗号分隔）
    p_platform_name TEXT DEFAULT NULL,        -- 平台名称
    p_limit INTEGER DEFAULT 50,               -- 分页限制
    p_offset INTEGER DEFAULT 0                -- 分页偏移
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
            -- 使用正则表达式同时支持逗号和空格作为分隔符
            v_waybill_numbers := regexp_split_to_array(trim(p_waybill_number), '[,\s]+');
            -- 过滤空字符串
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
          -- 装货日期筛选
          AND (p_loading_date IS NULL OR lr.loading_date = p_loading_date)
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

-- 3. 添加函数注释
COMMENT ON FUNCTION public.get_payment_requests_filtered IS '
申请单筛选查询函数，支持多维度筛选
- 支持批量查询（逗号、空格或混合分隔，OR逻辑）：运单编号、司机姓名、车牌号、电话号码
- 批量输入示例："张三,李四" 或 "张三 李四" 或 "张三, 李四"
- 运单编号查询范围：本平台运单号(auto_number) + 其他平台运单号(external_tracking_numbers)
- 支持平台名称筛选：本平台 或 其他平台名称(other_platform_names)
';

-- 4. 授权（确保前端可以调用）
GRANT EXECUTE ON FUNCTION public.get_payment_requests_filtered TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_requests_filtered TO anon;

-- 5. 测试查询示例
-- 基础查询
-- SELECT * FROM public.get_payment_requests_filtered();

-- 状态筛选
-- SELECT * FROM public.get_payment_requests_filtered(p_status => 'Pending');

-- 批量司机筛选（支持逗号、空格或混合分隔）
-- SELECT * FROM public.get_payment_requests_filtered(p_driver_name => '张三,李四');
-- SELECT * FROM public.get_payment_requests_filtered(p_driver_name => '张三 李四');
-- SELECT * FROM public.get_payment_requests_filtered(p_driver_name => '张三, 李四, 王五');

-- 批量车牌号筛选（支持逗号、空格或混合分隔）
-- SELECT * FROM public.get_payment_requests_filtered(p_license_plate => '京A12345,京B67890');
-- SELECT * FROM public.get_payment_requests_filtered(p_license_plate => '京A12345 京B67890');

-- 运单编号筛选（支持批量，查询本平台运单号 auto_number 和其他平台运单号 external_tracking_numbers）
-- SELECT * FROM public.get_payment_requests_filtered(p_waybill_number => 'HDA0648');
-- SELECT * FROM public.get_payment_requests_filtered(p_waybill_number => 'WB001,WB002,WB003');
-- SELECT * FROM public.get_payment_requests_filtered(p_waybill_number => 'WB001 WB002 WB003');

-- 平台名称筛选（查询其他平台名称 other_platform_names）
-- SELECT * FROM public.get_payment_requests_filtered(p_platform_name => '中科智运');

-- 组合查询
-- SELECT * FROM public.get_payment_requests_filtered(
--   p_status => 'Approved',
--   p_driver_name => '张三,李四',
--   p_platform_name => '中科智运'
-- );

