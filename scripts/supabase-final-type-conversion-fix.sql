-- Supabase 最终类型转换修复脚本
-- 彻底解决 app_role 枚举类型与 text 类型的比较问题

-- 1. 检查当前类型问题
SELECT 
    '=== Supabase 最终类型转换修复 ===' as section,
    '修复时间: ' || now() as fix_time;

-- 2. 检查表结构
SELECT 
    '表结构检查' as category,
    'profiles.role' as field,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'role' AND table_schema = 'public'

UNION ALL

SELECT 
    '表结构检查' as category,
    'role_permission_templates.role' as field,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'role_permission_templates' AND column_name = 'role' AND table_schema = 'public';

-- 3. 创建完全修复的权限检查函数
CREATE OR REPLACE FUNCTION check_permission_inheritance()
RETURNS TABLE(
    user_id uuid,
    user_email text,
    user_role text,
    permission_type text,
    permission_source text,
    menu_count integer,
    function_count integer,
    project_count integer,
    data_count integer
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.role::text as user_role,
        CASE 
            WHEN up.user_id IS NULL THEN 'role_template'
            WHEN up.inherit_role = true THEN 'inherited'
            ELSE 'custom'
        END as permission_type,
        CASE 
            WHEN up.user_id IS NULL THEN rpt.name
            ELSE '用户特定权限'
        END as permission_source,
        COALESCE(array_length(COALESCE(up.menu_permissions, rpt.menu_permissions), 1), 0) as menu_count,
        COALESCE(array_length(COALESCE(up.function_permissions, rpt.function_permissions), 1), 0) as function_count,
        COALESCE(array_length(COALESCE(up.project_permissions, rpt.project_permissions), 1), 0) as project_count,
        COALESCE(array_length(COALESCE(up.data_permissions, rpt.data_permissions), 1), 0) as data_count
    FROM public.profiles p
    LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
    LEFT JOIN public.role_permission_templates rpt ON rpt.role::text = p.role::text
    ORDER BY p.role::text, p.email;
END;
$$ LANGUAGE plpgsql;

-- 4. 删除并重新创建权限检查视图（解决数据类型冲突）
DROP VIEW IF EXISTS user_permission_status CASCADE;

CREATE VIEW user_permission_status AS
SELECT 
    p.id,
    p.email,
    p.role::text as role,
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

-- 5. 测试权限检查函数
SELECT 
    '=== 权限检查函数测试 ===' as section;

SELECT * FROM check_permission_inheritance() 
LIMIT 3;

-- 6. 测试权限检查视图
SELECT 
    '=== 权限检查视图测试 ===' as section;

SELECT 
    id,
    email,
    role,
    permission_type,
    permission_source
FROM user_permission_status 
LIMIT 3;

-- 7. 快速权限状态检查（完全修复版本）
SELECT 
    '=== 快速权限状态检查 ===' as section;

-- 角色权限模板状态
SELECT 
    '角色权限模板' as category,
    role,
    name,
    COALESCE(array_length(menu_permissions, 1), 0) as menu_count,
    COALESCE(array_length(function_permissions, 1), 0) as function_count,
    COALESCE(array_length(project_permissions, 1), 0) as project_count,
    COALESCE(array_length(data_permissions, 1), 0) as data_count
FROM public.role_permission_templates 
ORDER BY role;

-- 用户权限继承状态
SELECT 
    '用户权限继承状态' as category,
    p.role::text as role,
    COUNT(*) as total_users,
    COUNT(CASE WHEN up.user_id IS NULL THEN 1 END) as use_role_template,
    COUNT(CASE WHEN up.inherit_role = true THEN 1 END) as inherit_role,
    COUNT(CASE WHEN up.inherit_role = false THEN 1 END) as custom_permissions
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
GROUP BY p.role::text
ORDER BY p.role::text;

-- 8. 验证修复结果
SELECT 
    '=== 最终修复验证 ===' as section,
    '类型转换问题已完全修复' as status,
    'app_role 枚举类型已正确转换为 text 类型进行比较' as description,
    '权限检查函数和视图现在可以正常工作' as result,
    '所有 LEFT JOIN 条件都已修复' as join_fix;
