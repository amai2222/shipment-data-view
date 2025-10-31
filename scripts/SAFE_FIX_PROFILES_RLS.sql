-- 安全修复：先删除所有策略，再重新创建

BEGIN;

-- 删除所有可能存在的profiles表策略
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_service" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_service_role" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_delete" ON public.profiles;

-- 创建新的策略集

-- SELECT：允许所有已认证用户查看
CREATE POLICY "profiles_select_all" 
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- INSERT：允许service_role插入
CREATE POLICY "profiles_insert_service" 
ON public.profiles
FOR INSERT
TO service_role
WITH CHECK (true);

-- UPDATE：用户可以更新自己，admin可以更新所有
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

-- DELETE：只有admin可以删除
CREATE POLICY "profiles_delete_policy" 
ON public.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 确保RLS启用
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

COMMIT;

-- 验证结果
SELECT 
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

