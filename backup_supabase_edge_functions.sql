-- Supabase Edge函数备份SQL命令
-- 可以直接在Supabase SQL编辑器中运行
-- 生成时间: 2025-01-16

-- ============================================
-- 1. 备份所有Edge函数定义
-- ============================================

-- 查看所有Edge函数
SELECT 
    '-- Edge函数: ' || function_name || E'\n' ||
    '-- 创建时间: ' || created_at || E'\n' ||
    '-- 更新时间: ' || updated_at || E'\n' ||
    '-- 状态: ' || status || E'\n' ||
    '-- 版本: ' || version || E'\n' ||
    '-- 入口点: ' || entrypoint || E'\n' ||
    '-- 验证器: ' || COALESCE(verify_jwt::text, 'NULL') || E'\n' ||
    '-- 导入映射: ' || COALESCE(import_map::text, 'NULL') || E'\n' ||
    '-- 代码:' || E'\n' ||
    COALESCE(source_code, '-- 无源代码') || E'\n' ||
    E'\n' || '-- ============================================' || E'\n'
FROM supabase_functions.functions
ORDER BY function_name;

-- ============================================
-- 2. 备份Edge函数配置信息
-- ============================================

-- 查看Edge函数配置详情
SELECT 
    '-- Edge函数配置信息' || E'\n' ||
    '-- 函数名: ' || function_name || E'\n' ||
    '-- 项目ID: ' || project_id || E'\n' ||
    '-- 函数ID: ' || id || E'\n' ||
    '-- 创建时间: ' || created_at || E'\n' ||
    '-- 更新时间: ' || updated_at || E'\n' ||
    '-- 状态: ' || status || E'\n' ||
    '-- 版本: ' || version || E'\n' ||
    '-- 入口点: ' || entrypoint || E'\n' ||
    '-- 验证JWT: ' || COALESCE(verify_jwt::text, 'NULL') || E'\n' ||
    '-- 导入映射: ' || COALESCE(import_map::text, 'NULL') || E'\n' ||
    '-- 源代码长度: ' || COALESCE(length(source_code)::text, '0') || ' 字符' || E'\n' ||
    E'\n'
FROM supabase_functions.functions
ORDER BY function_name;

-- ============================================
-- 3. 备份Edge函数部署历史
-- ============================================

-- 查看Edge函数部署历史（如果存在相关表）
SELECT 
    '-- Edge函数部署历史' || E'\n' ||
    '-- 函数名: ' || function_name || E'\n' ||
    '-- 部署时间: ' || deployed_at || E'\n' ||
    '-- 版本: ' || version || E'\n' ||
    '-- 状态: ' || status || E'\n' ||
    E'\n'
FROM supabase_functions.deployments
ORDER BY function_name, deployed_at DESC;

-- ============================================
-- 4. 备份Edge函数日志配置
-- ============================================

-- 查看Edge函数日志配置
SELECT 
    '-- Edge函数日志配置' || E'\n' ||
    '-- 函数名: ' || function_name || E'\n' ||
    '-- 日志级别: ' || COALESCE(log_level, 'default') || E'\n' ||
    '-- 保留天数: ' || COALESCE(retention_days::text, 'default') || E'\n' ||
    E'\n'
FROM supabase_functions.log_configs
ORDER BY function_name;

-- ============================================
-- 5. 生成Edge函数恢复脚本
-- ============================================

-- 生成Edge函数恢复脚本
SELECT 
    '-- 恢复Edge函数: ' || function_name || E'\n' ||
    '-- 使用以下命令恢复函数:' || E'\n' ||
    '-- supabase functions deploy ' || function_name || E'\n' ||
    '-- 或者使用SQL:' || E'\n' ||
    'INSERT INTO supabase_functions.functions (' || E'\n' ||
    '    function_name, project_id, status, version, entrypoint, verify_jwt, import_map, source_code' || E'\n' ||
    ') VALUES (' || E'\n' ||
    '    ''' || function_name || ''',' || E'\n' ||
    '    ''' || project_id || ''',' || E'\n' ||
    '    ''' || status || ''',' || E'\n' ||
    '    ' || version || ',' || E'\n' ||
    '    ''' || entrypoint || ''',' || E'\n' ||
    '    ' || COALESCE(verify_jwt::text, 'NULL') || ',' || E'\n' ||
    '    ' || COALESCE('''' || import_map::text || '''', 'NULL') || ',' || E'\n' ||
    '    ' || COALESCE('''' || replace(source_code, '''', '''''') || '''', 'NULL') || E'\n' ||
    ');' || E'\n' ||
    E'\n'
FROM supabase_functions.functions
ORDER BY function_name;

-- ============================================
-- 6. 备份Edge函数统计信息
-- ============================================

-- 查看Edge函数统计信息
SELECT 
    '-- Edge函数统计信息' || E'\n' ||
    '-- 总函数数量: ' || COUNT(*) || E'\n' ||
    '-- 活跃函数数量: ' || COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) || E'\n' ||
    '-- 非活跃函数数量: ' || COUNT(CASE WHEN status != 'ACTIVE' THEN 1 END) || E'\n' ||
    '-- 最新版本统计:' || E'\n' ||
    string_agg(
        '--   ' || function_name || ': v' || version || ' (' || status || ')',
        E'\n'
    ) || E'\n' ||
    E'\n'
FROM supabase_functions.functions
ORDER BY function_name;

-- ============================================
-- 7. 备份Edge函数依赖关系
-- ============================================

-- 查看Edge函数依赖关系（如果存在相关表）
SELECT 
    '-- Edge函数依赖关系' || E'\n' ||
    '-- 主函数: ' || main_function || E'\n' ||
    '-- 依赖函数: ' || dependency_function || E'\n' ||
    '-- 依赖类型: ' || dependency_type || E'\n' ||
    E'\n'
FROM supabase_functions.dependencies
ORDER BY main_function, dependency_function;

-- ============================================
-- 8. 生成完整的Edge函数备份报告
-- ============================================

-- 生成完整的备份报告
SELECT 
    '-- ============================================' || E'\n' ||
    '-- Supabase Edge函数完整备份报告' || E'\n' ||
    '-- 生成时间: ' || NOW() || E'\n' ||
    '-- ============================================' || E'\n' ||
    E'\n' ||
    '-- 1. 函数列表:' || E'\n' ||
    string_agg(
        '--   - ' || function_name || ' (v' || version || ', ' || status || ')',
        E'\n'
    ) || E'\n' ||
    E'\n' ||
    '-- 2. 总统计:' || E'\n' ||
    '--   总函数数量: ' || COUNT(*) || E'\n' ||
    '--   活跃函数: ' || COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) || E'\n' ||
    '--   非活跃函数: ' || COUNT(CASE WHEN status != 'ACTIVE' THEN 1 END) || E'\n' ||
    E'\n' ||
    '-- 3. 备份完成时间: ' || NOW() || E'\n' ||
    '-- ============================================'
FROM supabase_functions.functions;
