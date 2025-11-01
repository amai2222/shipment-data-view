-- ============================================================================
-- 验证 role_permission_templates 表的 RLS 策略
-- ============================================================================

-- 1. 检查 RLS 是否启用
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ 已启用'
        ELSE '❌ 未启用'
    END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'role_permission_templates';

-- 2. 检查所有 RLS 策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command_type,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'role_permission_templates'
ORDER BY policyname;

-- 3. 检查策略数量
SELECT 
    COUNT(*) as total_policies,
    COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) as select_policies,
    COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) as insert_policies,
    COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) as update_policies,
    COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) as delete_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'role_permission_templates';

-- 4. 测试当前用户的权限（需要替换为实际用户ID）
SELECT 
    auth.uid() as current_user_id,
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    ) as is_admin;

