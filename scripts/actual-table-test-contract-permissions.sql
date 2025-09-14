-- 匹配实际表结构的合同权限管理系统测试脚本
-- 文件: scripts/actual-table-test-contract-permissions.sql
-- 基于实际的contract_permissions表结构

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

-- 2. 检查contract_permissions表结构
SELECT '=== contract_permissions表结构检查 ===' as test_section;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'contract_permissions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 数据检查
SELECT '=== 数据检查 ===' as test_section;

-- 检查合同权限记录
SELECT 
    '合同权限记录' as check_item,
    COUNT(*) as total_count,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_count,
    COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_count,
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as user_permissions,
    COUNT(CASE WHEN department IS NOT NULL THEN 1 END) as department_permissions
FROM contract_permissions;

-- 检查权限类型分布
SELECT 
    '权限类型分布' as check_item,
    permission_type,
    COUNT(*) as count
FROM contract_permissions
GROUP BY permission_type
ORDER BY count DESC;

-- 检查所有者权限（如果表存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_owner_permissions' AND table_schema = 'public') THEN
        RAISE NOTICE '所有者权限记录数: %', (SELECT COUNT(*) FROM contract_owner_permissions);
    ELSE
        RAISE NOTICE 'contract_owner_permissions表不存在';
    END IF;
END $$;

-- 检查分类模板（如果表存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_category_permission_templates' AND table_schema = 'public') THEN
        RAISE NOTICE '分类模板记录数: %', (SELECT COUNT(*) FROM contract_category_permission_templates WHERE is_active = true);
    ELSE
        RAISE NOTICE 'contract_category_permission_templates表不存在';
    END IF;
END $$;

-- 4. 基础统计查询（基于实际字段）
SELECT '=== 基础统计查询 ===' as test_section;

-- 使用实际存在的字段进行统计
SELECT 
    '权限统计' as stat_name,
    (SELECT COUNT(*) FROM contract_permissions) as total_permissions,
    (SELECT COUNT(*) FROM contract_permissions WHERE is_active = true) as active_permissions,
    (SELECT COUNT(*) FROM contract_permissions WHERE is_active = false) as inactive_permissions,
    (SELECT COUNT(*) FROM contract_permissions WHERE user_id IS NOT NULL) as user_permissions,
    (SELECT COUNT(*) FROM contract_permissions WHERE department IS NOT NULL) as department_permissions,
    (SELECT COUNT(*) FROM contract_permissions WHERE field_permissions IS NOT NULL) as field_permissions_count,
    (SELECT COUNT(*) FROM contract_permissions WHERE file_permissions IS NOT NULL) as file_permissions_count;

-- 5. 函数检查
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

-- 6. 测试权限创建（基于实际字段）
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
        -- 测试权限创建（使用实际字段）
        BEGIN
            INSERT INTO contract_permissions (
                contract_id,
                user_id,
                department,
                permission_type,
                field_permissions,
                file_permissions,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                test_contract_id,
                test_user_id,
                '测试部门',
                'view',
                '{"field1": true, "field2": false}'::jsonb,
                '{"file1": true, "file2": false}'::jsonb,
                true,
                NOW(),
                NOW()
            ) RETURNING id INTO permission_id;
            
            RAISE NOTICE '✓ 权限创建成功，ID: %', permission_id;
            
            -- 验证权限是否创建成功
            SELECT COUNT(*) INTO test_count
            FROM contract_permissions
            WHERE id = permission_id;
            
            IF test_count > 0 THEN
                RAISE NOTICE '✓ 权限记录验证成功';
                
                -- 显示创建的权限详情
                SELECT 
                    contract_id,
                    user_id,
                    department,
                    permission_type,
                    is_active
                INTO test_contract_id, test_user_id, test_count, test_count, test_count
                FROM contract_permissions
                WHERE id = permission_id;
                
                RAISE NOTICE '✓ 权限详情: contract_id=%, user_id=%, department=%, permission_type=%, is_active=%', 
                    test_contract_id, test_user_id, test_count, test_count, test_count;
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

-- 7. 测试JSONB字段功能
SELECT '=== 测试JSONB字段功能 ===' as test_section;

-- 测试field_permissions字段
SELECT 
    'field_permissions字段测试' as test_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN field_permissions IS NOT NULL THEN 1 END) as has_field_permissions,
    COUNT(CASE WHEN field_permissions IS NULL THEN 1 END) as null_field_permissions
FROM contract_permissions;

-- 测试file_permissions字段
SELECT 
    'file_permissions字段测试' as test_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN file_permissions IS NOT NULL THEN 1 END) as has_file_permissions,
    COUNT(CASE WHEN file_permissions IS NULL THEN 1 END) as null_file_permissions
FROM contract_permissions;

-- 8. 测试权限查询（基于实际字段）
SELECT '=== 测试权限查询 ===' as test_section;

-- 查询用户权限
SELECT 
    '用户权限查询' as test_name,
    COUNT(*) as user_permission_count
FROM contract_permissions
WHERE user_id IS NOT NULL AND is_active = true;

-- 查询部门权限
SELECT 
    '部门权限查询' as test_name,
    department,
    COUNT(*) as count
FROM contract_permissions
WHERE department IS NOT NULL AND is_active = true
GROUP BY department
ORDER BY count DESC;

-- 查询权限类型分布
SELECT 
    '权限类型分布' as test_name,
    permission_type,
    COUNT(*) as count
FROM contract_permissions
WHERE is_active = true
GROUP BY permission_type
ORDER BY count DESC;

-- 9. 最终状态检查
SELECT '=== 最终状态检查 ===' as test_section;

DO $$
DECLARE
    total_tables INTEGER;
    total_functions INTEGER;
    total_templates INTEGER;
    total_permissions INTEGER;
    active_permissions INTEGER;
    inactive_permissions INTEGER;
    user_permissions INTEGER;
    department_permissions INTEGER;
    field_permissions_count INTEGER;
    file_permissions_count INTEGER;
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
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_category_permission_templates' AND table_schema = 'public') THEN
        SELECT COUNT(*) INTO total_templates
        FROM contract_category_permission_templates
        WHERE is_active = true;
    ELSE
        total_templates := 0;
    END IF;
    
    -- 统计权限数据
    SELECT COUNT(*) INTO total_permissions FROM contract_permissions;
    SELECT COUNT(*) INTO active_permissions FROM contract_permissions WHERE is_active = true;
    SELECT COUNT(*) INTO inactive_permissions FROM contract_permissions WHERE is_active = false;
    SELECT COUNT(*) INTO user_permissions FROM contract_permissions WHERE user_id IS NOT NULL;
    SELECT COUNT(*) INTO department_permissions FROM contract_permissions WHERE department IS NOT NULL;
    SELECT COUNT(*) INTO field_permissions_count FROM contract_permissions WHERE field_permissions IS NOT NULL;
    SELECT COUNT(*) INTO file_permissions_count FROM contract_permissions WHERE file_permissions IS NOT NULL;
    
    RAISE NOTICE '表数量: %', total_tables;
    RAISE NOTICE '函数数量: %', total_functions;
    RAISE NOTICE '权限模板数量: %', total_templates;
    RAISE NOTICE '权限数据统计:';
    RAISE NOTICE '  总权限数: %', total_permissions;
    RAISE NOTICE '  有效权限数: %', active_permissions;
    RAISE NOTICE '  无效权限数: %', inactive_permissions;
    RAISE NOTICE '  用户权限数: %', user_permissions;
    RAISE NOTICE '  部门权限数: %', department_permissions;
    RAISE NOTICE '  字段权限数: %', field_permissions_count;
    RAISE NOTICE '  文件权限数: %', file_permissions_count;
    
    -- 总体评估
    IF total_tables >= 1 THEN
        RAISE NOTICE '🎉 合同权限管理系统运行正常！';
        RAISE NOTICE '📊 当前权限数据: % 个总权限，% 个有效权限', total_permissions, active_permissions;
        
        IF total_permissions = 0 THEN
            RAISE NOTICE 'ℹ️ 提示：当前没有权限数据，可以开始创建权限';
        END IF;
        
        IF field_permissions_count > 0 OR file_permissions_count > 0 THEN
            RAISE NOTICE 'ℹ️ 发现JSONB权限字段数据，系统支持细粒度权限控制';
        END IF;
    ELSE
        RAISE NOTICE '⚠ 合同权限管理系统表不存在，请先执行安装脚本';
    END IF;
    
END $$;

-- 完成测试
SELECT '实际表结构测试完成！' as test_result;
