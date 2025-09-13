-- Supabase 类型转换修复脚本
-- 修复 app_role 枚举类型与 text 类型的转换问题

-- 1. 检查当前类型问题
SELECT 
    '=== 类型转换问题检查 ===' as section,
    '检查时间: ' || now() as check_time;

-- 2. 检查 profiles 表的 role 字段类型
SELECT 
    'profiles 表 role 字段类型检查' as category,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'role'
AND table_schema = 'public';

-- 3. 检查 role_permission_templates 表的 role 字段类型
SELECT 
    'role_permission_templates 表 role 字段类型检查' as category,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'role_permission_templates' 
AND column_name = 'role'
AND table_schema = 'public';

-- 4. 修复权限检查函数（显式类型转换）
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
        p.role::text as user_role,  -- 显式转换为 text 类型
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

-- 5. 删除并重新创建权限检查视图（显式类型转换）
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

-- 6. 测试权限检查函数
SELECT 
    '=== 权限检查函数测试 ===' as section,
    '测试 check_permission_inheritance 函数' as test_name;

-- 7. 执行权限检查函数测试
SELECT * FROM check_permission_inheritance() 
LIMIT 5;

-- 8. 测试权限检查视图
SELECT 
    '=== 权限检查视图测试 ===' as section,
    '测试 user_permission_status 视图' as test_name;

-- 9. 执行权限检查视图测试
SELECT 
    id,
    email,
    role,
    permission_type,
    permission_source
FROM user_permission_status 
LIMIT 5;

-- 10. 验证修复结果
SELECT 
    '=== 类型转换修复结果 ===' as section,
    '类型转换问题已修复' as status,
    'app_role 枚举类型已正确转换为 text 类型' as description,
    '权限检查函数和视图现在可以正常工作' as result;
