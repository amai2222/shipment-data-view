-- ============================================================================
-- 优化开票申请数据函数
-- 日期：2025-11-20
-- 说明：优化查询逻辑，使用 CTE 避免重复查询
-- 注意：索引创建已拆分到 20251120_create_invoice_indexes.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_invoice_request_data_1120(
    p_project_id text DEFAULT NULL::text,  -- ✅ 改为 TEXT，支持逗号分隔的多个 UUID
    p_start_date text DEFAULT NULL::text, 
    p_end_date text DEFAULT NULL::text, 
    p_partner_id uuid DEFAULT NULL::uuid, 
    p_invoice_status_array text[] DEFAULT NULL::text[], 
    p_page_size integer DEFAULT 50, 
    p_page_number integer DEFAULT 1, 
    p_waybill_numbers text DEFAULT NULL::text, 
    p_driver_name text DEFAULT NULL::text, 
    p_license_plate text DEFAULT NULL::text, 
    p_driver_phone text DEFAULT NULL::text, 
    p_other_platform_name text DEFAULT NULL::text, 
    p_driver_receivable text DEFAULT NULL::text
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
    v_project_ids uuid[];  -- ✅ 新增：存储解析后的项目ID数组
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- ✅ 解析项目ID（支持逗号分隔的多个UUID）
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

    -- ✅ 优化：使用单个 base_filtered CTE，避免重复查询
    WITH base_filtered AS (
        -- 基础筛选条件（只查询一次，获取符合条件的记录ID）
        SELECT DISTINCT lr.id
        FROM public.logistics_records lr
        WHERE 1=1
            -- ✅ 修改：支持多个项目ID
            AND (v_project_ids IS NULL OR array_length(v_project_ids, 1) IS NULL OR lr.project_id = ANY(v_project_ids))
            -- ✅ 使用 +08:00 时区转换
            AND (p_start_date IS NULL OR p_start_date = '' OR 
                 lr.loading_date >= (p_start_date || ' 00:00:00+08:00')::timestamptz)
            AND (p_end_date IS NULL OR p_end_date = '' OR 
                 lr.loading_date < ((p_end_date || ' 23:59:59+08:00')::timestamptz + INTERVAL '1 second'))
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
                SELECT 1 FROM public.drivers d WHERE d.id = lr.driver_id AND d.name = ANY(v_driver_array)
            ))
            AND (v_license_array IS NULL OR lr.license_plate = ANY(v_license_array))
            AND (v_phone_array IS NULL OR lr.driver_phone = ANY(v_phone_array))
            AND (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM public.logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = lr.id 
                  AND lpc.partner_id = p_partner_id
            ))
    ),
    filtered_records AS (
        -- ✅ 优化：只查询需要的字段，减少数据传输
        SELECT 
            lr.id,
            lr.auto_number,
            lr.project_id,
            lr.project_name,
            lr.chain_id,
            COALESCE(pc.chain_name, '') as chain_name,
            lr.driver_id,
            lr.driver_name,
            lr.loading_location,
            lr.unloading_location,
            lr.loading_date,
            lr.unloading_date,
            lr.loading_weight,
            lr.unloading_weight,
            lr.payable_cost,
            lr.license_plate,
            lr.driver_phone,
            lr.payment_status,
            lr.invoice_status,
            lr.cargo_type,
            lr.remarks
        FROM public.logistics_records lr
        INNER JOIN base_filtered bf ON lr.id = bf.id
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        ORDER BY lr.auto_number DESC
        LIMIT p_page_size OFFSET v_offset
    ),
    total_count AS (
        -- ✅ 优化：直接使用 base_filtered，避免重复查询
        SELECT COUNT(*) as count FROM base_filtered
    ),
    total_invoiceable_cost AS (
        -- ✅ 优化：使用 base_filtered，只计算一次
        SELECT COALESCE(SUM(lr.payable_cost), 0) AS total
        FROM public.logistics_records lr
        INNER JOIN base_filtered bf ON lr.id = bf.id
    ),
    partners_data AS (
        -- ✅ 优化：使用 base_filtered，避免重复 JOIN
        SELECT 
            lpc.partner_id, 
            p.name AS partner_name, 
            COUNT(DISTINCT lpc.logistics_record_id) AS records_count,
            SUM(lpc.payable_amount) AS total_payable
        FROM public.logistics_partner_costs lpc
        INNER JOIN base_filtered bf ON lpc.logistics_record_id = bf.id
        JOIN public.partners p ON lpc.partner_id = p.id
        WHERE (
            p_invoice_status_array IS NULL
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
    )
    SELECT jsonb_build_object(
        'count', (SELECT count FROM total_count),
        'overview', jsonb_build_object(
            'total_invoiceable_cost', (SELECT total FROM total_invoiceable_cost)
        ),
        'partners', (
            SELECT COALESCE(jsonb_agg(pd), '[]'::jsonb)
            FROM partners_data pd
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
                                'branch_name', pbd.branch_name,
                                'tax_number', p.tax_number,
                                'company_address', p.company_address
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

COMMENT ON FUNCTION public.get_invoice_request_data_1120 IS 
'优化的开票申请数据查询函数（1120版本）
- 支持多项目ID筛选（逗号分隔）
- 使用 CTE 优化查询性能，避免重复查询
- 支持批量筛选运单号、司机、车牌号等
- 添加了必要的索引以提升查询速度';

-- ============================================================================
-- 函数创建完成
-- ============================================================================
-- 
-- ✅ get_invoice_request_data_1120 函数创建成功
-- 
-- 优化内容：
--   1. 使用base_filtered CTE避免重复查询
--   2. 优化JOIN顺序和字段选择
--   3. 支持多项目ID筛选
-- 
-- 注意：请单独执行 20251120_create_invoice_indexes.sql 创建索引

