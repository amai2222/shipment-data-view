-- ============================================================================
-- 添加车辆轨迹查询权限到角色模板
-- 创建日期：2025-12-03
-- 功能：为所有角色添加 contracts.vehicle_tracking 菜单权限
-- ============================================================================

-- 为所有现有角色添加车辆轨迹查询权限
-- 使用更简单直接的方式，确保所有角色都能更新
UPDATE public.role_permission_templates
SET 
  menu_permissions = CASE
    -- 如果 menu_permissions 是 NULL，初始化为数组
    WHEN menu_permissions IS NULL THEN ARRAY['contracts.vehicle_tracking']::text[]
    -- 如果已经包含该权限，不做修改
    WHEN 'contracts.vehicle_tracking' = ANY(menu_permissions) THEN menu_permissions
    -- 否则添加该权限
    ELSE array_append(menu_permissions, 'contracts.vehicle_tracking')
  END,
  updated_at = NOW()
WHERE 
  -- 更新所有存在的角色模板（不限制角色类型，让数据库自己处理）
  role IS NOT NULL
  -- 确保不会重复添加（排除已经包含该权限的记录）
  AND (menu_permissions IS NULL OR 'contracts.vehicle_tracking' != ANY(menu_permissions));

-- 如果某些角色模板不存在，创建它们（可选）
-- 这里只创建基本的角色模板，如果它们不存在的话

-- 为 admin 角色添加权限（如果不存在）
INSERT INTO public.role_permission_templates (role, menu_permissions, function_permissions, project_permissions, data_permissions)
SELECT 
  'admin',
  ARRAY['contracts.vehicle_tracking']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permission_templates WHERE role = 'admin'
);

-- 为其他常见角色添加权限（如果不存在）
INSERT INTO public.role_permission_templates (role, menu_permissions, function_permissions, project_permissions, data_permissions)
SELECT 
  'finance',
  ARRAY['contracts.vehicle_tracking']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permission_templates WHERE role = 'finance'
);

-- 为 business 角色添加权限（如果不存在）
INSERT INTO public.role_permission_templates (role, menu_permissions, function_permissions, project_permissions, data_permissions)
SELECT 
  'business',
  ARRAY['contracts.vehicle_tracking']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permission_templates WHERE role = 'business'
);

-- 为 partner 角色添加权限（如果不存在）
INSERT INTO public.role_permission_templates (role, menu_permissions, function_permissions, project_permissions, data_permissions)
SELECT 
  'partner',
  ARRAY['contracts.vehicle_tracking']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permission_templates WHERE role = 'partner'
);

-- 为 operator 角色添加权限（如果不存在）
INSERT INTO public.role_permission_templates (role, menu_permissions, function_permissions, project_permissions, data_permissions)
SELECT 
  'operator',
  ARRAY['contracts.vehicle_tracking']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permission_templates WHERE role = 'operator'
);

-- 为 viewer 角色添加权限（如果不存在）
INSERT INTO public.role_permission_templates (role, menu_permissions, function_permissions, project_permissions, data_permissions)
SELECT 
  'viewer',
  ARRAY['contracts.vehicle_tracking']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permission_templates WHERE role = 'viewer'
);

-- 为 driver 角色添加权限（如果不存在）
INSERT INTO public.role_permission_templates (role, menu_permissions, function_permissions, project_permissions, data_permissions)
SELECT 
  'driver',
  ARRAY['contracts.vehicle_tracking']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permission_templates WHERE role = 'driver'
);

-- 为 fleet_manager 角色添加权限（如果不存在）
INSERT INTO public.role_permission_templates (role, menu_permissions, function_permissions, project_permissions, data_permissions)
SELECT 
  'fleet_manager',
  ARRAY['contracts.vehicle_tracking']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permission_templates WHERE role = 'fleet_manager'
);

-- 添加注释
COMMENT ON COLUMN public.role_permission_templates.menu_permissions IS '菜单权限列表，包含 contracts.vehicle_tracking（车辆轨迹查询）';

