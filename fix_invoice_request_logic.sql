-- 修正开票申请逻辑：以运单为主要对象，参考付款申请的逻辑
-- 开票申请应该显示运单列表，选择运单后对各级合作方成本记录进行开票状态修改

-- =============================================================================
-- 第一步：重新创建开票申请数据查询函数（以运单为主对象）
-- =============================================================================

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
    v_offset := (p_page_number - 1) * p_page_size;

    -- 查询运单，并汇总每个运单的开票状态
    WITH logistics_with_invoice_status AS (
        SELECT 
            lr.*,
            -- 汇总该运单下所有合作方成本的开票状态
            CASE 
                WHEN COUNT(lpc.id) = 0 THEN 'Uninvoiced'
                WHEN COUNT(lpc.id) = COUNT(CASE WHEN lpc.invoice_status = 'Invoiced' THEN 1 END) THEN 'Invoiced'
                WHEN COUNT(CASE WHEN lpc.invoice_status = 'Processing' THEN 1 END) > 0 THEN 'Processing'
                ELSE 'Uninvoiced'
            END as overall_invoice_status,
            -- 汇总开票金额
            COALESCE(SUM(lpc.payable_amount), 0) as total_invoiceable_amount,
            -- 统计合作方成本记录数量
            COUNT(lpc.id) as partner_cost_count
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
            ))
        GROUP BY lr.id, lr.auto_number, lr.project_id, lr.project_name, lr.driver_id, lr.driver_name, 
                 lr.loading_location, lr.unloading_location, lr.loading_date, lr.unloading_date,
                 lr.license_plate, lr.driver_phone, lr.cargo_type, lr.loading_weight, 
                 lr.unloading_weight, lr.remarks, lr.billing_type_id, lr.current_cost, 
                 lr.extra_cost, lr.chain_id, lr.user_id, lr.created_at, lr.updated_at
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
        SELECT count(*) as count FROM logistics_with_invoice_status
    )
    SELECT json_build_object(
        'records', COALESCE(json_agg(
            json_build_object(
                'id', lwis.id,
                'auto_number', lwis.auto_number,
                'project_name', lwis.project_name,
                'driver_name', lwis.driver_name,
                'loading_location', lwis.loading_location,
                'unloading_location', lwis.unloading_location,
                'loading_date', lwis.loading_date,
                'unloading_date', lwis.unloading_date,
                'license_plate', lwis.license_plate,
                'driver_phone', lwis.driver_phone,
                'cargo_type', lwis.cargo_type,
                'loading_weight', lwis.loading_weight,
                'unloading_weight', lwis.unloading_weight,
                'remarks', lwis.remarks,
                'billing_type_id', lwis.billing_type_id,
                'current_cost', lwis.current_cost,
                'extra_cost', lwis.extra_cost,
                'invoice_status', lwis.overall_invoice_status,
                'total_invoiceable_amount', lwis.total_invoiceable_amount,
                'partner_cost_count', lwis.partner_cost_count
            )
            ORDER BY lwis.loading_date DESC, lwis.auto_number DESC
        ), '[]'::json),
        'count', (SELECT count FROM total_count)
    ) INTO result_json
    FROM (
        SELECT * FROM logistics_with_invoice_status
        ORDER BY loading_date DESC, auto_number DESC
        LIMIT p_page_size OFFSET v_offset
    ) lwis;

    RETURN result_json;
END;
$function$;

-- =============================================================================
-- 第二步：创建获取未开票运单ID的函数
-- =============================================================================

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

-- =============================================================================
-- 第三步：创建获取开票申请详细数据的函数（基于运单ID）
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_invoice_request_data_v2(p_record_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json jsonb;
BEGIN
    SELECT jsonb_build_object(
        'records', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', lr.id,
                'auto_number', lr.auto_number,
                'project_name', lr.project_name,
                'driver_name', lr.driver_name,
                'loading_location', lr.loading_location,
                'unloading_location', lr.unloading_location,
                'loading_date', lr.loading_date,
                'unloading_date', lr.unloading_date,
                'license_plate', lr.license_plate,
                'driver_phone', lr.driver_phone,
                'cargo_type', lr.cargo_type,
                'loading_weight', lr.loading_weight,
                'unloading_weight', lr.unloading_weight,
                'remarks', lr.remarks,
                'billing_type_id', lr.billing_type_id,
                'current_cost', lr.current_cost,
                'extra_cost', lr.extra_cost,
                'partner_costs', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'id', lpc.id,
                            'partner_id', lpc.partner_id,
                            'partner_name', p.name,
                            'level', lpc.level,
                            'base_amount', lpc.base_amount,
                            'payable_amount', lpc.payable_amount,
                            'tax_rate', lpc.tax_rate,
                            'invoice_status', lpc.invoice_status,
                            'payment_status', lpc.payment_status,
                            -- 合作方开票信息
                            'full_name', p.full_name,
                            'tax_number', COALESCE(p.tax_number, ''),
                            'company_address', COALESCE(p.company_address, ''),
                            'bank_name', COALESCE(p.bank_name, ''),
                            'bank_account', COALESCE(p.bank_account, '')
                        ) ORDER BY lpc.level
                    ), '[]'::jsonb)
                    FROM logistics_partner_costs lpc
                    JOIN partners p ON lpc.partner_id = p.id
                    WHERE lpc.logistics_record_id = lr.id
                      AND lpc.invoice_status = 'Uninvoiced'
                )
            )
        ), '[]'::jsonb)
    )
    INTO result_json
    FROM logistics_records lr
    WHERE lr.id = ANY(p_record_ids);

    RETURN result_json;
END;
$function$;

-- =============================================================================
-- 第四步：更新保存开票申请函数（基于运单处理）
-- =============================================================================

CREATE OR REPLACE FUNCTION public.save_invoice_request(p_invoice_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_sheets jsonb;
    v_all_record_ids uuid[];
    v_sheet jsonb;
    v_request_id uuid;
    v_request_number text;
    v_record_id uuid;
    result_json jsonb;
    created_requests jsonb[] := '{}';
    v_records jsonb;
    v_record jsonb;
    v_partner_costs jsonb;
    v_partner_cost jsonb;
BEGIN
    -- 检查用户权限
    IF NOT public.is_finance_or_admin_for_invoice() THEN
        RAISE EXCEPTION '权限不足：只有财务人员、管理员或操作员可以创建开票申请';
    END IF;

    v_sheets := p_invoice_data->'sheets';
    v_all_record_ids := ARRAY(SELECT jsonb_array_elements_text(p_invoice_data->'all_record_ids'))::uuid[];

    -- 验证所有运单下的合作方成本记录都是未开票状态
    IF EXISTS (
        SELECT 1 FROM logistics_partner_costs lpc
        WHERE lpc.logistics_record_id = ANY(v_all_record_ids) 
        AND lpc.invoice_status != 'Uninvoiced'
    ) THEN
        RAISE EXCEPTION '部分运单下的合作方成本记录已经申请过开票或已完成开票';
    END IF;

    -- 为每个合作方创建开票申请
    FOR i IN 0..jsonb_array_length(v_sheets)-1 LOOP
        v_sheet := v_sheets->i;
        v_request_number := generate_invoice_request_number();
        
        INSERT INTO invoice_requests (
            request_number,
            partner_id,
            partner_name,
            partner_full_name,
            tax_number,
            company_address,
            bank_name,
            bank_account,
            total_amount,
            record_count,
            created_by
        ) VALUES (
            v_request_number,
            (v_sheet->>'invoicing_partner_id')::uuid,
            v_sheet->>'invoicing_partner_full_name',
            v_sheet->>'invoicing_partner_full_name',
            v_sheet->>'invoicing_partner_tax_number',
            v_sheet->>'invoicing_partner_company_address',
            v_sheet->>'invoicing_partner_bank_name',
            v_sheet->>'invoicing_partner_bank_account',
            (v_sheet->>'total_invoiceable')::decimal,
            (v_sheet->>'record_count')::integer,
            auth.uid()
        ) RETURNING id INTO v_request_id;

        v_records := v_sheet->'records';
        
        -- 处理每个运单
        FOR j IN 0..jsonb_array_length(v_records)-1 LOOP
            v_record := v_records->j;
            v_record_id := (v_record->>'id')::uuid;
            
            -- 创建申请明细记录
            INSERT INTO invoice_request_details (
                invoice_request_id,
                logistics_record_id,
                amount
            ) VALUES (
                v_request_id,
                v_record_id,
                (v_record->>'total_invoiceable_for_partner')::decimal
            );
            
            -- 更新该运单下属于当前合作方的所有合作方成本记录状态
            UPDATE logistics_partner_costs 
            SET 
                invoice_status = 'Processing',
                invoice_request_id = v_request_id,
                invoice_applied_at = NOW()
            WHERE logistics_record_id = v_record_id
              AND partner_id = (v_sheet->>'invoicing_partner_id')::uuid
              AND invoice_status = 'Uninvoiced';
        END LOOP;
        
        created_requests := created_requests || jsonb_build_object(
            'request_id', v_request_id,
            'request_number', v_request_number,
            'partner_id', v_sheet->>'invoicing_partner_id',
            'partner_name', v_sheet->>'invoicing_partner_full_name',
            'total_amount', v_sheet->>'total_invoiceable',
            'record_count', v_sheet->>'record_count'
        );
    END LOOP;

    result_json := jsonb_build_object(
        'success', true,
        'message', '开票申请创建成功',
        'created_requests', to_jsonb(created_requests)
    );

    RETURN result_json;
END;
$function$;

-- =============================================================================
-- 第五步：验证函数创建成功
-- =============================================================================

-- 检查函数是否创建成功
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name IN ('get_invoice_request_data', 'get_filtered_uninvoiced_record_ids', 'get_invoice_request_data_v2', 'save_invoice_request')
AND routine_schema = 'public'
ORDER BY routine_name;

-- 测试函数
SELECT 'Testing invoice request functions...' as message;
SELECT public.get_invoice_request_data() LIMIT 1;
