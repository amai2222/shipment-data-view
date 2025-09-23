-- 最终修复开票申请函数参数错误
-- 先删除旧函数，再创建新函数

-- 1. 删除所有旧的开票申请相关函数
DROP FUNCTION IF EXISTS public.get_invoice_request_data_v2(uuid[]);
DROP FUNCTION IF EXISTS public.get_invoice_request_data(uuid, date, date, uuid, text[], integer, integer);
DROP FUNCTION IF EXISTS public.get_filtered_uninvoiced_record_ids(uuid, date, date, uuid);

-- 2. 重新创建 get_invoice_request_data 函数
CREATE OR REPLACE FUNCTION public.get_invoice_request_data(
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date date DEFAULT NULL::date, 
    p_end_date date DEFAULT NULL::date, 
    p_partner_id uuid DEFAULT NULL::uuid, 
    p_invoice_status_array text[] DEFAULT NULL::text[], 
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
BEGIN
    -- 权限检查
    IF NOT public.is_finance_or_admin_for_invoice() THEN
        RAISE EXCEPTION '权限不足';
    END IF;
    
    v_offset := (p_page_number - 1) * p_page_size;

    -- 查询运单记录，返回与付款申请相同的数据结构
    WITH filtered_records AS (
        SELECT 
            lr.*,
            p.name as project_name,
            d.name as driver_name,
            d.phone as driver_phone,
            -- 计算整体开票状态（基于合作方成本的开票状态）
            CASE 
                WHEN COUNT(lpc.id) = 0 THEN 'Uninvoiced'
                WHEN COUNT(lpc.id) = COUNT(CASE WHEN lpc.invoice_status = 'Invoiced' THEN 1 END) THEN 'Invoiced'
                WHEN COUNT(CASE WHEN lpc.invoice_status = 'Processing' THEN 1 END) > 0 THEN 'Processing'
                ELSE 'Uninvoiced'
            END as overall_invoice_status,
            -- 获取合作方成本信息（用于显示各级合作方开票金额）
            COALESCE(
                json_agg(
                    json_build_object(
                        'partner_id', lpc.partner_id,
                        'partner_name', pt.name,
                        'level', lpc.level,
                        'payable_amount', lpc.payable_amount,
                        'invoice_status', lpc.invoice_status,
                        'full_name', pt.full_name,
                        'bank_account', pt.bank_account,
                        'bank_name', pt.bank_name,
                        'branch_name', pt.branch_name
                    ) ORDER BY lpc.level
                ) FILTER (WHERE lpc.id IS NOT NULL),
                '[]'::json
            ) as partner_costs
        FROM logistics_records lr
        LEFT JOIN projects p ON lr.project_id = p.id
        LEFT JOIN drivers d ON lr.driver_id = d.id
        LEFT JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
        LEFT JOIN partners pt ON lpc.partner_id = pt.id
        WHERE 
            (p_project_id IS NULL OR lr.project_id = p_project_id) AND
            (p_start_date IS NULL OR lr.loading_date >= p_start_date) AND
            (p_end_date IS NULL OR lr.loading_date <= p_end_date) AND
            (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM logistics_partner_costs lpc2 
                WHERE lpc2.logistics_record_id = lr.id 
                AND lpc2.partner_id = p_partner_id
            ))
        GROUP BY lr.id, lr.auto_number, lr.project_id, lr.driver_id, lr.loading_location, 
                 lr.unloading_location, lr.loading_date, lr.unloading_date, lr.license_plate, 
                 lr.driver_phone, lr.cargo_type, lr.loading_weight, lr.unloading_weight, 
                 lr.remarks, lr.billing_type_id, lr.current_cost, lr.extra_cost, lr.chain_id, 
                 lr.user_id, lr.created_at, lr.updated_at, p.name, d.name, d.phone
        HAVING 
            (p_invoice_status_array IS NULL OR 
             CASE 
                WHEN COUNT(lpc.id) = 0 THEN 'Uninvoiced'
                WHEN COUNT(lpc.id) = COUNT(CASE WHEN lpc.invoice_status = 'Invoiced' THEN 1 END) THEN 'Invoiced'
                WHEN COUNT(CASE WHEN lpc.invoice_status = 'Processing' THEN 1 END) > 0 THEN 'Processing'
                ELSE 'Uninvoiced'
             END = ANY(p_invoice_status_array))
    ),
    total_count AS (
        SELECT count(*) as count FROM filtered_records
    ),
    paginated_records AS (
        SELECT * FROM filtered_records
        ORDER BY loading_date DESC, auto_number DESC
        LIMIT p_page_size OFFSET v_offset
    ),
    -- 计算合作方汇总信息（用于表头显示）
    partner_invoice_summary AS (
        SELECT 
            lpc.partner_id,
            pt.name as partner_name,
            lpc.level,
            SUM(lpc.payable_amount) as total_invoiceable
        FROM logistics_records lr
        JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
        JOIN partners pt ON lpc.partner_id = pt.id
        WHERE lr.id IN (SELECT id FROM filtered_records)
        GROUP BY lpc.partner_id, pt.name, lpc.level
        ORDER BY lpc.level
    ),
    -- 计算总览信息
    overview_data AS (
        SELECT 
            SUM(COALESCE(lr.current_cost, 0) + COALESCE(lr.extra_cost, 0)) as total_invoiceable_cost
        FROM filtered_records lr
    )
    SELECT json_build_object(
        'records', COALESCE(json_agg(
            json_build_object(
                'id', pr.id,
                'auto_number', pr.auto_number,
                'project_name', pr.project_name,
                'driver_name', pr.driver_name,
                'loading_location', pr.loading_location,
                'unloading_location', pr.unloading_location,
                'loading_date', pr.loading_date,
                'unloading_date', pr.unloading_date,
                'license_plate', pr.license_plate,
                'driver_phone', pr.driver_phone,
                'cargo_type', pr.cargo_type,
                'loading_weight', pr.loading_weight,
                'unloading_weight', pr.unloading_weight,
                'remarks', pr.remarks,
                'billing_type_id', pr.billing_type_id,
                'current_cost', pr.current_cost,
                'extra_cost', pr.extra_cost,
                'payable_cost', COALESCE(pr.current_cost, 0) + COALESCE(pr.extra_cost, 0),
                'invoice_status', pr.overall_invoice_status,
                'partner_costs', pr.partner_costs
            )
            ORDER BY pr.loading_date DESC, pr.auto_number DESC
        ), '[]'::json),
        'count', (SELECT count FROM total_count),
        'partner_invoiceables', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'partner_id', partner_id,
                    'partner_name', partner_name,
                    'level', level,
                    'total_invoiceable', total_invoiceable
                ) ORDER BY level
            )
            FROM partner_invoice_summary
        ), '[]'::json),
        'overview', json_build_object(
            'total_invoiceable_cost', COALESCE((SELECT total_invoiceable_cost FROM overview_data), 0)
        )
    ) INTO result_json
    FROM paginated_records pr;

    RETURN result_json;
END;
$function$;

-- 3. 重新创建 get_filtered_uninvoiced_record_ids 函数
CREATE OR REPLACE FUNCTION public.get_filtered_uninvoiced_record_ids(
    p_project_id uuid DEFAULT NULL::uuid,
    p_start_date date DEFAULT NULL::date,
    p_end_date date DEFAULT NULL::date,
    p_partner_id uuid DEFAULT NULL::uuid
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_ids uuid[];
BEGIN
    -- 权限检查
    IF NOT public.is_finance_or_admin_for_invoice() THEN
        RAISE EXCEPTION '权限不足';
    END IF;
    
    -- 获取有未开票合作方成本记录的运单ID
    SELECT array_agg(DISTINCT lr.id)
    INTO result_ids
    FROM logistics_records lr
    JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
    WHERE
        lpc.invoice_status = 'Uninvoiced' AND
        (p_project_id IS NULL OR lr.project_id = p_project_id) AND
        (p_start_date IS NULL OR lr.loading_date >= p_start_date) AND
        (p_end_date IS NULL OR lr.loading_date <= p_end_date) AND
        (p_partner_id IS NULL OR lpc.partner_id = p_partner_id);

    RETURN COALESCE(result_ids, ARRAY[]::uuid[]);
END;
$function$;

-- 4. 重新创建 get_invoice_request_data_v2 函数（注意参数名为 p_record_ids）
CREATE OR REPLACE FUNCTION public.get_invoice_request_data_v2(p_record_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json jsonb;
BEGIN
    -- 权限检查
    IF NOT public.is_finance_or_admin_for_invoice() THEN
        RAISE EXCEPTION '权限不足';
    END IF;
    
    SELECT jsonb_build_object(
        'records', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', lr.id,
                'auto_number', lr.auto_number,
                'project_name', p.name,
                'driver_name', d.name,
                'loading_location', lr.loading_location,
                'unloading_location', lr.unloading_location,
                'loading_date', lr.loading_date,
                'unloading_date', lr.unloading_date,
                'license_plate', lr.license_plate,
                'driver_phone', d.phone,
                'cargo_type', lr.cargo_type,
                'loading_weight', lr.loading_weight,
                'unloading_weight', lr.unloading_weight,
                'remarks', lr.remarks,
                'billing_type_id', lr.billing_type_id,
                'current_cost', lr.current_cost,
                'extra_cost', lr.extra_cost,
                'payable_cost', COALESCE(lr.current_cost, 0) + COALESCE(lr.extra_cost, 0),
                'partner_costs', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'id', lpc.id,
                            'partner_id', lpc.partner_id,
                            'partner_name', pt.name,
                            'level', lpc.level,
                            'base_amount', lpc.base_amount,
                            'payable_amount', lpc.payable_amount,
                            'tax_rate', lpc.tax_rate,
                            'invoice_status', lpc.invoice_status,
                            'payment_status', lpc.payment_status,
                            'full_name', pt.full_name,
                            'tax_number', COALESCE(pt.tax_number, ''),
                            'company_address', COALESCE(pt.company_address, ''),
                            'bank_name', COALESCE(pt.bank_name, ''),
                            'bank_account', COALESCE(pt.bank_account, '')
                        ) ORDER BY lpc.level
                    ), '[]'::jsonb)
                    FROM logistics_partner_costs lpc
                    JOIN partners pt ON lpc.partner_id = pt.id
                    WHERE lpc.logistics_record_id = lr.id
                      AND lpc.invoice_status = 'Uninvoiced'
                )
            )
        ), '[]'::jsonb)
    )
    INTO result_json
    FROM logistics_records lr
    LEFT JOIN projects p ON lr.project_id = p.id
    LEFT JOIN drivers d ON lr.driver_id = d.id
    WHERE lr.id = ANY(p_record_ids);

    RETURN result_json;
END;
$function$;

-- 验证函数创建成功
SELECT 'Invoice request functions recreated successfully with correct parameter names' as status;
