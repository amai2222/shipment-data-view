-- Supabase 视图问题快速修复脚本
-- 专门解决视图列数据类型冲突问题

-- 1. 删除现有视图
DROP VIEW IF EXISTS public.user_permission_status CASCADE;

-- 2. 重新创建视图（正确的数据类型）
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

-- 3. 测试视图
SELECT 
    '视图修复完成' as status,
    'role 列现在是 text 类型' as description;

-- 4. 验证视图查询
SELECT 
    id,
    email,
    role,
    permission_type
FROM public.user_permission_status 
LIMIT 3;
