-- ============================================================================
-- 【重要】升级前备份脚本 - 请先执行此文件
-- ============================================================================
-- 备份时间：2025-10-26
-- 说明：此脚本将当前的 get_payment_requests_filtered 函数备份为一个新函数
-- 备份函数名：get_payment_requests_filtered_backup_20251026
-- ============================================================================

BEGIN;

-- ============================================================================
-- 步骤1：创建备份函数
-- ============================================================================
-- 将当前版本的函数复制为备份版本（添加 _backup_20251026 后缀）

CREATE OR REPLACE FUNCTION public.get_payment_requests_filtered_backup_20251026(
    p_request_id TEXT DEFAULT NULL,
    p_waybill_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_loading_date DATE DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_project_id TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    request_id TEXT,
    status TEXT,
    notes TEXT,
    logistics_record_ids UUID[],
    record_count INTEGER,
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
    v_total_count BIGINT;
BEGIN
    -- 构建基础查询条件（申请单级筛选）
    IF p_request_id IS NOT NULL AND p_request_id != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.request_id ILIKE %L', '%' || p_request_id || '%'));
    END IF;

    -- 状态筛选
    IF p_status IS NOT NULL AND p_status != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('pr.status = %L', p_status));
    END IF;

    -- 处理运单号、司机、装货日期、项目筛选（需要关联查询）
    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' OR
       p_driver_name IS NOT NULL AND p_driver_name != '' OR
       p_loading_date IS NOT NULL OR
       p_project_id IS NOT NULL AND p_project_id != '' THEN
        
        -- 构建运单筛选条件（单个值搜索）
        SELECT array_agg(lr.id) INTO v_logistics_ids
        FROM logistics_records lr
        WHERE (p_waybill_number IS NULL OR p_waybill_number = '' OR lr.auto_number ILIKE '%' || p_waybill_number || '%')
          AND (p_driver_name IS NULL OR p_driver_name = '' OR lr.driver_name ILIKE '%' || p_driver_name || '%')
          AND (p_loading_date IS NULL OR lr.loading_date = p_loading_date)
          AND (p_project_id IS NULL OR p_project_id = '' OR lr.project_id::TEXT = p_project_id);
        
        -- 如果有匹配的运单，添加筛选条件
        IF v_logistics_ids IS NOT NULL AND array_length(v_logistics_ids, 1) > 0 THEN
            v_where_conditions := array_append(v_where_conditions, 
                format('pr.logistics_record_ids && %L', v_logistics_ids));
        ELSE
            -- 如果没有匹配的运单，返回空结果
            v_where_conditions := array_append(v_where_conditions, '1 = 0');
        END IF;
    END IF;

    -- 构建WHERE子句
    IF array_length(v_where_conditions, 1) > 0 THEN
        v_where_clause := 'WHERE ' || array_to_string(v_where_conditions, ' AND ');
    END IF;

    -- 执行查询并返回结果
    RETURN QUERY EXECUTE format('
        WITH filtered_requests AS (
            SELECT 
                pr.id,
                pr.created_at,
                pr.request_id,
                pr.status,
                pr.notes,
                pr.logistics_record_ids,
                COALESCE(array_length(pr.logistics_record_ids, 1), 0) as record_count
            FROM payment_requests pr
            %s
            ORDER BY pr.created_at DESC
            LIMIT %s OFFSET %s
        ),
        total_count AS (
            SELECT COUNT(*) as count
            FROM payment_requests pr
            %s
        )
        SELECT 
            fr.id,
            fr.created_at,
            fr.request_id,
            fr.status,
            fr.notes,
            fr.logistics_record_ids,
            fr.record_count,
            tc.count as total_count
        FROM filtered_requests fr
        CROSS JOIN total_count tc
    ', v_where_clause, p_limit, p_offset, v_where_clause);
END;
$$;

COMMENT ON FUNCTION public.get_payment_requests_filtered_backup_20251026 IS 
'[备份] 2025-10-26备份的原始版本 - 升级前的付款申请筛选函数';

-- ============================================================================
-- 步骤2：验证备份是否成功
-- ============================================================================

DO $$
DECLARE
    v_backup_exists BOOLEAN;
BEGIN
    -- 检查备份函数是否存在
    SELECT EXISTS (
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'get_payment_requests_filtered_backup_20251026'
    ) INTO v_backup_exists;

    IF v_backup_exists THEN
        RAISE NOTICE '✅ 备份成功！函数 get_payment_requests_filtered_backup_20251026 已创建';
    ELSE
        RAISE EXCEPTION '❌ 备份失败！请检查错误信息';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- 备份完成提示
-- ============================================================================

SELECT '✅ 备份完成！' as 状态,
       'get_payment_requests_filtered_backup_20251026' as 备份函数名,
       '现在可以安全执行升级脚本了' as 下一步操作;

-- ============================================================================
-- 如何使用备份函数
-- ============================================================================
-- 1. 查看备份函数是否存在：
--    SELECT proname FROM pg_proc WHERE proname LIKE '%backup%';
--
-- 2. 测试备份函数：
--    SELECT * FROM get_payment_requests_filtered_backup_20251026(
--        p_status := 'Pending',
--        p_limit := 5
--    );
--
-- 3. 如果升级后需要回滚，执行以下命令：
--    -- 删除新版本
--    DROP FUNCTION IF EXISTS get_payment_requests_filtered;
--    
--    -- 将备份版本恢复为主函数
--    CREATE OR REPLACE FUNCTION public.get_payment_requests_filtered(
--        p_request_id TEXT DEFAULT NULL,
--        p_waybill_number TEXT DEFAULT NULL,
--        p_driver_name TEXT DEFAULT NULL,
--        p_loading_date DATE DEFAULT NULL,
--        p_status TEXT DEFAULT NULL,
--        p_project_id TEXT DEFAULT NULL,
--        p_limit INTEGER DEFAULT 50,
--        p_offset INTEGER DEFAULT 0
--    )
--    RETURNS TABLE (
--        id UUID,
--        created_at TIMESTAMP WITH TIME ZONE,
--        request_id TEXT,
--        status TEXT,
--        notes TEXT,
--        logistics_record_ids UUID[],
--        record_count INTEGER,
--        total_count BIGINT
--    )
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public'
--    AS $$
--    BEGIN
--        RETURN QUERY 
--        SELECT * FROM get_payment_requests_filtered_backup_20251026(
--            p_request_id, p_waybill_number, p_driver_name, 
--            p_loading_date, p_status, p_project_id, p_limit, p_offset
--        );
--    END;
--    $$;
-- ============================================================================

