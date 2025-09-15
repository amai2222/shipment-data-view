-- 检查数据库中实际存在的角色数据
-- 分析为什么只显示3种角色

-- 1. 检查 profiles 表中的角色分布
SELECT 'Profiles table role distribution:' as info;
SELECT 
    role,
    COUNT(*) as user_count
FROM public.profiles
GROUP BY role
ORDER BY role;

-- 2. 检查 user_projects 表中的角色分布
SELECT 'User_projects table role distribution:' as info;
SELECT 
    role,
    COUNT(*) as assignment_count
FROM public.user_projects
GROUP BY role
ORDER BY role;

-- 3. 检查 app_role 枚举类型定义
SELECT 'App_role enum values:' as info;
SELECT 
    enumlabel as role_value,
    enumsortorder as sort_order
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'app_role' 
ORDER BY enumsortorder;

-- 4. 检查是否有其他角色数据但被过滤掉了
SELECT 'All distinct role values in profiles (including NULL):' as info;
SELECT 
    COALESCE(role, 'NULL') as role_value,
    COUNT(*) as count
FROM public.profiles
GROUP BY role
ORDER BY role;

-- 5. 检查是否有其他角色数据在 user_projects 中
SELECT 'All distinct role values in user_projects (including NULL):' as info;
SELECT 
    COALESCE(role, 'NULL') as role_value,
    COUNT(*) as count
FROM public.user_projects
GROUP BY role
ORDER BY role;

-- 6. 检查系统配置中定义的角色
SELECT 'System defined roles (from config):' as info;
SELECT unnest(ARRAY['admin', 'finance', 'business', 'operator', 'partner', 'viewer']) as system_role;
