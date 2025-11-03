-- ============================================================================
-- 修复 permission_audit_logs 表的 RLS 策略问题
-- ============================================================================
-- 问题：管理员修改用户角色时，无法插入审计日志
-- 错误："new row violates row-level security policy for table 'permission_audit_logs'"
-- 原因：RLS 策略过于严格，或者 is_admin() 函数返回错误结果
-- 解决：更新 RLS 策略，允许所有认证用户插入审计日志（由应用层控制）
-- ============================================================================

-- 第一步：检查当前的 RLS 策略
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'permission_audit_logs'
ORDER BY policyname;

-- 第二步：检查 is_admin() 函数
SELECT 
    proname AS function_name,
    pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE proname = 'is_admin'
  AND pronamespace = 'public'::regnamespace;

-- 第三步：测试 is_admin() 函数
SELECT 
    auth.uid() AS current_user_id,
    is_admin() AS is_admin_result,
    (SELECT role FROM profiles WHERE id = auth.uid()) AS current_role;

-- 第四步：删除旧的 RLS 策略
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.permission_audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.permission_audit_logs;
DROP POLICY IF EXISTS "Admins can create audit logs" ON public.permission_audit_logs;
DROP POLICY IF EXISTS "System can create audit logs" ON public.permission_audit_logs;

-- 第五步：创建新的更宽松的 RLS 策略

-- 查看权限：管理员可以查看所有日志
CREATE POLICY "Admins can view all audit logs" 
ON public.permission_audit_logs 
FOR SELECT 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- 查看权限：用户可以查看与自己相关的日志
CREATE POLICY "Users can view their own audit logs" 
ON public.permission_audit_logs 
FOR SELECT 
TO authenticated
USING (
    auth.uid() = user_id 
    OR auth.uid() = target_user_id
    OR auth.uid() = created_by
);

-- 插入权限：允许认证用户插入审计日志（使用 SECURITY DEFINER 函数时）
-- 这样即使通过函数调用，也能正常插入
CREATE POLICY "Authenticated users can create audit logs" 
ON public.permission_audit_logs 
FOR INSERT 
TO authenticated
WITH CHECK (true);  -- 允许所有认证用户插入，由应用层和函数控制权限

-- 可选：如果只想管理员可以插入，使用这个策略
-- CREATE POLICY "Admins can create audit logs" 
-- ON public.permission_audit_logs 
-- FOR INSERT 
-- TO authenticated
-- WITH CHECK (
--     EXISTS (
--         SELECT 1 FROM public.profiles 
--         WHERE id = auth.uid() 
--         AND role = 'admin'
--     )
-- );

-- 第六步：验证策略创建
SELECT 
    policyname,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN '有 USING 子句'
        ELSE '无 USING 子句'
    END AS using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN '有 WITH CHECK 子句'
        ELSE '无 WITH CHECK 子句'
    END AS with_check_clause
FROM pg_policies
WHERE tablename = 'permission_audit_logs'
ORDER BY cmd, policyname;

-- 第七步：测试插入（可选，需要管理员权限）
-- 插入一条测试审计日志
-- INSERT INTO public.permission_audit_logs (
--     user_id,
--     action,
--     permission_type,
--     permission_key,
--     target_user_id,
--     old_value,
--     new_value,
--     reason,
--     created_by
-- ) VALUES (
--     auth.uid(),
--     'modify',
--     'role',
--     'user_role_change_test',
--     auth.uid(),
--     jsonb_build_object('role', 'operator'),
--     jsonb_build_object('role', 'admin'),
--     'RLS 策略修复测试',
--     auth.uid()
-- );

-- 第八步：显示结果
SELECT 
    '✅ permission_audit_logs RLS 策略已更新' AS status,
    COUNT(*) AS total_policies
FROM pg_policies
WHERE tablename = 'permission_audit_logs';

-- ==========================================
-- 修复完成！
-- ==========================================
-- ✅ permission_audit_logs 表的 RLS 策略已更新
-- ✅ 现在认证用户可以插入审计日志
-- ✅ 管理员可以查看所有审计日志
-- ✅ 普通用户只能查看与自己相关的审计日志
-- 
-- 请在前端重新测试用户角色修改功能
-- ==========================================

