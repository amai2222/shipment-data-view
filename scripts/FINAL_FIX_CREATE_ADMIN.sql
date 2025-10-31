-- ============================================================================
-- 最终修复：创建管理员账号
-- 已修复所有语法错误和枚举类型问题
-- ============================================================================

-- 一键执行：复制所有内容，粘贴到Supabase SQL Editor，点击Run
-- ============================================================================

BEGIN;

-- 第1步：删除旧策略
DROP POLICY IF EXISTS "profiles_insert_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_by_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- 第2步：创建INSERT策略
CREATE POLICY "profiles_service_role_insert" 
ON public.profiles
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- 第3步：创建UPDATE策略
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
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  auth.role() = 'service_role'
  OR
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 第4步：创建SELECT策略
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
    WHERE id = auth.uid() AND role IN ('admin', 'finance')
  )
);

-- 第5步：创建DELETE策略
CREATE POLICY "profiles_service_role_delete" 
ON public.profiles
FOR DELETE
USING (
  auth.role() = 'service_role'
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 第6步：确保RLS已启用
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- 验证结果
-- ============================================================================

SELECT '✅ 修复完成！' as message;

SELECT 
  policyname as "策略名称",
  cmd as "操作类型"
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;
