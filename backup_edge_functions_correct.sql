-- 正确的Supabase Edge函数备份SQL命令
-- 注意：Edge函数不是存储在数据库表中，而是作为独立服务
-- 这些查询用于备份相关的配置和元数据

-- ============================================
-- 1. 备份Edge函数相关的数据库配置
-- ============================================

-- 查看所有自定义函数（可能包含Edge函数相关的逻辑）
SELECT 
    '-- 自定义函数: ' || n.nspname || '.' || p.proname || E'\n' ||
    '-- 创建时间: ' || p.procreatedate || E'\n' ||
    '-- 函数类型: ' || p.prokind || E'\n' ||
    '-- 语言: ' || l.lanname || E'\n' ||
    pg_get_functiondef(p.oid) || ';' || E'\n' ||
    E'\n'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%edge%' OR p.proname LIKE '%function%' OR p.proname LIKE '%webhook%'
ORDER BY p.proname;

-- ============================================
-- 2. 备份Webhook配置（如果存在）
-- ============================================

-- 查看所有触发器（可能包含Edge函数触发器）
SELECT 
    '-- 触发器: ' || t.tgname || ' ON ' || c.relname || E'\n' ||
    '-- 触发时机: ' || t.tgtype || E'\n' ||
    '-- 触发条件: ' || COALESCE(t.tgqual, '无') || E'\n' ||
    pg_get_triggerdef(t.oid) || ';' || E'\n' ||
    E'\n'
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND NOT t.tgisinternal
AND (t.tgname LIKE '%webhook%' OR t.tgname LIKE '%edge%' OR t.tgname LIKE '%function%')
ORDER BY c.relname, t.tgname;

-- ============================================
-- 3. 备份API相关配置
-- ============================================

-- 查看所有视图（可能包含API相关视图）
SELECT 
    '-- 视图: ' || schemaname || '.' || viewname || E'\n' ||
    '-- 创建时间: ' || COALESCE(created::text, '未知') || E'\n' ||
    'CREATE OR REPLACE VIEW ' || schemaname || '.' || viewname || ' AS ' || E'\n' ||
    definition || ';' || E'\n' ||
    E'\n'
FROM pg_views 
WHERE schemaname = 'public' 
AND (viewname LIKE '%api%' OR viewname LIKE '%webhook%' OR viewname LIKE '%edge%')
ORDER BY viewname;

-- ============================================
-- 4. 备份RLS策略（可能影响Edge函数访问）
-- ============================================

-- 查看所有RLS策略
SELECT 
    '-- RLS策略: ' || policyname || ' ON ' || tablename || E'\n' ||
    '-- 命令: ' || cmd || E'\n' ||
    '-- 角色: ' || array_to_string(roles, ', ') || E'\n' ||
    'CREATE POLICY ' || policyname || ' ON ' || schemaname || '.' || tablename || E'\n' ||
    'FOR ' || cmd || E'\n' ||
    'TO ' || array_to_string(roles, ', ') || E'\n' ||
    CASE WHEN qual IS NOT NULL THEN 'USING (' || qual || ')' ELSE '' END || E'\n' ||
    CASE WHEN with_check IS NOT NULL THEN 'WITH CHECK (' || with_check || ')' ELSE '' END || ';' || E'\n' ||
    E'\n'
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- ============================================
-- 5. 备份系统配置
-- ============================================

-- 查看系统配置
SELECT 
    '-- 系统配置信息' || E'\n' ||
    '-- 数据库版本: ' || version() || E'\n' ||
    '-- 当前时间: ' || NOW() || E'\n' ||
    '-- 当前用户: ' || current_user || E'\n' ||
    '-- 当前数据库: ' || current_database() || E'\n' ||
    E'\n';

-- ============================================
-- 6. 生成Edge函数备份说明
-- ============================================

SELECT 
    '-- ============================================' || E'\n' ||
    '-- Supabase Edge函数备份说明' || E'\n' ||
    '-- ============================================' || E'\n' ||
    E'\n' ||
    '-- 重要提示:' || E'\n' ||
    '-- 1. Edge函数不是存储在数据库表中' || E'\n' ||
    '-- 2. 它们作为独立的服务运行' || E'\n' ||
    '-- 3. 备份Edge函数需要使用以下方法:' || E'\n' ||
    E'\n' ||
    '-- 方法一：使用Supabase CLI' || E'\n' ||
    '-- supabase functions list' || E'\n' ||
    '-- supabase functions download <function-name>' || E'\n' ||
    E'\n' ||
    '-- 方法二：从本地文件系统备份' || E'\n' ||
    '-- cp -r supabase/functions/ backup/' || E'\n' ||
    E'\n' ||
    '-- 方法三：使用Supabase Dashboard' || E'\n' ||
    '-- 在Supabase Dashboard的Edge Functions页面查看和下载' || E'\n' ||
    E'\n' ||
    '-- 当前数据库中的相关配置已备份完成' || E'\n' ||
    '-- ============================================';
