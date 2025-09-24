-- 创建处理记录ID数组的开票申请函数
-- 请在Supabase SQL编辑器中执行以下命令

-- 创建专门处理记录ID数组的函数（重命名避免冲突）
CREATE OR REPLACE FUNCTION public.get_invoice_data_by_record_ids(
    p_record_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
                'cargo_type', lr.cargo_type,
                'invoice_status', COALESCE(lr.invoice_status, 'Uninvoiced'),
                'partner_costs', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'partner_id', lpc.partner_id,
                            'partner_name', p.name,
                            'level', lpc.level,
                            'payable_amount', lpc.payable_amount,
                            'full_name', CASE WHEN v_can_view THEN p.full_name ELSE NULL END
                        ) ORDER BY lpc.level
                    ), '[]'::jsonb)
                    FROM public.logistics_partner_costs lpc
                    JOIN public.partners p ON lpc.partner_id = p.id
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
$function$;
