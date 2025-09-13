-- 用户状态管理功能验证脚本
-- 验证用户禁用/启用功能是否正常工作

-- 1. 检查当前用户状态
SELECT 
    '=== 当前用户状态检查 ===' as section,
    '验证时间: ' || now() as check_time;

-- 2. 查看所有用户的状态
SELECT 
    '=== 所有用户状态 ===' as section;

SELECT 
    id,
    email,
    username,
    full_name,
    role::text as role,
    is_active,
    created_at
FROM public.profiles 
ORDER BY created_at DESC;

-- 3. 检查用户状态分布
SELECT 
    '=== 用户状态分布 ===' as section;

SELECT 
    CASE 
        WHEN is_active = true THEN '启用'
        WHEN is_active = false THEN '禁用'
        ELSE '未知'
    END as status,
    COUNT(*) as count
FROM public.profiles 
GROUP BY is_active
ORDER BY is_active DESC;

-- 4. 检查用户权限关联
SELECT 
    '=== 用户权限关联检查 ===' as section;

SELECT 
    p.id,
    p.email,
    p.is_active,
    COUNT(up.user_id) as permission_count
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id
GROUP BY p.id, p.email, p.is_active
ORDER BY p.created_at DESC;

-- 5. 测试用户状态更新功能
SELECT 
    '=== 用户状态更新测试 ===' as section,
    '注意：以下操作仅用于测试，请谨慎执行' as warning;

-- 示例：禁用一个测试用户（请替换为实际的用户ID）
-- UPDATE public.profiles 
-- SET is_active = false, updated_at = now()
-- WHERE email = 'test@example.com';

-- 示例：启用一个测试用户（请替换为实际的用户ID）
-- UPDATE public.profiles 
-- SET is_active = true, updated_at = now()
-- WHERE email = 'test@example.com';

-- 6. 检查RLS策略
SELECT 
    '=== RLS策略检查 ===' as section;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 7. 前端修复说明
SELECT 
    '=== 前端修复说明 ===' as section,
    '1. 修复了用户状态显示逻辑' as fix_1,
    '2. 修复了禁用/启用按钮的显示' as fix_2,
    '3. 添加了删除用户功能' as fix_3,
    '4. 改进了状态更新后的前端刷新' as fix_4,
    '5. 添加了操作确认对话框' as fix_5;

-- 8. 验证步骤
SELECT 
    '=== 验证步骤 ===' as section,
    '1. 刷新用户管理页面' as step_1,
    '2. 检查用户状态是否正确显示' as step_2,
    '3. 点击禁用按钮测试状态切换' as step_3,
    '4. 检查状态更新后前端是否刷新' as step_4,
    '5. 测试删除用户功能' as step_5;

-- 9. 预期结果
SELECT 
    '=== 预期结果 ===' as section,
    '用户状态应该正确显示为"启用"或"禁用"' as expected_1,
    '点击禁用按钮后，状态应该立即更新' as expected_2,
    '按钮文字应该根据状态变化' as expected_3,
    '删除用户应该有确认对话框' as expected_4,
    '所有操作都应该有成功/失败提示' as expected_5;
