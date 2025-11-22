-- ============================================================================
-- 重命名付款申请相关函数：_1120 → _1122
-- 创建时间: 2025-11-22
-- 说明：将函数后缀从 _1120 改为 _1122，统一版本号
-- ============================================================================

-- ============================================================================
-- 1. 创建 get_payment_request_data_1122（基于 _1120 版本）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_payment_request_data_1122(
    p_project_id text DEFAULT NULL::text,
    p_start_date text DEFAULT NULL::text, 
    p_end_date text DEFAULT NULL::text, 
    p_payment_status_array text[] DEFAULT NULL::text[], 
    p_partner_id uuid DEFAULT NULL::uuid, 
    p_driver_name text DEFAULT NULL::text, 
    p_license_plate text DEFAULT NULL::text, 
    p_driver_phone text DEFAULT NULL::text, 
    p_waybill_numbers text DEFAULT NULL::text, 
    p_other_platform_name text DEFAULT NULL::text, 
    p_page_size integer DEFAULT 50, 
    p_page_number integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json jsonb;
    v_offset integer;
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
    v_project_ids uuid[];
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 解析项目ID（支持逗号分隔的多个UUID）
    IF p_project_id IS NOT NULL AND p_project_id != '' THEN
        v_project_ids := string_to_array(p_project_id, ',')::uuid[];
        -- 移除空值
        v_project_ids := array_remove(v_project_ids, NULL);
    END IF;
    
    -- 解析批量输入参数
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := regexp_split_to_array(trim(p_waybill_numbers), '[,\s]+');
        v_waybill_array := array_remove(v_waybill_array, '');
    END IF;
    
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := regexp_split_to_array(trim(p_driver_name), '[,\s]+');
        v_driver_array := array_remove(v_driver_array, '');
    END IF;
    
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := regexp_split_to_array(trim(p_license_plate), '[,\s]+');
        v_license_array := array_remove(v_license_array, '');
    END IF;
    
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := regexp_split_to_array(trim(p_driver_phone), '[,\s]+');
        v_phone_array := array_remove(v_phone_array, '');
    END IF;

    -- 主查询逻辑
    WITH filtered_records AS (
        SELECT DISTINCT
            lr.*,
            pc.chain_name
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE 1=1
            AND (v_project_ids IS NULL OR array_length(v_project_ids, 1) IS NULL OR lr.project_id = ANY(v_project_ids))
            AND (p_start_date IS NULL OR p_start_date = '' OR 
                 lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz)
            AND (p_end_date IS NULL OR p_end_date = '' OR 
                 lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second'))
            AND (p_payment_status_array IS NULL OR lr.payment_status = ANY(p_payment_status_array))
            AND (p_other_platform_name IS NULL OR 
                (p_other_platform_name = '本平台' AND lr.external_tracking_numbers IS NULL) OR
                p_other_platform_name = ANY(lr.other_platform_names)
            )
            AND (v_waybill_array IS NULL OR (
                lr.auto_number = ANY(v_waybill_array) 
                OR (lr.external_tracking_numbers IS NOT NULL AND lr.external_tracking_numbers && v_waybill_array)
            ))
            AND (v_driver_array IS NULL OR EXISTS (
                SELECT 1 FROM public.drivers d WHERE d.id = lr.driver_id AND d.name = ANY(v_driver_array)
            ))
            AND (v_license_array IS NULL OR lr.license_plate = ANY(v_license_array))
            AND (v_phone_array IS NULL OR lr.driver_phone = ANY(v_phone_array))
            AND (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM public.logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = lr.id AND lpc.partner_id = p_partner_id
            ))
            ORDER BY lr.auto_number DESC
            LIMIT p_page_size
            OFFSET v_offset
    ),
    total_count AS (
        SELECT COUNT(DISTINCT lr.id) AS count
        FROM public.logistics_records lr
        WHERE 1=1
            AND (v_project_ids IS NULL OR array_length(v_project_ids, 1) IS NULL OR lr.project_id = ANY(v_project_ids))
            AND (p_start_date IS NULL OR p_start_date = '' OR 
                 lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz)
            AND (p_end_date IS NULL OR p_end_date = '' OR 
                 lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second'))
            AND (p_payment_status_array IS NULL OR lr.payment_status = ANY(p_payment_status_array))
            AND (p_other_platform_name IS NULL OR 
                (p_other_platform_name = '本平台' AND lr.external_tracking_numbers IS NULL) OR
                p_other_platform_name = ANY(lr.other_platform_names)
            )
            AND (v_waybill_array IS NULL OR (
                lr.auto_number = ANY(v_waybill_array) 
                OR (lr.external_tracking_numbers IS NOT NULL AND lr.external_tracking_numbers && v_waybill_array)
            ))
            AND (v_driver_array IS NULL OR EXISTS (
                SELECT 1 FROM public.drivers d WHERE d.id = lr.driver_id AND d.name = ANY(v_driver_array)
            ))
            AND (v_license_array IS NULL OR lr.license_plate = ANY(v_license_array))
            AND (v_phone_array IS NULL OR lr.driver_phone = ANY(v_phone_array))
            AND (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM public.logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = lr.id AND lpc.partner_id = p_partner_id
            ))
    ),
    total_payable_cost AS (
        SELECT COALESCE(SUM(payable_cost), 0) AS total FROM filtered_records
    )
    SELECT jsonb_build_object(
        'count', (SELECT count FROM total_count),
        'overview', jsonb_build_object(
            'total_payable_cost', (SELECT total FROM total_payable_cost)
        ),
        'partners', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT 
                    lpc.partner_id, 
                    p.name AS partner_name, 
                    p.full_name, 
                    pbd.bank_account, 
                    pbd.bank_name, 
                    pbd.branch_name,
                    COUNT(DISTINCT lpc.logistics_record_id) AS records_count,
                    SUM(lpc.payable_amount) AS total_payable
                FROM public.logistics_partner_costs lpc
                JOIN public.partners p ON lpc.partner_id = p.id
                LEFT JOIN public.partner_bank_details pbd ON p.id = pbd.partner_id
                WHERE lpc.logistics_record_id IN (SELECT id FROM filtered_records)
                  AND (
                    p_payment_status_array IS NULL
                    OR (
                      CASE 
                        WHEN 'Unpaid' = ANY(p_payment_status_array) THEN lpc.payment_status = 'Unpaid'
                        WHEN 'Processing' = ANY(p_payment_status_array) THEN lpc.payment_status = 'Processing'
                        WHEN 'Paid' = ANY(p_payment_status_array) THEN lpc.payment_status = 'Paid'
                        ELSE lpc.payment_status = 'Unpaid'
                      END
                    )
                  )
                GROUP BY lpc.partner_id, p.name, p.full_name, pbd.bank_account, pbd.bank_name, pbd.branch_name
            ) t
        ),
        'records', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', r.id,
                    'auto_number', r.auto_number,
                    'project_name', r.project_name,
                    'driver_name', r.driver_name,
                    'loading_location', r.loading_location,
                    'unloading_location', r.unloading_location,
                    'loading_date', r.loading_date,
                    'unloading_date', r.unloading_date,
                    'license_plate', r.license_plate,
                    'driver_phone', r.driver_phone,
                    'payable_cost', r.payable_cost,
                    'payment_status', r.payment_status,
                    'invoice_status', r.invoice_status,
                    'cargo_type', r.cargo_type,
                    'loading_weight', r.loading_weight,
                    'unloading_weight', r.unloading_weight,
                    'billing_type_id', r.billing_type_id,
                    'remarks', r.remarks,
                    'chain_name', r.chain_name,
                    'chain_id', r.chain_id,
                    'partner_costs', (
                        SELECT COALESCE(jsonb_agg(
                            jsonb_build_object(
                                'partner_id', lpc.partner_id,
                                'partner_name', p.name,
                                'level', lpc.level,
                                'payable_amount', lpc.payable_amount,
                                'payment_status', lpc.payment_status,
                                'invoice_status', lpc.invoice_status,
                                'full_name', p.full_name,
                                'bank_account', pbd.bank_account,
                                'bank_name', pbd.bank_name,
                                'branch_name', pbd.branch_name
                            ) ORDER BY lpc.level
                        ), '[]'::jsonb)
                        FROM public.logistics_partner_costs lpc
                        JOIN public.partners p ON lpc.partner_id = p.id
                        LEFT JOIN public.partner_bank_details pbd ON p.id = pbd.partner_id
                        WHERE lpc.logistics_record_id = r.id
                    )
                ) ORDER BY r.auto_number DESC
            ), '[]'::jsonb)
            FROM filtered_records r
        )
    ) INTO result_json;

    RETURN result_json;
END;
$function$;

COMMENT ON FUNCTION public.get_payment_request_data_1122 IS '获取付款申请数据，支持多个 project_id（逗号分隔的 UUID 字符串）- 1122版本';

-- ============================================================================
-- 2. 创建 get_filtered_unpaid_ids_1122（基于 _1120 版本）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_filtered_unpaid_ids_1122(
    p_project_id text DEFAULT NULL,
    p_start_date date DEFAULT NULL::date,
    p_end_date date DEFAULT NULL::date,
    p_partner_id uuid DEFAULT NULL::uuid,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_ids uuid[];
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
    v_project_ids uuid[];
BEGIN
    -- 解析项目ID（支持逗号分隔的多个UUID）
    IF p_project_id IS NOT NULL AND p_project_id != '' THEN
        v_project_ids := string_to_array(p_project_id, ',')::uuid[];
        -- 移除空值
        v_project_ids := array_remove(v_project_ids, NULL);
    END IF;
    
    -- 解析批量输入参数（支持逗号、空格或混合分隔）
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := regexp_split_to_array(trim(p_waybill_numbers), '[,\s]+');
        v_waybill_array := array_remove(v_waybill_array, '');
    END IF;
    
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := regexp_split_to_array(trim(p_driver_name), '[,\s]+');
        v_driver_array := array_remove(v_driver_array, '');
    END IF;
    
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := regexp_split_to_array(trim(p_license_plate), '[,\s]+');
        v_license_array := array_remove(v_license_array, '');
    END IF;
    
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := regexp_split_to_array(trim(p_driver_phone), '[,\s]+');
        v_phone_array := array_remove(v_phone_array, '');
    END IF;

    SELECT array_agg(DISTINCT v.id)
    INTO result_ids
    FROM public.logistics_records_view v
    JOIN public.logistics_records lr ON v.id = lr.id
    WHERE
        lr.payment_status = 'Unpaid' AND
        (v_project_ids IS NULL OR array_length(v_project_ids, 1) IS NULL OR v.project_id = ANY(v_project_ids)) AND
        (p_start_date IS NULL OR v.loading_date::date >= p_start_date) AND
        (p_end_date IS NULL OR v.loading_date::date <= p_end_date) AND
        (v_waybill_array IS NULL OR EXISTS (
            SELECT 1 FROM unnest(v_waybill_array) AS wb_num
            WHERE v.auto_number ILIKE '%' || wb_num || '%'
               OR EXISTS (
                   SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext_num
                   WHERE ext_num ILIKE '%' || wb_num || '%'
               )
        )) AND
        (v_driver_array IS NULL OR EXISTS (
            SELECT 1 FROM unnest(v_driver_array) AS dr_name
            WHERE v.driver_name ILIKE '%' || dr_name || '%'
        )) AND
        (v_license_array IS NULL OR EXISTS (
            SELECT 1 FROM unnest(v_license_array) AS lp
            WHERE v.license_plate ILIKE '%' || lp || '%'
        )) AND
        (v_phone_array IS NULL OR EXISTS (
            SELECT 1 FROM unnest(v_phone_array) AS phone
            WHERE v.driver_phone ILIKE '%' || phone || '%'
        )) AND
        (p_other_platform_name IS NULL OR p_other_platform_name = '' OR
            CASE 
                WHEN p_other_platform_name = '本平台' THEN 
                    (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                ELSE 
                    EXISTS (
                        SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name
                        WHERE platform_name ILIKE '%' || p_other_platform_name || '%'
                    )
            END
        ) AND
        (p_partner_id IS NULL OR EXISTS (
            SELECT 1 FROM public.logistics_partner_costs lpc
            WHERE lpc.logistics_record_id = v.id 
              AND lpc.partner_id = p_partner_id
              AND lpc.payment_status = 'Unpaid'
        ));

    RETURN COALESCE(result_ids, '{}');
END;
$function$;

COMMENT ON FUNCTION public.get_filtered_unpaid_ids_1122 IS '获取未付款运单ID列表，支持多个 project_id（逗号分隔的 UUID 字符串）- 1122版本';

-- ============================================================================
-- 完成
-- ============================================================================

SELECT '✅ 函数已创建：get_payment_request_data_1122 和 get_filtered_unpaid_ids_1122' AS status;
