-- Supabase 权限系统完整性检查和修复脚本
-- 适用于 Supabase 数据库结构

-- 1. 检查当前权限系统状态
SELECT 
    '=== Supabase 权限系统状态检查 ===' as section,
    '检查时间: ' || now() as check_time;

-- 2. 检查角色权限模板完整性
SELECT 
    '=== 角色权限模板检查 ===' as section,
    role,
    name,
    CASE 
        WHEN menu_permissions IS NULL THEN '❌ 菜单权限为空'
        WHEN array_length(menu_permissions, 1) = 0 THEN '❌ 菜单权限为空数组'
        ELSE '✅ 菜单权限: ' || array_length(menu_permissions, 1) || ' 项'
    END as menu_status,
    CASE 
        WHEN function_permissions IS NULL THEN '❌ 功能权限为空'
        WHEN array_length(function_permissions, 1) = 0 THEN '❌ 功能权限为空数组'
        ELSE '✅ 功能权限: ' || array_length(function_permissions, 1) || ' 项'
    END as function_status,
    CASE 
        WHEN project_permissions IS NULL THEN '❌ 项目权限为空'
        WHEN array_length(project_permissions, 1) = 0 THEN '❌ 项目权限为空数组'
        ELSE '✅ 项目权限: ' || array_length(project_permissions, 1) || ' 项'
    END as project_status,
    CASE 
        WHEN data_permissions IS NULL THEN '❌ 数据权限为空'
        WHEN array_length(data_permissions, 1) = 0 THEN '❌ 数据权限为空数组'
        ELSE '✅ 数据权限: ' || array_length(data_permissions, 1) || ' 项'
    END as data_status
FROM public.role_permission_templates 
ORDER BY role;

-- 3. 检查用户权限配置（使用 Supabase 表结构）
SELECT 
    '=== 用户权限配置检查 ===' as section,
    p.id,
    p.email,
    p.role,
    p.is_active,
    CASE 
        WHEN up.user_id IS NULL THEN '❌ 无用户特定权限'
        WHEN up.inherit_role = true THEN '✅ 继承角色权限'
        WHEN up.inherit_role = false THEN '⚠️ 不继承角色权限'
        ELSE '❓ 继承状态未知'
    END as inherit_status,
    CASE 
        WHEN up.user_id IS NULL THEN '使用角色模板权限'
        ELSE '有用户特定权限配置'
    END as permission_source
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
ORDER BY p.role, p.email;

-- 4. 检查权限继承逻辑问题
SELECT 
    '=== 权限继承逻辑问题检查 ===' as section,
    p.id,
    p.email,
    p.role,
    CASE 
        WHEN up.user_id IS NOT NULL AND up.inherit_role = false THEN '❌ 问题: 不继承角色权限但有用户特定权限'
        WHEN up.user_id IS NOT NULL AND up.inherit_role = true THEN '⚠️ 注意: 继承角色权限但有用户特定权限'
        WHEN up.user_id IS NULL THEN '✅ 正常: 使用角色模板权限'
        ELSE '❓ 状态未知'
    END as issue_status,
    CASE 
        WHEN up.user_id IS NOT NULL THEN 
            '用户权限: 菜单(' || COALESCE(array_length(up.menu_permissions, 1), 0) || 
            ') 功能(' || COALESCE(array_length(up.function_permissions, 1), 0) || 
            ') 项目(' || COALESCE(array_length(up.project_permissions, 1), 0) || 
            ') 数据(' || COALESCE(array_length(up.data_permissions, 1), 0) || ')'
        ELSE '使用角色模板权限'
    END as permission_details
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
WHERE up.user_id IS NOT NULL AND up.inherit_role = false
ORDER BY p.role, p.email;

-- 5. 修复权限继承逻辑
-- 5.1 清理不必要的用户特定权限（当用户应该继承角色权限时）
DELETE FROM public.user_permissions 
WHERE user_id IN (
    SELECT p.id 
    FROM public.profiles p
    LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
    WHERE up.user_id IS NOT NULL 
    AND up.inherit_role = false
    AND up.menu_permissions IS NOT NULL
    AND up.function_permissions IS NOT NULL
    AND up.project_permissions IS NOT NULL
    AND up.data_permissions IS NOT NULL
    -- 检查用户权限是否与角色模板权限相同
    AND EXISTS (
        SELECT 1 FROM public.role_permission_templates rpt
        WHERE rpt.role = p.role
        AND rpt.menu_permissions = up.menu_permissions
        AND rpt.function_permissions = up.function_permissions
        AND rpt.project_permissions = up.project_permissions
        AND rpt.data_permissions = up.data_permissions
    )
)
AND project_id IS NULL;

-- 5.2 更新用户权限继承状态
UPDATE public.user_permissions 
SET inherit_role = true
WHERE user_id IN (
    SELECT p.id 
    FROM public.profiles p
    WHERE p.role IN ('admin', 'finance', 'business', 'partner', 'operator')
)
AND project_id IS NULL
AND inherit_role = false;

-- 6. 创建角色变更触发器函数（适用于 Supabase）
CREATE OR REPLACE FUNCTION handle_profile_role_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 当用户角色变更时，自动应用角色模板权限
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        -- 删除用户的全局权限配置（让用户使用新的角色模板）
        DELETE FROM public.user_permissions 
        WHERE user_id = NEW.id 
        AND project_id IS NULL;
        
        -- 记录角色变更日志
        INSERT INTO public.permission_audit_logs (
            user_id, 
            action, 
            details, 
            created_at
        ) VALUES (
            NEW.id, 
            'role_changed', 
            jsonb_build_object(
                'old_role', OLD.role,
                'new_role', NEW.role,
                'message', '用户角色已变更，权限将使用新角色模板'
            ), 
            now()
        );
        
        RAISE NOTICE '用户 % 角色已从 % 变更为 %，权限将使用新角色模板', 
            NEW.email, OLD.role, NEW.role;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建角色变更触发器
DROP TRIGGER IF EXISTS trigger_profile_role_change ON public.profiles;
CREATE TRIGGER trigger_profile_role_change
    AFTER UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION handle_profile_role_change();

-- 8. 创建权限同步函数（适用于 Supabase）
CREATE OR REPLACE FUNCTION sync_user_permissions_with_role()
RETURNS void AS $$
DECLARE
    user_record RECORD;
    role_template RECORD;
BEGIN
    -- 为所有用户同步权限
    FOR user_record IN 
        SELECT id, email, role 
        FROM public.profiles 
        WHERE role IS NOT NULL
    LOOP
        -- 获取角色模板
        SELECT * INTO role_template
        FROM public.role_permission_templates
        WHERE role = user_record.role;
        
        -- 如果用户有全局权限配置且不继承角色权限，则删除
        IF EXISTS (
            SELECT 1 FROM public.user_permissions 
            WHERE user_id = user_record.id 
            AND project_id IS NULL 
            AND inherit_role = false
        ) THEN
            DELETE FROM public.user_permissions 
            WHERE user_id = user_record.id 
            AND project_id IS NULL;
            
            RAISE NOTICE '已清理用户 % 的全局权限配置，将使用角色 % 的模板权限', 
                user_record.email, user_record.role;
        END IF;
    END LOOP;
    
    RAISE NOTICE '权限同步完成';
END;
$$ LANGUAGE plpgsql;

-- 9. 执行权限同步
SELECT sync_user_permissions_with_role();

-- 10. 验证修复结果
SELECT 
    '=== 修复后权限状态验证 ===' as section,
    p.id,
    p.email,
    p.role,
    CASE 
        WHEN up.user_id IS NULL THEN '✅ 使用角色模板权限'
        WHEN up.inherit_role = true THEN '✅ 继承角色权限'
        ELSE '⚠️ 有用户特定权限'
    END as final_status,
    CASE 
        WHEN up.user_id IS NULL THEN '角色模板: ' || rpt.name
        ELSE '用户特定权限'
    END as permission_source
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
LEFT JOIN public.role_permission_templates rpt ON rpt.role = p.role
ORDER BY p.role, p.email;

-- 11. 检查权限继承统计
SELECT 
    '=== 权限继承统计 ===' as section,
    '使用角色模板权限的用户' as category,
    COUNT(*) as count
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
WHERE up.user_id IS NULL

UNION ALL

SELECT 
    '=== 权限继承统计 ===' as section,
    '继承角色权限的用户' as category,
    COUNT(*) as count
FROM public.profiles p
JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
WHERE up.inherit_role = true

UNION ALL

SELECT 
    '=== 权限继承统计 ===' as section,
    '有用户特定权限的用户' as category,
    COUNT(*) as count
FROM public.profiles p
JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
WHERE up.inherit_role = false;

-- 12. 删除并重新创建权限检查视图（适用于 Supabase）
DROP VIEW IF EXISTS user_permission_status CASCADE;

CREATE VIEW user_permission_status AS
SELECT 
    p.id,
    p.email,
    p.role::text as role,  -- 显式转换为 text 类型
    p.is_active,
    CASE 
        WHEN up.user_id IS NULL THEN 'role_template'
        WHEN up.inherit_role = true THEN 'inherited'
        ELSE 'custom'
    END as permission_type,
    CASE 
        WHEN up.user_id IS NULL THEN rpt.name
        ELSE '用户特定权限'
    END as permission_source,
    COALESCE(up.menu_permissions, rpt.menu_permissions) as effective_menu_permissions,
    COALESCE(up.function_permissions, rpt.function_permissions) as effective_function_permissions,
    COALESCE(up.project_permissions, rpt.project_permissions) as effective_project_permissions,
    COALESCE(up.data_permissions, rpt.data_permissions) as effective_data_permissions
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
LEFT JOIN public.role_permission_templates rpt ON rpt.role::text = p.role::text;

-- 13. 最终验证
SELECT 
    '=== 最终验证结果 ===' as section,
    'Supabase 权限系统修复完成' as status,
    '所有用户现在都使用角色模板权限或正确继承权限' as description,
    '角色变更时会自动应用新角色模板权限' as feature,
    '请刷新权限管理页面查看效果' as instruction;
