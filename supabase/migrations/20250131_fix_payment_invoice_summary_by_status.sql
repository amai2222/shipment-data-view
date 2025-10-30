-- ============================================================
-- 修复付款和开票申请的合计计算逻辑
-- ============================================================
-- 问题：筛选"已申请支付"或"开票中"时，底部合计显示为¥0.00
-- 原因：合计计算只统计Unpaid/Uninvoiced状态，不跟随筛选条件
-- 解决：合计计算应该跟随筛选的payment_status/invoice_status
-- ============================================================

BEGIN;

-- ============================================================
-- 先删除所有旧版本的函数（解决函数重载冲突）
-- ============================================================
DO $$
DECLARE
    v_func_oid oid;
BEGIN
    -- 删除所有版本的 get_payment_request_data
    FOR v_func_oid IN 
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'get_payment_request_data'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || v_func_oid::regprocedure || ' CASCADE';
        RAISE NOTICE '删除旧版本函数: %', v_func_oid::regprocedure;
    END LOOP;
    
    -- 删除所有版本的 get_invoice_request_data
    FOR v_func_oid IN 
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'get_invoice_request_data'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || v_func_oid::regprocedure || ' CASCADE';
        RAISE NOTICE '删除旧版本函数: %', v_func_oid::regprocedure;
    END LOOP;
    
    RAISE NOTICE '旧版本函数删除完成，准备创建新版本...';
END $$;

-- ============================================================
-- 1. 修复付款申请数据函数的合计计算
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_payment_request_data(
    -- 常规筛选参数
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date date DEFAULT NULL::date, 
    p_end_date date DEFAULT NULL::date, 
    p_payment_status_array text[] DEFAULT NULL::text[],
    
    -- 高级筛选参数
    p_partner_id uuid DEFAULT NULL::uuid,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL,
    
    -- 分页参数
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
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
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

    -- 主查询逻辑（保持原有筛选逻辑不变）
    WITH filtered_records AS (
        SELECT DISTINCT
            lr.*,
            pc.chain_name
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE 1=1
            AND (p_project_id IS NULL OR lr.project_id = p_project_id)
            AND (p_start_date IS NULL OR lr.loading_date >= p_start_date)
            AND (p_end_date IS NULL OR lr.loading_date <= p_end_date)
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
            ORDER BY lr.auto_number DESC
            LIMIT p_page_size
            OFFSET v_offset
    ),
    total_count AS (
        SELECT COUNT(DISTINCT lr.id) AS count
        FROM public.logistics_records lr
        WHERE 1=1
            AND (p_project_id IS NULL OR lr.project_id = p_project_id)
            AND (p_start_date IS NULL OR lr.loading_date >= p_start_date)
            AND (p_end_date IS NULL OR lr.loading_date <= p_end_date)
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
                  -- ✅ 修复：根据筛选条件决定统计哪些状态
                  AND (
                    p_payment_status_array IS NULL  -- 如果没有筛选，只统计未支付
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

COMMENT ON FUNCTION public.get_payment_request_data IS '
获取付款申请数据（支持批量查询和筛选）
✅ 修复：合计计算现在跟随payment_status筛选条件
- 筛选"未支付" → 只统计未支付的合计
- 筛选"已申请支付" → 只统计已申请支付的合计  
- 筛选"已完成支付" → 只统计已完成支付的合计
- 没有筛选 → 统计所有状态的合计
';

-- ============================================================
-- 2. 修复开票申请数据函数的合计计算
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_invoice_request_data(
    p_project_id uuid DEFAULT NULL::uuid,
    p_start_date date DEFAULT NULL::date,
    p_end_date date DEFAULT NULL::date,
    p_partner_id uuid DEFAULT NULL::uuid,
    p_invoice_status_array text[] DEFAULT NULL::text[],
    p_page_size integer DEFAULT 50,
    p_page_number integer DEFAULT 1,
    p_waybill_numbers text DEFAULT NULL,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL,
    p_driver_receivable text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json json;
    v_offset integer;
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 解析批量输入
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

    WITH filtered_records AS (
        SELECT DISTINCT
            lr.*,
            pc.chain_name
        FROM logistics_records lr
        LEFT JOIN partner_chains pc ON lr.chain_id = pc.id
        WHERE 1=1
            AND (p_project_id IS NULL OR lr.project_id = p_project_id)
            AND (p_start_date IS NULL OR lr.loading_date >= p_start_date)
            AND (p_end_date IS NULL OR lr.loading_date <= p_end_date)
            AND (p_invoice_status_array IS NULL OR lr.invoice_status = ANY(p_invoice_status_array))
            AND (p_driver_receivable IS NULL OR 
                (p_driver_receivable = '>0' AND lr.payable_cost > 0) OR
                (p_driver_receivable = '=0' AND (lr.payable_cost IS NULL OR lr.payable_cost = 0)) OR
                (p_driver_receivable = '<0' AND lr.payable_cost < 0)
            )
            AND (p_other_platform_name IS NULL OR 
                (p_other_platform_name = '本平台' AND lr.external_tracking_numbers IS NULL) OR
                p_other_platform_name = ANY(lr.other_platform_names)
            )
            AND (v_waybill_array IS NULL OR (
                lr.auto_number = ANY(v_waybill_array) 
                OR (lr.external_tracking_numbers IS NOT NULL AND lr.external_tracking_numbers && v_waybill_array)
            ))
            AND (v_driver_array IS NULL OR EXISTS (
                SELECT 1 FROM drivers d WHERE d.id = lr.driver_id AND d.name = ANY(v_driver_array)
            ))
            AND (v_license_array IS NULL OR lr.license_plate = ANY(v_license_array))
            AND (v_phone_array IS NULL OR lr.driver_phone = ANY(v_phone_array))
        ORDER BY lr.auto_number DESC
        LIMIT p_page_size
        OFFSET v_offset
    ),
    total_invoiceable_cost AS (
        SELECT COALESCE(SUM(payable_cost), 0) AS total FROM filtered_records
    )
    SELECT json_build_object(
        'overview', json_build_object(
            'total_invoiceable_cost', (SELECT total FROM total_invoiceable_cost)
        ),
        'partners', (
            SELECT COALESCE(json_agg(t), '[]'::json) FROM (
                SELECT 
                    lpc.partner_id, 
                    p.name AS partner_name, 
                    COUNT(DISTINCT lpc.logistics_record_id) AS records_count,
                    SUM(lpc.payable_amount) AS total_payable
                FROM logistics_partner_costs lpc
                JOIN partners p ON lpc.partner_id = p.id
                JOIN filtered_records fr ON lpc.logistics_record_id = fr.id
                -- ✅ 修复：根据筛选条件决定统计哪些状态
                WHERE (
                    p_invoice_status_array IS NULL  -- 如果没有筛选，只统计未开票
                    OR (
                      CASE 
                        WHEN 'Uninvoiced' = ANY(p_invoice_status_array) THEN lpc.invoice_status = 'Uninvoiced'
                        WHEN 'Processing' = ANY(p_invoice_status_array) THEN lpc.invoice_status = 'Processing'
                        WHEN 'Invoiced' = ANY(p_invoice_status_array) THEN lpc.invoice_status = 'Invoiced'
                        ELSE lpc.invoice_status = 'Uninvoiced'
                      END
                    )
                  )
                GROUP BY lpc.partner_id, p.name
            ) t
        ),
        'records', COALESCE((
            SELECT json_agg(
                json_build_object(
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
                    'remarks', r.remarks,
                    'chain_name', r.chain_name,
                    'chain_id', r.chain_id,
                    'partner_costs', (
                        SELECT COALESCE(json_agg(
                            json_build_object(
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
                        ), '[]'::json)
                        FROM logistics_partner_costs lpc
                        JOIN partners p ON lpc.partner_id = p.id
                        LEFT JOIN partner_bank_details pbd ON p.id = pbd.partner_id
                        WHERE lpc.logistics_record_id = r.id
                    )
                ) ORDER BY r.auto_number DESC
            )
            FROM filtered_records r
        ), '[]'::json)
    ) INTO result_json;

    RETURN result_json;
END;
$function$;

COMMENT ON FUNCTION public.get_invoice_request_data IS '
获取开票申请数据（支持批量查询和筛选）
✅ 修复：合计计算现在跟随invoice_status筛选条件
- 筛选"未开票" → 只统计未开票的合计
- 筛选"开票中" → 只统计开票中的合计  
- 筛选"已开票" → 只统计已开票的合计
- 没有筛选 → 统计所有状态的合计
';

COMMIT;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 付款和开票合计计算已修复';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '1. 付款申请合计现在跟随payment_status筛选';
    RAISE NOTICE '   - 筛选"已申请支付" → 统计已申请支付的合计';
    RAISE NOTICE '   - 筛选"已完成支付" → 统计已完成支付的合计';
    RAISE NOTICE '';
    RAISE NOTICE '2. 开票申请合计现在跟随invoice_status筛选';
    RAISE NOTICE '   - 筛选"开票中" → 统计开票中的合计';
    RAISE NOTICE '   - 筛选"已开票" → 统计已开票的合计';
    RAISE NOTICE '';
    RAISE NOTICE '修复前：筛选非默认状态时，合计显示¥0.00';
    RAISE NOTICE '修复后：合计跟随筛选条件，正确显示金额';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

