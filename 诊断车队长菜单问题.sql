-- ============================================================================
-- 诊断车队长菜单不显示问题
-- ============================================================================

-- 1. 检查谭玉龙的账号信息
SELECT 
    '谭玉龙账号信息' as 检查项,
    id as 用户ID,
    email as 邮箱,
    full_name as 姓名,
    role as 角色,
    is_active as 是否启用
FROM profiles
WHERE email = 'tanyulong@test.com';

-- 2. 检查 fleet_manager 角色模板是否存在
SELECT 
    'fleet_manager角色模板' as 检查项,
    role as 角色,
    name as 角色名称,
    array_length(menu_permissions, 1) as 菜单权限数,
    menu_permissions as 菜单权限列表
FROM role_permission_templates
WHERE role = 'fleet_manager';

-- 3. 检查内部车辆管理的菜单是否在 menu_config 表中
SELECT 
    '内部车辆管理菜单' as 检查项,
    COUNT(*) as 菜单数量,
    COUNT(*) FILTER (WHERE is_active = true) as 启用数量
FROM menu_config
WHERE key LIKE 'internal.%';

-- 4. 列出所有内部车辆管理菜单
SELECT 
    key as 菜单Key,
    title as 标题,
    url as 路由,
    is_active as 是否启用,
    required_permissions as 所需权限
FROM menu_config
WHERE key LIKE 'internal.%'
ORDER BY order_index;

-- 5. 检查车队长是否有内部菜单权限
SELECT 
    'fleet_manager是否包含internal菜单' as 检查项,
    CASE 
        WHEN 'internal.fleet_dashboard' = ANY(menu_permissions) THEN '✅ 有fleet_dashboard权限'
        ELSE '❌ 无fleet_dashboard权限'
    END as fleet_dashboard,
    CASE 
        WHEN 'internal.vehicles' = ANY(menu_permissions) THEN '✅ 有vehicles权限'
        ELSE '❌ 无vehicles权限'
    END as vehicles,
    CASE 
        WHEN 'internal.expense_review' = ANY(menu_permissions) THEN '✅ 有expense_review权限'
        ELSE '❌ 无expense_review权限'
    END as expense_review
FROM role_permission_templates
WHERE role = 'fleet_manager';

-- 6. 检查是否是角色名称问题
SELECT 
    '所有角色枚举值' as 检查项,
    enumlabel as 角色Key
FROM pg_enum
WHERE enumtypid = 'app_role'::regtype
ORDER BY enumsortorder;

-- 7. 如果上面都正常，手动更新车队长权限（强制同步）
DO $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    -- 检查是否已有权限
    SELECT 'internal.fleet_dashboard' = ANY(menu_permissions) INTO v_has_permission
    FROM role_permission_templates
    WHERE role = 'fleet_manager';
    
    IF NOT v_has_permission THEN
        RAISE NOTICE '⚠️ 检测到车队长缺少内部菜单权限，正在修复...';
        
        -- 更新车队长权限
        UPDATE role_permission_templates
        SET menu_permissions = ARRAY[
            'dashboard.transport',
            'dashboard.project',
            'internal.fleet_dashboard',
            'internal.vehicles',
            'internal.expense_review',
            'internal.income_input',
            'internal.ledger',
            'internal.pending_tasks',
            'business.entry',
            'business.scale',
            'maintenance.drivers',
            'maintenance.projects'
        ],
        updated_at = NOW()
        WHERE role = 'fleet_manager';
        
        RAISE NOTICE '✅ 车队长权限已更新';
    ELSE
        RAISE NOTICE '✅ 车队长已有内部菜单权限';
    END IF;
END $$;

-- 8. 再次验证车队长权限
SELECT 
    '最终验证' as 检查项,
    role as 角色,
    array_length(menu_permissions, 1) as 菜单权限数,
    menu_permissions as 菜单权限
FROM role_permission_templates
WHERE role = 'fleet_manager';

-- 9. 建议的解决方案
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔍 诊断完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '如果车队长菜单还是不显示，请检查：';
    RAISE NOTICE '';
    RAISE NOTICE '1. 前端是否重新部署？';
    RAISE NOTICE '   - 提交代码后，Cloudflare Pages 需要2-3分钟部署';
    RAISE NOTICE '   - 检查 Cloudflare Pages 的部署状态';
    RAISE NOTICE '';
    RAISE NOTICE '2. 浏览器缓存是否清除？';
    RAISE NOTICE '   - 按 Ctrl + Shift + R 强制刷新';
    RAISE NOTICE '   - 或清除浏览器所有缓存';
    RAISE NOTICE '';
    RAISE NOTICE '3. 谭玉龙的角色是否正确？';
    RAISE NOTICE '   - 在 profiles 表检查 role = ''fleet_manager''';
    RAISE NOTICE '';
    RAISE NOTICE '4. 前端代码是否正确？';
    RAISE NOTICE '   - 检查 src/components/mobile/MobileLayout.tsx';
    RAISE NOTICE '   - 检查 roles: [''fleet_manager''] 是否存在';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

