-- ============================================================================
-- 全面检查数据库 RLS 策略
-- ============================================================================
-- 目的：检查所有表的 RLS 策略，确保管理员可以正常执行用户管理操作
-- 特别关注：profiles, user_permissions, user_roles, permission_audit_logs 等表
-- ============================================================================

-- ==========================================
-- 第一步：检查所有权限检查函数
-- ==========================================
SELECT 
    '====== 权限检查函数列表 ======' AS info;

SELECT 
    proname AS function_name,
    pronargs AS arg_count,
    prorettype::regtype AS return_type,
    CASE 
        WHEN provolatile = 'i' THEN 'IMMUTABLE'
        WHEN provolatile = 's' THEN 'STABLE'
        WHEN provolatile = 'v' THEN 'VOLATILE'
    END AS volatility,
    prosecdef AS security_definer
FROM pg_proc
WHERE proname IN ('is_admin', 'is_finance_or_admin', 'is_finance_operator_or_admin', 'can_view_partner')
  AND pronamespace = 'public'::regnamespace
ORDER BY proname;

-- ==========================================
-- 第二步：测试权限检查函数
-- ==========================================
SELECT 
    '====== 测试当前用户权限 ======' AS info;

SELECT 
    auth.uid() AS current_user_id,
    (SELECT email FROM profiles WHERE id = auth.uid()) AS email,
    (SELECT role FROM profiles WHERE id = auth.uid()) AS role,
    is_admin() AS is_admin,
    is_finance_or_admin() AS is_finance_or_admin;

-- ==========================================
-- 第三步：检查核心用户管理表的 RLS 状态
-- ==========================================
SELECT 
    '====== 核心用户管理表 RLS 状态 ======' AS info;

SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = c.relname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_tables t ON t.tablename = c.relname AND t.schemaname = n.nspname
WHERE n.nspname = 'public'
  AND c.relname IN (
    'profiles',
    'user_permissions',
    'user_roles',
    'role_permission_templates',
    'permission_audit_logs',
    'user_projects'
  )
ORDER BY c.relname;

-- ==========================================
-- 第四步：检查 profiles 表的 RLS 策略
-- ==========================================
SELECT 
    '====== profiles 表 RLS 策略 ======' AS info;

SELECT 
    policyname,
    cmd,
    qual AS using_clause,
    with_check AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
ORDER BY cmd, policyname;

-- ==========================================
-- 第五步：检查 user_permissions 表的 RLS 策略
-- ==========================================
SELECT 
    '====== user_permissions 表 RLS 策略 ======' AS info;

SELECT 
    policyname,
    cmd,
    qual AS using_clause,
    with_check AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_permissions'
ORDER BY cmd, policyname;

-- ==========================================
-- 第六步：检查 user_roles 表的 RLS 策略
-- ==========================================
SELECT 
    '====== user_roles 表 RLS 策略 ======' AS info;

SELECT 
    policyname,
    cmd,
    qual AS using_clause,
    with_check AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_roles'
ORDER BY cmd, policyname;

-- ==========================================
-- 第七步：检查 role_permission_templates 表的 RLS 策略
-- ==========================================
SELECT 
    '====== role_permission_templates 表 RLS 策略 ======' AS info;

SELECT 
    policyname,
    cmd,
    qual AS using_clause,
    with_check AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'role_permission_templates'
ORDER BY cmd, policyname;

-- ==========================================
-- 第八步：检查 permission_audit_logs 表的 RLS 策略
-- ==========================================
SELECT 
    '====== permission_audit_logs 表 RLS 策略 ======' AS info;

SELECT 
    policyname,
    cmd,
    qual AS using_clause,
    with_check AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'permission_audit_logs'
ORDER BY cmd, policyname;

-- ==========================================
-- 第九步：检查 user_projects 表的 RLS 策略
-- ==========================================
SELECT 
    '====== user_projects 表 RLS 策略 ======' AS info;

SELECT 
    policyname,
    cmd,
    qual AS using_clause,
    with_check AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_projects'
ORDER BY cmd, policyname;

-- ==========================================
-- 第十步：查找缺少 RLS 策略的表
-- ==========================================
SELECT 
    '====== 已启用 RLS 但缺少策略的表 ======' AS info;

SELECT 
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = n.nspname AND tablename = c.relname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'  -- 只查看普通表
  AND c.relrowsecurity = true  -- RLS 已启用
  AND (SELECT COUNT(*) FROM pg_policies WHERE schemaname = n.nspname AND tablename = c.relname) = 0  -- 没有策略
ORDER BY c.relname;

-- ==========================================
-- 第十一步：查找使用旧式权限检查的策略
-- ==========================================
SELECT 
    '====== 使用 user_roles 表检查权限的策略（可能过时）======' AS info;

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE (
    qual LIKE '%user_roles%'
    OR with_check LIKE '%user_roles%'
)
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- ==========================================
-- 第十二步：检查所有使用 is_admin() 的策略
-- ==========================================
SELECT 
    '====== 使用 is_admin() 函数的 RLS 策略 ======' AS info;

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual LIKE '%is_admin()%' THEN 'USING子句'
        WHEN with_check LIKE '%is_admin()%' THEN 'WITH CHECK子句'
        ELSE '未知'
    END AS usage_location
FROM pg_policies
WHERE (
    qual LIKE '%is_admin()%'
    OR with_check LIKE '%is_admin()%'
)
AND schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ==========================================
-- 第十三步：检查所有使用 is_finance_or_admin() 的策略
-- ==========================================
SELECT 
    '====== 使用 is_finance_or_admin() 函数的 RLS 策略 ======' AS info;

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual LIKE '%is_finance_or_admin()%' THEN 'USING子句'
        WHEN with_check LIKE '%is_finance_or_admin()%' THEN 'WITH CHECK子句'
        ELSE '未知'
    END AS usage_location
FROM pg_policies
WHERE (
    qual LIKE '%is_finance_or_admin()%'
    OR with_check LIKE '%is_finance_or_admin()%'
)
AND schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ==========================================
-- 第十四步：总结报告
-- ==========================================
SELECT 
    '====== RLS 检查总结 ======' AS info;

SELECT 
    '总表数（启用RLS）' AS metric,
    COUNT(*)::TEXT AS value
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true

UNION ALL

SELECT 
    '总策略数' AS metric,
    COUNT(*)::TEXT AS value
FROM pg_policies
WHERE schemaname = 'public'

UNION ALL

SELECT 
    '使用 is_admin() 的策略数' AS metric,
    COUNT(*)::TEXT AS value
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual LIKE '%is_admin()%' OR with_check LIKE '%is_admin()%')

UNION ALL

SELECT 
    '使用 is_finance_or_admin() 的策略数' AS metric,
    COUNT(*)::TEXT AS value
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual LIKE '%is_finance_or_admin()%' OR with_check LIKE '%is_finance_or_admin()%')

UNION ALL

SELECT 
    '缺少策略的表数（RLS已启用）' AS metric,
    COUNT(*)::TEXT AS value
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
  AND (SELECT COUNT(*) FROM pg_policies WHERE schemaname = n.nspname AND tablename = c.relname) = 0;

-- ==========================================
-- 检查完成！
-- ==========================================

