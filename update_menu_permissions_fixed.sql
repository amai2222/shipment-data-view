-- 菜单权限重组：财务对账 -> 财务管理，申请单管理移动到财务管理下
-- 执行日期: 2025-09-23
-- 修复版本：解决多重赋值错误

-- ===================================
-- 1. 更新角色权限模板
-- ===================================

-- 为 admin 角色添加 finance.payment_requests 权限
UPDATE public.role_permission_templates
SET
  menu_permissions = CASE
    WHEN 'finance.payment_requests' = ANY(menu_permissions) THEN menu_permissions
    ELSE menu_permissions || ARRAY['finance.payment_requests']
  END,
  updated_at = now()
WHERE role = 'admin' AND NOT ('finance.payment_requests' = ANY(menu_permissions));

-- 为 finance 角色添加 finance.payment_requests 权限，移除 business.payment_requests
UPDATE public.role_permission_templates
SET
  menu_permissions = array_remove(
    CASE
      WHEN 'finance.payment_requests' = ANY(menu_permissions) THEN menu_permissions
      ELSE menu_permissions || ARRAY['finance.payment_requests']
    END,
    'business.payment_requests'
  ),
  updated_at = now()
WHERE role = 'finance';

-- 为其他有 business.payment_requests 权限的角色移除该权限
UPDATE public.role_permission_templates
SET
  menu_permissions = array_remove(menu_permissions, 'business.payment_requests'),
  updated_at = now()
WHERE 'business.payment_requests' = ANY(menu_permissions) AND role NOT IN ('admin', 'finance');

-- ===================================
-- 2. 更新现有用户权限
-- ===================================

-- 为 admin 用户添加 finance.payment_requests 权限
UPDATE public.user_permissions
SET
  menu_permissions = CASE
    WHEN 'finance.payment_requests' = ANY(menu_permissions) THEN menu_permissions
    ELSE menu_permissions || ARRAY['finance.payment_requests']
  END,
  updated_at = now()
WHERE user_id IN (
  SELECT id FROM public.profiles WHERE role = 'admin'
) AND NOT ('finance.payment_requests' = ANY(COALESCE(menu_permissions, ARRAY[]::text[])));

-- 为 finance 用户添加 finance.payment_requests 权限，移除 business.payment_requests
UPDATE public.user_permissions
SET
  menu_permissions = array_remove(
    CASE
      WHEN 'finance.payment_requests' = ANY(menu_permissions) THEN menu_permissions
      ELSE menu_permissions || ARRAY['finance.payment_requests']
    END,
    'business.payment_requests'
  ),
  updated_at = now()
WHERE user_id IN (
  SELECT id FROM public.profiles WHERE role = 'finance'
);

-- 为其他用户移除 business.payment_requests 权限
UPDATE public.user_permissions
SET
  menu_permissions = array_remove(menu_permissions, 'business.payment_requests'),
  updated_at = now()
WHERE 'business.payment_requests' = ANY(COALESCE(menu_permissions, ARRAY[]::text[]))
  AND user_id IN (
    SELECT id FROM public.profiles WHERE role NOT IN ('admin', 'finance')
  );

-- ===================================
-- 3. 清理和验证
-- ===================================

-- 清理可能存在的重复权限
UPDATE public.role_permission_templates
SET
  menu_permissions = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(menu_permissions) 
      ORDER BY unnest(menu_permissions)
    )
  ),
  updated_at = now()
WHERE array_length(menu_permissions, 1) > 0;

UPDATE public.user_permissions
SET
  menu_permissions = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(menu_permissions) 
      ORDER BY unnest(menu_permissions)
    )
  ),
  updated_at = now()
WHERE array_length(menu_permissions, 1) > 0;

-- ===================================
-- 4. 验证更新结果
-- ===================================

-- 检查角色权限模板更新情况
SELECT 
  role,
  CASE 
    WHEN 'finance.payment_requests' = ANY(menu_permissions) THEN '✅ 已添加'
    ELSE '❌ 未添加'
  END as finance_payment_requests_status,
  CASE 
    WHEN 'business.payment_requests' = ANY(menu_permissions) THEN '❌ 仍存在'
    ELSE '✅ 已移除'
  END as business_payment_requests_status,
  array_length(menu_permissions, 1) as total_menu_permissions
FROM public.role_permission_templates
WHERE role IN ('admin', 'finance', 'business', 'operator')
ORDER BY role;

-- 检查用户权限更新情况
SELECT 
  p.role,
  COUNT(*) as user_count,
  COUNT(CASE WHEN 'finance.payment_requests' = ANY(up.menu_permissions) THEN 1 END) as with_finance_payment_requests,
  COUNT(CASE WHEN 'business.payment_requests' = ANY(up.menu_permissions) THEN 1 END) as with_business_payment_requests
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id
WHERE p.role IN ('admin', 'finance', 'business', 'operator')
GROUP BY p.role
ORDER BY p.role;

-- 显示完成状态
SELECT 
  '菜单权限重组完成' as status,
  '财务对账已重命名为财务管理，申请单管理已移动到财务管理下' as description,
  NOW() as completed_at;
