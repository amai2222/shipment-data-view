-- 修复admin角色权限模板问题
-- 1. 首先检查当前admin角色的权限模板数据
SELECT 
  role,
  name,
  description,
  menu_permissions,
  function_permissions,
  project_permissions,
  data_permissions,
  is_system,
  is_active,
  created_at
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 2. 如果admin角色模板不存在或权限为空，则创建/更新admin角色模板
INSERT INTO public.role_permission_templates (
  role,
  name,
  description,
  menu_permissions,
  function_permissions,
  project_permissions,
  data_permissions,
  is_system,
  is_active,
  color
) VALUES (
  'admin',
  '系统管理员',
  '拥有系统所有权限',
  ARRAY['dashboard', 'users', 'contracts', 'reports', 'settings'],
  ARRAY['create_user', 'edit_user', 'delete_user', 'export_data', 'import_data'],
  ARRAY['project_view', 'project_create', 'project_edit', 'project_delete'],
  ARRAY['data_read', 'data_write', 'data_delete'],
  true,
  true,
  'bg-red-500'
) ON CONFLICT (role) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  menu_permissions = EXCLUDED.menu_permissions,
  function_permissions = EXCLUDED.function_permissions,
  project_permissions = EXCLUDED.project_permissions,
  data_permissions = EXCLUDED.data_permissions,
  is_system = EXCLUDED.is_system,
  is_active = EXCLUDED.is_active,
  color = EXCLUDED.color,
  updated_at = now();

-- 3. 确保所有角色模板的is_active字段都设置为true
UPDATE public.role_permission_templates 
SET is_active = true 
WHERE is_active IS NULL OR is_active = false;

-- 4. 验证修复结果
SELECT 
  role,
  name,
  description,
  array_length(menu_permissions, 1) as menu_count,
  array_length(function_permissions, 1) as function_count,
  array_length(project_permissions, 1) as project_count,
  array_length(data_permissions, 1) as data_count,
  is_active
FROM public.role_permission_templates 
ORDER BY role;
