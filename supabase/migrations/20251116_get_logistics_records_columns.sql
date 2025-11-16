-- ============================================================================
-- 获取 logistics_records 表列信息的函数
-- 创建日期：2025-11-16
-- 功能：用于模板管理功能，从数据库动态读取表列信息
-- ============================================================================

-- 创建函数：获取 logistics_records 表的列信息
CREATE OR REPLACE FUNCTION get_logistics_records_columns()
RETURNS TABLE (
    column_name TEXT,
    data_type TEXT,
    is_nullable TEXT,
    table_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.column_name::TEXT,
        c.data_type::TEXT,
        c.is_nullable::TEXT,
        c.table_name::TEXT
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
        AND c.table_name = 'logistics_records'
    ORDER BY c.ordinal_position;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION get_logistics_records_columns() IS '获取 logistics_records 表的列信息，用于模板管理功能显示数据库列名';

-- 授予权限
GRANT EXECUTE ON FUNCTION get_logistics_records_columns() TO authenticated;

