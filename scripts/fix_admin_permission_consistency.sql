-- 修复管理员权限配置一致性问题
-- 确保所有admin用户使用相同的权限配置

-- 1. 检查当前admin角色的权限模板
SELECT 
    '=== 当前admin角色权限模板 ===' as section;

SELECT 
    role,
    name,
    description,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    array_length(project_permissions, 1) as project_count,
    array_length(data_permissions, 1) as data_count,
    (array_length(menu_permissions, 1) + 
     array_length(function_permissions, 1) + 
     array_length(project_permissions, 1) + 
     array_length(data_permissions, 1)) as total_count
FROM public.role_permission_templates 
WHERE role = 'admin';

-- 2. 检查所有admin用户的权限配置
SELECT 
    '=== 所有admin用户权限配置 ===' as section;

SELECT 
    p.email,
    p.full_name,
    CASE 
        WHEN up.user_id IS NOT NULL THEN '有自定义权限'
        ELSE '使用角色模板'
    END as permission_source,
    COALESCE(array_length(up.menu_permissions, 1), 0) as custom_menu_count,
    COALESCE(array_length(up.function_permissions, 1), 0) as custom_function_count,
    COALESCE(array_length(up.project_permissions, 1), 0) as custom_project_count,
    COALESCE(array_length(up.data_permissions, 1), 0) as custom_data_count,
    (COALESCE(array_length(up.menu_permissions, 1), 0) + 
     COALESCE(array_length(up.function_permissions, 1), 0) + 
     COALESCE(array_length(up.project_permissions, 1), 0) + 
     COALESCE(array_length(up.data_permissions, 1), 0)) as custom_total_count
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
WHERE p.role = 'admin'
ORDER BY custom_total_count DESC;

-- 3. 计算每个admin用户的实际权限数量（使用修复后的逻辑）
SELECT 
    '=== 修复后的权限统计 ===' as section;

SELECT 
    p.email,
    p.full_name,
    -- 实际生效的权限（用户自定义权限优先，否则使用角色模板权限）
    COALESCE(array_length(up.menu_permissions, 1), array_length(rpt.menu_permissions, 1)) as effective_menu_count,
    COALESCE(array_length(up.function_permissions, 1), array_length(rpt.function_permissions, 1)) as effective_function_count,
    COALESCE(array_length(up.project_permissions, 1), array_length(rpt.project_permissions, 1)) as effective_project_count,
    COALESCE(array_length(up.data_permissions, 1), array_length(rpt.data_permissions, 1)) as effective_data_count,
    (COALESCE(array_length(up.menu_permissions, 1), array_length(rpt.menu_permissions, 1)) + 
     COALESCE(array_length(up.function_permissions, 1), array_length(rpt.function_permissions, 1)) + 
     COALESCE(array_length(up.project_permissions, 1), array_length(rpt.project_permissions, 1)) + 
     COALESCE(array_length(up.data_permissions, 1), array_length(rpt.data_permissions, 1))) as effective_total_count
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
LEFT JOIN public.role_permission_templates rpt ON p.role::text = rpt.role::text
WHERE p.role = 'admin'
ORDER BY effective_total_count DESC;

-- 4. 修复建议
SELECT 
    '=== 修复建议 ===' as section,
    '1. 如果admin用户有自定义权限且数量不一致，建议删除自定义权限' as suggestion_1,
    '2. 让所有admin用户使用统一的角色模板权限' as suggestion_2,
    '3. 前端已修复权限计算逻辑，现在会正确显示实际生效的权限数量' as suggestion_3;

-- 5. 可选：清理admin用户的自定义权限（取消注释以执行）
-- DELETE FROM public.user_permissions 
-- WHERE user_id IN (
--     SELECT p.id 
--     FROM public.profiles p 
--     WHERE p.role = 'admin'
-- ) AND project_id IS NULL;

-- 6. 验证修复结果
SELECT 
    '=== 修复后验证 ===' as section,
    '执行上述DELETE语句后，所有admin用户将显示相同的权限数量' as verification;
