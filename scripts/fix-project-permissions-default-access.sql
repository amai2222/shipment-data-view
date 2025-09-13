-- 修复项目权限默认访问问题
-- 问题：用户希望所有项目默认都是可访问的，但系统显示有4个项目受限

-- 1. 检查当前用户权限状态
SELECT 
    u.id,
    u.full_name,
    u.email,
    u.role,
    COUNT(p.id) as total_projects,
    COUNT(up.project_id) as accessible_projects,
    COUNT(p.id) - COUNT(up.project_id) as restricted_projects
FROM public.profiles u
LEFT JOIN public.projects p ON p.project_status = '进行中'
LEFT JOIN public.user_permissions up ON up.user_id = u.id AND up.project_id = p.id
WHERE u.full_name = 'szf'
GROUP BY u.id, u.full_name, u.email, u.role;

-- 2. 检查用户权限记录
SELECT 
    up.user_id,
    up.project_id,
    p.name as project_name,
    up.project_permissions,
    up.created_at
FROM public.user_permissions up
LEFT JOIN public.projects p ON up.project_id = p.id
WHERE up.user_id = (
    SELECT id FROM public.profiles WHERE full_name = 'szf'
)
ORDER BY up.created_at DESC;

-- 3. 修复方案：为所有进行中的项目创建用户权限记录
-- 方案A：删除所有现有权限记录，让用户使用角色默认权限
DO $$
DECLARE
    target_user_id uuid;
BEGIN
    -- 获取目标用户ID
    SELECT id INTO target_user_id 
    FROM public.profiles 
    WHERE full_name = 'szf';
    
    IF target_user_id IS NOT NULL THEN
        -- 删除用户的所有项目权限记录
        DELETE FROM public.user_permissions 
        WHERE user_id = target_user_id;
        
        RAISE NOTICE '已删除用户 % 的所有项目权限记录，将使用角色默认权限', target_user_id;
    ELSE
        RAISE NOTICE '未找到用户 szf';
    END IF;
END $$;

-- 4. 验证修复结果
SELECT 
    u.id,
    u.full_name,
    u.email,
    u.role,
    COUNT(p.id) as total_projects,
    COUNT(up.project_id) as accessible_projects,
    COUNT(p.id) - COUNT(up.project_id) as restricted_projects
FROM public.profiles u
LEFT JOIN public.projects p ON p.project_status = '进行中'
LEFT JOIN public.user_permissions up ON up.user_id = u.id AND up.project_id = p.id
WHERE u.full_name = 'szf'
GROUP BY u.id, u.full_name, u.email, u.role;

-- 5. 方案B：为所有进行中的项目创建权限记录（如果需要显式权限）
/*
DO $$
DECLARE
    target_user_id uuid;
    project_record RECORD;
BEGIN
    -- 获取目标用户ID
    SELECT id INTO target_user_id 
    FROM public.profiles 
    WHERE full_name = 'szf';
    
    IF target_user_id IS NOT NULL THEN
        -- 为所有进行中的项目创建权限记录
        FOR project_record IN 
            SELECT id FROM public.projects WHERE project_status = '进行中'
        LOOP
            INSERT INTO public.user_permissions (
                user_id, 
                project_id, 
                project_permissions,
                menu_permissions,
                function_permissions
            ) VALUES (
                target_user_id,
                project_record.id,
                ARRAY[project_record.id::text], -- 项目权限
                '{}', -- 菜单权限使用角色默认
                '{}'  -- 功能权限使用角色默认
            ) ON CONFLICT (user_id, project_id) DO UPDATE SET
                project_permissions = ARRAY[project_record.id::text],
                updated_at = now();
        END LOOP;
        
        RAISE NOTICE '已为用户 % 创建所有进行中项目的权限记录', target_user_id;
    ELSE
        RAISE NOTICE '未找到用户 szf';
    END IF;
END $$;
*/

-- 6. 检查角色权限模板
SELECT 
    role,
    project_permissions,
    menu_permissions,
    function_permissions
FROM public.role_permission_templates
ORDER BY role;

-- 7. 更新角色权限模板，确保默认有所有项目权限
UPDATE public.role_permission_templates 
SET project_permissions = (
    SELECT ARRAY_AGG(id::text) 
    FROM public.projects 
    WHERE project_status = '进行中'
)
WHERE role IN ('admin', 'finance', 'business', 'operator');

-- 8. 最终验证
SELECT 
    '修复完成' as status,
    u.full_name,
    u.role,
    COUNT(p.id) as total_projects,
    CASE 
        WHEN u.role = 'admin' THEN COUNT(p.id)
        ELSE COUNT(up.project_id)
    END as accessible_projects
FROM public.profiles u
LEFT JOIN public.projects p ON p.project_status = '进行中'
LEFT JOIN public.user_permissions up ON up.user_id = u.id AND up.project_id = p.id
WHERE u.full_name = 'szf'
GROUP BY u.id, u.full_name, u.role;
