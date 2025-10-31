-- 修复profiles表RLS策略，允许创建管理员账号
-- 直接在Supabase SQL Editor中执行

BEGIN;

-- 删除旧策略
DROP POLICY IF EXISTS "profiles_insert_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_by_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- 创建INSERT策略
CREATE POLICY "profiles_service_role_insert" 
ON public.profiles
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- 创建UPDATE策略
CREATE POLICY "profiles_service_role_update" 
ON public.profiles
FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  auth.role() = 'service_role'
  OR id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 创建SELECT策略
CREATE POLICY "profiles_select_policy" 
ON public.profiles
FOR SELECT
USING (
  auth.role() = 'service_role'
  OR id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'finance'))
);

-- 创建DELETE策略
CREATE POLICY "profiles_service_role_delete" 
ON public.profiles
FOR DELETE
USING (
  auth.role() = 'service_role'
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 确保RLS启用
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

COMMIT;

-- 验证
SELECT 
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

