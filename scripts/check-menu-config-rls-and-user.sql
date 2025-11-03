-- ============================================================================
-- 检查 menu_config RLS 策略和当前用户权限
-- ============================================================================

-- 1. 查看当前所有 RLS 策略
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'menu_config'
ORDER BY cmd, policyname;

-- 2. 检查表是否启用了 RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'menu_config';

-- 3. 查看所有管理员用户
SELECT 
    id,
    email,
    role,
    is_active
FROM profiles
WHERE role = 'admin'
ORDER BY email;

