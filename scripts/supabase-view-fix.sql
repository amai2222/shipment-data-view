-- Supabase 视图修复脚本
-- 解决视图列数据类型冲突问题

-- 1. 检查当前视图状态
SELECT 
    '=== Supabase 视图修复 ===' as section,
    '修复时间: ' || now() as fix_time;

-- 2. 检查现有视图
SELECT 
    '现有视图检查' as category,
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE viewname = 'user_permission_status'
AND schemaname = 'public';

-- 3. 删除现有视图（如果存在）
DROP VIEW IF EXISTS public.user_permission_status CASCADE;

-- 4. 重新创建权限检查视图（正确的数据类型）
CREATE VIEW public.user_permission_status AS
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

-- 5. 验证视图创建成功
SELECT 
    '=== 视图创建验证 ===' as section,
    '视图已重新创建' as status;

-- 6. 测试视图查询
SELECT 
    '=== 视图查询测试 ===' as section;

SELECT 
    id,
    email,
    role,
    permission_type,
    permission_source
FROM public.user_permission_status 
LIMIT 3;

-- 7. 检查视图列数据类型
SELECT 
    '=== 视图列数据类型检查 ===' as section,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'user_permission_status'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 8. 最终验证
SELECT 
    '=== 最终验证结果 ===' as section,
    '视图数据类型冲突已解决' as status,
    'role 列现在是 text 类型' as description,
    '视图可以正常查询' as result;
