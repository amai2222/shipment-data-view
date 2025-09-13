-- 移除权限管理菜单项，保留集成权限管理
-- 更新数据库中的权限配置

-- 1. 检查当前权限配置
SELECT 
    '=== 当前权限配置检查 ===' as section,
    '验证时间: ' || now() as check_time;

-- 2. 检查admin角色的菜单权限
SELECT 
    '=== Admin角色菜单权限 ===' as section;

SELECT 
    role,
    name,
    menu_permissions
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 3. 移除settings.permissions权限
UPDATE public.role_permission_templates 
SET 
    menu_permissions = array_remove(menu_permissions, 'settings.permissions'),
    updated_at = now()
WHERE role = 'admin' 
AND 'settings.permissions' = ANY(menu_permissions);

-- 4. 验证更新结果
SELECT 
    '=== 更新后权限配置 ===' as section;

SELECT 
    role,
    name,
    menu_permissions
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 5. 检查是否还有settings.permissions引用
SELECT 
    '=== 检查剩余引用 ===' as section;

SELECT 
    role,
    name,
    menu_permissions
FROM public.role_permission_templates 
WHERE 'settings.permissions' = ANY(menu_permissions);

-- 6. 更新说明
SELECT 
    '=== 更新说明 ===' as section,
    '1. 已从admin角色权限中移除settings.permissions' as update_1,
    '2. 保留了settings.integrated集成权限管理' as update_2,
    '3. 前端菜单已更新，移除了权限管理菜单项' as update_3,
    '4. 移动端菜单也已同步更新' as update_4;

-- 7. 验证步骤
SELECT 
    '=== 验证步骤 ===' as section,
    '1. 刷新页面查看菜单变化' as step_1,
    '2. 确认权限管理菜单项已移除' as step_2,
    '3. 确认集成权限管理菜单项保留' as step_3,
    '4. 测试集成权限管理功能是否正常' as step_4;
