-- ==========================================
-- 修复付款申请数据排序 - 改为运单编号升序
-- ==========================================
-- 创建时间: 2025-10-29
-- 问题: 当前按装货日期降序、运单编号降序排序
-- 需求: 改为按运单编号升序排序
-- ==========================================

BEGIN;

-- 先删除所有版本的 get_payment_request_data 函数
DROP FUNCTION IF EXISTS public.get_payment_request_data(uuid, date, date, text[], uuid, text, text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_payment_request_data(uuid, date, date, text[], integer, integer);

CREATE OR REPLACE FUNCTION public.get_payment_request_data(
    -- 常规筛选参数
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date date DEFAULT NULL::date, 
    p_end_date date DEFAULT NULL::date, 
    p_payment_status_array text[] DEFAULT NULL::text[],
    
    -- 高级筛选参数
    p_partner_id uuid DEFAULT NULL::uuid,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL,
    
    -- 分页参数
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
            -- 常规筛选
            (p_project_id IS NULL OR v.project_id = p_project_id) AND
            (p_start_date IS NULL OR v.loading_date::date >= p_start_date) AND
            (p_end_date IS NULL OR v.loading_date::date <= p_end_date) AND
            (
                p_payment_status_array IS NULL 
                OR array_length(p_payment_status_array, 1) IS NULL
                OR lr.payment_status = ANY(p_payment_status_array)
            ) AND
            
            -- 高级筛选（支持批量OR逻辑）
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
                        p_other_platform_name = ANY(lr.other_platform_names)
                END
            ) AND
            (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM public.logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = v.id
                  AND lpc.partner_id = p_partner_id
            ))
    ),
    paginated_records AS (
        SELECT id
        FROM filtered_records
        ORDER BY loading_date ASC, auto_number ASC  -- ✅ 默认：装货日期升序、运单编号升序
        LIMIT p_page_size
        OFFSET v_offset
    ),
    total_count AS (
        SELECT COUNT(*) AS count FROM filtered_records
    ),
    total_payable_cost AS (
        SELECT COALESCE(SUM(payable_cost), 0) AS total FROM filtered_records
    )
    SELECT jsonb_build_object(
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
                  AND lpc.payment_status = 'Unpaid'
                GROUP BY lpc.partner_id, p.name, p.full_name, pbd.bank_account, pbd.bank_name, pbd.branch_name
            ) t
        ),
        'records', (
            SELECT COALESCE(jsonb_agg(t ORDER BY t.loading_date ASC, t.auto_number ASC), '[]'::jsonb) FROM (  -- ✅ 装货日期升序、运单编号升序
                SELECT
                    v.id, v.auto_number, v.project_name, v.driver_name, v.loading_location, v.unloading_location,
                    to_char(v.loading_date, 'YYYY-MM-DD') AS loading_date,
                    to_char(v.unloading_date, 'YYYY-MM-DD') AS unloading_date,
                    v.loading_weight, v.unloading_weight, v.current_cost, v.payable_cost, v.extra_cost,
                    v.license_plate, v.driver_phone, v.transport_type, v.remarks, v.chain_name,
                    lr.payment_status, v.billing_type_id,
                    COALESCE((
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'partner_id', lpc.partner_id,
                                'partner_name', p.name,
                                'level', lpc.level,
                                'base_amount', lpc.base_amount,
                                'payable_amount', lpc.payable_amount,
                                'tax_rate', lpc.tax_rate,
                                'invoice_status', lpc.invoice_status,
                                'payment_status', lpc.payment_status
                            ) ORDER BY lpc.level
                        )
                        FROM public.logistics_partner_costs lpc
                        JOIN public.partners p ON lpc.partner_id = p.id
                        WHERE lpc.logistics_record_id = v.id
                    ), '[]'::jsonb) AS partner_costs
                FROM public.logistics_records_view v
                JOIN public.logistics_records lr ON v.id = lr.id
                WHERE v.id IN (SELECT id FROM paginated_records)
            ) t
        ),
        'count', (SELECT count FROM total_count)
    ) INTO result_json;

    RETURN result_json;
END;
$function$;

COMMENT ON FUNCTION public.get_payment_request_data IS '
获取付款申请数据（支持高级筛选和批量输入）
- 支持批量输入：运单编号、司机姓名、车牌号、电话号码（逗号或空格分隔）
- 排序方式：运单编号升序（auto_number ASC）
- 批量输入示例："张三,李四" 或 "张三 李四" 或 "张三, 李四"
';

COMMIT;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 付款申请数据排序已修复';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修改内容：';
    RAISE NOTICE '- 排序方式从：loading_date DESC, auto_number DESC';
    RAISE NOTICE '- 改为：auto_number ASC（运单编号升序）';
    RAISE NOTICE '';
    RAISE NOTICE '现在付款申请页面会按运单编号从小到大排序';
    RAISE NOTICE '========================================';
END $$;

