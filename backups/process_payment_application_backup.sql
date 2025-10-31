-- ============================================================================
-- 备份：process_payment_application函数
-- 备份时间：2025-10-31
-- 说明：这是创建付款申请的函数，执行新SQL前的备份
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_payment_application(p_record_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_request_id UUID;
    v_request_number TEXT;
    v_record_count INTEGER;
    v_updated_partner_costs INTEGER := 0;
    v_updated_records INTEGER := 0;
    v_rec_id UUID;
    v_rec_max_level INTEGER;
    v_temp_count INTEGER;
    v_notes_parts TEXT[] := '{}';
    v_partner_info RECORD;
BEGIN
    -- 验证权限
    IF NOT public.is_finance_operator_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务、操作员和管理员可以创建付款申请';
    END IF;
    
    -- 生成付款申请单编号
    v_request_number := 'FKD' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                       LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    -- 生成备注：收集所有需要付款的供应商信息
    FOR v_partner_info IN
        WITH record_max_levels AS (
            SELECT 
                logistics_record_id, 
                MAX(level) as max_level,
                COUNT(*) as cost_count
            FROM public.logistics_partner_costs
            WHERE logistics_record_id = ANY(p_record_ids)
            GROUP BY logistics_record_id
        ),
        record_payment_status AS (
            SELECT id, payment_status
            FROM public.logistics_records
            WHERE id = ANY(p_record_ids)
        )
        SELECT 
            p.name,
            p.full_name,
            COUNT(DISTINCT lpc.logistics_record_id) as record_count,
            SUM(lpc.payable_amount) as total_amount
        FROM public.logistics_partner_costs lpc
        INNER JOIN record_max_levels rml ON lpc.logistics_record_id = rml.logistics_record_id
        INNER JOIN record_payment_status rps ON lpc.logistics_record_id = rps.id
        INNER JOIN public.partners p ON lpc.partner_id = p.id
        WHERE lpc.logistics_record_id = ANY(p_record_ids)
          AND rps.payment_status = 'Unpaid'
          AND (
              rml.cost_count = 1
              OR 
              lpc.level < rml.max_level
          )
          AND lpc.payment_status = 'Unpaid'
        GROUP BY p.id, p.name, p.full_name
        ORDER BY total_amount DESC
    LOOP
        v_notes_parts := array_append(
            v_notes_parts,
            format('%s申请付款共%s条运单金额¥%s',
                COALESCE(v_partner_info.full_name, v_partner_info.name),
                v_partner_info.record_count,
                ROUND(v_partner_info.total_amount, 2)
            )
        );
    END LOOP;
    
    IF array_length(v_notes_parts, 1) = 0 OR array_length(v_notes_parts, 1) IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '按规则排除最高级合作方后，没有需要申请付款的运单'
        );
    END IF;
    
    -- 创建付款申请单
    INSERT INTO public.payment_requests (
        request_id,
        logistics_record_ids,
        record_count,
        status,
        notes,
        created_by,
        user_id,
        created_at
    ) VALUES (
        v_request_number,
        p_record_ids,
        array_length(p_record_ids, 1),
        'Pending',
        array_to_string(v_notes_parts, '，'),
        auth.uid(),
        auth.uid(),
        NOW()
    ) RETURNING id INTO v_request_id;
    
    -- 创建付款申请明细
    FOR v_rec_id IN SELECT unnest(p_record_ids)
    LOOP
        INSERT INTO public.payment_items (
            payment_request_id,
            logistics_record_id,
            user_id
        ) VALUES (
            v_request_id,
            v_rec_id,
            auth.uid()
        );
    END LOOP;
    
    -- 更新合作方成本状态
    FOR v_rec_id IN SELECT unnest(p_record_ids)
    LOOP
        <<inner_block>>
        DECLARE
            v_cost_count INTEGER;
            v_rec_payment_status TEXT;
        BEGIN
            SELECT payment_status INTO v_rec_payment_status
            FROM public.logistics_records
            WHERE id = v_rec_id;
            
            IF v_rec_payment_status != 'Unpaid' THEN
                CONTINUE;
            END IF;
            
            SELECT COUNT(*), MAX(level) 
            INTO v_cost_count, v_rec_max_level
            FROM public.logistics_partner_costs
            WHERE logistics_record_id = v_rec_id;
            
            IF v_cost_count = 1 THEN
                UPDATE public.logistics_partner_costs
                SET 
                    payment_status = 'Processing',
                    payment_request_id = v_request_id,
                    payment_applied_at = NOW()
                WHERE logistics_record_id = v_rec_id
                  AND payment_status = 'Unpaid';
            ELSE
                UPDATE public.logistics_partner_costs
                SET 
                    payment_status = 'Processing',
                    payment_request_id = v_request_id,
                    payment_applied_at = NOW()
                WHERE logistics_record_id = v_rec_id
                  AND level < v_rec_max_level
                  AND payment_status = 'Unpaid';
            END IF;
            
            GET DIAGNOSTICS v_temp_count = ROW_COUNT;
            v_updated_partner_costs := v_updated_partner_costs + v_temp_count;
        END inner_block;
    END LOOP;
    
    -- 更新运单状态为Processing
    UPDATE public.logistics_records
    SET payment_status = 'Processing'
    WHERE id = ANY(p_record_ids)
      AND payment_status = 'Unpaid';
    
    GET DIAGNOSTICS v_updated_records = ROW_COUNT;
    
    -- 返回结果
    RETURN json_build_object(
        'success', true,
        'message', format('成功创建1个付款申请单，包含%s条运单', array_length(p_record_ids, 1)),
        'request_id', v_request_id,
        'request_number', v_request_number,
        'record_count', array_length(p_record_ids, 1),
        'updated_partner_costs', v_updated_partner_costs,
        'updated_records', v_updated_records
    );
    
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '创建付款申请失败: %', SQLERRM;
END;
$function$;

