-- ============================================================================
-- 最终修复：完全参照运单管理的搜索逻辑
-- ============================================================================
-- 参考函数：get_logistics_summary_and_records_enhanced
-- 核心逻辑：精确匹配 + 数组交集运算符 &&
-- 运单号搜索：lr.auto_number = ANY(array) OR lr.external_tracking_numbers && array
-- ============================================================================

BEGIN;

-- ============================================================================
-- 函数1: get_payment_requests_filtered (付款审核 + 财务付款)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_payment_requests_filtered(text, text, text, text, text, text, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_payment_requests_filtered(
    p_request_id text DEFAULT NULL,
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_status text DEFAULT NULL,
    p_project_id text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL,
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
    v_where_conditions TEXT[];
    v_where_clause TEXT;
    v_logistics_ids UUID[];
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
BEGIN
    v_where_conditions := ARRAY[]::TEXT[];
    v_where_clause := '';
    
    -- 解析批量搜索数组
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := string_to_array(p_waybill_numbers, ',');
        v_waybill_array := array(SELECT trim(unnest(v_waybill_array)));
    END IF;
    
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := string_to_array(p_driver_name, ',');
        v_driver_array := array(SELECT trim(unnest(v_driver_array)));
    END IF;
    
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := string_to_array(p_license_plate, ',');
        v_license_array := array(SELECT trim(unnest(v_license_array)));
    END IF;
    
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := string_to_array(p_driver_phone, ',');
        v_phone_array := array(SELECT trim(unnest(v_phone_array)));
    END IF;

    -- 申请单级筛选
    IF p_request_id IS NOT NULL AND p_request_id != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.request_id ILIKE %L', '%' || p_request_id || '%'));
    END IF;

    IF p_status IS NOT NULL AND p_status != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.status = %L', p_status));
    END IF;
    
    IF p_start_date IS NOT NULL AND p_start_date != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.created_at >= %L::date', p_start_date));
    END IF;
    
    IF p_end_date IS NOT NULL AND p_end_date != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.created_at <= %L::date + interval ''1 day''', p_end_date));
    END IF;

    -- 运单级筛选
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' OR
       p_driver_name IS NOT NULL AND p_driver_name != '' OR
       p_license_plate IS NOT NULL AND p_license_plate != '' OR
       p_driver_phone IS NOT NULL AND p_driver_phone != '' OR
       p_other_platform_name IS NOT NULL AND p_other_platform_name != '' OR
       p_project_id IS NOT NULL AND p_project_id != '' THEN
        
        SELECT array_agg(DISTINCT lr.id) INTO v_logistics_ids
        FROM logistics_records lr
        WHERE 
            -- 🔧 运单号：参照运单管理的精确匹配 + 数组交集逻辑
            (p_waybill_numbers IS NULL OR p_waybill_numbers = '' OR 
             lr.auto_number = ANY(v_waybill_array) OR
             (lr.external_tracking_numbers IS NOT NULL AND 
              lr.external_tracking_numbers && v_waybill_array)) AND
            
            -- 司机：模糊匹配 + 批量OR
            (p_driver_name IS NULL OR p_driver_name = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_driver_array) AS driver_name
                 WHERE lr.driver_name ILIKE '%' || driver_name || '%'
             )) AND
            
            -- 车牌号：模糊匹配 + 批量OR
            (p_license_plate IS NULL OR p_license_plate = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_license_array) AS plate
                 WHERE lr.license_plate ILIKE '%' || plate || '%'
             )) AND
            
            -- 电话：模糊匹配 + 批量OR
            (p_driver_phone IS NULL OR p_driver_phone = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_phone_array) AS phone
                 WHERE lr.driver_phone ILIKE '%' || phone || '%'
             )) AND
            
            -- 平台名称
            (p_other_platform_name IS NULL OR p_other_platform_name = '' OR 
             CASE 
                 WHEN p_other_platform_name = '本平台' THEN 
                     (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                 ELSE 
                     EXISTS (SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name 
                            WHERE platform_name ILIKE '%' || p_other_platform_name || '%')
             END) AND
            
            -- 项目
            (p_project_id IS NULL OR p_project_id = '' OR lr.project_id::TEXT = p_project_id);
        
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
'获取筛选后的付款申请单（参照运单管理逻辑）- 运单号精确匹配 + 数组交集';

SELECT '✅ 函数1完成：get_payment_requests_filtered' as 状态;

-- ============================================================================
-- 函数2: get_payment_request_data (合作方付款申请)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_payment_request_data(uuid, date, date, text[], uuid, text, text, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_payment_request_data(
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date date DEFAULT NULL::date, 
    p_end_date date DEFAULT NULL::date, 
    p_payment_status_array text[] DEFAULT NULL::text[],
    p_partner_id uuid DEFAULT NULL::uuid,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL,
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
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 解析批量搜索数组
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := string_to_array(p_waybill_numbers, ',');
        v_waybill_array := array(SELECT trim(unnest(v_waybill_array)));
    END IF;
    
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := string_to_array(p_driver_name, ',');
        v_driver_array := array(SELECT trim(unnest(v_driver_array)));
    END IF;
    
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := string_to_array(p_license_plate, ',');
        v_license_array := array(SELECT trim(unnest(v_license_array)));
    END IF;
    
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := string_to_array(p_driver_phone, ',');
        v_phone_array := array(SELECT trim(unnest(v_phone_array)));
    END IF;

    WITH filtered_records AS (
        SELECT 
            v.id, v.auto_number, v.project_name, v.project_id, v.driver_name,
            v.loading_location, v.unloading_location, v.loading_date, v.unloading_date,
            v.loading_weight, v.unloading_weight, v.current_cost, v.payable_cost, v.extra_cost,
            v.license_plate, v.driver_phone, v.transport_type, v.remarks, v.chain_name,
            v.billing_type_id, v.invoice_status,
            lr.payment_status
        FROM public.logistics_records_view AS v
        JOIN public.logistics_records lr ON v.id = lr.id
        WHERE
            (p_project_id IS NULL OR v.project_id = p_project_id) AND
            (p_start_date IS NULL OR v.loading_date::date >= p_start_date) AND
            (p_end_date IS NULL OR v.loading_date::date <= p_end_date) AND
            (
                p_payment_status_array IS NULL OR
                array_length(p_payment_status_array, 1) IS NULL OR
                LOWER(lr.payment_status) = ANY(ARRAY(SELECT lower(unnest) FROM unnest(p_payment_status_array)))
            ) AND
            (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM public.logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = v.id AND lpc.partner_id = p_partner_id
            )) AND
            (p_driver_name IS NULL OR p_driver_name = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_driver_array) AS driver_name
                 WHERE v.driver_name ILIKE '%' || driver_name || '%'
             )) AND
            (p_license_plate IS NULL OR p_license_plate = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_license_array) AS plate
                 WHERE lr.license_plate ILIKE '%' || plate || '%'
             )) AND
            (p_driver_phone IS NULL OR p_driver_phone = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_phone_array) AS phone
                 WHERE lr.driver_phone ILIKE '%' || phone || '%'
             )) AND
            -- 🔧 运单号：完全参照运单管理的逻辑（精确匹配 + 数组交集）
            (p_waybill_numbers IS NULL OR p_waybill_numbers = '' OR 
             lr.auto_number = ANY(v_waybill_array) OR
             (lr.external_tracking_numbers IS NOT NULL AND 
              lr.external_tracking_numbers && v_waybill_array)) AND
            (p_other_platform_name IS NULL OR p_other_platform_name = '' OR 
             CASE 
                 WHEN p_other_platform_name = '本平台' THEN 
                     (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                 ELSE 
                     EXISTS (SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name 
                            WHERE platform_name ILIKE '%' || p_other_platform_name || '%')
             END)
    ),
    paginated_records AS (
        SELECT id
        FROM filtered_records
        ORDER BY loading_date DESC
        LIMIT p_page_size
        OFFSET v_offset
    )
    SELECT jsonb_build_object(
        'count', (SELECT COUNT(*) FROM filtered_records),
        'overview', (
            SELECT jsonb_build_object(
                'total_records', COALESCE(COUNT(*), 0),
                'total_current_cost', COALESCE(SUM(current_cost), 0),
                'total_extra_cost', COALESCE(SUM(extra_cost), 0),
                'total_payable_cost', COALESCE(SUM(payable_cost), 0)
            )
            FROM filtered_records
        ),
        'partner_payables', (
            SELECT COALESCE(jsonb_agg(t ORDER BY t.partner_name), '[]'::jsonb) FROM (
                SELECT
                    lpc.partner_id, p.name AS partner_name,
                    COUNT(DISTINCT lpc.logistics_record_id) AS records_count,
                    SUM(lpc.payable_amount) AS total_payable
                FROM public.logistics_partner_costs lpc
                JOIN public.partners p ON lpc.partner_id = p.id
                WHERE lpc.logistics_record_id IN (SELECT id FROM filtered_records)
                GROUP BY lpc.partner_id, p.name
            ) t
        ),
        'records', (
            SELECT COALESCE(jsonb_agg(t ORDER BY t.loading_date DESC), '[]'::jsonb) FROM (
                SELECT
                    fr.id, fr.auto_number, fr.project_name, fr.project_id, fr.driver_name, 
                    fr.loading_location, fr.unloading_location,
                    to_char(fr.loading_date, 'YYYY-MM-DD') AS loading_date,
                    to_char(fr.unloading_date, 'YYYY-MM-DD') AS unloading_date,
                    fr.loading_weight, fr.unloading_weight, fr.current_cost, fr.payable_cost, fr.extra_cost,
                    fr.license_plate, fr.driver_phone, fr.transport_type, fr.remarks, fr.chain_name,
                    fr.payment_status, fr.invoice_status,
                    fr.billing_type_id,
                    (SELECT COALESCE(jsonb_agg(sub ORDER BY sub.level), '[]'::jsonb) FROM (
                        SELECT 
                            lpc.partner_id, 
                            par.name AS partner_name, 
                            par.full_name,
                            pbd.bank_account,
                            pbd.bank_name,
                            pbd.branch_name,
                            lpc.level, 
                            lpc.payable_amount
                        FROM public.logistics_partner_costs lpc
                        JOIN public.partners par ON lpc.partner_id = par.id
                        LEFT JOIN public.partner_bank_details pbd ON par.id = pbd.partner_id
                        WHERE lpc.logistics_record_id = fr.id
                     ) sub
                    ) AS partner_costs
                FROM filtered_records fr
                WHERE fr.id IN (SELECT id FROM paginated_records)
            ) t
        )
    )
    INTO result_json;

    RETURN result_json;
END;
$function$;

COMMENT ON FUNCTION public.get_payment_request_data IS 
'获取付款申请数据（参照运单管理逻辑）- 运单号精确匹配 + 数组交集';

SELECT '✅ 函数2完成：get_payment_request_data' as 状态;

-- ============================================================================
-- 函数3: get_filtered_unpaid_ids (合作方付款申请 - 跨页选择)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_filtered_unpaid_ids(uuid, date, date, uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.get_filtered_unpaid_ids(
    p_project_id uuid DEFAULT NULL::uuid,
    p_start_date date DEFAULT NULL::date,
    p_end_date date DEFAULT NULL::date,
    p_partner_id uuid DEFAULT NULL::uuid,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
BEGIN
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := string_to_array(p_waybill_numbers, ',');
        v_waybill_array := array(SELECT trim(unnest(v_waybill_array)));
    END IF;
    
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := string_to_array(p_driver_name, ',');
        v_driver_array := array(SELECT trim(unnest(v_driver_array)));
    END IF;
    
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := string_to_array(p_license_plate, ',');
        v_license_array := array(SELECT trim(unnest(v_license_array)));
    END IF;
    
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := string_to_array(p_driver_phone, ',');
        v_phone_array := array(SELECT trim(unnest(v_phone_array)));
    END IF;

    RETURN ARRAY(
        SELECT lr.id::text
        FROM public.logistics_records lr
        WHERE
            lr.payment_status = 'Unpaid' AND
            (p_project_id IS NULL OR lr.project_id = p_project_id) AND
            (p_start_date IS NULL OR lr.loading_date::date >= p_start_date) AND
            (p_end_date IS NULL OR lr.loading_date::date <= p_end_date) AND
            (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM public.logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = lr.id AND lpc.partner_id = p_partner_id
            )) AND
            (p_driver_name IS NULL OR p_driver_name = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_driver_array) AS driver_name
                 WHERE lr.driver_name ILIKE '%' || driver_name || '%'
             )) AND
            (p_license_plate IS NULL OR p_license_plate = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_license_array) AS plate
                 WHERE lr.license_plate ILIKE '%' || plate || '%'
             )) AND
            (p_driver_phone IS NULL OR p_driver_phone = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_phone_array) AS phone
                 WHERE lr.driver_phone ILIKE '%' || phone || '%'
             )) AND
            -- 🔧 运单号：完全参照运单管理的逻辑（精确匹配 + 数组交集）
            (p_waybill_numbers IS NULL OR p_waybill_numbers = '' OR 
             lr.auto_number = ANY(v_waybill_array) OR
             (lr.external_tracking_numbers IS NOT NULL AND 
              lr.external_tracking_numbers && v_waybill_array)) AND
            (p_other_platform_name IS NULL OR p_other_platform_name = '' OR 
             CASE 
                 WHEN p_other_platform_name = '本平台' THEN 
                     (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                 ELSE 
                     EXISTS (SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name 
                            WHERE platform_name ILIKE '%' || p_other_platform_name || '%')
             END)
        ORDER BY lr.loading_date DESC
    );
END;
$function$;

COMMENT ON FUNCTION public.get_filtered_unpaid_ids IS 
'获取筛选后的未支付运单ID（参照运单管理逻辑）- 运单号精确匹配 + 数组交集';

SELECT '✅ 函数3完成：get_filtered_unpaid_ids' as 状态;

COMMIT;

-- ============================================================================
-- 测试所有函数
-- ============================================================================

-- 测试付款审核函数
SELECT '【测试1】付款审核函数 - 搜索其他平台运单号' as 测试;
SELECT request_id, status, record_count 
FROM get_payment_requests_filtered(
    p_waybill_numbers := '2021991438,2021975523',
    p_limit := 5
);

-- 测试合作方付款申请函数
SELECT '【测试2】合作方付款申请函数 - 搜索其他平台运单号' as 测试;
SELECT 
    (public.get_payment_request_data(
        p_waybill_numbers := '2021991438,2021975523',
        p_page_size := 5
    ) -> 'count')::int as 运单数量;

-- 测试跨页选择函数
SELECT '【测试3】跨页选择函数 - 搜索其他平台运单号' as 测试;
SELECT 
    array_length(public.get_filtered_unpaid_ids(
        p_waybill_numbers := '2021991438,2021975523'
    ), 1) as 筛选到的运单ID数量;

SELECT '🎉 最终修复完成！完全参照运单管理的搜索逻辑！' as 完成状态;

-- ============================================================================
-- 核心区别说明
-- ============================================================================
--
-- ❌ 之前的错误逻辑（模糊匹配）：
--    EXISTS (
--        SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext_num
--        WHERE ext_num ILIKE '%' || waybill_num || '%'
--    )
--
-- ✅ 正确逻辑（参照运单管理 - 数组交集）：
--    lr.auto_number = ANY(v_waybill_array) OR
--    lr.external_tracking_numbers && v_waybill_array
--
-- 关键差异：
-- - 运单管理使用：精确匹配 + 数组交集运算符 &&
-- - 之前错误地使用：模糊匹配 + EXISTS + unnest
--
-- 数组交集运算符 && 的作用：
-- - 检查两个数组是否有任何相同的元素
-- - 例如：ARRAY['2021991438'] && ARRAY['2021991438', 'ABC'] 返回 true
-- - 这是 PostgreSQL 的标准数组运算符，性能更好
--
-- ============================================================================

