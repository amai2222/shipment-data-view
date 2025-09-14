-- 合同权限管理系统测试脚本
-- 文件: scripts/test-contract-permissions-system.sql
-- 用于测试所有合同权限管理功能

-- 1. 测试环境准备
DO $$
DECLARE
    test_user_id UUID;
    test_contract_id UUID;
    test_role_id UUID;
    permission_id UUID;
    test_count INTEGER;
BEGIN
    RAISE NOTICE '=== 开始合同权限管理系统测试 ===';
    
    -- 检查必要的表是否存在
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'contracts表不存在，请先执行安装脚本';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_owner_permissions' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'contract_owner_permissions表不存在，请先执行安装脚本';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_category_permission_templates' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'contract_category_permission_templates表不存在，请先执行安装脚本';
    END IF;
    
    RAISE NOTICE '✓ 所有必要的表都存在';
    
END $$;

-- 2. 测试表结构
SELECT '=== 测试表结构 ===' as test_section;

-- 检查contracts表结构
SELECT 
    'contracts表字段检查' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'user_id' AND table_schema = 'public')
        THEN '✓ user_id字段存在'
        ELSE '✗ user_id字段缺失'
    END as user_id_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'category' AND table_schema = 'public')
        THEN '✓ category字段存在'
        ELSE '✗ category字段缺失'
    END as category_status;

-- 检查权限表结构
SELECT 
    'contract_owner_permissions表字段检查' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_owner_permissions' AND column_name = 'permissions' AND table_schema = 'public')
        THEN '✓ permissions字段存在'
        ELSE '✗ permissions字段缺失'
    END as permissions_status;

SELECT 
    'contract_category_permission_templates表字段检查' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_category_permission_templates' AND column_name = 'role_permissions' AND table_schema = 'public')
        THEN '✓ role_permissions字段存在'
        ELSE '✗ role_permissions字段缺失'
    END as role_permissions_status;

-- 3. 测试函数存在性
SELECT '=== 测试函数存在性 ===' as test_section;

SELECT 
    '函数存在性检查' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'auto_create_contract_owner_permissions' AND routine_schema = 'public')
        THEN '✓ auto_create_contract_owner_permissions函数存在'
        ELSE '✗ auto_create_contract_owner_permissions函数缺失'
    END as trigger_function_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'create_contract_permission' AND routine_schema = 'public')
        THEN '✓ create_contract_permission函数存在'
        ELSE '✗ create_contract_permission函数缺失'
    END as create_permission_function_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_user_contract_permissions' AND routine_schema = 'public')
        THEN '✓ get_user_contract_permissions函数存在'
        ELSE '✗ get_user_contract_permissions函数缺失'
    END as query_permission_function_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_contract_owner_permissions' AND routine_schema = 'public')
        THEN '✓ get_contract_owner_permissions函数存在'
        ELSE '✗ get_contract_owner_permissions函数缺失'
    END as owner_permission_function_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_contract_category_templates' AND routine_schema = 'public')
        THEN '✓ get_contract_category_templates函数存在'
        ELSE '✗ get_contract_category_templates函数缺失'
    END as category_template_function_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_contract_permission_stats' AND routine_schema = 'public')
        THEN '✓ get_contract_permission_stats函数存在'
        ELSE '✗ get_contract_permission_stats函数缺失'
    END as stats_function_status;

-- 4. 测试触发器
SELECT '=== 测试触发器 ===' as test_section;

SELECT 
    '触发器检查' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'auto_create_contract_owner_permissions_trigger' 
            AND event_object_table = 'contracts'
            AND event_object_schema = 'public'
        )
        THEN '✓ 合同所有者权限自动创建触发器存在'
        ELSE '✗ 合同所有者权限自动创建触发器缺失'
    END as trigger_status;

-- 5. 测试RLS策略
SELECT '=== 测试RLS策略 ===' as test_section;

SELECT 
    'RLS策略检查' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'contract_owner_permissions' 
            AND policyname = 'Admins can manage all contract owner permissions'
        )
        THEN '✓ 管理员权限策略存在'
        ELSE '✗ 管理员权限策略缺失'
    END as admin_policy_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'contract_owner_permissions' 
            AND policyname = 'Contract owners can view their own permissions'
        )
        THEN '✓ 所有者权限策略存在'
        ELSE '✗ 所有者权限策略缺失'
    END as owner_policy_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'contract_category_permission_templates' 
            AND policyname = 'Users can view active category templates'
        )
        THEN '✓ 分类模板查看策略存在'
        ELSE '✗ 分类模板查看策略缺失'
    END as template_policy_status;

-- 6. 测试默认数据
SELECT '=== 测试默认数据 ===' as test_section;

-- 检查默认权限模板
SELECT 
    '默认权限模板检查' as test_name,
    COUNT(*) as template_count,
    string_agg(category::text, ', ') as categories
FROM contract_category_permission_templates
WHERE is_active = true;

-- 检查每个分类的权限配置
SELECT 
    category,
    template_name,
    default_permissions,
    role_permissions
FROM contract_category_permission_templates
WHERE is_active = true
ORDER BY category;

-- 7. 测试权限创建功能（如果有测试数据）
DO $$
DECLARE
    test_contract_id UUID;
    test_user_id UUID;
    permission_id UUID;
    test_count INTEGER;
BEGIN
    RAISE NOTICE '=== 测试权限创建功能 ===';
    
    -- 获取测试数据
    SELECT id INTO test_contract_id FROM contracts LIMIT 1;
    SELECT id INTO test_user_id FROM profiles LIMIT 1;
    
    IF test_contract_id IS NOT NULL AND test_user_id IS NOT NULL THEN
        -- 测试权限创建
        BEGIN
            SELECT create_contract_permission(
                test_contract_id,
                'view',
                test_user_id,
                NULL, -- role_id
                NULL, -- department_id
                NULL, -- expires_at
                '测试权限'
            ) INTO permission_id;
            
            RAISE NOTICE '✓ 权限创建成功，ID: %', permission_id;
            
            -- 验证权限是否创建成功
            SELECT COUNT(*) INTO test_count
            FROM contract_permissions
            WHERE id = permission_id;
            
            IF test_count > 0 THEN
                RAISE NOTICE '✓ 权限记录验证成功';
            ELSE
                RAISE NOTICE '✗ 权限记录验证失败';
            END IF;
            
            -- 清理测试数据
            DELETE FROM contract_permissions WHERE id = permission_id;
            RAISE NOTICE '✓ 测试数据清理完成';
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '✗ 权限创建测试失败: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '⚠ 没有测试数据，跳过权限创建测试';
    END IF;
    
END $$;

-- 8. 测试权限查询功能
SELECT '=== 测试权限查询功能 ===' as test_section;

-- 测试所有者权限查询
SELECT 
    '所有者权限查询测试' as test_name,
    COUNT(*) as owner_permission_count
FROM get_contract_owner_permissions();

-- 测试分类模板查询
SELECT 
    '分类模板查询测试' as test_name,
    COUNT(*) as template_count
FROM get_contract_category_templates();

-- 测试权限统计
SELECT 
    '权限统计测试' as test_name,
    total_permissions,
    active_permissions,
    expired_permissions,
    user_permissions,
    role_permissions,
    department_permissions,
    owner_permissions
FROM get_contract_permission_stats();

-- 9. 测试数据完整性
SELECT '=== 测试数据完整性 ===' as test_section;

-- 检查外键约束
SELECT 
    '外键约束检查' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name LIKE '%contract_owner_permissions%' 
            AND constraint_type = 'FOREIGN KEY'
        )
        THEN '✓ 外键约束存在'
        ELSE '✗ 外键约束缺失'
    END as foreign_key_status;

-- 检查唯一约束
SELECT 
    '唯一约束检查' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name LIKE '%contract_owner_permissions%' 
            AND constraint_type = 'UNIQUE'
        )
        THEN '✓ 唯一约束存在'
        ELSE '✗ 唯一约束缺失'
    END as unique_constraint_status;

-- 10. 性能测试
SELECT '=== 性能测试 ===' as test_section;

-- 测试查询性能
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) FROM contract_owner_permissions;

EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) FROM contract_category_permission_templates;

-- 11. 测试结果总结
DO $$
DECLARE
    total_tables INTEGER;
    total_functions INTEGER;
    total_triggers INTEGER;
    total_policies INTEGER;
    total_templates INTEGER;
BEGIN
    RAISE NOTICE '=== 测试结果总结 ===';
    
    -- 统计表数量
    SELECT COUNT(*) INTO total_tables
    FROM information_schema.tables 
    WHERE table_name IN ('contracts', 'contract_owner_permissions', 'contract_category_permission_templates')
    AND table_schema = 'public';
    
    -- 统计函数数量
    SELECT COUNT(*) INTO total_functions
    FROM information_schema.routines 
    WHERE routine_name IN (
        'auto_create_contract_owner_permissions',
        'create_contract_permission',
        'get_user_contract_permissions',
        'get_contract_owner_permissions',
        'get_contract_category_templates',
        'get_contract_permission_stats'
    )
    AND routine_schema = 'public';
    
    -- 统计触发器数量
    SELECT COUNT(*) INTO total_triggers
    FROM information_schema.triggers 
    WHERE trigger_name = 'auto_create_contract_owner_permissions_trigger'
    AND event_object_schema = 'public';
    
    -- 统计策略数量
    SELECT COUNT(*) INTO total_policies
    FROM pg_policies 
    WHERE tablename IN ('contract_owner_permissions', 'contract_category_permission_templates')
    AND schemaname = 'public';
    
    -- 统计模板数量
    SELECT COUNT(*) INTO total_templates
    FROM contract_category_permission_templates
    WHERE is_active = true;
    
    RAISE NOTICE '表数量: %', total_tables;
    RAISE NOTICE '函数数量: %', total_functions;
    RAISE NOTICE '触发器数量: %', total_triggers;
    RAISE NOTICE 'RLS策略数量: %', total_policies;
    RAISE NOTICE '权限模板数量: %', total_templates;
    
    -- 总体评估
    IF total_tables >= 3 AND total_functions >= 6 AND total_triggers >= 1 AND total_policies >= 3 AND total_templates >= 3 THEN
        RAISE NOTICE '🎉 合同权限管理系统测试通过！';
    ELSE
        RAISE NOTICE '⚠ 合同权限管理系统测试未完全通过，请检查上述统计';
    END IF;
    
END $$;

-- 完成测试
SELECT '合同权限管理系统测试完成！' as test_status;
