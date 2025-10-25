-- ==========================================
-- 批量修改功能
-- 1. 批量修改最高合作方应付金额
-- 2. 批量修改合作链路
-- ==========================================

-- 1. 批量修改最高合作方应付金额
CREATE OR REPLACE FUNCTION public.batch_modify_partner_cost(
    p_record_ids UUID[],
    p_new_amount NUMERIC
)
RETURNS JSON AS $$
DECLARE
    v_can_access BOOLEAN;
    v_record_id UUID;
    v_updated_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_failed_records TEXT[] := '{}';
    v_highest_partner RECORD;
BEGIN
    -- 权限检查
    v_can_access := public.is_finance_operator_or_admin();
    
    IF NOT v_can_access THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有财务、操作员和管理员可以批量修改'
        );
    END IF;
    
    -- 遍历每个运单
    FOREACH v_record_id IN ARRAY p_record_ids
    LOOP
        BEGIN
            -- 检查运单状态
            DECLARE
                v_payment_status TEXT;
                v_invoice_status TEXT;
                v_auto_number TEXT;
            BEGIN
                SELECT payment_status, invoice_status, auto_number
                INTO v_payment_status, v_invoice_status, v_auto_number
                FROM public.logistics_records
                WHERE id = v_record_id;
                
                -- 检查付款状态
                IF v_payment_status != 'Unpaid' THEN
                    v_failed_count := v_failed_count + 1;
                    v_failed_records := array_append(v_failed_records, v_auto_number || '(已申请或已付款)');
                    CONTINUE;
                END IF;
                
                -- 检查开票状态
                IF v_invoice_status IS NOT NULL AND v_invoice_status != 'Uninvoiced' THEN
                    v_failed_count := v_failed_count + 1;
                    v_failed_records := array_append(v_failed_records, v_auto_number || '(已开票)');
                    CONTINUE;
                END IF;
                
                -- 获取最高级合作方
                SELECT partner_id, level
                INTO v_highest_partner
                FROM public.logistics_partner_costs
                WHERE logistics_record_id = v_record_id
                ORDER BY level DESC
                LIMIT 1;
                
                IF v_highest_partner.partner_id IS NULL THEN
                    v_failed_count := v_failed_count + 1;
                    v_failed_records := array_append(v_failed_records, v_auto_number || '(无合作方)');
                    CONTINUE;
                END IF;
                
                -- 更新最高级合作方的金额
                UPDATE public.logistics_partner_costs
                SET 
                    payable_amount = p_new_amount,
                    updated_at = NOW()
                WHERE logistics_record_id = v_record_id
                AND partner_id = v_highest_partner.partner_id
                AND level = v_highest_partner.level;
                
                v_updated_count := v_updated_count + 1;
            END;
        EXCEPTION WHEN OTHERS THEN
            v_failed_count := v_failed_count + 1;
            v_failed_records := array_append(v_failed_records, v_auto_number || '(错误)');
        END;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'updated_count', v_updated_count,
        'failed_count', v_failed_count,
        'failed_records', v_failed_records,
        'message', format('成功更新 %s 条运单，失败 %s 条', v_updated_count, v_failed_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.batch_modify_partner_cost IS '批量修改运单的最高级合作方应付金额';

-- 2. 批量修改合作链路
CREATE OR REPLACE FUNCTION public.batch_modify_chain(
    p_record_ids UUID[],
    p_chain_name TEXT
)
RETURNS JSON AS $$
DECLARE
    v_can_access BOOLEAN;
    v_record_id UUID;
    v_updated_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_failed_records TEXT[] := '{}';
    v_total_partners INTEGER := 0;
BEGIN
    -- 权限检查
    v_can_access := public.is_finance_operator_or_admin();
    
    IF NOT v_can_access THEN
        RETURN json_build_object(
            'success', false,
            'message', '权限不足：只有财务、操作员和管理员可以批量修改'
        );
    END IF;
    
    -- 遍历每个运单
    FOREACH v_record_id IN ARRAY p_record_ids
    LOOP
        BEGIN
            DECLARE
                v_result JSON;
                v_auto_number TEXT;
            BEGIN
                -- 获取运单编号
                SELECT auto_number INTO v_auto_number
                FROM public.logistics_records
                WHERE id = v_record_id;
                
                -- 调用单个运单的链路修改函数
                SELECT public.modify_logistics_record_chain_with_recalc(
                    v_record_id,
                    p_chain_name
                ) INTO v_result;
                
                -- 检查结果
                IF (v_result->>'success')::boolean THEN
                    v_updated_count := v_updated_count + 1;
                    v_total_partners := v_total_partners + COALESCE((v_result->>'recalculated_partners')::integer, 0);
                ELSE
                    v_failed_count := v_failed_count + 1;
                    v_failed_records := array_append(
                        v_failed_records, 
                        v_auto_number || '(' || (v_result->>'message') || ')'
                    );
                END IF;
            END;
        EXCEPTION WHEN OTHERS THEN
            v_failed_count := v_failed_count + 1;
            v_failed_records := array_append(v_failed_records, v_auto_number || '(系统错误)');
        END;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'updated_count', v_updated_count,
        'failed_count', v_failed_count,
        'total_partners', v_total_partners,
        'failed_records', v_failed_records,
        'message', format('成功更新 %s 条运单，重新计算 %s 个合作方成本，失败 %s 条', 
                         v_updated_count, v_total_partners, v_failed_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.batch_modify_chain IS '批量修改运单的合作链路并重新计算成本';

SELECT '✅ 批量修改功能创建完成' as 状态;

