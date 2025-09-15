-- 验证前端功能所需的数据库函数
-- 这个脚本确保前端角色创建功能正常工作

-- 1. 检查必要的函数是否存在
SELECT '检查数据库函数' as step;

SELECT 
    'check_enum_value' as function_name,
    CASE 
        WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'check_enum_value') THEN '存在'
        ELSE '不存在'
    END as status
UNION ALL
SELECT 
    'add_enum_value' as function_name,
    CASE 
        WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'add_enum_value') THEN '存在'
        ELSE '不存在'
    END as status;

-- 2. 检查当前枚举值
SELECT '当前枚举值' as step;
SELECT enumlabel as role_value 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
ORDER BY enumlabel;

-- 3. 测试函数调用（不实际添加）
SELECT '测试函数调用' as step;
SELECT check_enum_value('app_role', 'admin') as admin_exists;
SELECT check_enum_value('app_role', 'manager') as manager_exists;

-- 4. 检查权限模板表结构
SELECT '权限模板表结构' as step;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'role_permission_templates' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. 检查项目分配表结构
SELECT '项目分配表结构' as step;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_projects' 
AND table_schema = 'public'
ORDER BY ordinal_position;
