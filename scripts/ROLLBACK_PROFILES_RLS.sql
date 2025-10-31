-- 紧急回滚：恢复profiles表的访问
-- 如果执行RLS修复后网页打不开，立即执行此SQL

BEGIN;

-- 删除刚才创建的严格策略
DROP POLICY IF EXISTS "profiles_service_role_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- 创建宽松的SELECT策略（允许所有已认证用户查看）
CREATE POLICY "profiles_select_all_authenticated" 
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 创建INSERT策略（允许service_role）
CREATE POLICY "profiles_insert_service_role" 
ON public.profiles
FOR INSERT
TO service_role
WITH CHECK (true);

-- 创建UPDATE策略（用户可以更新自己的信息）
CREATE POLICY "profiles_update_own_or_admin" 
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

-- 创建DELETE策略（只有admin可以删除）
CREATE POLICY "profiles_delete_admin_only" 
ON public.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

COMMIT;

SELECT '已回滚，请刷新页面' as message;

