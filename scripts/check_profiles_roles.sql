-- 检查 profiles 表中的角色分布
-- 这是您的主要角色表

-- 1. 查看 profiles 表结构
SELECT 'Profiles table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 2. 查看所有角色分布
SELECT 'Role distribution in profiles table:' as info;
SELECT 
    COALESCE(role, 'NULL') as role_value,
    COUNT(*) as user_count
FROM public.profiles
GROUP BY role
ORDER BY role;

-- 3. 查看具体的用户和角色信息
SELECT 'User and role details:' as info;
SELECT 
    id,
    email,
    role,
    created_at
FROM public.profiles
ORDER BY role, created_at
LIMIT 20;

-- 4. 检查是否有其他角色但被过滤掉了
SELECT 'All distinct role values:' as info;
SELECT DISTINCT role
FROM public.profiles
WHERE role IS NOT NULL
ORDER BY role;
