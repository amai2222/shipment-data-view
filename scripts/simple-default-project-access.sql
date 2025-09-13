-- 简单配置：默认所有用户都拥有对所有项目的访问权限
-- 通过清空 user_projects 表来实现默认权限

-- 1. 检查当前状态
SELECT 
    '当前状态检查' as category,
    COUNT(*) as current_records,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 已经是默认权限状态'
        ELSE '需要清空权限记录'
    END as status
FROM public.user_projects;

-- 2. 清空用户项目权限记录
-- 这样系统将使用默认权限：所有用户都可以访问所有项目
DELETE FROM public.user_projects;

-- 3. 验证结果
SELECT 
    '配置结果' as category,
    COUNT(*) as remaining_records,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 配置成功：所有用户默认可以访问所有项目'
        ELSE '❌ 配置失败'
    END as result
FROM public.user_projects;

-- 4. 说明
SELECT 
    '配置说明' as category,
    '现在所有用户都可以访问所有项目' as description,
    '如果需要限制特定用户的项目访问，可以在 user_projects 表中添加记录' as note;
