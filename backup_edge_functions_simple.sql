-- 简化的Supabase Edge函数备份SQL命令
-- 专门用于备份本地文件系统中的Edge函数
-- 生成时间: 2025-01-16

-- ============================================
-- 1. 查看所有Edge函数
-- ============================================

-- 查看所有Edge函数基本信息
SELECT 
    '-- Edge函数: ' || function_name || E'\n' ||
    '-- 创建时间: ' || created_at || E'\n' ||
    '-- 状态: ' || status || E'\n' ||
    '-- 版本: ' || version || E'\n' ||
    '-- 入口点: ' || entrypoint || E'\n' ||
    E'\n'
FROM supabase_functions.functions
ORDER BY function_name;

-- ============================================
-- 2. 备份Edge函数源代码
-- ============================================

-- 备份所有Edge函数的源代码
SELECT 
    '-- ============================================' || E'\n' ||
    '-- Edge函数: ' || function_name || E'\n' ||
    '-- ============================================' || E'\n' ||
    E'\n' ||
    '-- 函数配置:' || E'\n' ||
    '-- 名称: ' || function_name || E'\n' ||
    '-- 状态: ' || status || E'\n' ||
    '-- 版本: ' || version || E'\n' ||
    '-- 入口点: ' || entrypoint || E'\n' ||
    '-- 验证JWT: ' || COALESCE(verify_jwt::text, 'false') || E'\n' ||
    E'\n' ||
    '-- 源代码:' || E'\n' ||
    COALESCE(source_code, '-- 无源代码') || E'\n' ||
    E'\n' ||
    '-- ============================================' || E'\n' ||
    E'\n'
FROM supabase_functions.functions
ORDER BY function_name;

-- ============================================
-- 3. 生成Edge函数统计
-- ============================================

-- 生成Edge函数统计信息
SELECT 
    '-- Edge函数统计信息' || E'\n' ||
    '-- 总函数数量: ' || COUNT(*) || E'\n' ||
    '-- 活跃函数: ' || COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) || E'\n' ||
    '-- 非活跃函数: ' || COUNT(CASE WHEN status != 'ACTIVE' THEN 1 END) || E'\n' ||
    E'\n' ||
    '-- 函数列表:' || E'\n' ||
    string_agg(
        '--   ' || function_name || ' (v' || version || ', ' || status || ')',
        E'\n'
    ) || E'\n'
FROM supabase_functions.functions;
