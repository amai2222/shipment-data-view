-- ============================================================================
-- 完全重建函数：彻底解决 operator is not unique 错误
-- ============================================================================
-- 执行前请确认：这将删除所有相关函数并重新创建
-- ============================================================================

-- 第一步：彻底清理所有版本的函数
DO $$ 
DECLARE
    func_signature TEXT;
BEGIN
    -- 查找并删除所有 get_invoice_requests_filtered_1114 函数
    FOR func_signature IN 
        SELECT pg_get_functiondef(oid)
        FROM pg_proc 
        WHERE proname = 'get_invoice_requests_filtered_1114'
          AND pronamespace = 'public'::regnamespace
    LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS public.get_invoice_requests_filtered_1114 CASCADE';
            RAISE NOTICE '✓ 已删除函数';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '清理时出错: %', SQLERRM;
        END;
    END LOOP;
END $$;

-- 等待一下确保清理完成
SELECT pg_sleep(0.5);

-- 第二步：创建新的正确版本
CREATE OR REPLACE FUNCTION public.get_invoice_requests_filtered_1114(
    p_request_number TEXT,
    p_waybill_number TEXT,
    p_driver_name TEXT,
    p_loading_date DATE,
    p_status TEXT,
    p_project_id UUID,
    p_license_plate TEXT,
    p_phone_number TEXT,
    p_platform_name TEXT,
    p_invoicing_partner_id UUID,
    p_page_number INTEGER,
    p_page_size INTEGER,
    p_limit INTEGER,
    p_offset INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_where_clause TEXT := '';
    v_where_conditions TEXT[] := '{}';
    v_limit INTEGER;
    v_offset INTEGER;
    v_records JSONB;
    v_total_count BIGINT;
    v_page_num INTEGER := 1;
    v_page_sz INTEGER := 20;
BEGIN
    -- 安全地处理分页参数
    IF p_page_number IS NOT NULL THEN
        v_page_num := p_page_number;
    END IF;
    
    IF p_page_size IS NOT NULL THEN
        v_page_sz := p_page_size;
    END IF;
    
    -- 计算分页
    IF p_limit IS NOT NULL AND p_offset IS NOT NULL THEN
        v_limit := p_limit;
        v_offset := p_offset;
    ELSE
        v_limit := v_page_sz;
        -- 明确使用已定义的 INTEGER 变量进行计算
        v_offset := (v_page_num - 1) * v_page_sz;
    END IF;
    
    -- 构建WHERE条件
    IF p_invoicing_partner_id IS NOT NULL THEN
        v_where_conditions := array_append(v_where_conditions, 
            'ir.invoicing_partner_id = ''' || p_invoicing_partner_id::text || '''::uuid');
    END IF;
    
    IF p_request_number IS NOT NULL AND p_request_number != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            'ir.request_number = ''' || p_request_number || '''');
    END IF;

    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            'EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND (lr.auto_number = ''' || p_waybill_number || ''' OR ''' || p_waybill_number || ''' = ANY(lr.external_tracking_numbers)))');
    END IF;

    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            'EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.driver_name = ''' || p_driver_name || ''')');
    END IF;

    IF p_loading_date IS NOT NULL THEN
        v_where_conditions := array_append(v_where_conditions, 
            'EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.loading_date::date = ''' || p_loading_date || '''::date)');
    END IF;

    IF p_status IS NOT NULL AND p_status != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            'ir.status = ''' || p_status || '''');
    END IF;

    IF p_project_id IS NOT NULL THEN
        v_where_conditions := array_append(v_where_conditions, 
            'EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.project_id = ''' || p_project_id::text || '''::uuid)');
    END IF;

    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            'EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.license_plate = ''' || p_license_plate || ''')');
    END IF;

    IF p_phone_number IS NOT NULL AND p_phone_number != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            'EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.driver_phone = ''' || p_phone_number || ''')');
    END IF;

    IF p_platform_name IS NOT NULL AND p_platform_name != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            'EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND ''' || p_platform_name || ''' = ANY(lr.external_tracking_numbers))');
    END IF;

    -- 构建WHERE子句
    IF array_length(v_where_conditions, 1) > 0 THEN
        v_where_clause := 'WHERE ' || array_to_string(v_where_conditions, ' AND ');
    END IF;

    -- 获取总数
    EXECUTE 'SELECT COUNT(*)::BIGINT FROM invoice_requests ir ' || v_where_clause 
        INTO v_total_count;

    -- 执行查询
    EXECUTE '
        WITH filtered_requests AS (
            SELECT 
                ir.id, ir.created_at, ir.request_number,
                ir.invoicing_partner_id, ir.partner_id, ir.partner_name,
                ir.partner_full_name, ir.invoicing_partner_full_name,
                ir.invoicing_partner_tax_number, ir.tax_number, ir.invoice_number,
                ir.total_amount,
                COALESCE(ir.total_received_amount, 0) AS total_received_amount,
                ir.payment_due_date,
                COALESCE(ir.overdue_days, 0) AS overdue_days,
                COALESCE(ir.reminder_count, 0) AS reminder_count,
                COALESCE(ir.reconciliation_status, ''Unreconciled'') AS reconciliation_status,
                ir.record_count, ir.status, ir.created_by, ir.remarks,
                COALESCE(ir.is_merged_request, false) AS is_merged_request,
                COALESCE(ir.merged_count, 0) AS merged_count
            FROM invoice_requests ir
            ' || v_where_clause || '
            ORDER BY ir.created_at DESC
            LIMIT ' || v_limit || ' OFFSET ' || v_offset || '
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
                    END, ''-''
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
                ''id'', fr.id, ''created_at'', fr.created_at,
                ''request_number'', fr.request_number,
                ''invoicing_partner_id'', fr.invoicing_partner_id,
                ''partner_id'', fr.partner_id, ''partner_name'', fr.partner_name,
                ''partner_full_name'', fr.partner_full_name,
                ''invoicing_partner_full_name'', fr.invoicing_partner_full_name,
                ''invoicing_partner_tax_number'', fr.invoicing_partner_tax_number,
                ''tax_number'', fr.tax_number, ''invoice_number'', fr.invoice_number,
                ''total_amount'', fr.total_amount,
                ''total_received_amount'', fr.total_received_amount,
                ''payment_due_date'', fr.payment_due_date,
                ''overdue_days'', fr.overdue_days,
                ''reminder_count'', fr.reminder_count,
                ''reconciliation_status'', fr.reconciliation_status,
                ''record_count'', fr.record_count, ''status'', fr.status,
                ''created_by'', fr.created_by, ''remarks'', fr.remarks,
                ''loading_date_range'', COALESCE(rs.loading_date_range, ''-''),
                ''total_payable_cost'', COALESCE(rs.total_payable_cost, 0),
                ''is_merged_request'', fr.is_merged_request,
                ''merged_count'', fr.merged_count
            )
        )
        FROM filtered_requests fr
        LEFT JOIN request_stats rs ON rs.id = fr.id'
        INTO v_records;

    RETURN jsonb_build_object(
        'success', true,
        'records', COALESCE(v_records, '[]'::jsonb),
        'total_count', v_total_count,
        'page_number', v_page_num,
        'page_size', v_page_sz,
        'total_pages', CEIL(v_total_count::numeric / v_page_sz::numeric)
    );
END;
$$;

-- 验证函数是否创建成功
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_invoice_requests_filtered_1114'
    ) THEN
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ 函数创建成功！';
        RAISE NOTICE '========================================';
        RAISE NOTICE '';
    ELSE
        RAISE EXCEPTION '❌ 函数创建失败！';
    END IF;
END $$;

