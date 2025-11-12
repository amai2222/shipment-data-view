-- ============================================================================
-- 为 get_invoice_requests_filtered 函数添加两个新字段
-- 1. loading_date_range: 运单装货日期范围（最早日期 - 最晚日期）
-- 2. total_payable_cost: 司机应收合计（所有运单的payable_cost总和）
-- ============================================================================

BEGIN;

-- 先删除所有版本的 get_invoice_requests_filtered 函数
DO $$
DECLARE
    v_func_oid oid;
BEGIN
    FOR v_func_oid IN 
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'get_invoice_requests_filtered'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || v_func_oid::regprocedure || ' CASCADE';
        RAISE NOTICE '删除函数: %', v_func_oid::regprocedure;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_invoice_requests_filtered(
    p_request_number TEXT DEFAULT NULL,
    p_waybill_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_loading_date DATE DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_project_id TEXT DEFAULT NULL,
    p_license_plate TEXT DEFAULT NULL,
    p_phone_number TEXT DEFAULT NULL,
    p_platform_name TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    request_number TEXT,
    invoicing_partner_id UUID,
    partner_id UUID,
    partner_name TEXT,
    partner_full_name TEXT,
    invoicing_partner_full_name TEXT,
    invoicing_partner_tax_number TEXT,
    tax_number TEXT,
    invoice_number TEXT,
    total_amount NUMERIC,
    record_count INTEGER,
    status TEXT,
    created_by UUID,
    remarks TEXT,
    loading_date_range TEXT,        -- ✅ 新增：运单装货日期范围
    total_payable_cost NUMERIC,     -- ✅ 新增：司机应收合计
    total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_where_conditions TEXT[] := '{}';
    v_where_clause TEXT := '';
    v_logistics_ids UUID[];
    v_waybill_numbers TEXT[];
    v_driver_names TEXT[];
    v_license_plates TEXT[];
    v_phone_numbers TEXT[];
BEGIN
    -- 构建基础查询条件（针对invoice_requests表）
    
    -- 开票申请单号筛选（支持批量）
    IF p_request_number IS NOT NULL AND p_request_number != '' THEN
        v_waybill_numbers := regexp_split_to_array(trim(p_request_number), '[,\s]+');
        v_waybill_numbers := array_remove(v_waybill_numbers, '');
        
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM unnest(%L::text[]) AS req_num WHERE ir.request_number ILIKE ''%%'' || req_num || ''%%'')', v_waybill_numbers));
    END IF;

    -- 状态筛选
    IF p_status IS NOT NULL AND p_status != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('ir.status = %L', p_status));
    END IF;

    -- 处理需要关联logistics_records的筛选条件
    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' OR
       p_driver_name IS NOT NULL AND p_driver_name != '' OR
       p_loading_date IS NOT NULL OR
       p_project_id IS NOT NULL AND p_project_id != '' OR
       p_license_plate IS NOT NULL AND p_license_plate != '' OR
       p_phone_number IS NOT NULL AND p_phone_number != '' OR
       p_platform_name IS NOT NULL AND p_platform_name != '' THEN
        
        -- 解析批量输入参数（支持逗号、空格或混合分隔）
        IF p_waybill_number IS NOT NULL AND p_waybill_number != '' THEN
            v_waybill_numbers := regexp_split_to_array(trim(p_waybill_number), '[,\s]+');
            v_waybill_numbers := array_remove(v_waybill_numbers, '');
        END IF;
        
        IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
            v_driver_names := regexp_split_to_array(trim(p_driver_name), '[,\s]+');
            v_driver_names := array_remove(v_driver_names, '');
        END IF;
        
        IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
            v_license_plates := regexp_split_to_array(trim(p_license_plate), '[,\s]+');
            v_license_plates := array_remove(v_license_plates, '');
        END IF;
        
        IF p_phone_number IS NOT NULL AND p_phone_number != '' THEN
            v_phone_numbers := regexp_split_to_array(trim(p_phone_number), '[,\s]+');
            v_phone_numbers := array_remove(v_phone_numbers, '');
        END IF;
        
        -- 查询符合条件的logistics_records ID
        SELECT array_agg(DISTINCT lr.id) INTO v_logistics_ids
        FROM logistics_records lr
        WHERE 
            -- 运单编号筛选（支持批量，查询本平台和其他平台运单号）
            (v_waybill_numbers IS NULL OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_waybill_numbers) AS wb
                 WHERE lr.auto_number ILIKE '%' || wb || '%'
                    OR EXISTS (
                        SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext
                        WHERE ext ILIKE '%' || wb || '%'
                    )
             )) AND
            -- 司机姓名筛选（支持批量）
            (v_driver_names IS NULL OR 
             EXISTS (SELECT 1 FROM unnest(v_driver_names) AS dr WHERE lr.driver_name ILIKE '%' || dr || '%')) AND
            -- 装货日期筛选（使用UTC日期范围查询）
            -- ✅ 修复：确保日期参数正确转换为DATE类型，然后转换为timestamptz
            -- 使用 ::date 转换，确保只提取日期部分，忽略任何时间信息
            (p_loading_date IS NULL OR 
             (lr.loading_date >= ((p_loading_date::date)::text || ' 00:00:00+00:00')::timestamptz 
              AND lr.loading_date < (((p_loading_date::date) + INTERVAL '1 day')::date::text || ' 00:00:00+00:00')::timestamptz)) AND
            -- 项目筛选
            (p_project_id IS NULL OR p_project_id = '' OR lr.project_id::text = p_project_id) AND
            -- 车牌号筛选（支持批量）
            (v_license_plates IS NULL OR 
             EXISTS (SELECT 1 FROM unnest(v_license_plates) AS lp WHERE lr.license_plate ILIKE '%' || lp || '%')) AND
            -- 电话筛选（支持批量）
            (v_phone_numbers IS NULL OR 
             EXISTS (SELECT 1 FROM unnest(v_phone_numbers) AS ph WHERE lr.driver_phone ILIKE '%' || ph || '%')) AND
            -- 平台筛选
            (p_platform_name IS NULL OR 
             p_platform_name = '本平台' AND lr.external_tracking_numbers IS NULL OR
             EXISTS (
               SELECT 1 FROM unnest(lr.other_platform_names) AS platform
               WHERE platform = p_platform_name
             ));

        -- 如果查询到符合条件的运单ID，添加到WHERE条件
        IF v_logistics_ids IS NOT NULL AND array_length(v_logistics_ids, 1) > 0 THEN
            v_where_conditions := array_append(v_where_conditions, 
                format('EXISTS (SELECT 1 FROM invoice_request_details ird WHERE ird.invoice_request_id = ir.id AND ird.logistics_record_id = ANY(%L))', v_logistics_ids));
        ELSE
            -- 如果没有匹配的运单，返回空结果
            v_where_conditions := array_append(v_where_conditions, '1 = 0');
        END IF;
    END IF;

    -- 合并WHERE条件
    IF array_length(v_where_conditions, 1) > 0 THEN
        v_where_clause := 'WHERE ' || array_to_string(v_where_conditions, ' AND ');
    END IF;

    -- 执行查询并返回结果
    RETURN QUERY EXECUTE format('
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
                ir.record_count,
                ir.status,
                ir.created_by,
                ir.remarks
            FROM invoice_requests ir
            %s
            ORDER BY ir.created_at DESC
            LIMIT %s OFFSET %s
        ),
        -- ✅ 新增：计算每个申请单的装货日期范围和司机应收合计
        request_stats AS (
            SELECT 
                fr.id,
                -- 装货日期范围：最早日期 - 最晚日期
                -- ✅ 规范：后端返回UTC日期，前端负责转换为中国时区显示
                -- 使用 (loading_date AT TIME ZONE ''UTC'')::date 提取UTC日期部分
                CASE 
                    WHEN (MIN(lr.loading_date) AT TIME ZONE ''UTC'')::date = (MAX(lr.loading_date) AT TIME ZONE ''UTC'')::date THEN
                        -- 如果所有运单都是同一天，只显示一个日期（UTC日期）
                        TO_CHAR((MIN(lr.loading_date) AT TIME ZONE ''UTC'')::date, ''YYYY-MM-DD'')
                    ELSE
                        -- 如果有多个日期，显示范围（UTC日期）
                        TO_CHAR((MIN(lr.loading_date) AT TIME ZONE ''UTC'')::date, ''YYYY-MM-DD'') || '' ~ '' || TO_CHAR((MAX(lr.loading_date) AT TIME ZONE ''UTC'')::date, ''YYYY-MM-DD'')
                END AS loading_date_range,
                -- 司机应收合计：所有运单的payable_cost总和
                COALESCE(SUM(lr.payable_cost), 0) AS total_payable_cost
            FROM filtered_requests fr
            INNER JOIN invoice_request_details ird ON ird.invoice_request_id = fr.id
            INNER JOIN logistics_records lr ON lr.id = ird.logistics_record_id
            GROUP BY fr.id
        ),
        total_count AS (
            SELECT COUNT(*) as count
            FROM invoice_requests ir
            %s
        )
        SELECT 
            fr.id,
            fr.created_at,
            fr.request_number,
            fr.invoicing_partner_id,
            fr.partner_id,
            fr.partner_name,
            fr.partner_full_name,
            fr.invoicing_partner_full_name,
            fr.invoicing_partner_tax_number,
            fr.tax_number,
            fr.invoice_number,
            fr.total_amount,
            fr.record_count,
            fr.status,
            fr.created_by,
            fr.remarks,
            COALESCE(rs.loading_date_range, ''-'') AS loading_date_range,      -- ✅ 新增字段
            COALESCE(rs.total_payable_cost, 0) AS total_payable_cost,          -- ✅ 新增字段
            tc.count as total_count
        FROM filtered_requests fr
        LEFT JOIN request_stats rs ON rs.id = fr.id
        CROSS JOIN total_count tc
    ', v_where_clause, p_limit, p_offset, v_where_clause);
END;
$$;

COMMENT ON FUNCTION public.get_invoice_requests_filtered IS '
开票申请单筛选查询函数（已添加装货日期范围和司机应收合计）
- 新增字段：
  1. loading_date_range: 运单装货日期范围（格式：YYYY-MM-DD 或 YYYY-MM-DD ~ YYYY-MM-DD）
  2. total_payable_cost: 司机应收合计（所有运单的payable_cost总和）
- 单日查询使用UTC日期范围查询，确保时区一致性
- 不再依赖PostgreSQL会话时区设置
';

COMMIT;

