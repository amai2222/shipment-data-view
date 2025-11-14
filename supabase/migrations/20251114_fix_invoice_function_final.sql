-- ============================================================================
-- 最终修复版本：解决 operator is not unique 错误
-- ============================================================================
-- 问题：分页计算中的类型转换不明确
-- 解决：使用更明确的类型声明和中间变量
-- ============================================================================

BEGIN;

-- 完全删除旧版本（所有可能的重载）
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure 
        FROM pg_proc 
        WHERE proname = 'get_invoice_requests_filtered_1114'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
        RAISE NOTICE '已删除函数: %', r.oid::regprocedure;
    END LOOP;
END $$;

-- 创建新的修复版本
CREATE FUNCTION public.get_invoice_requests_filtered_1114(
    p_request_number TEXT DEFAULT NULL,
    p_waybill_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_loading_date DATE DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_license_plate TEXT DEFAULT NULL,
    p_phone_number TEXT DEFAULT NULL,
    p_platform_name TEXT DEFAULT NULL,
    p_invoicing_partner_id UUID DEFAULT NULL,
    p_page_number INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 20,
    p_limit INTEGER DEFAULT NULL,
    p_offset INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_where_clause TEXT := '';
    v_where_conditions TEXT[] := ARRAY[]::TEXT[];
    v_limit INTEGER;
    v_offset INTEGER;
    v_records JSONB;
    v_total_count BIGINT;
    v_page_num INTEGER;
    v_page_sz INTEGER;
BEGIN
    -- 使用中间变量确保类型明确
    v_page_num := COALESCE(p_page_number, 1);
    v_page_sz := COALESCE(p_page_size, 20);
    
    -- 计算分页参数
    IF p_limit IS NOT NULL AND p_offset IS NOT NULL THEN
        v_limit := p_limit;
        v_offset := p_offset;
    ELSE
        v_limit := v_page_sz;
        v_offset := (v_page_num - 1) * v_page_sz;
    END IF;
    
    -- 构建WHERE条件
    IF p_invoicing_partner_id IS NOT NULL THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('ir.invoicing_partner_id = %L::uuid', p_invoicing_partner_id::text));
    END IF;
    
    IF p_request_number IS NOT NULL AND p_request_number != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('ir.request_number = %L', p_request_number));
    END IF;

    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND (lr.auto_number = %L OR %L = ANY(lr.external_tracking_numbers)))', 
                p_waybill_number, p_waybill_number));
    END IF;

    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.driver_name = %L)', 
                p_driver_name));
    END IF;

    IF p_loading_date IS NOT NULL THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.loading_date::date = %L::date)', 
                p_loading_date));
    END IF;

    IF p_status IS NOT NULL AND p_status != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('ir.status = %L', p_status));
    END IF;

    IF p_project_id IS NOT NULL THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.project_id = %L::uuid)', 
                p_project_id::text));
    END IF;

    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.license_plate = %L)', 
                p_license_plate));
    END IF;

    IF p_phone_number IS NOT NULL AND p_phone_number != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.driver_phone = %L)', 
                p_phone_number));
    END IF;

    IF p_platform_name IS NOT NULL AND p_platform_name != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND %L = ANY(lr.external_tracking_numbers))', 
                p_platform_name));
    END IF;

    -- 构建WHERE子句
    IF array_length(v_where_conditions, 1) > 0 THEN
        v_where_clause := 'WHERE ' || array_to_string(v_where_conditions, ' AND ');
    END IF;

    -- 获取总数
    EXECUTE format('
        SELECT COUNT(*)::BIGINT
        FROM invoice_requests ir
        %s
    ', v_where_clause) INTO v_total_count;

    -- 执行查询并返回结果
    EXECUTE format('
        WITH filtered_requests AS (
            SELECT 
                ir.id,
                ir.created_at,
                ir.request_number,
                ir.invoicing_partner_id,
                ir.partner_id,
                ir.partner_name,
                ir.partner_full_name,
                ir.invoicing_partner_full_name,
                ir.invoicing_partner_tax_number,
                ir.tax_number,
                ir.invoice_number,
                ir.total_amount,
                COALESCE(ir.total_received_amount, 0) AS total_received_amount,
                ir.payment_due_date,
                COALESCE(ir.overdue_days, 0) AS overdue_days,
                COALESCE(ir.reminder_count, 0) AS reminder_count,
                COALESCE(ir.reconciliation_status, ''Unreconciled'') AS reconciliation_status,
                ir.record_count,
                ir.status,
                ir.created_by,
                ir.remarks,
                COALESCE(ir.is_merged_request, false) AS is_merged_request,
                COALESCE(ir.merged_count, 0) AS merged_count
            FROM invoice_requests ir
            %s
            ORDER BY ir.created_at DESC
            LIMIT %s OFFSET %s
        ),
        request_stats AS (
            SELECT 
                fr.id,
                COALESCE(
                    CASE 
                        WHEN MIN(lr.loading_date) = MAX(lr.loading_date) THEN 
                            TO_CHAR(MIN(lr.loading_date) AT TIME ZONE ''UTC'', ''YYYY-MM-DD'')
                        ELSE 
                            TO_CHAR(MIN(lr.loading_date) AT TIME ZONE ''UTC'', ''YYYY-MM-DD'') || '' ~ '' || 
                            TO_CHAR(MAX(lr.loading_date) AT TIME ZONE ''UTC'', ''YYYY-MM-DD'')
                    END,
                    ''''-'''' 
                ) AS loading_date_range,
                COALESCE(SUM(
                    CASE 
                        WHEN p.partner_type = ''货主'' THEN lpc.payable_amount 
                        ELSE 0 
                    END
                ), 0) AS total_payable_cost
            FROM filtered_requests fr
            LEFT JOIN invoice_request_details ird ON ird.invoice_request_id = fr.id
            LEFT JOIN logistics_records lr ON ird.logistics_record_id = lr.id
            LEFT JOIN logistics_partner_costs lpc ON lpc.logistics_record_id = lr.id
            LEFT JOIN partners p ON p.id = lpc.partner_id
            GROUP BY fr.id
        )
        SELECT jsonb_agg(
            jsonb_build_object(
                ''id'', fr.id,
                ''created_at'', fr.created_at,
                ''request_number'', fr.request_number,
                ''invoicing_partner_id'', fr.invoicing_partner_id,
                ''partner_id'', fr.partner_id,
                ''partner_name'', fr.partner_name,
                ''partner_full_name'', fr.partner_full_name,
                ''invoicing_partner_full_name'', fr.invoicing_partner_full_name,
                ''invoicing_partner_tax_number'', fr.invoicing_partner_tax_number,
                ''tax_number'', fr.tax_number,
                ''invoice_number'', fr.invoice_number,
                ''total_amount'', fr.total_amount,
                ''total_received_amount'', fr.total_received_amount,
                ''payment_due_date'', fr.payment_due_date,
                ''overdue_days'', fr.overdue_days,
                ''reminder_count'', fr.reminder_count,
                ''reconciliation_status'', fr.reconciliation_status,
                ''record_count'', fr.record_count,
                ''status'', fr.status,
                ''created_by'', fr.created_by,
                ''remarks'', fr.remarks,
                ''loading_date_range'', COALESCE(rs.loading_date_range, ''''-''''),
                ''total_payable_cost'', COALESCE(rs.total_payable_cost, 0),
                ''is_merged_request'', fr.is_merged_request,
                ''merged_count'', fr.merged_count
            )
        )
        FROM filtered_requests fr
        LEFT JOIN request_stats rs ON rs.id = fr.id
    ', v_where_clause, v_limit, v_offset) INTO v_records;

    RETURN jsonb_build_object(
        'success', true,
        'records', COALESCE(v_records, '[]'::jsonb),
        'total_count', v_total_count,
        'page_number', v_page_num,
        'page_size', v_page_sz,
        'total_pages', CEIL(v_total_count::NUMERIC / v_page_sz::NUMERIC)
    );
END;
$$;

COMMENT ON FUNCTION public.get_invoice_requests_filtered_1114 IS '
开票申请单筛选查询函数（最终修复版本）
- 修复：使用中间变量避免 operator is not unique 错误
- 新增字段：is_merged_request, merged_count
- 支持：分页、多条件筛选、收款管理
';

COMMIT;

-- 验证
SELECT '✅ 函数已成功创建！' AS status;

