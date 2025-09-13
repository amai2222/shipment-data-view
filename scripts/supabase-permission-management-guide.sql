-- Supabase 用户权限管理使用指南
-- 快速权限变更操作示例

-- 1. 查看当前用户权限状态
SELECT 
    '=== 当前用户权限状态 ===' as section;

SELECT 
    p.email,
    p.role::text as role,
    CASE 
        WHEN up.user_id IS NULL THEN '使用角色模板'
        WHEN up.inherit_role = true THEN '继承角色权限'
        ELSE '用户特定权限'
    END as permission_type,
    COALESCE(array_length(up.menu_permissions, 1), 0) as menu_count,
    COALESCE(array_length(up.function_permissions, 1), 0) as function_count,
    COALESCE(array_length(up.project_permissions, 1), 0) as project_count,
    COALESCE(array_length(up.data_permissions, 1), 0) as data_count
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
ORDER BY p.role::text, p.email;

-- 2. 权限复制示例
-- 复制用户A的权限到用户B（替换模式）
-- SELECT copy_user_permissions(
--     'source_user_id'::uuid, 
--     'target_user_id'::uuid, 
--     'replace'
-- );

-- 复制用户A的权限到用户B（合并模式）
-- SELECT copy_user_permissions(
--     'source_user_id'::uuid, 
--     'target_user_id'::uuid, 
--     'merge'
-- );

-- 3. 权限修改示例
-- 为用户添加菜单权限
-- SELECT modify_user_permissions(
--     'user_id'::uuid, 
--     'menu', 
--     'dashboard', 
--     'add'
-- );

-- 为用户移除功能权限
-- SELECT modify_user_permissions(
--     'user_id'::uuid, 
--     'function', 
--     'data.create', 
--     'remove'
-- );

-- 为用户设置项目权限
-- SELECT modify_user_permissions(
--     'user_id'::uuid, 
--     'project', 
--     'project.view_all', 
--     'set'
-- );

-- 4. 批量权限变更示例
-- 同时修改多个权限
-- SELECT quick_permission_change(
--     'user_id'::uuid,
--     '[
--         ["menu", "add", "dashboard"],
--         ["function", "remove", "data.create"],
--         ["project", "add", "project.view_all"]
--     ]'::jsonb
-- );

-- 5. 权限变更验证
-- 检查权限变更后的状态
-- SELECT * FROM check_permission_inheritance() 
-- WHERE user_id = 'user_id'::uuid;

-- 6. 审计日志查看
-- 查看用户权限变更历史
-- SELECT 
--     user_id,
--     action,
--     details,
--     created_at
-- FROM public.permission_audit_logs 
-- WHERE user_id = 'user_id'::uuid
-- ORDER BY created_at DESC;

-- 7. 权限管理最佳实践
SELECT 
    '=== 权限管理最佳实践 ===' as section,
    '1. 优先使用角色模板权限' as practice_1,
    '2. 仅在必要时创建用户特定权限' as practice_2,
    '3. 定期检查权限配置' as practice_3,
    '4. 记录所有权限变更' as practice_4,
    '5. 测试权限变更效果' as practice_5;

-- 8. 权限变更流程
SELECT 
    '=== 权限变更流程 ===' as section,
    '1. 检查当前权限状态' as step_1,
    '2. 确定变更需求' as step_2,
    '3. 执行权限变更' as step_3,
    '4. 验证变更结果' as step_4,
    '5. 记录变更日志' as step_5;

-- 9. 常见权限变更场景
SELECT 
    '=== 常见权限变更场景 ===' as section,
    '场景1: 新用户权限配置' as scenario_1,
    '场景2: 用户角色变更' as scenario_2,
    '场景3: 临时权限授予' as scenario_3,
    '场景4: 权限回收' as scenario_4,
    '场景5: 批量用户权限调整' as scenario_5;

-- 10. 权限变更注意事项
SELECT 
    '=== 权限变更注意事项 ===' as section,
    '1. 权限变更会立即生效' as note_1,
    '2. 变更前请备份重要数据' as note_2,
    '3. 测试环境验证后再应用到生产' as note_3,
    '4. 通知相关用户权限变更' as note_4,
    '5. 定期审查权限配置' as note_5;
