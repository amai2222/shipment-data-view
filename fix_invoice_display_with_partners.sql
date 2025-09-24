-- 修复开票申请显示逻辑，使其与付款申请页面完全一致
-- 添加合作方汇总数据用于表头显示

-- 重新创建 get_invoice_request_data 函数，返回合作方汇总数据
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
    v_total_count integer;
BEGIN
    -- 权限检查
    IF NOT public.is_finance_or_admin_for_invoice() THEN
        RAISE EXCEPTION '权限不足';
    END IF;
    
    v_offset := (p_page_number - 1) * p_page_size;

    -- 首先获取符合条件的运单ID集合
    WITH filtered_record_ids AS (
        SELECT DISTINCT lr.id
        FROM logistics_records lr
        LEFT JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
        WHERE 
            (p_project_id IS NULL OR lr.project_id = p_project_id) AND
            (p_start_date IS NULL OR lr.loading_date >= p_start_date) AND
            (p_end_date IS NULL OR lr.loading_date <= p_end_date) AND
            (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM logistics_partner_costs lpc2 
                WHERE lpc2.logistics_record_id = lr.id 
                AND lpc2.partner_id = p_partner_id
            )) AND
            (p_invoice_status_array IS NULL OR 
             CASE 
                WHEN NOT EXISTS (SELECT 1 FROM logistics_partner_costs lpc3 WHERE lpc3.logistics_record_id = lr.id) THEN 'Uninvoiced'
                WHEN EXISTS (SELECT 1 FROM logistics_partner_costs lpc3 WHERE lpc3.logistics_record_id = lr.id AND lpc3.invoice_status = 'Processing') THEN 'Processing'
                WHEN NOT EXISTS (SELECT 1 FROM logistics_partner_costs lpc3 WHERE lpc3.logistics_record_id = lr.id AND lpc3.invoice_status != 'Invoiced') THEN 'Invoiced'
                ELSE 'Uninvoiced'
             END = ANY(p_invoice_status_array))
    ),
    -- 获取总记录数
    total_count AS (
        SELECT COUNT(*) as count FROM filtered_record_ids
    ),
    -- 获取分页的运单数据
    paginated_records AS (
        SELECT 
            lr.id,
            lr.auto_number,
            COALESCE(p.name, '未知项目') as project_name,
            COALESCE(d.name, '未知司机') as driver_name,
            lr.loading_location,
            lr.unloading_location,
            lr.loading_date,
            lr.unloading_date,
            lr.license_plate,
            d.phone as driver_phone,
            lr.cargo_type,
            lr.loading_weight,
            lr.unloading_weight,
            lr.remarks,
            lr.billing_type_id,
            lr.current_cost,
            lr.extra_cost,
            COALESCE(lr.current_cost, 0) + COALESCE(lr.extra_cost, 0) as payable_cost,
            -- 计算运单的整体开票状态
            CASE 
                WHEN NOT EXISTS (SELECT 1 FROM logistics_partner_costs lpc WHERE lpc.logistics_record_id = lr.id) THEN 'Uninvoiced'
                WHEN EXISTS (SELECT 1 FROM logistics_partner_costs lpc WHERE lpc.logistics_record_id = lr.id AND lpc.invoice_status = 'Processing') THEN 'Processing'
                WHEN NOT EXISTS (SELECT 1 FROM logistics_partner_costs lpc WHERE lpc.logistics_record_id = lr.id AND lpc.invoice_status != 'Invoiced') THEN 'Invoiced'
                ELSE 'Uninvoiced'
            END as invoice_status
        FROM logistics_records lr
        LEFT JOIN projects p ON lr.project_id = p.id
        LEFT JOIN drivers d ON lr.driver_id = d.id
        WHERE lr.id IN (SELECT id FROM filtered_record_ids)
        ORDER BY lr.loading_date DESC, lr.auto_number DESC
        LIMIT p_page_size OFFSET v_offset
    ),
    -- 为分页记录添加合作方成本信息
    records_with_costs AS (
        SELECT 
            pr.*,
            COALESCE(
                json_agg(
                    json_build_object(
                        'partner_id', lpc.partner_id,
                        'partner_name', pt.name,
                        'level', lpc.level,
                        'payable_amount', lpc.payable_amount,
                        'invoice_status', lpc.invoice_status,
                        'full_name', pt.full_name,
                        'bank_account', COALESCE(pbd.bank_account, ''),
                        'bank_name', COALESCE(pbd.bank_name, ''),
                        'branch_name', COALESCE(pbd.branch_name, '')
                    ) ORDER BY lpc.level
                ) FILTER (WHERE lpc.id IS NOT NULL),
                '[]'::json
            ) as partner_costs
        FROM paginated_records pr
        LEFT JOIN logistics_partner_costs lpc ON pr.id = lpc.logistics_record_id
        LEFT JOIN partners pt ON lpc.partner_id = pt.id
        LEFT JOIN partner_bank_details pbd ON pt.id = pbd.partner_id
        GROUP BY pr.id, pr.auto_number, pr.project_name, pr.driver_name, pr.loading_location, 
                 pr.unloading_location, pr.loading_date, pr.unloading_date, pr.license_plate,
                 pr.driver_phone, pr.cargo_type, pr.loading_weight, pr.unloading_weight, 
                 pr.remarks, pr.billing_type_id, pr.current_cost, pr.extra_cost, 
                 pr.payable_cost, pr.invoice_status
    ),
    -- 计算合作方汇总数据（用于表头显示，与付款申请一致）
    partner_invoiceables AS (
        SELECT 
            lpc.partner_id,
            pt.name as partner_name,
            lpc.level,
            SUM(lpc.payable_amount) as total_invoiceable
        FROM logistics_records lr
        JOIN logistics_partner_costs lpc ON lr.id = lpc.logistics_record_id
        JOIN partners pt ON lpc.partner_id = pt.id
        WHERE lr.id IN (SELECT id FROM filtered_record_ids)
        GROUP BY lpc.partner_id, pt.name, lpc.level
        ORDER BY lpc.level
    ),
    -- 计算总览数据
    overview_data AS (
        SELECT 
            SUM(COALESCE(lr.current_cost, 0) + COALESCE(lr.extra_cost, 0)) as total_invoiceable_cost
        FROM logistics_records lr
        WHERE lr.id IN (SELECT id FROM filtered_record_ids)
    )
    SELECT json_build_object(
        'records', COALESCE(json_agg(
            json_build_object(
                'id', rwc.id,
                'auto_number', rwc.auto_number,
                'project_name', rwc.project_name,
                'driver_name', rwc.driver_name,
                'loading_location', rwc.loading_location,
                'unloading_location', rwc.unloading_location,
                'loading_date', rwc.loading_date,
                'unloading_date', rwc.unloading_date,
                'license_plate', rwc.license_plate,
                'driver_phone', rwc.driver_phone,
                'cargo_type', rwc.cargo_type,
                'loading_weight', rwc.loading_weight,
                'unloading_weight', rwc.unloading_weight,
                'remarks', rwc.remarks,
                'billing_type_id', rwc.billing_type_id,
                'current_cost', rwc.current_cost,
                'extra_cost', rwc.extra_cost,
                'payable_cost', rwc.payable_cost,
                'invoice_status', rwc.invoice_status,
                'partner_costs', rwc.partner_costs
            )
            ORDER BY rwc.loading_date DESC, rwc.auto_number DESC
        ), '[]'::json),
        'count', (SELECT count FROM total_count),
        -- 关键：添加合作方汇总数据，与付款申请格式一致
        'partner_invoiceables', COALESCE((
            SELECT json_agg(
                json_build_object(
                    'partner_id', partner_id,
                    'partner_name', partner_name,
                    'level', level,
                    'total_invoiceable', total_invoiceable
                ) ORDER BY level
            )
            FROM partner_invoiceables
        ), '[]'::json),
        'overview', json_build_object(
            'total_invoiceable_cost', COALESCE((SELECT total_invoiceable_cost FROM overview_data), 0)
        )
    ) INTO result_json
    FROM records_with_costs rwc;

    RETURN result_json;
END;
$function$;

-- 验证修复完成
SELECT 'Invoice request data structure now matches payment request with partner columns' as status;
