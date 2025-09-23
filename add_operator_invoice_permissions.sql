-- 为 operator 角色添加开票申请管理权限
-- 包括权限模板更新和现有用户权限更新

-- =============================================================================
-- 第一步：更新权限检查函数，允许operator角色访问开票功能
-- =============================================================================

-- 更新开票申请权限检查函数，包含operator角色
CREATE OR REPLACE FUNCTION public.is_finance_or_admin_for_invoice()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin','finance','operator');
$$;

-- =============================================================================
-- 第二步：更新前端权限配置中的operator角色权限
-- =============================================================================

-- 更新角色权限模板表，为operator角色添加开票申请菜单权限
UPDATE public.role_permission_templates 
SET 
  menu_permissions = CASE 
    WHEN 'business.invoice_request' = ANY(menu_permissions) THEN menu_permissions
    ELSE menu_permissions || ARRAY['business.invoice_request']
  END,
  function_permissions = CASE 
    WHEN 'finance.generate_invoice' = ANY(function_permissions) THEN function_permissions
    ELSE function_permissions || ARRAY['finance.generate_invoice']
  END,
  updated_at = now()
WHERE role = 'operator' AND NOT ('business.invoice_request' = ANY(menu_permissions));

-- =============================================================================
-- 第三步：为现有的operator用户添加开票申请权限
-- =============================================================================

-- 为所有现有的operator用户添加开票申请权限（如果有自定义权限设置）
UPDATE public.user_permissions 
SET 
  menu_permissions = CASE 
    WHEN 'business.invoice_request' = ANY(menu_permissions) THEN menu_permissions
    ELSE menu_permissions || ARRAY['business.invoice_request']
  END,
  function_permissions = CASE 
    WHEN 'finance.generate_invoice' = ANY(function_permissions) THEN function_permissions
    ELSE function_permissions || ARRAY['finance.generate_invoice']
  END,
  updated_at = now()
WHERE user_id IN (
  SELECT id FROM public.profiles WHERE role = 'operator'
) AND NOT ('business.invoice_request' = ANY(COALESCE(menu_permissions, ARRAY[]::text[])));

-- 如果operator用户没有自定义权限记录，为他们创建基础权限记录
INSERT INTO public.user_permissions (
  user_id,
  project_id,
  menu_permissions,
  function_permissions,
  created_at,
  updated_at
)
SELECT 
  p.id,
  NULL, -- 全局权限
  ARRAY['business.invoice_request'],
  ARRAY['finance.generate_invoice'],
  now(),
  now()
FROM public.profiles p
WHERE p.role = 'operator'
AND NOT EXISTS (
  SELECT 1 FROM public.user_permissions up 
  WHERE up.user_id = p.id AND up.project_id IS NULL
)
ON CONFLICT (user_id, project_id) DO UPDATE SET
  menu_permissions = EXCLUDED.menu_permissions || user_permissions.menu_permissions,
  function_permissions = EXCLUDED.function_permissions || user_permissions.function_permissions,
  updated_at = now();

-- =============================================================================
-- 第四步：验证权限更新结果
-- =============================================================================

-- 检查角色权限模板更新结果
SELECT 
  role,
  name,
  'business.invoice_request' = ANY(menu_permissions) as has_invoice_menu,
  'finance.generate_invoice' = ANY(function_permissions) as has_invoice_function,
  array_length(menu_permissions, 1) as total_menu_permissions,
  array_length(function_permissions, 1) as total_function_permissions
FROM public.role_permission_templates 
WHERE role IN ('admin', 'finance', 'operator')
ORDER BY role;

-- 检查所有相关角色用户的权限状态
SELECT 
  p.email,
  p.role,
  p.full_name,
  CASE 
    WHEN up.menu_permissions IS NOT NULL THEN 
      'business.invoice_request' = ANY(up.menu_permissions)
    ELSE 
      'business.invoice_request' = ANY(rpt.menu_permissions)
  END as has_invoice_access,
  CASE 
    WHEN up.menu_permissions IS NOT NULL THEN 'custom'
    ELSE 'template'
  END as permission_source
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
LEFT JOIN public.role_permission_templates rpt ON p.role = rpt.role
WHERE p.role IN ('admin', 'finance', 'operator')
ORDER BY p.role, p.email;

-- 测试权限检查函数
SELECT 
  public.is_finance_or_admin_for_invoice() as has_invoice_permission,
  (SELECT role FROM public.profiles WHERE id = auth.uid()) as current_user_role;

-- =============================================================================
-- 第五步：记录权限更新日志（如果有审计表）
-- =============================================================================

-- 为operator用户记录权限更新日志
INSERT INTO public.permission_audit_logs (
  user_id,
  action,
  permission_type,
  permission_key,
  reason,
  created_by
)
SELECT 
  id,
  'grant',
  'menu',
  'business.invoice_request',
  '系统更新：为operator角色添加开票申请功能权限',
  id -- 自己给自己授权（系统更新）
FROM public.profiles 
WHERE role = 'operator'
ON CONFLICT DO NOTHING;

-- 显示更新摘要
SELECT 
  'Permission update completed' as status,
  (SELECT COUNT(*) FROM public.profiles WHERE role = 'operator') as total_operators,
  (SELECT COUNT(*) FROM public.role_permission_templates WHERE role = 'operator' AND 'business.invoice_request' = ANY(menu_permissions)) as template_updated;
