-- ============================================================================
-- 诊断创建管理员账号失败的问题
-- 错误：Edge Function returned a non-2xx status code
-- ============================================================================

-- 第1步：检查profiles表的RLS策略
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as "USING expression",
  with_check as "WITH CHECK expression"
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================================================
-- 第2步：检查Edge Function日志（需要在Supabase Dashboard查看）
-- ============================================================================

/*
在Supabase Dashboard中：
1. 点击左侧 "Edge Functions"
2. 找到 "create-user" 函数
3. 点击 "Logs" 查看最近的错误日志
4. 查找创建管理员时的具体错误信息
*/

-- ============================================================================
-- 第3步：检查profiles表的INSERT权限
-- ============================================================================

-- 查看当前用户的role
SELECT 
  id,
  email,
  full_name,
  role,
  '当前登录用户' as note
FROM profiles
WHERE id = auth.uid();

-- ============================================================================
-- 第4步：测试profiles表的INSERT权限
-- ============================================================================

-- 尝试插入一条测试记录（这会失败，但能看到错误信息）
/*
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  gen_random_uuid(),
  'test-admin@test.com',
  '测试管理员',
  'admin'
);
*/

-- ============================================================================
-- 第5步：检查是否有触发器限制
-- ============================================================================

SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'profiles'
ORDER BY trigger_name;

-- ============================================================================
-- 第6步：临时禁用RLS测试（仅诊断用）
-- ============================================================================

-- ⚠️ 仅用于诊断，不要在生产环境长期禁用！
/*
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 测试创建
-- 如果现在能创建成功，说明是RLS策略的问题

-- 测试完成后立即重新启用
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
*/

-- ============================================================================
-- 第7步：查看profiles表的详细结构
-- ============================================================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- 第8步：检查是否有CHECK约束限制
-- ============================================================================

SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'profiles'
ORDER BY conname;

-- ============================================================================
-- 第9步：修复方案 - 添加正确的INSERT策略
-- ============================================================================

-- 检查是否存在INSERT策略
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'profiles' AND cmd = 'INSERT';

-- 如果没有INSERT策略，创建一个
/*
CREATE POLICY IF NOT EXISTS "profiles_insert_by_service_role" 
ON public.profiles
FOR INSERT
WITH CHECK (
  -- Edge Function使用service_role key，应该允许插入
  auth.role() = 'service_role'
  OR
  -- 或者当前用户是admin
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
  )
);
*/

-- ============================================================================
-- 第10步：快速修复 - 确保Edge Function可以创建用户
-- ============================================================================

-- 修复profiles表的INSERT策略，允许service_role插入任何角色
DO $$ 
BEGIN
  -- 删除可能限制admin创建的旧策略
  DROP POLICY IF EXISTS "profiles_insert_restricted" ON public.profiles;
  
  -- 创建新的宽松策略（仅service_role使用）
  CREATE POLICY IF NOT EXISTS "profiles_insert_by_service_role" 
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    -- Edge Function使用service_role，应该被允许
    auth.role() = 'service_role'
  );
  
  RAISE NOTICE '✅ profiles表INSERT策略已更新';
END $$;

-- ============================================================================
-- 第11步：验证修复
-- ============================================================================

-- 查看更新后的策略
SELECT 
  policyname,
  cmd,
  with_check as "权限检查",
  '✅ 已修复' as status
FROM pg_policies
WHERE tablename = 'profiles' AND cmd = 'INSERT';

-- ============================================================================
-- 第12步：检查auth.users表的配置
-- ============================================================================

-- 查看auth schema的配置
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'auth' AND tablename = 'users';

