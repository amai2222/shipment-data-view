-- 最终修复：创建管理员账号
-- 纯SQL，无任何Markdown标记

BEGIN;

DROP POLICY IF EXISTS "profiles_insert_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_by_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

CREATE POLICY "profiles_service_role_insert" 
ON public.profiles
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

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

CREATE POLICY "profiles_select_policy" 
ON public.profiles
FOR SELECT
USING (
  auth.role() = 'service_role'
  OR id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'finance'))
);

CREATE POLICY "profiles_service_role_delete" 
ON public.profiles
FOR DELETE
USING (
  auth.role() = 'service_role'
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

COMMIT;

SELECT '修复完成，现在可以创建管理员了' as message;
