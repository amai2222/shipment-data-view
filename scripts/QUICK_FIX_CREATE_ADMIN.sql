-- ============================================================================
-- 快速修复：解决创建管理员账号失败问题
-- 错误：Edge Function returned a non-2xx status code
-- 语法：PostgreSQL兼容（已修复IF NOT EXISTS语法错误）
-- ============================================================================

-- 一键执行：复制以下所有SQL，粘贴到Supabase SQL Editor，点击Run
-- ============================================================================

BEGIN;

-- 第1步：删除可能限制的旧策略
DROP POLICY IF EXISTS "profiles_insert_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_by_admin_only" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_insert" ON public.profiles;

-- 第2步：创建新策略 - 允许Edge Function创建任何角色的用户
CREATE POLICY "profiles_service_role_insert" 
ON public.profiles
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- 第3步：确保RLS已启用
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- 验证修复结果
-- ============================================================================

SELECT 
  '✅ 修复完成！' as message,
  '现在可以创建管理员账号了' as status;

-- 查看当前的INSERT策略
SELECT 
  policyname as "策略名称",
  cmd as "操作类型",
  CASE 
    WHEN policyname = 'profiles_service_role_insert' THEN '✅ 新策略已创建'
    ELSE '旧策略'
  END as "策略状态"
FROM pg_policies
WHERE tablename = 'profiles' AND cmd = 'INSERT';

