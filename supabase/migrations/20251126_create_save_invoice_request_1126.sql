-- ==========================================
-- 创建 save_invoice_request_1126 函数
-- ==========================================
-- 创建时间: 2025-11-26
-- 功能: 保存开票申请函数（1126版本）
-- 说明: 根据原 save_invoice_request 函数逻辑创建，支持按合作方分组创建开票申请
-- ==========================================

CREATE OR REPLACE FUNCTION public.save_invoice_request_1126(p_invoice_data jsonb)
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
    v_remarks text;  -- ✅ 添加备注变量
BEGIN
    -- 提取数据
    v_sheets := p_invoice_data->'sheets';
    v_all_partner_cost_ids := ARRAY(SELECT jsonb_array_elements_text(p_invoice_data->'all_partner_cost_ids'))::uuid[];

    -- ✅ 使用统一权限系统检查权限
    -- 检查功能权限：finance.generate_invoice
    IF NOT public.has_function_permission('finance.generate_invoice') THEN
        RAISE EXCEPTION '权限不足：您没有创建开票申请的权限。请联系管理员在权限管理中分配 "finance.generate_invoice" 权限。';
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
        
        -- ✅ 生成备注信息
        v_remarks := format('%s申请开票共%s条运单金额¥%s',
            v_sheet->>'invoicing_partner_full_name',
            v_sheet->>'record_count',
            ROUND((v_sheet->>'total_invoiceable')::decimal, 2)
        );
        
        -- 创建开票申请记录
        INSERT INTO invoice_requests (
            request_number,
            invoicing_partner_id,  -- ✅ 必需字段
            partner_id,
            partner_name,
            partner_full_name,
            invoicing_partner_full_name,
            invoicing_partner_tax_number,
            invoicing_partner_company_address,
            invoicing_partner_bank_name,
            invoicing_partner_bank_account,
            tax_number,
            company_address,
            bank_name,
            bank_account,
            total_amount,
            record_count,
            created_by,
            remarks
        ) VALUES (
            v_request_number,
            (v_sheet->>'invoicing_partner_id')::uuid,
            (v_sheet->>'invoicing_partner_id')::uuid,
            v_sheet->>'invoicing_partner_full_name',
            v_sheet->>'invoicing_partner_full_name',
            v_sheet->>'invoicing_partner_full_name',
            v_sheet->>'invoicing_partner_tax_number',
            v_sheet->>'invoicing_partner_company_address',
            v_sheet->>'invoicing_partner_bank_name',
            v_sheet->>'invoicing_partner_bank_account',
            v_sheet->>'invoicing_partner_tax_number',
            v_sheet->>'invoicing_partner_company_address',
            v_sheet->>'invoicing_partner_bank_name',
            v_sheet->>'invoicing_partner_bank_account',
            (v_sheet->>'total_invoiceable')::decimal,
            (v_sheet->>'record_count')::integer,
            auth.uid(),
            v_remarks
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
            
            -- ✅ 同步更新运单的开票状态
            UPDATE logistics_records
            SET 
                invoice_status = 'Processing',
                invoice_request_id = v_request_id,  -- ✅ uuid类型，直接赋值
                invoice_applied_at = NOW()
            WHERE id = (v_partner_cost->>'logistics_record_id')::uuid;
        END LOOP;
        
        -- 记录创建的申请
        created_requests := created_requests || jsonb_build_object(
            'request_id', v_request_id,
            'request_number', v_request_number,
            'partner_name', v_sheet->>'invoicing_partner_full_name',
            'total_amount', (v_sheet->>'total_invoiceable')::decimal,
            'record_count', (v_sheet->>'record_count')::integer,
            'remarks', v_remarks  -- ✅ 包含备注信息
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

COMMENT ON FUNCTION public.save_invoice_request_1126 IS '保存开票申请函数（1126版本）- 按合作方分组创建开票申请，自动生成备注信息，同步更新运单状态（使用统一权限系统检查权限：has_function_permission(''finance.generate_invoice''))';

