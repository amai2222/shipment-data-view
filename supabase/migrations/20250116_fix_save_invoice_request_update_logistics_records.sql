-- 修复 save_invoice_request 函数，确保同时更新 logistics_records 表的状态
-- 文件: supabase/migrations/20250116_fix_save_invoice_request_update_logistics_records.sql

BEGIN;

-- 重写 save_invoice_request 函数，添加 logistics_records 状态更新
CREATE OR REPLACE FUNCTION public.save_invoice_request(p_record_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_max_level integer;
    v_partner_id uuid;
    v_partner_info record;
    v_request_id uuid;
    v_request_number text;
    v_total_amount numeric := 0;
    v_record_count integer := 0;
    v_partner_costs record;
    created_requests jsonb[] := '{}';
    v_processed_record_ids uuid[] := '{}';
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin_for_invoice() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以创建开票申请';
    END IF;

    -- 找出最高级别
    SELECT MAX(level) INTO v_max_level
    FROM public.logistics_partner_costs
    WHERE logistics_record_id = ANY(p_record_ids)
      AND invoice_status = 'Uninvoiced';

    IF v_max_level IS NULL THEN
        RAISE EXCEPTION '没有找到符合条件的未开票运单';
    END IF;

    -- 按合作方分组处理
    FOR v_partner_id IN
        SELECT DISTINCT partner_id
        FROM public.logistics_partner_costs
        WHERE logistics_record_id = ANY(p_record_ids)
          AND level = v_max_level
          AND invoice_status = 'Uninvoiced'
    LOOP
        -- 获取合作方信息
        SELECT 
            p.id,
            p.name,
            p.full_name,
            pbd.tax_number,
            pbd.company_address,
            pbd.bank_name,
            pbd.bank_account
        INTO v_partner_info
        FROM public.partners p
        LEFT JOIN public.partner_bank_details pbd ON p.id = pbd.partner_id
        WHERE p.id = v_partner_id;

        -- 生成申请编号
        v_request_number := public.generate_invoice_request_number();

        -- 统计金额和记录数
        SELECT 
            COUNT(*),
            SUM(lpc.payable_amount)
        INTO v_record_count, v_total_amount
        FROM public.logistics_partner_costs lpc
        WHERE lpc.logistics_record_id = ANY(p_record_ids)
          AND lpc.partner_id = v_partner_id
          AND lpc.level = v_max_level
          AND lpc.invoice_status = 'Uninvoiced';
        
        -- 创建开票申请记录
        INSERT INTO public.invoice_requests (
            request_number,
            partner_id,
            invoicing_partner_id,
            partner_name,
            partner_full_name,
            tax_number,
            company_address,
            bank_name,
            bank_account,
            total_amount,
            record_count,
            status,
            created_by,
            created_at
        ) VALUES (
            v_request_number,
            v_partner_id,
            v_partner_id,
            v_partner_info.name,
            v_partner_info.full_name,
            v_partner_info.tax_number,
            v_partner_info.company_address,
            v_partner_info.bank_name,
            v_partner_info.bank_account,
            v_total_amount,
            v_record_count,
            'Pending',
            auth.uid(),
            NOW()
        ) RETURNING id INTO v_request_id;
        
        -- 创建开票申请明细并更新状态
        FOR v_partner_costs IN
            SELECT 
                lpc.id as cost_id,
                lpc.logistics_record_id,
                lpc.payable_amount
            FROM public.logistics_partner_costs lpc
            WHERE lpc.logistics_record_id = ANY(p_record_ids)
              AND lpc.partner_id = v_partner_id
              AND lpc.level = v_max_level
              AND lpc.invoice_status = 'Uninvoiced'
        LOOP
            -- 插入开票申请明细
            INSERT INTO public.invoice_request_details (
                invoice_request_id,
                logistics_record_id,
                amount
            ) VALUES (
                v_request_id,
                v_partner_costs.logistics_record_id,
                v_partner_costs.payable_amount
            );
            
            -- 更新合作方成本状态
            UPDATE public.logistics_partner_costs
            SET 
                invoice_status = 'Processing',
                invoice_request_id = v_request_id,
                invoice_applied_at = NOW()
            WHERE id = v_partner_costs.cost_id;

            -- 收集已处理的运单ID
            v_processed_record_ids := v_processed_record_ids || v_partner_costs.logistics_record_id;
        END LOOP;
        
        -- 记录创建的申请
        created_requests := created_requests || jsonb_build_object(
            'request_id', v_request_id,
            'request_number', v_request_number,
            'partner_id', v_partner_id,
            'partner_name', v_partner_info.full_name,
            'total_amount', v_total_amount,
            'record_count', v_record_count
        );
    END LOOP;

    -- ✅ 关键修复：更新 logistics_records 表的状态
    -- 将所有已处理的运单状态更新为 'Processing'
    UPDATE public.logistics_records
    SET 
        invoice_status = 'Processing',
        invoice_applied_at = NOW(),
        invoice_request_id = (
            SELECT ir.id 
            FROM public.invoice_requests ir 
            WHERE ir.id = (
                SELECT ird.invoice_request_id 
                FROM public.invoice_request_details ird 
                WHERE ird.logistics_record_id = logistics_records.id 
                LIMIT 1
            )
        )
    WHERE id = ANY(v_processed_record_ids);

    -- 返回结果
    RETURN jsonb_build_object(
        'success', true,
        'message', '开票申请创建成功',
        'created_requests', created_requests,
        'total_requests', array_length(created_requests, 1),
        'processed_record_ids', v_processed_record_ids
    );

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '创建开票申请失败: %', SQLERRM;
END;
$function$;

-- 更新函数注释
COMMENT ON FUNCTION public.save_invoice_request(uuid[]) IS '
保存开票申请函数（修复版本）
参数：p_record_ids (uuid[]) - 运单ID数组
返回：jsonb - 包含创建的申请信息
逻辑：
  1. 找出最高级别合作方
  2. 只给最高级合作方创建开票申请
  3. 按合作方分组自动创建申请
  4. 更新 logistics_partner_costs 的 invoice_status
  5. ✅ 同时更新 logistics_records 的 invoice_status
注意：现在会同时更新两个表的状态，确保前端显示正确
';

COMMIT;
