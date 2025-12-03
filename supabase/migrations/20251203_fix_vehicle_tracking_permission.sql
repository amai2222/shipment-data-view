-- ============================================================================
-- 修复车辆轨迹查询权限（强制添加）
-- 创建日期：2025-12-03
-- 功能：为所有角色强制添加 contracts.vehicle_tracking 权限
-- ============================================================================

-- 方法1：使用 array_append，如果不存在则添加
UPDATE public.role_permission_templates
SET 
  menu_permissions = CASE
    -- 如果数组为 NULL，初始化为包含该权限的数组
    WHEN menu_permissions IS NULL THEN ARRAY['contracts.vehicle_tracking']::text[]
    -- 如果已经包含，保持不变
    WHEN 'contracts.vehicle_tracking' = ANY(menu_permissions) THEN menu_permissions
    -- 否则追加
    ELSE menu_permissions || ARRAY['contracts.vehicle_tracking']::text[]
  END,
  updated_at = NOW()
WHERE 
  -- 更新所有存在的角色模板
  EXISTS (SELECT 1 FROM public.role_permission_templates rpt2 WHERE rpt2.role = role_permission_templates.role)
  -- 只更新还没有该权限的记录
  AND (menu_permissions IS NULL OR NOT ('contracts.vehicle_tracking' = ANY(menu_permissions)));

-- 方法2：如果方法1没有生效，使用更直接的方式（备用）
-- 为每个角色单独更新
DO $$
DECLARE
  role_name text;
  role_list text[] := ARRAY['admin', 'finance', 'business', 'partner', 'operator', 'viewer', 'driver', 'fleet_manager'];
BEGIN
  FOREACH role_name IN ARRAY role_list
  LOOP
    -- 更新现有记录
    UPDATE public.role_permission_templates
    SET 
      menu_permissions = CASE
        WHEN menu_permissions IS NULL THEN ARRAY['contracts.vehicle_tracking']::text[]
        WHEN 'contracts.vehicle_tracking' = ANY(menu_permissions) THEN menu_permissions
        ELSE menu_permissions || ARRAY['contracts.vehicle_tracking']::text[]
      END,
      updated_at = NOW()
    WHERE role = role_name::app_role
      AND (menu_permissions IS NULL OR NOT ('contracts.vehicle_tracking' = ANY(menu_permissions)));
    
    -- 如果记录不存在，创建新记录
    INSERT INTO public.role_permission_templates (role, menu_permissions, function_permissions, project_permissions, data_permissions)
    SELECT 
      role_name::app_role,
      ARRAY['contracts.vehicle_tracking']::text[],
      ARRAY[]::text[],
      ARRAY[]::text[],
      ARRAY[]::text[]
    WHERE NOT EXISTS (
      SELECT 1 FROM public.role_permission_templates WHERE role = role_name::app_role
    );
  END LOOP;
END $$;

-- 验证更新结果
SELECT 
  role,
  'contracts.vehicle_tracking' = ANY(menu_permissions) as has_vehicle_tracking,
  array_length(menu_permissions, 1) as total_permissions
FROM public.role_permission_templates
ORDER BY role;

