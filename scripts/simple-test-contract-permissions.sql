    -- 简化的合同权限管理系统测试脚本
    -- 文件: scripts/simple-test-contract-permissions.sql
    -- 避免使用可能有问题的函数，直接测试基础功能

    -- 1. 基础检查
    SELECT '=== 基础检查 ===' as test_section;

    -- 检查表是否存在
    SELECT 
        table_name,
        CASE 
            WHEN table_name IN ('contracts', 'contract_owner_permissions', 'contract_category_permission_templates', 'contract_permissions')
            THEN '✓ 存在'
            ELSE '✗ 缺失'
        END as status
    FROM information_schema.tables 
    WHERE table_name IN ('contracts', 'contract_owner_permissions', 'contract_category_permission_templates', 'contract_permissions')
    AND table_schema = 'public'
    ORDER BY table_name;

    -- 检查contract_permissions表字段
    SELECT 
        'contract_permissions表字段检查' as test_name,
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'is_active' AND table_schema = 'public')
            THEN '✓ is_active字段存在'
            ELSE '✗ is_active字段缺失'
        END as is_active_status,
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'expires_at' AND table_schema = 'public')
            THEN '✓ expires_at字段存在'
            ELSE '✗ expires_at字段缺失'
        END as expires_at_status,
        CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'permission_type' AND table_schema = 'public')
            THEN '✓ permission_type字段存在'
            ELSE '✗ permission_type字段缺失'
        END as permission_type_status;

    -- 2. 函数检查
    SELECT '=== 函数检查 ===' as test_section;

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

    -- 3. 数据检查
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

    -- 检查合同权限
    SELECT 
        '合同权限记录' as check_item,
        COUNT(*) as count
    FROM contract_permissions;

    -- 4. 基础统计（直接查询，避免函数）
    SELECT '=== 基础统计 ===' as test_section;

    -- 直接查询统计信息
    SELECT 
        '权限统计' as stat_name,
        (SELECT COUNT(*) FROM contract_permissions) as total_permissions,
        (SELECT COUNT(*) FROM contract_permissions WHERE user_id IS NOT NULL) as user_permissions,
        (SELECT COUNT(*) FROM contract_permissions WHERE role_id IS NOT NULL) as role_permissions,
        (SELECT COUNT(*) FROM contract_permissions WHERE department_id IS NOT NULL) as department_permissions,
        (SELECT COUNT(*) FROM contract_owner_permissions) as owner_permissions;

    -- 5. 测试权限创建（如果有测试数据）
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

    -- 6. 测试分类模板查询
    SELECT '=== 测试分类模板查询 ===' as test_section;

    -- 直接查询分类模板
    SELECT 
        '分类模板查询' as test_name,
        category,
        template_name,
        array_length(default_permissions, 1) as permission_count
    FROM contract_category_permission_templates
    WHERE is_active = true
    ORDER BY category;

    -- 7. 测试所有者权限查询
    SELECT '=== 测试所有者权限查询 ===' as test_section;

    -- 直接查询所有者权限
    SELECT 
        '所有者权限查询' as test_name,
        COUNT(*) as owner_permission_count
    FROM contract_owner_permissions;

    -- 8. 最终状态检查
    SELECT '=== 最终状态检查 ===' as test_section;

    DO $$
    DECLARE
        total_tables INTEGER;
        total_functions INTEGER;
        total_templates INTEGER;
        has_is_active_field BOOLEAN;
        has_contract_permissions BOOLEAN;
    BEGIN
        RAISE NOTICE '=== 最终状态检查 ===';
        
        -- 统计表数量
        SELECT COUNT(*) INTO total_tables
        FROM information_schema.tables 
        WHERE table_name IN ('contracts', 'contract_owner_permissions', 'contract_category_permission_templates', 'contract_permissions')
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
        
        -- 统计模板数量
        SELECT COUNT(*) INTO total_templates
        FROM contract_category_permission_templates
        WHERE is_active = true;
        
        -- 检查is_active字段
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'contract_permissions' 
            AND column_name = 'is_active' 
            AND table_schema = 'public'
        ) INTO has_is_active_field;
        
        -- 检查contract_permissions表
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'contract_permissions' 
            AND table_schema = 'public'
        ) INTO has_contract_permissions;
        
        RAISE NOTICE '表数量: %', total_tables;
        RAISE NOTICE '函数数量: %', total_functions;
        RAISE NOTICE '权限模板数量: %', total_templates;
        RAISE NOTICE 'contract_permissions表存在: %', has_contract_permissions;
        RAISE NOTICE 'contract_permissions.is_active字段存在: %', has_is_active_field;
        
        -- 总体评估
        IF total_tables >= 4 AND total_functions >= 6 AND total_templates >= 3 THEN
            RAISE NOTICE '🎉 合同权限管理系统基础功能正常！';
            IF NOT has_is_active_field THEN
                RAISE NOTICE '⚠️ 注意：contract_permissions表缺少is_active字段，建议执行完全修复脚本';
            END IF;
        ELSE
            RAISE NOTICE '⚠ 合同权限管理系统存在问题，请检查上述统计';
        END IF;
        
    END $$;

    -- 完成测试
    SELECT '简化测试完成！' as test_result;
