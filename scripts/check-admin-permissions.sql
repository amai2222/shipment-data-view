-- 检查admin角色的权限模板数据
SELECT 
  role,
  name,
  description,
  menu_permissions,
  function_permissions,
  project_permissions,
  data_permissions,
  is_system,
  created_at
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 检查所有角色模板
SELECT 
  role,
  name,
  description,
  array_length(menu_permissions, 1) as menu_count,
  array_length(function_permissions, 1) as function_count,
  array_length(project_permissions, 1) as project_count,
  array_length(data_permissions, 1) as data_count
FROM public.role_permission_templates 
ORDER BY role;

-- 检查admin用户的权限配置
SELECT 
  p.id,
  p.email,
  p.role,
  up.menu_permissions,
  up.function_permissions,
  up.project_permissions,
  up.data_permissions
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
WHERE p.role = 'admin';
