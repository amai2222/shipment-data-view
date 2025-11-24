-- ============================================================================
-- 修复 get_payment_request_data_v2_1124 函数：按链路过滤合作方成本
-- 创建时间: 2025-11-24
-- 问题：PDF付款申请表的收款人信息没有按照运单的实际链路过滤
-- 解决：在获取partner_costs时，关联project_partners表，只返回属于该链路的合作方成本
-- 说明：重命名为 _1124 版本，避免与旧版本冲突
-- ============================================================================

-- 删除旧版本函数（如果存在）
DROP FUNCTION IF EXISTS public.get_payment_request_data_v2_1124(uuid[]);

-- 创建新版本函数，修复按链路过滤合作方成本
CREATE OR REPLACE FUNCTION public.get_payment_request_data_v2_1124(p_record_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result_json jsonb;
    v_can_view boolean := public.is_finance_or_admin();
BEGIN
    SELECT jsonb_build_object(
        'records', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', v.id,
                'auto_number', v.auto_number,
                'project_name', v.project_name,
                'driver_name', v.driver_name,
                'loading_location', v.loading_location,
                'unloading_location', v.unloading_location,
                'loading_date', to_char(v.loading_date, 'YYYY-MM-DD'),
                'unloading_date', COALESCE(to_char(v.unloading_date, 'YYYY-MM-DD'), null),
                'loading_weight', v.loading_weight,
                'unloading_weight', v.unloading_weight,
                'current_cost', v.current_cost,
                'extra_cost', v.extra_cost,
                'payable_cost', v.payable_cost,
                'license_plate', v.license_plate,
                'driver_phone', v.driver_phone,
                'transport_type', v.transport_type,
                'remarks', v.remarks,
                'chain_name', v.chain_name,
                'chain_id', lr.chain_id,  -- ✅ 新增：返回chain_id，用于前端链路分组
                'cargo_type', lr.cargo_type,
                'billing_type_id', lr.billing_type_id,  -- 计费类型ID，用于前端格式化数量显示
                'payment_status', lr.payment_status,  -- 使用 logistics_records 的 payment_status
                'partner_costs', (
                    -- ✅ 修复：根据运单的chain_id过滤，只返回属于该链路的合作方成本
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'partner_id', lpc.partner_id,
                            'partner_name', p.name,
                            'level', lpc.level,
                            'payable_amount', lpc.payable_amount,
                            'full_name', CASE WHEN v_can_view THEN p.full_name ELSE NULL END,
                            'bank_account', CASE WHEN v_can_view THEN bd.bank_account ELSE NULL END,
                            'bank_name', CASE WHEN v_can_view THEN bd.bank_name ELSE NULL END,
                            'branch_name', CASE WHEN v_can_view THEN bd.branch_name ELSE NULL END
                        ) ORDER BY lpc.level
                    ), '[]'::jsonb)
                    FROM public.logistics_partner_costs lpc
                    JOIN public.partners p ON lpc.partner_id = p.id
                    LEFT JOIN public.partner_bank_details bd ON bd.partner_id = p.id
                    -- ✅ 关键修复：关联project_partners表，只返回属于该链路的合作方
                    INNER JOIN public.project_partners pp ON (
                        pp.partner_id = lpc.partner_id 
                        AND pp.project_id = lr.project_id
                        AND pp.chain_id = lr.chain_id  -- 确保合作方属于运单的链路
                    )
                    WHERE lpc.logistics_record_id = v.id
                )
            ) ORDER BY v.loading_date DESC
        ), '[]'::jsonb)
    )
    INTO result_json
    FROM public.logistics_records_view v
    JOIN public.logistics_records lr ON v.id = lr.id
    WHERE v.id = ANY(p_record_ids);

    RETURN result_json;
END;
$$;

COMMENT ON FUNCTION public.get_payment_request_data_v2_1124 IS '获取付款申请数据（v2_1124版本），根据运单的chain_id过滤合作方成本，确保只返回属于该链路的合作方';

-- ============================================================================
-- 完成
-- ============================================================================

SELECT '✅ get_payment_request_data_v2_1124 函数已创建，已修复按链路过滤合作方成本的问题' AS status;

