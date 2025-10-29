-- ============================================================
-- 修复 get_invoice_requests_filtered 函数
-- ============================================================
-- 问题：RPC函数没有返回 partner_full_name 字段，导致PDF显示"未知合作方"
-- 解决：添加 partner_full_name 到返回字段列表
-- ============================================================

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
    p_request_number TEXT DEFAULT NULL,       -- 开票申请单号
    p_waybill_number TEXT DEFAULT NULL,       -- 运单编号（支持批量）
    p_driver_name TEXT DEFAULT NULL,          -- 司机姓名（支持批量）
    p_loading_date DATE DEFAULT NULL,         -- 装货日期
    p_status TEXT DEFAULT NULL,               -- 开票状态
    p_project_id TEXT DEFAULT NULL,           -- 项目ID
    p_license_plate TEXT DEFAULT NULL,        -- 车牌号（支持批量）
    p_phone_number TEXT DEFAULT NULL,         -- 电话号码（支持批量）
    p_platform_name TEXT DEFAULT NULL,        -- 平台名称
    p_limit INTEGER DEFAULT 50,               -- 分页限制
    p_offset INTEGER DEFAULT 0                -- 分页偏移
)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    request_number TEXT,
    invoicing_partner_id UUID,  -- ✅ 添加（关键！用于查询税号）
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
        -- 解析批量输入
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
               SELECT 1 FROM unnest(v_waybill_numbers) AS wb_num
               WHERE lr.auto_number ILIKE '%' || wb_num || '%'
                  OR EXISTS (
                       SELECT 1 FROM unnest(lr.external_tracking_numbers) AS ext_num
                       WHERE ext_num ILIKE '%' || wb_num || '%'
                     )
             ))
            -- 司机姓名筛选（支持批量）
            AND (v_driver_names IS NULL OR 
                 EXISTS (
                   SELECT 1 FROM unnest(v_driver_names) AS driver
                   WHERE lr.driver_name ILIKE '%' || driver || '%'
                 ))
            -- 装货日期筛选
            AND (p_loading_date IS NULL OR lr.loading_date = p_loading_date)
            -- 项目筛选
            AND (p_project_id IS NULL OR lr.project_id::text = p_project_id)
            -- 车牌号筛选（支持批量）
            AND (v_license_plates IS NULL OR 
                 EXISTS (
                   SELECT 1 FROM unnest(v_license_plates) AS plate
                   WHERE lr.license_plate ILIKE '%' || plate || '%'
                 ))
            -- 电话号码筛选（支持批量）
            AND (v_phone_numbers IS NULL OR 
                 EXISTS (
                   SELECT 1 FROM unnest(v_phone_numbers) AS phone
                   WHERE lr.driver_phone ILIKE '%' || phone || '%'
                 ))
            -- 平台名称筛选
            AND (p_platform_name IS NULL OR 
                 p_platform_name = '本平台' AND lr.external_tracking_numbers IS NULL OR
                 EXISTS (
                   SELECT 1 FROM unnest(lr.other_platform_names) AS platform
                   WHERE platform = p_platform_name
                 ));

        -- 如果查询到符合条件的运单ID，添加到WHERE条件
        IF v_logistics_ids IS NOT NULL AND array_length(v_logistics_ids, 1) > 0 THEN
            -- 获取包含这些运单的开票申请单ID
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
                ir.invoicing_partner_id,  -- ✅ 添加（关键！）
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
        total_count AS (
            SELECT COUNT(*) as count
            FROM invoice_requests ir
            %s
        )
        SELECT 
            fr.id,
            fr.created_at,
            fr.request_number,
            fr.invoicing_partner_id,  -- ✅ 添加（关键！）
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
            tc.count as total_count
        FROM filtered_requests fr
        CROSS JOIN total_count tc
    ', v_where_clause, p_limit, p_offset, v_where_clause);
END;
$$;

COMMENT ON FUNCTION public.get_invoice_requests_filtered IS '
开票申请单筛选查询函数，支持多维度筛选
- 支持批量查询（逗号、空格或混合分隔，OR逻辑）：开票申请单号、运单编号、司机姓名、车牌号、电话号码
- 批量输入示例："张三,李四" 或 "张三 李四" 或 "张三, 李四"
- 运单编号查询范围：本平台运单号(auto_number) + 其他平台运单号(external_tracking_numbers)
- 支持平台名称筛选：本平台 或 其他平台名称(other_platform_names)
- 返回字段包含：partner_name, partner_full_name, invoicing_partner_full_name 三个合作方名称字段
';

GRANT EXECUTE ON FUNCTION public.get_invoice_requests_filtered TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_requests_filtered TO anon;

COMMIT;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ get_invoice_requests_filtered 函数已更新';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '修复内容：';
    RAISE NOTICE '- 添加了 partner_full_name 字段到返回结果';
    RAISE NOTICE '- 现在返回三个合作方名称字段：';
    RAISE NOTICE '  1. partner_name';
    RAISE NOTICE '  2. partner_full_name';
    RAISE NOTICE '  3. invoicing_partner_full_name';
    RAISE NOTICE '';
    RAISE NOTICE '这样前端可以优先使用这些字段来显示合作方名称';
    RAISE NOTICE '========================================';
END $$;

