-- ============================================================================
-- 修复开票申请权限问题
-- ============================================================================
-- 问题：新建的管理员没有开票申请权限
-- 原因：is_finance_or_admin() 函数检查 user_roles 表，但新用户只在 profiles 表设置了角色
-- 解决：修改 is_finance_or_admin() 函数，改为直接检查 profiles 表的 role 字段
-- ============================================================================
-- 创建时间: 2025-11-03
-- ============================================================================

-- 删除旧版本的 is_finance_or_admin 函数（如果存在多个重载版本）
DROP FUNCTION IF EXISTS public.is_finance_or_admin(UUID);
DROP FUNCTION IF EXISTS public.is_finance_or_admin();

-- 创建新版本 - 直接检查 profiles 表的 role 字段
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

-- 验证结果
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ is_finance_or_admin 函数已更新';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '函数定义:';
    RAISE NOTICE '  - 检查 profiles.role 字段';
    RAISE NOTICE '  - 允许角色: admin, finance';
    RAISE NOTICE '';
    RAISE NOTICE '影响范围:';
    RAISE NOTICE '  ✅ 开票申请创建权限';
    RAISE NOTICE '  ✅ 开票审批权限';
    RAISE NOTICE '  ✅ 付款申请相关权限';
    RAISE NOTICE '';
    RAISE NOTICE '所有角色为 admin 或 finance 的用户现在都可以使用开票功能';
    RAISE NOTICE '========================================';
END $$;











