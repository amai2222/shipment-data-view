-- ============================================================================
-- 诊断角色权限不生效问题
-- ============================================================================

-- 📊 Step 1: 检查数据库触发器是否存在
-- ============================================================================

SELECT 
    '====== 检查角色变更触发器 ======' as info;

SELECT 
    tgname as "触发器名称",
    tgenabled as "是否启用",
    pg_get_triggerdef(oid) as "触发器定义"
FROM pg_trigger
WHERE tgname LIKE '%role_change%'
   OR tgname LIKE '%profile%'
ORDER BY tgname;

-- 如果没有找到触发器，说明需要部署

-- 📋 Step 2: 检查用户的权限来源
-- ============================================================================

SELECT 
    '====== 用户权限来源检查 ======' as info;

-- 查看每个用户的权限是来自角色模板还是自定义权限
SELECT 
    p.id::text as user_id,
    p.email,
    p.full_name,
    p.role as "当前角色",
    CASE 
        WHEN up.id IS NOT NULL THEN '🔧 自定义权限'
        ELSE '📋 角色模板'
    END as "权限来源",
    CASE 
        WHEN up.id IS NOT NULL THEN 
            (COALESCE(array_length(up.menu_permissions, 1), 0) +
             COALESCE(array_length(up.function_permissions, 1), 0))::TEXT || ' 个权限'
        ELSE '使用角色默认'
    END as "权限数量"
FROM public.profiles p
LEFT JOIN public.user_permissions up ON up.user_id = p.id AND up.project_id IS NULL
ORDER BY p.email;

-- 🔍 Step 3: 对比角色模板和用户实际权限
-- ============================================================================

SELECT 
    '====== 角色模板 vs 用户实际权限 ======' as info;

SELECT 
    p.email,
    p.role as "角色",
    
    -- 角色模板的权限数量
    COALESCE(array_length(rt.menu_permissions, 1), 0) as "模板菜单权限",
    COALESCE(array_length(rt.function_permissions, 1), 0) as "模板功能权限",
    
    -- 用户实际权限数量
    COALESCE(array_length(up.menu_permissions, 1), 0) as "用户菜单权限",
    COALESCE(array_length(up.function_permissions, 1), 0) as "用户功能权限",
    
    -- 是否一致
    CASE 
        WHEN up.id IS NULL THEN '✅ 使用角色模板'
        WHEN COALESCE(array_length(rt.menu_permissions, 1), 0) = COALESCE(array_length(up.menu_permissions, 1), 0)
         AND COALESCE(array_length(rt.function_permissions, 1), 0) = COALESCE(array_length(up.function_permissions, 1), 0)
        THEN '✅ 权限一致'
        ELSE '⚠️ 权限不一致'
    END as "状态"
FROM public.profiles p
LEFT JOIN public.role_permission_templates rt ON rt.role = p.role
LEFT JOIN public.user_permissions up ON up.user_id = p.id AND up.project_id IS NULL
ORDER BY p.email;

-- ⚠️ Step 4: 找出权限可能不生效的用户
-- ============================================================================

SELECT 
    '====== 可能存在问题的用户 ======' as info;

SELECT 
    p.id::text as user_id,
    p.email,
    p.full_name,
    p.role,
    '有自定义权限，可能覆盖了角色权限' as "问题",
    '执行重置权限' as "建议"
FROM public.profiles p
INNER JOIN public.user_permissions up ON up.user_id = p.id AND up.project_id IS NULL
ORDER BY p.email;

-- 📊 Step 5: 检查角色模板是否存在
-- ============================================================================

SELECT 
    '====== 角色模板检查 ======' as info;

SELECT 
    rt.role as "角色",
    COALESCE(array_length(rt.menu_permissions, 1), 0) as "菜单权限数",
    COALESCE(array_length(rt.function_permissions, 1), 0) as "功能权限数",
    COALESCE(array_length(rt.project_permissions, 1), 0) as "项目权限数",
    COALESCE(array_length(rt.data_permissions, 1), 0) as "数据权限数"
FROM public.role_permission_templates rt
ORDER BY 
    CASE rt.role
        WHEN 'admin' THEN 1
        WHEN 'finance' THEN 2
        WHEN 'business' THEN 3
        WHEN 'operator' THEN 4
        WHEN 'partner' THEN 5
        WHEN 'viewer' THEN 6
        ELSE 999
    END;

-- 检查是否有角色没有模板
SELECT 
    '====== 缺少模板的角色 ======' as info;

SELECT DISTINCT
    p.role as "角色",
    COUNT(p.id) as "用户数",
    '❌ 缺少角色模板' as "问题"
FROM public.profiles p
LEFT JOIN public.role_permission_templates rt ON rt.role = p.role
WHERE rt.role IS NULL
GROUP BY p.role;

-- 🎯 Step 6: 生成修复建议
-- ============================================================================

DO $$
DECLARE
    v_trigger_count INTEGER;
    v_custom_perm_count INTEGER;
    v_missing_template_count INTEGER;
BEGIN
    -- 检查触发器
    SELECT COUNT(*) INTO v_trigger_count
    FROM pg_trigger
    WHERE tgname LIKE '%role_change%' OR tgname LIKE '%profile%';
    
    -- 检查自定义权限用户数
    SELECT COUNT(DISTINCT user_id) INTO v_custom_perm_count
    FROM public.user_permissions
    WHERE project_id IS NULL;
    
    -- 检查缺少模板的角色
    SELECT COUNT(DISTINCT p.role) INTO v_missing_template_count
    FROM public.profiles p
    LEFT JOIN public.role_permission_templates rt ON rt.role = p.role
    WHERE rt.role IS NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '诊断结果:';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    IF v_trigger_count = 0 THEN
        RAISE NOTICE '❌ 未找到角色变更触发器';
        RAISE NOTICE '   建议: 部署触发器（见下面的修复脚本）';
    ELSE
        RAISE NOTICE '✅ 角色变更触发器已部署 (% 个)', v_trigger_count;
    END IF;
    
    RAISE NOTICE '';
    
    IF v_custom_perm_count > 0 THEN
        RAISE NOTICE '⚠️  发现 % 个用户有自定义权限', v_custom_perm_count;
        RAISE NOTICE '   建议: 这些用户修改角色后需要手动重置权限';
    ELSE
        RAISE NOTICE '✅ 所有用户都使用角色模板权限';
    END IF;
    
    RAISE NOTICE '';
    
    IF v_missing_template_count > 0 THEN
        RAISE NOTICE '❌ 有 % 个角色缺少权限模板', v_missing_template_count;
        RAISE NOTICE '   建议: 为这些角色创建权限模板';
    ELSE
        RAISE NOTICE '✅ 所有角色都有权限模板';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

