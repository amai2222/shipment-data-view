-- 验证 UNION 查询修复
-- 测试类型转换是否正常工作

-- 1. 检查列类型
SELECT 'Column types check:' as info;
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name IN ('profiles', 'user_projects') 
  AND column_name = 'role'
ORDER BY table_name;

-- 2. 测试 UNION 查询
SELECT 'UNION query test:' as info;
SELECT 
    'Supported roles:' as info,
    string_agg(role_value, ', ' ORDER BY role_value) as roles
FROM (
    SELECT DISTINCT role::text as role_value FROM public.profiles
    UNION
    SELECT DISTINCT role::text as role_value FROM public.user_projects WHERE role IS NOT NULL
) t;

-- 3. 检查数据完整性
SELECT 'Data integrity check:' as info;
SELECT 
    role,
    COUNT(*) as count
FROM public.user_projects
GROUP BY role
ORDER BY role;

-- 4. 测试类型转换
SELECT 'Type conversion test:' as info;
DO $$
DECLARE
    test_role app_role;
BEGIN
    test_role := 'operator'::app_role;
    RAISE NOTICE 'Type conversion successful: %', test_role;
END $$;
