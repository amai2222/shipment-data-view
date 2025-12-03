-- ============================================================================
-- 验证车辆轨迹查询权限是否正确添加
-- 创建日期：2025-12-03
-- 功能：检查所有角色的权限配置，确认 contracts.vehicle_tracking 是否已添加
-- ============================================================================

-- 1. 检查所有角色的权限配置
SELECT 
  role,
  menu_permissions,
  CASE 
    WHEN 'contracts.vehicle_tracking' = ANY(menu_permissions) THEN '✅ 已包含'
    ELSE '❌ 未包含'
  END as vehicle_tracking_status,
  array_length(menu_permissions, 1) as total_menu_permissions
FROM public.role_permission_templates
ORDER BY role;

-- 2. 检查特定权限是否存在
SELECT 
  role,
  'contracts.vehicle_tracking' = ANY(menu_permissions) as has_vehicle_tracking
FROM public.role_permission_templates
WHERE role IN ('admin', 'finance', 'business', 'operator', 'viewer', 'driver', 'fleet_manager');

-- 3. 如果权限缺失，手动添加（仅用于修复）
-- 注意：这应该已经通过之前的迁移文件完成了
UPDATE public.role_permission_templates
SET 
  menu_permissions = array_append(menu_permissions, 'contracts.vehicle_tracking'),
  updated_at = NOW()
WHERE 
  role IN ('admin', 'finance', 'business', 'operator', 'viewer', 'driver', 'fleet_manager')
  AND ('contracts.vehicle_tracking' != ANY(menu_permissions) OR menu_permissions IS NULL)
  AND NOT ('contracts.vehicle_tracking' = ANY(menu_permissions));

