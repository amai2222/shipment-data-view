-- ============================================================================
-- 修复创建管理员用户失败的问题
-- 错误：Edge Function returned a non-2xx status code
-- ============================================================================

-- 问题分析：
-- Edge Function 调用 supabaseAdmin.auth.admin.createUser() 和
-- supabaseAdmin.from('profiles').upsert() 时可能被RLS策略阻止

-- ============================================================================
-- 解决方案：确保service_role可以向profiles表插入任何角色的用户
-- ============================================================================

BEGIN;

-- 第1步：检查现有的INSERT策略
SELECT 
  '📋 检查现有INSERT策略' as step,
  policyname,
  cmd,
  with_check as check_expression
FROM pg_policies
WHERE tablename = 'profiles' AND cmd = 'INSERT';

-- 第2步：删除可能限制admin创建的旧策略
-- ============================================================================

DO $$
BEGIN
  -- 删除所有可能限制的INSERT策略
  DROP POLICY IF EXISTS "profiles_insert_restricted" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_insert_by_admin_only" ON public.profiles;  
  DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
  DROP POLICY IF EXISTS "restrict_admin_creation" ON public.profiles;
  
  RAISE NOTICE '✅ 已删除旧的限制性策略';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ 删除旧策略时出错（可能策略不存在）: %', SQLERRM;
END $$;

-- 第3步：创建新的宽松INSERT策略
-- ============================================================================

-- 先删除同名策略（如果存在），然后创建新策略
DROP POLICY IF EXISTS "profiles_service_role_insert" ON public.profiles;

CREATE POLICY "profiles_service_role_insert" 
ON public.profiles
FOR INSERT
WITH CHECK (
  -- service_role（Edge Function使用）可以插入任何记录
  auth.role() = 'service_role'
);

COMMENT ON POLICY "profiles_service_role_insert" ON public.profiles IS 
  '允许Edge Function（使用service_role）创建任何角色的用户，包括admin';

-- 第4步：确保profiles表启用了RLS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 第5步：创建UPDATE策略（Edge Function可能需要更新）
-- ============================================================================

DROP POLICY IF EXISTS "profiles_service_role_update" ON public.profiles;

CREATE POLICY "profiles_service_role_update" 
ON public.profiles
FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
  )
)
WITH CHECK (
  auth.role() = 'service_role'
  OR
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
  )
);

COMMENT ON POLICY "profiles_service_role_update" ON public.profiles IS 
  '允许service_role、用户自己、或管理员更新profiles';

-- 第6步：创建SELECT策略（确保查询不受影响）
-- ============================================================================

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

CREATE POLICY "profiles_select_policy" 
ON public.profiles
FOR SELECT
USING (
  auth.role() = 'service_role'
  OR
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'system_admin', 'finance')
  )
);

COMMENT ON POLICY "profiles_select_policy" ON public.profiles IS 
  '允许查看：service_role、自己、或admin/finance查看所有';

-- 第7步：创建DELETE策略
-- ============================================================================

DROP POLICY IF EXISTS "profiles_service_role_delete" ON public.profiles;

CREATE POLICY "profiles_service_role_delete" 
ON public.profiles
FOR DELETE
USING (
  auth.role() = 'service_role'
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
  )
);

COMMENT ON POLICY "profiles_service_role_delete" ON public.profiles IS 
  '允许service_role或管理员删除用户';

COMMIT;

-- ============================================================================
-- 验证修复结果
-- ============================================================================

SELECT 
  '✅ 修复完成 - 查看更新后的策略' as status;

SELECT 
  policyname as "策略名称",
  cmd as "操作类型",
  CASE 
    WHEN cmd = 'SELECT' THEN '✅ 查询'
    WHEN cmd = 'INSERT' THEN '✅ 插入（修复的关键）'
    WHEN cmd = 'UPDATE' THEN '✅ 更新'
    WHEN cmd = 'DELETE' THEN '✅ 删除'
  END as "操作说明"
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- ============================================================================
-- 测试说明
-- ============================================================================

/*
执行此脚本后，请进行以下测试：

1. 清除浏览器缓存
2. 刷新用户管理页面
3. 尝试创建新的管理员账号：
   - 邮箱：test-admin@example.com
   - 姓名：测试管理员
   - 角色：系统管理员
   - 密码：Test123456

4. 如果仍然失败，查看：
   - 浏览器控制台的错误信息
   - Supabase Dashboard → Edge Functions → create-user → Logs
   - 查看具体的错误详情

5. 常见错误：
   - "role is invalid" → 检查role字段的值
   - "permission denied" → RLS策略问题（此脚本已修复）
   - "duplicate key" → 邮箱已存在
   - "violates check constraint" → 检查表约束
*/

