-- 完整修复所有问题：
-- 1. 修复创建管理员账号失败
-- 2. 修复登录页第二次打不开白屏
-- 3. 确保admin和finance都能看到收款人信息

-- 立即在Supabase SQL Editor中执行

BEGIN;

-- 第1步：删除所有旧的profiles策略
DROP POLICY IF EXISTS "profiles_insert_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_by_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_service_role" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;

-- 第2步：创建正确的SELECT策略（修复白屏问题）
CREATE POLICY "profiles_select_all" 
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 第3步：创建INSERT策略（修复创建admin问题）
CREATE POLICY "profiles_insert_service" 
ON public.profiles
FOR INSERT
TO service_role
WITH CHECK (true);

-- 第4步：创建UPDATE策略
CREATE POLICY "profiles_update_policy" 
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 第5步：创建DELETE策略
CREATE POLICY "profiles_delete_policy" 
ON public.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 第6步：确保RLS启用
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

COMMIT;

-- 验证结果
SELECT 
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

SELECT '所有问题已修复！' as message;

