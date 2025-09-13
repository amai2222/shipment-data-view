-- 修复超级用户（admin）的项目权限配置
-- 添加缺失的 project.view_assigned 权限

-- 1. 检查当前 admin 角色的项目权限
SELECT 
    '当前admin角色项目权限' as category,
    role,
    project_permissions,
    array_length(project_permissions, 1) as permission_count
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 2. 更新 admin 角色的项目权限，添加 project.view_assigned
UPDATE public.role_permission_templates 
SET project_permissions = ARRAY[
    'project_access', 
    'project.view_all', 
    'project.view_assigned',  -- 添加缺失的权限
    'project.manage', 
    'project.admin',
    'project_data', 
    'project_data.view_financial', 
    'project_data.edit_financial', 
    'project_data.view_operational', 
    'project_data.edit_operational'
],
updated_at = now()
WHERE role = 'admin';

-- 3. 验证更新结果
SELECT 
    '更新后admin角色项目权限' as category,
    role,
    project_permissions,
    array_length(project_permissions, 1) as permission_count,
    CASE 
        WHEN 'project.view_assigned' = ANY(project_permissions) 
        THEN '✅ 包含 project.view_assigned 权限'
        ELSE '❌ 缺少 project.view_assigned 权限'
    END as status
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 4. 检查所有角色的项目权限配置
SELECT 
    '所有角色项目权限检查' as category,
    role,
    name,
    project_permissions,
    CASE 
        WHEN role = 'admin' AND 'project.view_assigned' = ANY(project_permissions) 
        THEN '✅ admin权限完整'
        WHEN role = 'admin' AND 'project.view_assigned' != ANY(project_permissions) 
        THEN '❌ admin缺少权限'
        ELSE '其他角色'
    END as status
FROM public.role_permission_templates 
ORDER BY role;

-- 5. 说明修复内容
SELECT 
    '修复说明' as category,
    '已为admin角色添加 project.view_assigned 权限' as description,
    '现在超级用户可以查看分配项目权限' as result,
    '刷新权限管理页面即可看到更新' as instruction;
