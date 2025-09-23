-- 重写开票申请函数，基于logistics_partner_costs表的正确业务逻辑
-- 文件: supabase/migrations/20250923000007_rewrite_invoice_functions_for_partner_costs.sql

BEGIN;

-- 1. 重写获取开票申请数据的函数
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
            (p_invoice_status_array IS NULL OR array_length(p_invoice_status_array, 1) IS NULL OR lpc.invoice_status = ANY(p_invoice_status_array))
    ),
    total_count AS (
        SELECT count(*) as count FROM filtered_partner_costs
    )
    SELECT json_build_object(
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
                ORDER BY loading_date DESC, auto_number DESC, level ASC
                LIMIT p_page_size OFFSET v_offset
            ) fpc
        ), '[]'::json),
        'count', (SELECT count FROM total_count)
    ) INTO result_json;

    RETURN result_json;
END;
$function$;

-- 2. 重写获取筛选后的未开票合作方成本ID
CREATE OR REPLACE FUNCTION public.get_filtered_uninvoiced_partner_cost_ids(
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
    SELECT array_agg(lpc.id)
    INTO result_ids
    FROM logistics_partner_costs lpc
    JOIN logistics_records lr ON lpc.logistics_record_id = lr.id
    WHERE
        lpc.invoice_status = 'Uninvoiced' AND
        (p_project_id IS NULL OR lr.project_id = p_project_id) AND
        (p_start_date IS NULL OR lr.loading_date >= p_start_date) AND
        (p_end_date IS NULL OR lr.loading_date <= p_end_date) AND
        (p_partner_id IS NULL OR lpc.partner_id = p_partner_id);

    RETURN COALESCE(result_ids, ARRAY[]::uuid[]);
END;
$function$;

-- 3. 重写获取开票申请详细数据
CREATE OR REPLACE FUNCTION public.get_invoice_request_data_v2(p_partner_cost_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json jsonb;
BEGIN
    SELECT jsonb_build_object(
        'partner_costs', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', lpc.id,
                'logistics_record_id', lpc.logistics_record_id,
                'auto_number', lr.auto_number,
                'project_name', lr.project_name,
                'driver_name', lr.driver_name,
                'loading_location', lr.loading_location,
                'unloading_location', lr.unloading_location,
                'loading_date', to_char(lr.loading_date, 'YYYY-MM-DD'),
                'unloading_date', COALESCE(to_char(lr.unloading_date, 'YYYY-MM-DD'), null),
                'loading_weight', lr.loading_weight,
                'unloading_weight', lr.unloading_weight,
                'current_cost', lr.current_cost,
                'extra_cost', lr.extra_cost,
                'license_plate', d.license_plate,
                'driver_phone', d.phone,
                'transport_type', lr.transport_type,
                'remarks', lr.remarks,
                'chain_name', pc.chain_name,
                'cargo_type', lr.cargo_type,
                'billing_type_id', lr.billing_type_id,
                'partner_id', lpc.partner_id,
                'partner_name', p.name,
                'level', lpc.level,
                'base_amount', lpc.base_amount,
                'payable_amount', lpc.payable_amount,
                'tax_rate', lpc.tax_rate,
                'invoice_status', lpc.invoice_status,
                'payment_status', lpc.payment_status,
                'tax_number', p.tax_number,
                'company_address', p.company_address,
                'bank_name', p.bank_name,
                'bank_account', p.bank_account
            )
        ), '[]'::jsonb)
    )
    INTO result_json
    FROM logistics_partner_costs lpc
    JOIN logistics_records lr ON lpc.logistics_record_id = lr.id
    JOIN partners p ON lpc.partner_id = p.id
    JOIN drivers d ON lr.driver_id = d.id
    LEFT JOIN partner_chains pc ON lr.chain_id = pc.id
    WHERE lpc.id = ANY(p_partner_cost_ids)
      AND lpc.invoice_status = 'Uninvoiced';

    RETURN result_json;
END;
$function$;

-- 4. 重写保存开票申请函数
CREATE OR REPLACE FUNCTION public.save_invoice_request(p_invoice_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_sheets jsonb;
    v_all_partner_cost_ids uuid[];
    v_sheet jsonb;
    v_request_id uuid;
    v_request_number text;
    v_partner_cost_id uuid;
    result_json jsonb;
    created_requests jsonb[] := '{}';
    v_partner_costs jsonb;
    v_partner_cost jsonb;
BEGIN
    -- 提取数据
    v_sheets := p_invoice_data->'sheets';
    v_all_partner_cost_ids := ARRAY(SELECT jsonb_array_elements_text(p_invoice_data->'all_partner_cost_ids'))::uuid[];

    -- 检查用户权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以创建开票申请';
    END IF;

    -- 验证所有合作方成本记录都是未开票状态
    IF EXISTS (
        SELECT 1 FROM logistics_partner_costs 
        WHERE id = ANY(v_all_partner_cost_ids) 
        AND invoice_status != 'Uninvoiced'
    ) THEN
        RAISE EXCEPTION '部分合作方成本记录已经申请过开票或已完成开票';
    END IF;

    -- 为每个合作方创建开票申请
    FOR i IN 0..jsonb_array_length(v_sheets)-1 LOOP
        v_sheet := v_sheets->i;
        
        -- 生成申请单号
        v_request_number := generate_invoice_request_number();
        
        -- 创建开票申请记录
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

        -- 获取该合作方的所有合作方成本记录
        v_partner_costs := v_sheet->'partner_costs';
        
        -- 处理该合作方的所有合作方成本记录
        FOR j IN 0..jsonb_array_length(v_partner_costs)-1 LOOP
            v_partner_cost := v_partner_costs->j;
            v_partner_cost_id := (v_partner_cost->>'id')::uuid;
            
            -- 创建开票申请明细（基于partner_cost记录）
            INSERT INTO invoice_request_details (
                invoice_request_id,
                logistics_record_id,
                amount
            ) VALUES (
                v_request_id,
                (v_partner_cost->>'logistics_record_id')::uuid,
                (v_partner_cost->>'payable_amount')::decimal
            );
            
            -- 更新合作方成本记录的状态和关联信息
            UPDATE logistics_partner_costs 
            SET 
                invoice_status = 'Processing',
                invoice_request_id = v_request_id,
                invoice_applied_at = NOW()
            WHERE id = v_partner_cost_id;
        END LOOP;
        
        -- 记录创建的申请
        created_requests := created_requests || jsonb_build_object(
            'request_id', v_request_id,
            'request_number', v_request_number,
            'partner_name', v_sheet->>'invoicing_partner_full_name',
            'total_amount', (v_sheet->>'total_invoiceable')::decimal,
            'record_count', (v_sheet->>'record_count')::integer
        );
    END LOOP;

    -- 返回结果
    result_json := jsonb_build_object(
        'success', true,
        'message', '开票申请创建成功',
        'created_requests', created_requests,
        'total_requests', jsonb_array_length(to_jsonb(created_requests)),
        'total_partner_costs', array_length(v_all_partner_cost_ids, 1)
    );

    RETURN result_json;

EXCEPTION WHEN OTHERS THEN
    -- 发生错误时回滚
    RAISE EXCEPTION '创建开票申请失败: %', SQLERRM;
END;
$function$;

-- 5. 更新开票申请管理函数以适配新的业务逻辑
CREATE OR REPLACE FUNCTION public.approve_invoice_request(
    p_request_id uuid,
    p_action text, -- 'approve' 或 'reject'
    p_remarks text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request invoice_requests%ROWTYPE;
    v_new_status text;
    result_json json;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以审批开票申请';
    END IF;

    -- 获取申请信息
    SELECT * INTO v_request FROM invoice_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在';
    END IF;

    IF v_request.status != 'Pending' THEN
        RAISE EXCEPTION '只能审批待审批状态的申请';
    END IF;

    -- 确定新状态
    IF p_action = 'approve' THEN
        v_new_status := 'Approved';
    ELSIF p_action = 'reject' THEN
        v_new_status := 'Rejected';
    ELSE
        RAISE EXCEPTION '无效的操作类型，只支持 approve 或 reject';
    END IF;

    -- 更新申请状态
    UPDATE invoice_requests 
    SET 
        status = v_new_status,
        approved_by = auth.uid(),
        approved_at = NOW(),
        remarks = COALESCE(p_remarks, remarks)
    WHERE id = p_request_id;

    -- 如果是拒绝，需要将相关合作方成本记录状态改回未开票
    IF p_action = 'reject' THEN
        UPDATE logistics_partner_costs 
        SET 
            invoice_status = 'Uninvoiced',
            invoice_request_id = NULL,
            invoice_applied_at = NULL
        WHERE invoice_request_id = p_request_id;
    END IF;

    result_json := json_build_object(
        'success', true,
        'message', CASE 
            WHEN p_action = 'approve' THEN '开票申请已批准'
            ELSE '开票申请已拒绝，相关合作方成本记录状态已恢复'
        END,
        'request_id', p_request_id,
        'new_status', v_new_status
    );

    RETURN result_json;
END;
$function$;

-- 6. 更新完成开票函数
CREATE OR REPLACE FUNCTION public.complete_invoice_request(
    p_request_id uuid,
    p_invoice_number text,
    p_invoice_date date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request invoice_requests%ROWTYPE;
    result_json json;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以完成开票';
    END IF;

    -- 获取申请信息
    SELECT * INTO v_request FROM invoice_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在';
    END IF;

    IF v_request.status != 'Approved' THEN
        RAISE EXCEPTION '只能完成已批准的开票申请';
    END IF;

    -- 更新申请状态和发票信息
    UPDATE invoice_requests 
    SET 
        status = 'Invoiced',
        invoice_number = p_invoice_number,
        invoice_date = p_invoice_date
    WHERE id = p_request_id;

    -- 更新相关合作方成本记录状态为已开票
    UPDATE logistics_partner_costs 
    SET 
        invoice_status = 'Invoiced',
        invoice_number = p_invoice_number,
        invoice_completed_at = NOW()
    WHERE invoice_request_id = p_request_id;

    result_json := json_build_object(
        'success', true,
        'message', '开票完成，合作方成本记录状态已更新',
        'request_id', p_request_id,
        'invoice_number', p_invoice_number,
        'invoice_date', p_invoice_date
    );

    RETURN result_json;
END;
$function$;

-- 7. 更新删除开票申请函数
CREATE OR REPLACE FUNCTION public.delete_invoice_request(p_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_request invoice_requests%ROWTYPE;
    result_json json;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以删除开票申请';
    END IF;

    -- 获取申请信息
    SELECT * INTO v_request FROM invoice_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在';
    END IF;

    IF v_request.status != 'Pending' THEN
        RAISE EXCEPTION '只能删除待审批状态的申请';
    END IF;

    -- 恢复相关合作方成本记录状态
    UPDATE logistics_partner_costs 
    SET 
        invoice_status = 'Uninvoiced',
        invoice_request_id = NULL,
        invoice_applied_at = NULL
    WHERE invoice_request_id = p_request_id;

    -- 删除申请（级联删除明细）
    DELETE FROM invoice_requests WHERE id = p_request_id;

    result_json := json_build_object(
        'success', true,
        'message', '开票申请已删除，相关合作方成本记录状态已恢复',
        'request_id', p_request_id
    );

    RETURN result_json;
END;
$function$;

-- 添加函数注释
COMMENT ON FUNCTION public.get_invoice_request_data IS '获取开票申请数据，基于logistics_partner_costs表，支持分页和筛选';
COMMENT ON FUNCTION public.get_filtered_uninvoiced_partner_cost_ids IS '获取筛选条件下的未开票合作方成本记录ID列表';
COMMENT ON FUNCTION public.get_invoice_request_data_v2 IS '获取指定合作方成本记录的详细开票数据';
COMMENT ON FUNCTION public.save_invoice_request IS '保存开票申请，基于合作方成本记录创建申请并更新状态';

COMMIT;
