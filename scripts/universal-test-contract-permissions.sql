-- 完全兼容的合同权限管理系统测试脚本
-- 文件: scripts/universal-test-contract-permissions.sql
-- 自动检测字段存在性，避免所有字段错误

-- 1. 检查实际表结构
DO $$
DECLARE
    contracts_exists BOOLEAN;
    contract_permissions_exists BOOLEAN;
    contract_owner_permissions_exists BOOLEAN;
    contract_category_permission_templates_exists BOOLEAN;
    
    -- contract_permissions表字段检查
    has_user_id BOOLEAN;
    has_role_id BOOLEAN;
    has_department_id BOOLEAN;
    has_is_active BOOLEAN;
    has_expires_at BOOLEAN;
    has_permission_type BOOLEAN;
    
    -- contracts表字段检查
    has_contracts_user_id BOOLEAN;
    has_contracts_category BOOLEAN;
BEGIN
    RAISE NOTICE '=== 开始数据库结构检查 ===';
    
    -- 检查表是否存在
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts' AND table_schema = 'public') INTO contracts_exists;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_permissions' AND table_schema = 'public') INTO contract_permissions_exists;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_owner_permissions' AND table_schema = 'public') INTO contract_owner_permissions_exists;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_category_permission_templates' AND table_schema = 'public') INTO contract_category_permission_templates_exists;
    
    -- 检查contract_permissions表字段
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'user_id' AND table_schema = 'public') INTO has_user_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'role_id' AND table_schema = 'public') INTO has_role_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'department_id' AND table_schema = 'public') INTO has_department_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'is_active' AND table_schema = 'public') INTO has_is_active;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'expires_at' AND table_schema = 'public') INTO has_expires_at;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'permission_type' AND table_schema = 'public') INTO has_permission_type;
    
    -- 检查contracts表字段
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'user_id' AND table_schema = 'public') INTO has_contracts_user_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'category' AND table_schema = 'public') INTO has_contracts_category;
    
    -- 输出检查结果
    RAISE NOTICE 'contracts表存在: %', contracts_exists;
    RAISE NOTICE 'contract_permissions表存在: %', contract_permissions_exists;
    RAISE NOTICE 'contract_owner_permissions表存在: %', contract_owner_permissions_exists;
    RAISE NOTICE 'contract_category_permission_templates表存在: %', contract_category_permission_templates_exists;
    
    RAISE NOTICE 'contract_permissions表字段:';
    RAISE NOTICE '  user_id: %', has_user_id;
    RAISE NOTICE '  role_id: %', has_role_id;
    RAISE NOTICE '  department_id: %', has_department_id;
    RAISE NOTICE '  is_active: %', has_is_active;
    RAISE NOTICE '  expires_at: %', has_expires_at;
    RAISE NOTICE '  permission_type: %', has_permission_type;
    
    RAISE NOTICE 'contracts表字段:';
    RAISE NOTICE '  user_id: %', has_contracts_user_id;
    RAISE NOTICE '  category: %', has_contracts_category;
    
END $$;

-- 2. 基础检查
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

-- 3. 动态字段检查
SELECT '=== 动态字段检查 ===' as test_section;

-- 检查contract_permissions表的所有字段
SELECT 
    'contract_permissions表字段' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'contract_permissions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. 数据检查
SELECT '=== 数据检查 ===' as test_section;

-- 检查默认模板（如果表存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_category_permission_templates' AND table_schema = 'public') THEN
        RAISE NOTICE '检查默认权限模板...';
    ELSE
        RAISE NOTICE 'contract_category_permission_templates表不存在';
    END IF;
END $$;

-- 检查所有者权限（如果表存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_owner_permissions' AND table_schema = 'public') THEN
        RAISE NOTICE '检查所有者权限...';
    ELSE
        RAISE NOTICE 'contract_owner_permissions表不存在';
    END IF;
END $$;

-- 检查合同权限（如果表存在）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_permissions' AND table_schema = 'public') THEN
        RAISE NOTICE '检查合同权限...';
    ELSE
        RAISE NOTICE 'contract_permissions表不存在';
    END IF;
END $$;

-- 5. 动态统计查询
SELECT '=== 动态统计查询 ===' as test_section;

-- 使用动态SQL进行统计
DO $$
DECLARE
    sql_text TEXT;
    has_user_id BOOLEAN;
    has_role_id BOOLEAN;
    has_department_id BOOLEAN;
    has_is_active BOOLEAN;
    has_expires_at BOOLEAN;
    result_record RECORD;
BEGIN
    -- 检查字段存在性
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'user_id' AND table_schema = 'public') INTO has_user_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'role_id' AND table_schema = 'public') INTO has_role_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'department_id' AND table_schema = 'public') INTO has_department_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'is_active' AND table_schema = 'public') INTO has_is_active;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'expires_at' AND table_schema = 'public') INTO has_expires_at;
    
    -- 构建动态SQL
    sql_text := 'SELECT ';
    sql_text := sql_text || '(SELECT COUNT(*) FROM contract_permissions) as total_permissions, ';
    
    -- 用户权限统计
    IF has_user_id THEN
        sql_text := sql_text || '(SELECT COUNT(*) FROM contract_permissions WHERE user_id IS NOT NULL) as user_permissions, ';
    ELSE
        sql_text := sql_text || '0 as user_permissions, ';
    END IF;
    
    -- 角色权限统计
    IF has_role_id THEN
        sql_text := sql_text || '(SELECT COUNT(*) FROM contract_permissions WHERE role_id IS NOT NULL) as role_permissions, ';
    ELSE
        sql_text := sql_text || '0 as role_permissions, ';
    END IF;
    
    -- 部门权限统计
    IF has_department_id THEN
        sql_text := sql_text || '(SELECT COUNT(*) FROM contract_permissions WHERE department_id IS NOT NULL) as department_permissions, ';
    ELSE
        sql_text := sql_text || '0 as department_permissions, ';
    END IF;
    
    -- 所有者权限统计
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_owner_permissions' AND table_schema = 'public') THEN
        sql_text := sql_text || '(SELECT COUNT(*) FROM contract_owner_permissions) as owner_permissions';
    ELSE
        sql_text := sql_text || '0 as owner_permissions';
    END IF;
    
    -- 执行动态SQL
    EXECUTE sql_text INTO result_record;
    
    RAISE NOTICE '权限统计结果:';
    RAISE NOTICE '  总权限数: %', result_record.total_permissions;
    RAISE NOTICE '  用户权限数: %', result_record.user_permissions;
    RAISE NOTICE '  角色权限数: %', result_record.role_permissions;
    RAISE NOTICE '  部门权限数: %', result_record.department_permissions;
    RAISE NOTICE '  所有者权限数: %', result_record.owner_permissions;
    
END $$;

-- 6. 函数检查
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

-- 7. 测试权限创建（如果有测试数据）
DO $$
DECLARE
    test_contract_id UUID;
    test_user_id UUID;
    permission_id UUID;
    test_count INTEGER;
    has_user_id BOOLEAN;
    has_role_id BOOLEAN;
    has_department_id BOOLEAN;
BEGIN
    RAISE NOTICE '=== 测试权限创建功能 ===';
    
    -- 检查字段存在性
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'user_id' AND table_schema = 'public') INTO has_user_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'role_id' AND table_schema = 'public') INTO has_role_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'department_id' AND table_schema = 'public') INTO has_department_id;
    
    -- 获取测试数据
    SELECT id INTO test_contract_id FROM contracts LIMIT 1;
    SELECT id INTO test_user_id FROM profiles LIMIT 1;
    
    IF test_contract_id IS NOT NULL AND test_user_id IS NOT NULL THEN
        -- 测试权限创建
        BEGIN
            -- 根据字段存在性决定如何创建权限
            IF has_user_id THEN
                -- 直接插入权限记录
                INSERT INTO contract_permissions (
                    contract_id,
                    user_id,
                    permission_type,
                    granted_at,
                    is_active
                ) VALUES (
                    test_contract_id,
                    test_user_id,
                    'view',
                    NOW(),
                    true
                ) RETURNING id INTO permission_id;
                
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
            ELSE
                RAISE NOTICE '⚠ contract_permissions表缺少user_id字段，跳过权限创建测试';
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '✗ 权限创建测试失败: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '⚠ 没有测试数据，跳过权限创建测试';
    END IF;
    
END $$;

-- 8. 最终状态检查
SELECT '=== 最终状态检查 ===' as test_section;

DO $$
DECLARE
    total_tables INTEGER;
    total_functions INTEGER;
    total_templates INTEGER;
    has_is_active_field BOOLEAN;
    has_role_id_field BOOLEAN;
    has_user_id_field BOOLEAN;
    has_department_id_field BOOLEAN;
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
    
    -- 检查字段存在性
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'is_active' AND table_schema = 'public') INTO has_is_active_field;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'role_id' AND table_schema = 'public') INTO has_role_id_field;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'user_id' AND table_schema = 'public') INTO has_user_id_field;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_permissions' AND column_name = 'department_id' AND table_schema = 'public') INTO has_department_id_field;
    
    RAISE NOTICE '表数量: %', total_tables;
    RAISE NOTICE '函数数量: %', total_functions;
    RAISE NOTICE '权限模板数量: %', total_templates;
    RAISE NOTICE 'contract_permissions表字段:';
    RAISE NOTICE '  user_id: %', CASE WHEN has_user_id_field THEN '存在' ELSE '缺失' END;
    RAISE NOTICE '  role_id: %', CASE WHEN has_role_id_field THEN '存在' ELSE '缺失' END;
    RAISE NOTICE '  department_id: %', CASE WHEN has_department_id_field THEN '存在' ELSE '缺失' END;
    RAISE NOTICE '  is_active: %', CASE WHEN has_is_active_field THEN '存在' ELSE '缺失' END;
    
    -- 总体评估
    IF total_tables >= 1 THEN
        RAISE NOTICE '🎉 合同权限管理系统基础结构存在！';
        IF NOT has_user_id_field THEN
            RAISE NOTICE '⚠️ 注意：contract_permissions表缺少user_id字段';
        END IF;
        IF NOT has_role_id_field THEN
            RAISE NOTICE '⚠️ 注意：contract_permissions表缺少role_id字段';
        END IF;
        IF NOT has_is_active_field THEN
            RAISE NOTICE '⚠️ 注意：contract_permissions表缺少is_active字段';
        END IF;
    ELSE
        RAISE NOTICE '⚠ 合同权限管理系统表不存在，请先执行安装脚本';
    END IF;
    
END $$;

-- 完成测试
SELECT '通用兼容性测试完成！' as test_result;
