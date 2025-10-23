-- ==========================================
-- 货主看板权限问题排查和修复脚本
-- ==========================================
-- 创建时间: 2025-01-22
-- 功能: 排查和修复货主看板权限问题
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步: 检查当前用户权限配置
-- ============================================================

-- 1. 检查所有用户的角色和权限
DO $$
DECLARE
    user_record RECORD;
    permission_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔍 用户权限配置检查';
    RAISE NOTICE '========================================';
    
    FOR user_record IN 
        SELECT 
            p.id,
            p.email,
            p.role,
            up.menu_permissions,
            up.inherit_role
        FROM profiles p
        LEFT JOIN user_permissions up ON p.id = up.user_id
        ORDER BY p.role, p.email
    LOOP
        RAISE NOTICE '';
        RAISE NOTICE '用户: % (%)', user_record.email, user_record.id;
        RAISE NOTICE '  角色: %', user_record.role;
        RAISE NOTICE '  继承角色权限: %', user_record.inherit_role;
        
        -- 检查是否有货主看板权限
        IF user_record.menu_permissions IS NOT NULL THEN
            IF 'dashboard.shipper' = ANY(user_record.menu_permissions) THEN
                RAISE NOTICE '  ✅ 有货主看板权限';
            ELSE
                RAISE NOTICE '  ❌ 无货主看板权限';
            END IF;
        ELSE
            RAISE NOTICE '  ⚠️  无权限配置记录';
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- 第二步: 检查合作方信息
-- ============================================================

-- 2. 检查所有合作方信息
DO $$
DECLARE
    partner_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🏢 合作方信息检查';
    RAISE NOTICE '========================================';
    
    FOR partner_record IN 
        SELECT 
            id,
            name,
            partner_type,
            is_root,
            hierarchy_path,
            hierarchy_depth
        FROM partners
        ORDER BY partner_type, name
    LOOP
        RAISE NOTICE '';
        RAISE NOTICE '合作方: % (%)', partner_record.name, partner_record.id;
        RAISE NOTICE '  类型: %', partner_record.partner_type;
        RAISE NOTICE '  是否根节点: %', partner_record.is_root;
        RAISE NOTICE '  层级路径: %', partner_record.hierarchy_path;
        RAISE NOTICE '  层级深度: %', partner_record.hierarchy_depth;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- 第三步: 检查角色权限模板
-- ============================================================

-- 3. 检查角色权限模板
DO $$
DECLARE
    template_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📋 角色权限模板检查';
    RAISE NOTICE '========================================';
    
    FOR template_record IN 
        SELECT 
            role,
            menu_permissions,
            function_permissions
        FROM role_permission_templates
        ORDER BY role
    LOOP
        RAISE NOTICE '';
        RAISE NOTICE '角色: %', template_record.role;
        
        -- 检查菜单权限
        IF template_record.menu_permissions IS NOT NULL THEN
            IF 'dashboard.shipper' = ANY(template_record.menu_permissions) THEN
                RAISE NOTICE '  ✅ 有货主看板菜单权限';
            ELSE
                RAISE NOTICE '  ❌ 无货主看板菜单权限';
            END IF;
        ELSE
            RAISE NOTICE '  ⚠️  无菜单权限配置';
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- 第四步: 修复权限配置（如果需要）
-- ============================================================

-- 4. 为没有货主看板权限的用户添加权限
DO $$
DECLARE
    user_record RECORD;
    updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔧 修复用户权限配置';
    RAISE NOTICE '========================================';
    
    -- 为所有用户添加货主看板权限
    FOR user_record IN 
        SELECT DISTINCT p.id, p.role
        FROM profiles p
        LEFT JOIN user_permissions up ON p.id = up.user_id
        WHERE up.menu_permissions IS NULL OR NOT ('dashboard.shipper' = ANY(up.menu_permissions))
    LOOP
        -- 更新或插入用户权限
        INSERT INTO user_permissions (user_id, menu_permissions, inherit_role)
        VALUES (user_record.id, ARRAY['dashboard.shipper'], true)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            menu_permissions = array_append(COALESCE(user_permissions.menu_permissions, '{}'), 'dashboard.shipper'),
            updated_at = NOW();
        
        updated_count := updated_count + 1;
        RAISE NOTICE '已为用户 % (%) 添加货主看板权限', user_record.id, user_record.role;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '共更新了 % 个用户的权限', updated_count;
    RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- 第五步: 创建测试货主（如果没有货主）
-- ============================================================

-- 5. 检查是否有货主类型的合作方
DO $$
DECLARE
    shipper_count INTEGER;
    test_shipper_id UUID;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🏭 检查货主数据';
    RAISE NOTICE '========================================';
    
    -- 统计货主数量
    SELECT COUNT(*) INTO shipper_count
    FROM partners
    WHERE partner_type = '货主';
    
    RAISE NOTICE '当前货主数量: %', shipper_count;
    
    -- 如果没有货主，创建一个测试货主
    IF shipper_count = 0 THEN
        RAISE NOTICE '没有货主数据，创建测试货主...';
        
        INSERT INTO partners (
            name, 
            partner_type, 
            is_root, 
            hierarchy_path, 
            hierarchy_depth,
            created_at,
            updated_at
        ) VALUES (
            '测试货主',
            '货主',
            true,
            '/测试货主',
            0,
            NOW(),
            NOW()
        ) RETURNING id INTO test_shipper_id;
        
        RAISE NOTICE '已创建测试货主，ID: %', test_shipper_id;
    ELSE
        RAISE NOTICE '已有货主数据，无需创建';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- 第六步: 验证修复结果
-- ============================================================

-- 6. 验证修复结果
DO $$
DECLARE
    user_count INTEGER;
    shipper_count INTEGER;
    template_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 修复结果验证';
    RAISE NOTICE '========================================';
    
    -- 统计有货主看板权限的用户
    SELECT COUNT(*) INTO user_count
    FROM user_permissions up
    WHERE 'dashboard.shipper' = ANY(up.menu_permissions);
    
    -- 统计货主数量
    SELECT COUNT(*) INTO shipper_count
    FROM partners
    WHERE partner_type = '货主';
    
    -- 统计有货主看板权限的角色模板
    SELECT COUNT(*) INTO template_count
    FROM role_permission_templates
    WHERE 'dashboard.shipper' = ANY(menu_permissions);
    
    RAISE NOTICE '有货主看板权限的用户: %', user_count;
    RAISE NOTICE '货主数量: %', shipper_count;
    RAISE NOTICE '有货主看板权限的角色模板: %', template_count;
    
    IF user_count > 0 AND shipper_count > 0 AND template_count > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 权限配置修复完成！';
        RAISE NOTICE '现在所有用户都应该能够访问货主看板了。';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  权限配置可能仍有问题，请检查上述数据。';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================
-- 使用说明
-- ============================================================

/*
使用步骤：

1. 执行此脚本排查权限问题
2. 查看输出日志，了解当前权限配置状态
3. 脚本会自动修复权限配置
4. 验证修复结果

如果问题仍然存在，请提供：
- 脚本执行后的完整日志
- 用户的具体角色和权限信息
- 错误页面的调试信息

常见问题：
1. 用户角色是 'partner' 但没有 partnerId
2. 用户关联的合作方不是"货主"类型
3. 权限模板配置错误
4. 用户权限配置错误

解决方案：
1. 将用户关联到正确的货主
2. 修改权限检查逻辑
3. 更新权限配置
4. 创建测试数据
*/
