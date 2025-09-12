-- 修复 get_payment_request_data 函数
-- 解决运费对账页面"加载财务对账数据失败"的问题

BEGIN;

-- 1. 删除可能存在的旧版本函数（避免冲突）
DROP FUNCTION IF EXISTS public.get_payment_request_data(uuid, date, date, uuid, text[], integer, integer);
DROP FUNCTION IF EXISTS public.get_payment_request_data(date, integer, integer, uuid, text[], uuid, date);
DROP FUNCTION IF EXISTS public.get_payment_request_data(text, integer, integer, uuid, text[], uuid, text);

-- 2. 确保 is_finance_or_admin 函数存在
CREATE OR REPLACE FUNCTION public.is_finance_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin','finance');
$$;

-- 3. 重新创建正确参数顺序的 get_payment_request_data 函数
CREATE OR REPLACE FUNCTION public.get_payment_request_data(
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date date DEFAULT NULL::date, 
    p_end_date date DEFAULT NULL::date, 
    p_partner_id uuid DEFAULT NULL::uuid, 
    p_payment_status_array text[] DEFAULT NULL::text[], 
    p_page_size integer DEFAULT 50, 
    p_page_number integer DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json json;
    v_offset integer;
    v_can_view boolean := public.is_finance_or_admin();
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;

    -- 构建筛选条件
    WITH filtered_records AS (
        SELECT r.*
        FROM logistics_records r
        WHERE
            (p_project_id IS NULL OR r.project_id = p_project_id) AND
            (p_start_date IS NULL OR r.loading_date >= p_start_date) AND
            (p_end_date IS NULL OR r.loading_date <= p_end_date) AND
            (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = r.id AND lpc.partner_id = p_partner_id
            )) AND
            (p_payment_status_array IS NULL OR array_length(p_payment_status_array, 1) IS NULL OR r.payment_status = ANY(p_payment_status_array))
    ),
    total_count AS (
        SELECT count(*) as count FROM filtered_records
    ),
    paginated_records AS (
        SELECT id FROM filtered_records
        ORDER BY loading_date DESC
        LIMIT p_page_size OFFSET v_offset
    )
    SELECT json_build_object(
        'records', COALESCE(json_agg(
            json_build_object(
                'id', v.id,
                'auto_number', v.auto_number,
                'project_name', v.project_name,
                'driver_name', v.driver_name,
                'loading_location', v.loading_location,
                'unloading_location', v.unloading_location,
                'loading_date', to_char(v.loading_date, 'YYYY-MM-DD'),
                'unloading_date', COALESCE(to_char(v.unloading_date, 'YYYY-MM-DD'), null),
                'loading_weight', v.loading_weight,
                'unloading_weight', v.unloading_weight,
                'current_cost', v.current_cost,
                'extra_cost', v.extra_cost,
                'payable_cost', v.payable_cost,
                'license_plate', v.license_plate,
                'driver_phone', v.driver_phone,
                'transport_type', v.transport_type,
                'remarks', v.remarks,
                'chain_name', v.chain_name,
                'payment_status', lr.payment_status,
                'partner_costs', (
                    SELECT COALESCE(json_agg(
                        json_build_object(
                            'partner_id', lpc.partner_id,
                            'partner_name', p.name,
                            'level', lpc.level,
                            'payable_amount', lpc.payable_amount,
                            -- 敏感信息只有财务或管理员可见
                            'full_name', CASE WHEN v_can_view THEN p.full_name ELSE NULL END,
                            'bank_account', CASE WHEN v_can_view THEN bd.bank_account ELSE NULL END,
                            'bank_name', CASE WHEN v_can_view THEN bd.bank_name ELSE NULL END,
                            'branch_name', CASE WHEN v_can_view THEN bd.branch_name ELSE NULL END
                        ) ORDER BY lpc.level
                    ), '[]'::json)
                    FROM logistics_partner_costs lpc
                    JOIN partners p ON lpc.partner_id = p.id
                    LEFT JOIN partner_bank_details bd ON bd.partner_id = p.id
                    WHERE lpc.logistics_record_id = v.id
                )
            ) ORDER BY v.loading_date DESC
        ), '[]'::json),
        'count', tc.count
    )
    INTO result_json
    FROM logistics_records_view v
    JOIN logistics_records lr ON v.id = lr.id
    CROSS JOIN total_count tc
    WHERE v.id IN (SELECT id FROM paginated_records);

    RETURN result_json;
END;
$function$;

-- 4. 验证函数创建成功
SELECT 'get_payment_request_data function created successfully' as status;

-- 5. 测试函数是否正常工作
SELECT public.get_payment_request_data(
    p_project_id := NULL,
    p_start_date := NULL,
    p_end_date := NULL,
    p_partner_id := NULL,
    p_payment_status_array := NULL,
    p_page_size := 5,
    p_page_number := 1
) as test_result;

COMMIT;
