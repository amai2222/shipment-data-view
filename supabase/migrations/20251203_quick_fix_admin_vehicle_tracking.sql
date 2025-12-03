-- ============================================================================
-- 快速修复：确保 admin 角色拥有车辆轨迹查询权限
-- 创建日期：2025-12-03
-- 使用说明：直接在 Supabase SQL Editor 中执行此脚本
-- ============================================================================

-- ============================================================================
-- 方法 1: 如果 admin 角色已有 'all' 权限，则无需修改
-- ============================================================================

-- 检查 admin 角色当前权限
SELECT 
    role,
    menu_permissions,
    CASE 
        WHEN 'all' = ANY(menu_permissions) THEN '✅ 已包含 all（拥有所有权限，包括车辆轨迹查询）'
        WHEN 'contracts.vehicle_tracking' = ANY(menu_permissions) THEN '✅ 已包含 contracts.vehicle_tracking'
        ELSE '❌ 缺少 contracts.vehicle_tracking'
    END AS status
FROM public.role_permission_templates
WHERE role = 'admin';

-- ============================================================================
-- 方法 2: 确保 admin 角色包含 'all' 权限（推荐）
-- ============================================================================

-- 如果 admin 角色不存在，创建它
INSERT INTO public.role_permission_templates (role, menu_permissions, function_permissions, project_permissions, data_permissions)
SELECT 
  'admin',
  ARRAY['all']::text[],  -- 使用 'all' 表示拥有所有菜单权限
  ARRAY['all']::text[],  -- 使用 'all' 表示拥有所有功能权限
  ARRAY['all']::text[],  -- 使用 'all' 表示拥有所有项目权限
  ARRAY['all']::text[]   -- 使用 'all' 表示拥有所有数据权限
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permission_templates WHERE role = 'admin'
);

-- 如果 admin 角色存在但没有 'all' 权限，添加它
UPDATE public.role_permission_templates
SET 
  menu_permissions = CASE
    WHEN 'all' = ANY(menu_permissions) THEN menu_permissions  -- 已有 all，不修改
    WHEN 'contracts.vehicle_tracking' = ANY(menu_permissions) THEN 
      -- 如果已有 contracts.vehicle_tracking，添加 'all' 到数组开头
      array_prepend('all', menu_permissions)
    ELSE 
      -- 如果都没有，添加 'all'
      array_prepend('all', COALESCE(menu_permissions, ARRAY[]::text[]))
  END,
  function_permissions = CASE
    WHEN 'all' = ANY(function_permissions) THEN function_permissions
    ELSE array_prepend('all', COALESCE(function_permissions, ARRAY[]::text[]))
  END,
  project_permissions = CASE
    WHEN 'all' = ANY(project_permissions) THEN project_permissions
    ELSE array_prepend('all', COALESCE(project_permissions, ARRAY[]::text[]))
  END,
  data_permissions = CASE
    WHEN 'all' = ANY(data_permissions) THEN data_permissions
    ELSE array_prepend('all', COALESCE(data_permissions, ARRAY[]::text[]))
  END,
  updated_at = NOW()
WHERE role = 'admin'
  AND (
    'all' != ANY(menu_permissions) 
    OR 'all' != ANY(function_permissions)
    OR 'all' != ANY(project_permissions)
    OR 'all' != ANY(data_permissions)
  );

-- ============================================================================
-- 方法 3: 如果不想使用 'all'，只添加 contracts.vehicle_tracking
-- ============================================================================

-- 只添加 contracts.vehicle_tracking 权限（如果 admin 没有 'all'）
UPDATE public.role_permission_templates
SET 
  menu_permissions = CASE
    WHEN 'all' = ANY(menu_permissions) THEN menu_permissions  -- 已有 all，不需要添加
    WHEN 'contracts.vehicle_tracking' = ANY(menu_permissions) THEN menu_permissions  -- 已有，不修改
    ELSE array_append(COALESCE(menu_permissions, ARRAY[]::text[]), 'contracts.vehicle_tracking')  -- 添加
  END,
  updated_at = NOW()
WHERE role = 'admin'
  AND 'all' != ANY(menu_permissions)
  AND 'contracts.vehicle_tracking' != ANY(menu_permissions);

-- ============================================================================
-- 验证修复结果
-- ============================================================================

-- 最终检查
SELECT 
    role,
    menu_permissions,
    function_permissions,
    CASE 
        WHEN 'all' = ANY(menu_permissions) THEN '✅ 拥有所有菜单权限（包括车辆轨迹查询）'
        WHEN 'contracts.vehicle_tracking' = ANY(menu_permissions) THEN '✅ 已包含车辆轨迹查询权限'
        ELSE '❌ 缺少车辆轨迹查询权限'
    END AS status,
    updated_at
FROM public.role_permission_templates
WHERE role = 'admin';

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
DECLARE
    v_has_all BOOLEAN;
    v_has_tracking BOOLEAN;
BEGIN
    SELECT 
        'all' = ANY(menu_permissions),
        'contracts.vehicle_tracking' = ANY(menu_permissions)
    INTO v_has_all, v_has_tracking
    FROM public.role_permission_templates
    WHERE role = 'admin';
    
    IF v_has_all THEN
        RAISE NOTICE '✅ Admin 角色已拥有所有权限（包括车辆轨迹查询）';
    ELSIF v_has_tracking THEN
        RAISE NOTICE '✅ Admin 角色已包含车辆轨迹查询权限';
    ELSE
        RAISE WARNING '❌ Admin 角色缺少车辆轨迹查询权限，请检查上面的 UPDATE 语句是否执行成功';
    END IF;
END $$;

