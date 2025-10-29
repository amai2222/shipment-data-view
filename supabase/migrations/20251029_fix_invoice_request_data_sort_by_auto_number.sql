-- ==========================================
-- 修复开票申请数据排序 - 改为运单编号升序
-- ==========================================
-- 创建时间: 2025-10-29
-- 问题: 当前按装货日期降序、运单编号降序排序
-- 需求: 改为按运单编号升序排序
-- ==========================================

BEGIN;

-- 先删除所有版本的 get_invoice_request_data 函数
DROP FUNCTION IF EXISTS public.get_invoice_request_data(uuid, date, date, uuid, text[], integer, integer);
DROP FUNCTION IF EXISTS public.get_invoice_request_data(uuid, date, date, uuid, text[], integer, integer, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.get_invoice_request_data(
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date date DEFAULT NULL::date, 
    p_end_date date DEFAULT NULL::date, 
    p_partner_id uuid DEFAULT NULL::uuid, 
    p_invoice_status_array text[] DEFAULT NULL::text[], 
    p_page_size integer DEFAULT 50, 
    p_page_number integer DEFAULT 1,
    p_waybill_numbers text DEFAULT NULL,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL,
    p_driver_receivable text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json json;
    v_offset integer;
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;

    WITH filtered_partner_costs AS (
        SELECT 
            lpc.*,
            lr.auto_number,
            lr.project_id,
            lr.project_name,
            lr.driver_id,
            lr.driver_name,
            lr.loading_location,
            lr.unloading_location,
            lr.loading_date,
            lr.unloading_date,
            lr.loading_weight,
            lr.unloading_weight,
            lr.cargo_type,
            lr.billing_type_id,
            lr.remarks,
            lr.current_cost,
            lr.extra_cost,
            d.license_plate,
            d.phone as driver_phone,
            p.name as partner_name,
            p.tax_number,
            p.company_address,
            p.bank_name,
            p.bank_account,
            pc.chain_name
        FROM logistics_partner_costs lpc
        JOIN logistics_records lr ON lpc.logistics_record_id = lr.id
        JOIN partners p ON lpc.partner_id = p.id
        JOIN drivers d ON lr.driver_id = d.id
        LEFT JOIN partner_chains pc ON lr.chain_id = pc.id
        WHERE
            (p_project_id IS NULL OR lr.project_id = p_project_id) AND
            (p_start_date IS NULL OR lr.loading_date >= p_start_date) AND
            (p_end_date IS NULL OR lr.loading_date <= p_end_date) AND
            (p_partner_id IS NULL OR lpc.partner_id = p_partner_id) AND
            (p_invoice_status_array IS NULL OR array_length(p_invoice_status_array, 1) IS NULL OR lpc.invoice_status = ANY(p_invoice_status_array)) AND
            (p_waybill_numbers IS NULL OR lr.auto_number ILIKE '%' || p_waybill_numbers || '%') AND
            (p_driver_name IS NULL OR lr.driver_name ILIKE '%' || p_driver_name || '%') AND
            (p_license_plate IS NULL OR d.license_plate ILIKE '%' || p_license_plate || '%') AND
            (p_driver_phone IS NULL OR d.phone ILIKE '%' || p_driver_phone || '%') AND
            (p_other_platform_name IS NULL OR 
                (p_other_platform_name = '本平台' AND lr.external_tracking_numbers IS NULL) OR
                p_other_platform_name = ANY(lr.other_platform_names)
            ) AND
            (p_driver_receivable IS NULL OR 
                (p_driver_receivable = '>0' AND lr.payable_cost > 0) OR
                (p_driver_receivable = '=0' AND (lr.payable_cost IS NULL OR lr.payable_cost = 0)) OR
                (p_driver_receivable = '<0' AND lr.payable_cost < 0)
            )
    ),
    total_count AS (
        SELECT count(*) as count FROM filtered_partner_costs
    ),
    total_invoiceable_cost AS (
        SELECT COALESCE(SUM(current_cost + extra_cost), 0) AS total FROM filtered_partner_costs WHERE level = 0
    )
    SELECT json_build_object(
        'overview', json_build_object(
            'total_invoiceable_cost', (SELECT total FROM total_invoiceable_cost)
        ),
        'partners', (
            SELECT COALESCE(json_agg(t), '[]'::json) FROM (
                SELECT 
                    lpc.partner_id, 
                    p.name AS partner_name, 
                    COUNT(DISTINCT lpc.logistics_record_id) AS records_count,
                    SUM(lpc.payable_amount) AS total_payable
                FROM filtered_partner_costs lpc
                JOIN partners p ON lpc.partner_id = p.id
                WHERE lpc.invoice_status = 'Uninvoiced'
                GROUP BY lpc.partner_id, p.name
            ) t
        ),
        'records', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'id', fpc.id,
                    'logistics_record_id', fpc.logistics_record_id,
                    'auto_number', fpc.auto_number,
                    'project_name', fpc.project_name,
                    'driver_id', fpc.driver_id,
                    'driver_name', fpc.driver_name,
                    'loading_location', fpc.loading_location,
                    'unloading_location', fpc.unloading_location,
                    'loading_date', fpc.loading_date,
                    'unloading_date', fpc.unloading_date,
                    'license_plate', fpc.license_plate,
                    'driver_phone', fpc.driver_phone,
                    'partner_id', fpc.partner_id,
                    'partner_name', fpc.partner_name,
                    'level', fpc.level,
                    'base_amount', fpc.base_amount,
                    'payable_amount', fpc.payable_amount,
                    'tax_rate', fpc.tax_rate,
                    'invoice_status', fpc.invoice_status,
                    'payment_status', fpc.payment_status,
                    'current_cost', fpc.current_cost,
                    'extra_cost', fpc.extra_cost,
                    'cargo_type', fpc.cargo_type,
                    'loading_weight', fpc.loading_weight,
                    'unloading_weight', fpc.unloading_weight,
                    'billing_type_id', fpc.billing_type_id,
                    'remarks', fpc.remarks,
                    'chain_name', fpc.chain_name,
                    'tax_number', fpc.tax_number,
                    'company_address', fpc.company_address,
                    'bank_name', fpc.bank_name,
                    'bank_account', fpc.bank_account
                )
            )
            FROM (
                SELECT * FROM filtered_partner_costs
                ORDER BY loading_date ASC, auto_number ASC, level ASC  -- ✅ 装货日期升序、运单编号升序
                LIMIT p_page_size OFFSET v_offset
            ) fpc
        ), '[]'::json),
        'count', (SELECT count FROM total_count)
    ) INTO result_json;

    RETURN result_json;
END;
$function$;

COMMENT ON FUNCTION public.get_invoice_request_data IS '
获取开票申请数据
- 排序方式：运单编号升序（auto_number ASC）
';

COMMIT;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 开票申请数据排序已修复';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修改内容：';
    RAISE NOTICE '- 排序方式从：loading_date DESC, auto_number DESC';
    RAISE NOTICE '- 改为：auto_number ASC（运单编号升序）';
    RAISE NOTICE '';
    RAISE NOTICE '现在开票申请页面会按运单编号从小到大排序';
    RAISE NOTICE '========================================';
END $$;

