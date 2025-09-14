-- 合同权限管理系统快速测试脚本
-- 文件: scripts/quick-test-contract-permissions.sql
-- 快速验证核心功能

-- 1. 基础检查
SELECT '=== 基础检查 ===' as test_section;

-- 检查表是否存在
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('contracts', 'contract_owner_permissions', 'contract_category_permission_templates')
        THEN '✓ 存在'
        ELSE '✗ 缺失'
    END as status
FROM information_schema.tables 
WHERE table_name IN ('contracts', 'contract_owner_permissions', 'contract_category_permission_templates')
AND table_schema = 'public'
ORDER BY table_name;

-- 检查函数是否存在
SELECT 
    routine_name,
    CASE 
        WHEN routine_name IN (
            'auto_create_contract_owner_permissions',
            'create_contract_permission',
            'get_user_contract_permissions',
            'get_contract_owner_permissions',
            'get_contract_category_templates',
            'get_contract_permission_stats'
        )
        THEN '✓ 存在'
        ELSE '✗ 缺失'
    END as status
FROM information_schema.routines 
WHERE routine_name IN (
    'auto_create_contract_owner_permissions',
    'create_contract_permission',
    'get_user_contract_permissions',
    'get_contract_owner_permissions',
    'get_contract_category_templates',
    'get_contract_permission_stats'
)
AND routine_schema = 'public'
ORDER BY routine_name;

-- 2. 数据检查
SELECT '=== 数据检查 ===' as test_section;

-- 检查默认模板
SELECT 
    '默认权限模板' as check_item,
    COUNT(*) as count,
    string_agg(category::text, ', ') as categories
FROM contract_category_permission_templates
WHERE is_active = true;

-- 检查所有者权限
SELECT 
    '所有者权限记录' as check_item,
    COUNT(*) as count
FROM contract_owner_permissions;

-- 3. 功能测试
SELECT '=== 功能测试 ===' as test_section;

-- 测试权限统计
SELECT 
    '权限统计功能' as test_name,
    total_permissions,
    active_permissions,
    owner_permissions
FROM get_contract_permission_stats();

-- 测试分类模板查询
SELECT 
    '分类模板查询' as test_name,
    category,
    template_name,
    array_length(default_permissions, 1) as permission_count
FROM get_contract_category_templates()
ORDER BY category;

-- 4. 快速权限创建测试
DO $$
DECLARE
    test_contract_id UUID;
    test_user_id UUID;
    permission_id UUID;
BEGIN
    RAISE NOTICE '=== 快速权限创建测试 ===';
    
    -- 获取测试数据
    SELECT id INTO test_contract_id FROM contracts LIMIT 1;
    SELECT id INTO test_user_id FROM profiles LIMIT 1;
    
    IF test_contract_id IS NOT NULL AND test_user_id IS NOT NULL THEN
        BEGIN
            -- 创建测试权限
            SELECT create_contract_permission(
                test_contract_id,
                'view',
                test_user_id,
                NULL, NULL, NULL, '快速测试权限'
            ) INTO permission_id;
            
            RAISE NOTICE '✓ 权限创建成功: %', permission_id;
            
            -- 立即删除测试数据
            DELETE FROM contract_permissions WHERE id = permission_id;
            RAISE NOTICE '✓ 测试数据清理完成';
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '✗ 权限创建失败: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '⚠ 没有测试数据，跳过权限创建测试';
    END IF;
    
END $$;

-- 5. 最终状态
SELECT '=== 最终状态 ===' as test_section;

SELECT 
    '系统状态' as status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM contract_category_permission_templates WHERE is_active = true)
        AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_contract_permission_stats')
        THEN '✅ 系统正常运行'
        ELSE '❌ 系统异常'
    END as system_status;

-- 完成
SELECT '快速测试完成！' as test_result;
