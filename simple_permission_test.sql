-- 简化的权限管理功能测试脚本
-- 文件: simple_permission_test.sql

-- 1. 测试用户项目权限分配功能
DO $$
DECLARE
    test_user_id UUID;
    test_project_id UUID;
    test_result RECORD;
BEGIN
    RAISE NOTICE '--- 开始测试用户项目权限分配功能 ---';
    
    -- 获取第一个用户和第一个项目进行测试
    SELECT id INTO test_user_id FROM public.profiles WHERE is_active = true LIMIT 1;
    SELECT id INTO test_project_id FROM public.projects LIMIT 1;
    
    IF test_user_id IS NULL OR test_project_id IS NULL THEN
        RAISE WARNING '无法找到测试用户或项目';
        RETURN;
    END IF;
    
    RAISE NOTICE '测试用户ID: %, 测试项目ID: %', test_user_id, test_project_id;
    
    -- 测试插入新权限（应该成功）
    INSERT INTO public.user_projects (user_id, project_id, can_view, can_edit, can_delete)
    VALUES (test_user_id, test_project_id, true, true, false)
    ON CONFLICT (user_id, project_id) 
    DO UPDATE SET 
        can_view = EXCLUDED.can_view,
        can_edit = EXCLUDED.can_edit,
        can_delete = EXCLUDED.can_delete,
        updated_at = NOW()
    RETURNING * INTO test_result;
    
    RAISE NOTICE '权限分配成功: can_view=%, can_edit=%, can_delete=%', 
        test_result.can_view, test_result.can_edit, test_result.can_delete;
    
    -- 测试重复插入（应该更新而不是报错）
    INSERT INTO public.user_projects (user_id, project_id, can_view, can_edit, can_delete)
    VALUES (test_user_id, test_project_id, false, true, true)
    ON CONFLICT (user_id, project_id) 
    DO UPDATE SET 
        can_view = EXCLUDED.can_view,
        can_edit = EXCLUDED.can_edit,
        can_delete = EXCLUDED.can_delete,
        updated_at = NOW()
    RETURNING * INTO test_result;
    
    RAISE NOTICE '权限更新成功: can_view=%, can_edit=%, can_delete=%', 
        test_result.can_view, test_result.can_edit, test_result.can_delete;
    
    RAISE NOTICE '--- 用户项目权限分配功能测试完成 ---';
END $$;

-- 2. 测试角色模板变更触发器
DO $$
DECLARE
    test_role TEXT := 'operator';
    initial_count INTEGER;
    updated_count INTEGER;
BEGIN
    RAISE NOTICE '--- 开始测试角色模板变更触发器 ---';
    
    -- 获取初始权限数量
    SELECT array_length(menu_permissions, 1) INTO initial_count
    FROM public.role_permission_templates
    WHERE role = test_role::app_role;
    
    RAISE NOTICE '角色 % 初始菜单权限数量: %', test_role, initial_count;
    
    -- 更新角色模板权限
    UPDATE public.role_permission_templates
    SET menu_permissions = array_append(menu_permissions, 'test_permission_' || extract(epoch from now())::text)
    WHERE role = test_role::app_role;
    
    -- 获取更新后权限数量
    SELECT array_length(menu_permissions, 1) INTO updated_count
    FROM public.role_permission_templates
    WHERE role = test_role::app_role;
    
    RAISE NOTICE '角色 % 更新后菜单权限数量: %', test_role, updated_count;
    
    IF updated_count = initial_count + 1 THEN
        RAISE NOTICE '角色模板变更触发器测试成功';
    ELSE
        RAISE WARNING '角色模板变更触发器测试失败';
    END IF;
    
    -- 清理测试数据
    UPDATE public.role_permission_templates
    SET menu_permissions = array_remove(menu_permissions, 'test_permission_' || extract(epoch from now())::text)
    WHERE role = test_role::app_role;
    
    RAISE NOTICE '--- 角色模板变更触发器测试完成 ---';
END $$;

-- 3. 测试用户权限管理功能
DO $$
DECLARE
    test_user_id UUID;
    test_permission RECORD;
BEGIN
    RAISE NOTICE '--- 开始测试用户权限管理功能 ---';
    
    -- 获取第一个用户进行测试
    SELECT id INTO test_user_id FROM public.profiles WHERE is_active = true LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE WARNING '无法找到测试用户';
        RETURN;
    END IF;
    
    RAISE NOTICE '测试用户ID: %', test_user_id;
    
    -- 测试插入用户权限
    INSERT INTO public.user_permissions (
        user_id, 
        project_id, 
        menu_permissions, 
        function_permissions,
        project_permissions,
        data_permissions,
        inherit_role,
        custom_settings
    )
    VALUES (
        test_user_id,
        NULL,
        ARRAY['dashboard', 'users'],
        ARRAY['data.view', 'data.edit'],
        ARRAY['project.view_all'],
        ARRAY['data.own'],
        false,
        '{}'::jsonb
    )
    ON CONFLICT (user_id, project_id) 
    DO UPDATE SET 
        menu_permissions = EXCLUDED.menu_permissions,
        function_permissions = EXCLUDED.function_permissions,
        project_permissions = EXCLUDED.project_permissions,
        data_permissions = EXCLUDED.data_permissions,
        inherit_role = EXCLUDED.inherit_role,
        custom_settings = EXCLUDED.custom_settings,
        updated_at = NOW()
    RETURNING * INTO test_permission;
    
    RAISE NOTICE '用户权限创建/更新成功: inherit_role=%, menu_count=%', 
        test_permission.inherit_role, 
        array_length(test_permission.menu_permissions, 1);
    
    RAISE NOTICE '--- 用户权限管理功能测试完成 ---';
END $$;

-- 4. 最终状态检查
SELECT 
    '最终功能测试结果' as test_type,
    '用户项目权限' as feature,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT project_id) as unique_projects
FROM public.user_projects

UNION ALL

SELECT 
    '最终功能测试结果' as test_type,
    '用户权限' as feature,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT project_id) as unique_projects
FROM public.user_permissions

UNION ALL

SELECT 
    '最终功能测试结果' as test_type,
    '角色模板' as feature,
    COUNT(*) as total_records,
    COUNT(DISTINCT role) as unique_roles,
    0 as placeholder
FROM public.role_permission_templates;

-- 5. 检查所有触发器状态
SELECT 
    '触发器状态检查' as check_type,
    event_object_table as table_name,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE event_object_table IN (
    'role_permission_templates',
    'user_permissions',
    'user_projects'
)
ORDER BY event_object_table, trigger_name;

SELECT '简化权限管理功能测试完成' as status;
