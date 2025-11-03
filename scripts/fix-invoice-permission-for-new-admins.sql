-- ============================================================================
-- 修复开票申请权限问题
-- ============================================================================
-- 问题：新建的管理员没有开票申请权限
-- 原因：is_finance_or_admin() 函数检查 user_roles 表，但新用户只在 profiles 表设置了角色
-- 解决：修改 is_finance_or_admin() 函数，改为直接检查 profiles 表的 role 字段
-- ============================================================================

-- ==========================================
-- 第一步：查看当前所有管理员的信息
-- ==========================================
SELECT 
    id,
    email,
    username,
    role,
    created_at
FROM public.profiles
WHERE role = 'admin'
ORDER BY created_at;

-- ==========================================
-- 第二步：检查 user_roles 表（旧的权限表）
-- ==========================================
SELECT 
    ur.user_id,
    p.email,
    p.username,
    ur.role,
    p.created_at
FROM public.user_roles ur
LEFT JOIN public.profiles p ON ur.user_id = p.id
WHERE ur.role = 'admin'
ORDER BY p.created_at;

-- ==========================================
-- 第三步：修复 is_finance_or_admin 函数
-- ==========================================

-- 直接替换函数定义（不删除，避免破坏依赖的策略）
-- 更新为检查 profiles 表的 role 字段，而不是 user_roles 表
CREATE OR REPLACE FUNCTION public.is_finance_or_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- 直接检查 profiles 表的 role 字段，而不是 user_roles 表
  SELECT (SELECT role::TEXT FROM public.profiles WHERE id = COALESCE(_user_id, auth.uid())) IN ('admin', 'finance')
$function$;

COMMENT ON FUNCTION public.is_finance_or_admin IS '检查用户是否为财务或管理员（检查 profiles.role 字段）';

-- ✅ is_finance_or_admin 函数已更新

-- ==========================================
-- 第四步：验证函数定义
-- ==========================================
SELECT 
    proname AS function_name,
    pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE proname = 'is_finance_or_admin'
  AND pronamespace = 'public'::regnamespace;

-- ==========================================
-- 第五步：测试函数（显示所有管理员和财务用户）
-- ==========================================
SELECT 
    id,
    email,
    username,
    role,
    created_at
FROM public.profiles
WHERE role IN ('admin', 'finance')
ORDER BY role, created_at;

-- ==========================================
-- 修复完成！
-- ==========================================
-- ✅ is_finance_or_admin 函数已更新为检查 profiles.role 字段
-- ✅ 所有角色为 admin 或 finance 的用户现在都可以创建开票申请
-- 
-- 请在前端重新登录测试开票申请功能
-- ==========================================

