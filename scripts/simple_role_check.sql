-- 简单检查角色分布
-- 分析为什么只显示3种角色

-- 1. 检查 profiles 表中的所有角色
SELECT 'Profiles table - all roles:' as info;
SELECT 
    COALESCE(role, 'NULL') as role_value,
    COUNT(*) as user_count
FROM public.profiles
GROUP BY role
ORDER BY role;

-- 2. 检查 user_projects 表中的所有角色
SELECT 'User_projects table - all roles:' as info;
SELECT 
    COALESCE(role::text, 'NULL') as role_value,
    COUNT(*) as assignment_count
FROM public.user_projects
GROUP BY role
ORDER BY role;

-- 3. 检查 app_role 枚举类型
SELECT 'App_role enum values:' as info;
SELECT 
    enumlabel as role_value
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'app_role' 
ORDER BY enumsortorder;

-- 4. 检查是否有其他角色但被过滤掉了
SELECT 'All distinct role values (including NULL):' as info;
SELECT 
    COALESCE(role, 'NULL') as role_value,
    COUNT(*) as count
FROM public.profiles
GROUP BY role
UNION ALL
SELECT 
    COALESCE(role::text, 'NULL') as role_value,
    COUNT(*) as count
FROM public.user_projects
GROUP BY role
ORDER BY role_value;
