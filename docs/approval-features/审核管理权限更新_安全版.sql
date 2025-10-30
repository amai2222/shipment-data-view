-- 审核管理权限更新脚本（安全版）
-- 先检查表结构，再执行更新

-- 1. 检查表是否存在
DO $$
BEGIN
    -- 检查 role_permission_templates 表
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_permission_templates') THEN
        RAISE NOTICE '表 role_permission_templates 不存在';
    ELSE
        RAISE NOTICE '表 role_permission_templates 存在';
    END IF;
    
    -- 检查 user_permissions 表
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_permissions') THEN
        RAISE NOTICE '表 user_permissions 不存在';
    ELSE
        RAISE NOTICE '表 user_permissions 存在';
    END IF;
    
    -- 检查 profiles 表
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        RAISE NOTICE '表 profiles 不存在';
    ELSE
        RAISE NOTICE '表 profiles 存在';
    END IF;
END $$;

-- 2. 如果表存在，执行权限更新
DO $$
BEGIN
    -- 更新角色模板权限（如果表存在）
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_permission_templates') THEN
        -- 更新管理员角色
        UPDATE role_permission_templates 
        SET 
            menu_permissions = array_cat(COALESCE(menu_permissions, '{}'), ARRAY['audit', 'audit.invoice', 'audit.payment']),
            updated_at = NOW()
        WHERE role = 'admin';
        
        -- 更新财务角色
        UPDATE role_permission_templates 
        SET 
            menu_permissions = array_cat(COALESCE(menu_permissions, '{}'), ARRAY['audit', 'audit.invoice', 'audit.payment']),
            updated_at = NOW()
        WHERE role = 'finance';
        
        -- 更新操作员角色
        UPDATE role_permission_templates 
        SET 
            menu_permissions = array_cat(COALESCE(menu_permissions, '{}'), ARRAY['audit', 'audit.invoice', 'audit.payment']),
            updated_at = NOW()
        WHERE role = 'operator';
        
        RAISE NOTICE '角色模板权限更新完成';
    ELSE
        RAISE NOTICE '跳过角色模板更新（表不存在）';
    END IF;
END $$;

-- 3. 验证更新结果
SELECT 
    'role_permission_templates' as table_name,
    role,
    menu_permissions,
    updated_at
FROM role_permission_templates 
WHERE role IN ('admin', 'finance', 'operator')
ORDER BY role;
