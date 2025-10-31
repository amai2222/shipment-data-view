-- 启用profiles表的RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_service" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

-- 创建宽松的SELECT策略（所有已认证用户可查看）
CREATE POLICY "profiles_select_all" 
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 创建UPDATE策略（用户可更新自己的或admin可更新所有）
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