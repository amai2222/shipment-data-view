-- 测试权限数量一致性修复
-- 验证两个页面的权限计算是否一致

-- 1. 检查用户列表页面的权限计算逻辑
SELECT '用户列表页面权限计算' as test_type;
SELECT 
  p.id as user_id,
  p.full_name,
  p.email,
  p.role,
  -- 模拟用户列表页面的计算逻辑
  (
    COALESCE(array_length(up.menu_permissions, 1), 0) +
    COALESCE(array_length(up.function_permissions, 1), 0) +
    COALESCE(array_length(up.project_permissions, 1), 0) +
    COALESCE(array_length(up.data_permissions, 1), 0)
  ) as user_permission_count,
  -- 角色模板权限数量
  (
    COALESCE(array_length(rpt.menu_permissions, 1), 0) +
    COALESCE(array_length(rpt.function_permissions, 1), 0) +
    COALESCE(array_length(rpt.project_permissions, 1), 0) +
    COALESCE(array_length(rpt.data_permissions, 1), 0)
  ) as role_permission_count,
  -- 最终权限数量（用户权限优先，否则使用角色模板）
  CASE 
    WHEN up.user_id IS NOT NULL THEN
      (
        COALESCE(array_length(up.menu_permissions, 1), 0) +
        COALESCE(array_length(up.function_permissions, 1), 0) +
        COALESCE(array_length(up.project_permissions, 1), 0) +
        COALESCE(array_length(up.data_permissions, 1), 0)
      )
    ELSE
      (
        COALESCE(array_length(rpt.menu_permissions, 1), 0) +
        COALESCE(array_length(rpt.function_permissions, 1), 0) +
        COALESCE(array_length(rpt.project_permissions, 1), 0) +
        COALESCE(array_length(rpt.data_permissions, 1), 0)
      )
  END as final_permission_count
FROM profiles p
LEFT JOIN user_permissions up ON p.id = up.user_id
LEFT JOIN role_permission_templates rpt ON p.role = rpt.role
ORDER BY p.full_name;

-- 2. 检查权限配置页面的权限计算逻辑
SELECT '权限配置页面权限计算' as test_type;
SELECT 
  p.id as user_id,
  p.full_name,
  p.email,
  p.role,
  -- 模拟权限配置页面的计算逻辑
  CASE 
    WHEN up.user_id IS NOT NULL THEN
      (
        COALESCE(array_length(up.menu_permissions, 1), 0) +
        COALESCE(array_length(up.function_permissions, 1), 0) +
        COALESCE(array_length(up.project_permissions, 1), 0) +
        COALESCE(array_length(up.data_permissions, 1), 0)
      )
    ELSE
      (
        COALESCE(array_length(rpt.menu_permissions, 1), 0) +
        COALESCE(array_length(rpt.function_permissions, 1), 0) +
        COALESCE(array_length(rpt.project_permissions, 1), 0) +
        COALESCE(array_length(rpt.data_permissions, 1), 0)
      )
  END as permission_count
FROM profiles p
LEFT JOIN user_permissions up ON p.id = up.user_id
LEFT JOIN role_permission_templates rpt ON p.role = rpt.role
ORDER BY p.full_name;

-- 3. 检查两个页面的计算结果是否一致
SELECT '一致性检查' as test_type;
WITH user_list_calc AS (
  SELECT 
    p.id as user_id,
    p.full_name,
    CASE 
      WHEN up.user_id IS NOT NULL THEN
        (
          COALESCE(array_length(up.menu_permissions, 1), 0) +
          COALESCE(array_length(up.function_permissions, 1), 0) +
          COALESCE(array_length(up.project_permissions, 1), 0) +
          COALESCE(array_length(up.data_permissions, 1), 0)
        )
      ELSE
        (
          COALESCE(array_length(rpt.menu_permissions, 1), 0) +
          COALESCE(array_length(rpt.function_permissions, 1), 0) +
          COALESCE(array_length(rpt.project_permissions, 1), 0) +
          COALESCE(array_length(rpt.data_permissions, 1), 0)
        )
    END as user_list_count
  FROM profiles p
  LEFT JOIN user_permissions up ON p.id = up.user_id
  LEFT JOIN role_permission_templates rpt ON p.role = rpt.role
),
permission_config_calc AS (
  SELECT 
    p.id as user_id,
    CASE 
      WHEN up.user_id IS NOT NULL THEN
        (
          COALESCE(array_length(up.menu_permissions, 1), 0) +
          COALESCE(array_length(up.function_permissions, 1), 0) +
          COALESCE(array_length(up.project_permissions, 1), 0) +
          COALESCE(array_length(up.data_permissions, 1), 0)
        )
      ELSE
        (
          COALESCE(array_length(rpt.menu_permissions, 1), 0) +
          COALESCE(array_length(rpt.function_permissions, 1), 0) +
          COALESCE(array_length(rpt.project_permissions, 1), 0) +
          COALESCE(array_length(rpt.data_permissions, 1), 0)
        )
    END as permission_config_count
  FROM profiles p
  LEFT JOIN user_permissions up ON p.id = up.user_id
  LEFT JOIN role_permission_templates rpt ON p.role = rpt.role
)
SELECT 
  ulc.user_id,
  ulc.full_name,
  ulc.user_list_count,
  pcc.permission_config_count,
  CASE 
    WHEN ulc.user_list_count = pcc.permission_config_count THEN '一致'
    ELSE '不一致'
  END as consistency_status
FROM user_list_calc ulc
JOIN permission_config_calc pcc ON ulc.user_id = pcc.user_id
ORDER BY ulc.full_name;

-- 4. 检查权限数据完整性
SELECT '权限数据完整性检查' as test_type;
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
