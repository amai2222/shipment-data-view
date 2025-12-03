-- ============================================================================
-- 检查并修复车辆轨迹查询权限
-- 创建日期：2025-12-03
-- 功能：检查所有角色的 contracts.vehicle_tracking 权限，确保配置正确
-- ============================================================================

-- ============================================================================
-- Step 1: 检查当前权限配置
-- ============================================================================

-- 查看所有角色的菜单权限配置
SELECT 
    role,
    menu_permissions,
    CASE 
        WHEN 'contracts.vehicle_tracking' = ANY(menu_permissions) THEN '✅ 已包含'
        WHEN 'all' = ANY(menu_permissions) THEN '✅ 包含 all（拥有所有权限）'
        ELSE '❌ 缺少'
    END AS vehicle_tracking_status,
    array_length(menu_permissions, 1) AS permission_count
FROM public.role_permission_templates
ORDER BY role;

-- ============================================================================
-- Step 2: 为所有现有角色添加车辆轨迹查询权限
-- ============================================================================

-- 更新所有现有角色，添加 contracts.vehicle_tracking 权限
UPDATE public.role_permission_templates
SET 
  menu_permissions = CASE
    -- 如果 menu_permissions 是 NULL，初始化为数组
    WHEN menu_permissions IS NULL THEN ARRAY['contracts.vehicle_tracking']::text[]
    -- 如果已经包含 'all'，不需要添加（admin 通常有 all）
    WHEN 'all' = ANY(menu_permissions) THEN menu_permissions
    -- 如果已经包含该权限，不做修改
    WHEN 'contracts.vehicle_tracking' = ANY(menu_permissions) THEN menu_permissions
    -- 否则添加该权限
    ELSE array_append(menu_permissions, 'contracts.vehicle_tracking')
  END,
  updated_at = NOW()
WHERE 
  -- 更新所有存在的角色模板
  role IS NOT NULL
  -- 只更新缺少该权限的记录（排除已有 'all' 或已有该权限的）
  AND (
    menu_permissions IS NULL 
    OR (
      'all' != ANY(menu_permissions) 
      AND 'contracts.vehicle_tracking' != ANY(menu_permissions)
    )
  );

-- ============================================================================
-- Step 3: 为不存在的角色创建模板（如果不存在）
-- ============================================================================

-- 为 admin 角色添加权限（如果不存在）
INSERT INTO public.role_permission_templates (role, menu_permissions, function_permissions, project_permissions, data_permissions)
SELECT 
  'admin',
  ARRAY['contracts.vehicle_tracking']::text[],
  ARRAY['all']::text[],
  ARRAY['all']::text[],
  ARRAY['all']::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permission_templates WHERE role = 'admin'
);

-- 为其他常见角色添加权限（如果不存在）
INSERT INTO public.role_permission_templates (role, menu_permissions, function_permissions, project_permissions, data_permissions)
SELECT 
  role_name::app_role,
  ARRAY['contracts.vehicle_tracking']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
FROM (VALUES 
  ('finance'),
  ('business'),
  ('partner'),
  ('operator'),
  ('viewer'),
  ('driver'),
  ('fleet_manager')
) AS roles(role_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permission_templates 
  WHERE role = roles.role_name::app_role
);

-- ============================================================================
-- Step 4: 验证修复结果
-- ============================================================================

-- 再次检查所有角色的权限配置
SELECT 
    role,
    CASE 
        WHEN 'contracts.vehicle_tracking' = ANY(menu_permissions) THEN '✅ 已包含'
        WHEN 'all' = ANY(menu_permissions) THEN '✅ 包含 all（拥有所有权限）'
        ELSE '❌ 缺少'
    END AS vehicle_tracking_status,
    array_length(menu_permissions, 1) AS permission_count,
    updated_at
FROM public.role_permission_templates
ORDER BY role;

-- ============================================================================
-- Step 5: 特别检查 admin 角色
-- ============================================================================

-- 详细查看 admin 角色的权限配置
SELECT 
    role,
    menu_permissions,
    function_permissions,
    project_permissions,
    data_permissions,
    CASE 
        WHEN 'contracts.vehicle_tracking' = ANY(menu_permissions) THEN '✅ 已包含'
        WHEN 'all' = ANY(menu_permissions) THEN '✅ 包含 all（拥有所有权限）'
        ELSE '❌ 缺少 - 需要手动添加'
    END AS vehicle_tracking_status
FROM public.role_permission_templates
WHERE role = 'admin';

-- ============================================================================
-- 手动修复 admin 权限（如果上述更新未生效）
-- ============================================================================

-- 如果 admin 角色缺少权限，可以手动执行以下语句：
/*
UPDATE public.role_permission_templates
SET 
  menu_permissions = CASE
    WHEN 'all' = ANY(menu_permissions) THEN menu_permissions
    WHEN 'contracts.vehicle_tracking' = ANY(menu_permissions) THEN menu_permissions
    ELSE array_append(COALESCE(menu_permissions, ARRAY[]::text[]), 'contracts.vehicle_tracking')
  END,
  updated_at = NOW()
WHERE role = 'admin'
  AND (
    'all' != ANY(menu_permissions) 
    AND 'contracts.vehicle_tracking' != ANY(menu_permissions)
  );
*/

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ 权限检查和修复完成！';
    RAISE NOTICE '请查看上方的查询结果，确认所有角色都已包含 contracts.vehicle_tracking 权限';
    RAISE NOTICE '如果 admin 角色显示 "包含 all"，说明已拥有所有权限（包括车辆轨迹查询）';
END $$;

