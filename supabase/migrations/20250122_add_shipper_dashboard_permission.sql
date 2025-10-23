-- ==========================================
-- 货主看板权限配置
-- ==========================================
-- 创建时间: 2025-01-22
-- 功能: 将货主看板(dashboard.shipper)添加到权限系统中
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步: 更新角色权限模板，添加货主看板权限
-- ============================================================

-- 更新管理员权限模板（包含所有权限）
UPDATE public.role_permission_templates
SET 
    menu_permissions = array_append(menu_permissions, 'dashboard.shipper'),
    updated_at = NOW()
WHERE role = 'admin'
  AND NOT ('dashboard.shipper' = ANY(menu_permissions));

-- 更新财务人员权限模板（可以查看货主看板）
UPDATE public.role_permission_templates
SET 
    menu_permissions = array_append(menu_permissions, 'dashboard.shipper'),
    updated_at = NOW()
WHERE role = 'finance'
  AND NOT ('dashboard.shipper' = ANY(menu_permissions));

-- 更新业务人员权限模板（可以查看货主看板）
UPDATE public.role_permission_templates
SET 
    menu_permissions = array_append(menu_permissions, 'dashboard.shipper'),
    updated_at = NOW()
WHERE role = 'business'
  AND NOT ('dashboard.shipper' = ANY(menu_permissions));

-- 更新操作人员权限模板（可以查看货主看板）
UPDATE public.role_permission_templates
SET 
    menu_permissions = array_append(menu_permissions, 'dashboard.shipper'),
    updated_at = NOW()
WHERE role = 'operator'
  AND NOT ('dashboard.shipper' = ANY(menu_permissions));

-- 更新查看者权限模板（可以查看货主看板）
UPDATE public.role_permission_templates
SET 
    menu_permissions = array_append(menu_permissions, 'dashboard.shipper'),
    updated_at = NOW()
WHERE role = 'viewer'
  AND NOT ('dashboard.shipper' = ANY(menu_permissions));

-- 更新合作方权限模板（可以查看货主看板，但需要是货主类型）
UPDATE public.role_permission_templates
SET 
    menu_permissions = array_append(menu_permissions, 'dashboard.shipper'),
    updated_at = NOW()
WHERE role = 'partner'
  AND NOT ('dashboard.shipper' = ANY(menu_permissions));

-- ============================================================
-- 第二步: 为现有用户添加货主看板权限（继承角色权限的用户）
-- ============================================================

-- 为管理员用户添加权限
UPDATE public.user_permissions up
SET 
    menu_permissions = array_append(menu_permissions, 'dashboard.shipper'),
    updated_at = NOW()
FROM public.profiles p
WHERE up.user_id = p.id
  AND p.role = 'admin'
  AND up.inherit_role = true
  AND NOT ('dashboard.shipper' = ANY(up.menu_permissions));

-- 为财务人员添加权限
UPDATE public.user_permissions up
SET 
    menu_permissions = array_append(menu_permissions, 'dashboard.shipper'),
    updated_at = NOW()
FROM public.profiles p
WHERE up.user_id = p.id
  AND p.role = 'finance'
  AND up.inherit_role = true
  AND NOT ('dashboard.shipper' = ANY(up.menu_permissions));

-- 为业务人员添加权限
UPDATE public.user_permissions up
SET 
    menu_permissions = array_append(menu_permissions, 'dashboard.shipper'),
    updated_at = NOW()
FROM public.profiles p
WHERE up.user_id = p.id
  AND p.role = 'business'
  AND up.inherit_role = true
  AND NOT ('dashboard.shipper' = ANY(up.menu_permissions));

-- 为操作人员添加权限
UPDATE public.user_permissions up
SET 
    menu_permissions = array_append(menu_permissions, 'dashboard.shipper'),
    updated_at = NOW()
FROM public.profiles p
WHERE up.user_id = p.id
  AND p.role = 'operator'
  AND up.inherit_role = true
  AND NOT ('dashboard.shipper' = ANY(up.menu_permissions));

-- 为查看者添加权限
UPDATE public.user_permissions up
SET 
    menu_permissions = array_append(menu_permissions, 'dashboard.shipper'),
    updated_at = NOW()
FROM public.profiles p
WHERE up.user_id = p.id
  AND p.role = 'viewer'
  AND up.inherit_role = true
  AND NOT ('dashboard.shipper' = ANY(up.menu_permissions));

-- 为合作方添加权限
UPDATE public.user_permissions up
SET 
    menu_permissions = array_append(menu_permissions, 'dashboard.shipper'),
    updated_at = NOW()
FROM public.profiles p
WHERE up.user_id = p.id
  AND p.role = 'partner'
  AND up.inherit_role = true
  AND NOT ('dashboard.shipper' = ANY(up.menu_permissions));

-- ============================================================
-- 第三步: 验证权限配置
-- ============================================================

DO $$
DECLARE
    v_admin_count INTEGER;
    v_finance_count INTEGER;
    v_business_count INTEGER;
    v_operator_count INTEGER;
    v_viewer_count INTEGER;
    v_partner_count INTEGER;
    v_template_admin INTEGER;
    v_template_finance INTEGER;
    v_template_business INTEGER;
    v_template_operator INTEGER;
    v_template_viewer INTEGER;
    v_template_partner INTEGER;
BEGIN
    -- 统计角色权限模板
    SELECT COUNT(*) INTO v_template_admin
    FROM public.role_permission_templates
    WHERE role = 'admin' AND 'dashboard.shipper' = ANY(menu_permissions);
    
    SELECT COUNT(*) INTO v_template_finance
    FROM public.role_permission_templates
    WHERE role = 'finance' AND 'dashboard.shipper' = ANY(menu_permissions);
    
    SELECT COUNT(*) INTO v_template_business
    FROM public.role_permission_templates
    WHERE role = 'business' AND 'dashboard.shipper' = ANY(menu_permissions);
    
    SELECT COUNT(*) INTO v_template_operator
    FROM public.role_permission_templates
    WHERE role = 'operator' AND 'dashboard.shipper' = ANY(menu_permissions);
    
    SELECT COUNT(*) INTO v_template_viewer
    FROM public.role_permission_templates
    WHERE role = 'viewer' AND 'dashboard.shipper' = ANY(menu_permissions);
    
    SELECT COUNT(*) INTO v_template_partner
    FROM public.role_permission_templates
    WHERE role = 'partner' AND 'dashboard.shipper' = ANY(menu_permissions);
    
    -- 统计用户权限
    SELECT COUNT(DISTINCT up.user_id) INTO v_admin_count
    FROM public.user_permissions up
    JOIN public.profiles p ON up.user_id = p.id
    WHERE p.role = 'admin' AND 'dashboard.shipper' = ANY(up.menu_permissions);
    
    SELECT COUNT(DISTINCT up.user_id) INTO v_finance_count
    FROM public.user_permissions up
    JOIN public.profiles p ON up.user_id = p.id
    WHERE p.role = 'finance' AND 'dashboard.shipper' = ANY(up.menu_permissions);
    
    SELECT COUNT(DISTINCT up.user_id) INTO v_business_count
    FROM public.user_permissions up
    JOIN public.profiles p ON up.user_id = p.id
    WHERE p.role = 'business' AND 'dashboard.shipper' = ANY(up.menu_permissions);
    
    SELECT COUNT(DISTINCT up.user_id) INTO v_operator_count
    FROM public.user_permissions up
    JOIN public.profiles p ON up.user_id = p.id
    WHERE p.role = 'operator' AND 'dashboard.shipper' = ANY(up.menu_permissions);
    
    SELECT COUNT(DISTINCT up.user_id) INTO v_viewer_count
    FROM public.user_permissions up
    JOIN public.profiles p ON up.user_id = p.id
    WHERE p.role = 'viewer' AND 'dashboard.shipper' = ANY(up.menu_permissions);
    
    SELECT COUNT(DISTINCT up.user_id) INTO v_partner_count
    FROM public.user_permissions up
    JOIN public.profiles p ON up.user_id = p.id
    WHERE p.role = 'partner' AND 'dashboard.shipper' = ANY(up.menu_permissions);
    
    -- 输出统计结果
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 货主看板权限配置完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '角色权限模板更新：';
    RAISE NOTICE '  管理员(admin): % 个模板已更新', v_template_admin;
    RAISE NOTICE '  财务(finance): % 个模板已更新', v_template_finance;
    RAISE NOTICE '  业务(business): % 个模板已更新', v_template_business;
    RAISE NOTICE '  操作员(operator): % 个模板已更新', v_template_operator;
    RAISE NOTICE '  查看者(viewer): % 个模板已更新', v_template_viewer;
    RAISE NOTICE '  合作方(partner): % 个模板已更新', v_template_partner;
    RAISE NOTICE '';
    RAISE NOTICE '用户权限更新：';
    RAISE NOTICE '  管理员: % 个用户已更新', v_admin_count;
    RAISE NOTICE '  财务: % 个用户已更新', v_finance_count;
    RAISE NOTICE '  业务: % 个用户已更新', v_business_count;
    RAISE NOTICE '  操作员: % 个用户已更新', v_operator_count;
    RAISE NOTICE '  查看者: % 个用户已更新', v_viewer_count;
    RAISE NOTICE '  合作方: % 个用户已更新', v_partner_count;
    RAISE NOTICE '';
    RAISE NOTICE '权限键: dashboard.shipper';
    RAISE NOTICE '菜单路径: 数据看板 → 货主看板';
    RAISE NOTICE '路由: /dashboard/shipper (桌面端), /m/dashboard/shipper (移动端)';
    RAISE NOTICE '';
    RAISE NOTICE '注意事项：';
    RAISE NOTICE '  ✓ 所有角色都有货主看板的菜单权限';
    RAISE NOTICE '  ✓ 合作方角色需要是货主类型才能查看数据';
    RAISE NOTICE '  ✓ 其他角色可以选择货主查看数据';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

