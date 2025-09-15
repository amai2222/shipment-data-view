-- 修复权限数量不一致问题
-- 统一两个页面的权限计算逻辑

-- 1. 检查当前权限数据状态
SELECT '当前权限数据状态' as step;
SELECT 
  role,
  CASE 
    WHEN menu_permissions IS NULL THEN 'NULL'
    ELSE array_length(menu_permissions, 1)::text
  END as menu_count,
  CASE 
    WHEN function_permissions IS NULL THEN 'NULL'
    ELSE array_length(function_permissions, 1)::text
  END as function_count,
  CASE 
    WHEN project_permissions IS NULL THEN 'NULL'
    ELSE array_length(project_permissions, 1)::text
  END as project_count,
  CASE 
    WHEN data_permissions IS NULL THEN 'NULL'
    ELSE array_length(data_permissions, 1)::text
  END as data_count,
  (
    COALESCE(array_length(menu_permissions, 1), 0) +
    COALESCE(array_length(function_permissions, 1), 0) +
    COALESCE(array_length(project_permissions, 1), 0) +
    COALESCE(array_length(data_permissions, 1), 0)
  ) as total_permissions
FROM role_permission_templates
ORDER BY role;

-- 2. 检查用户权限数据
SELECT '用户权限数据检查' as step;
SELECT 
  user_id,
  CASE 
    WHEN menu_permissions IS NULL THEN 'NULL'
    ELSE array_length(menu_permissions, 1)::text
  END as menu_count,
  CASE 
    WHEN function_permissions IS NULL THEN 'NULL'
    ELSE array_length(function_permissions, 1)::text
  END as function_count,
  CASE 
    WHEN project_permissions IS NULL THEN 'NULL'
    ELSE array_length(project_permissions, 1)::text
  END as project_count,
  CASE 
    WHEN data_permissions IS NULL THEN 'NULL'
    ELSE array_length(data_permissions, 1)::text
  END as data_count,
  (
    COALESCE(array_length(menu_permissions, 1), 0) +
    COALESCE(array_length(function_permissions, 1), 0) +
    COALESCE(array_length(project_permissions, 1), 0) +
    COALESCE(array_length(data_permissions, 1), 0)
  ) as total_permissions
FROM user_permissions
ORDER BY user_id;

-- 3. 检查用户角色分布
SELECT '用户角色分布' as step;
SELECT 
  role,
  COUNT(*) as user_count
FROM profiles
GROUP BY role
ORDER BY role;

-- 4. 检查权限数据完整性
SELECT '权限数据完整性检查' as step;
SELECT 
  'role_permission_templates' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN menu_permissions IS NULL OR array_length(menu_permissions, 1) = 0 THEN 1 END) as empty_menu,
  COUNT(CASE WHEN function_permissions IS NULL OR array_length(function_permissions, 1) = 0 THEN 1 END) as empty_function,
  COUNT(CASE WHEN project_permissions IS NULL OR array_length(project_permissions, 1) = 0 THEN 1 END) as empty_project,
  COUNT(CASE WHEN data_permissions IS NULL OR array_length(data_permissions, 1) = 0 THEN 1 END) as empty_data
FROM role_permission_templates

UNION ALL

SELECT 
  'user_permissions' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN menu_permissions IS NULL OR array_length(menu_permissions, 1) = 0 THEN 1 END) as empty_menu,
  COUNT(CASE WHEN function_permissions IS NULL OR array_length(function_permissions, 1) = 0 THEN 1 END) as empty_function,
  COUNT(CASE WHEN project_permissions IS NULL OR array_length(project_permissions, 1) = 0 THEN 1 END) as empty_project,
  COUNT(CASE WHEN data_permissions IS NULL OR array_length(data_permissions, 1) = 0 THEN 1 END) as empty_data
FROM user_permissions;

-- 5. 检查具体权限内容
SELECT '具体权限内容检查' as step;
SELECT 
  role,
  menu_permissions,
  function_permissions,
  project_permissions,
  data_permissions
FROM role_permission_templates
WHERE role = 'admin'
LIMIT 1;

-- 6. 检查用户权限内容
SELECT '用户权限内容检查' as step;
SELECT 
  user_id,
  menu_permissions,
  function_permissions,
  project_permissions,
  data_permissions
FROM user_permissions
LIMIT 3;
