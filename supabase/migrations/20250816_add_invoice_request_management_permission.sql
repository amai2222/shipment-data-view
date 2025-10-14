-- 为所有菜单项添加完整的权限支持

-- 1. 为admin角色添加所有缺失的权限
UPDATE public.role_permission_templates 
SET menu_permissions = array_cat(menu_permissions, ARRAY[
  'finance.invoice_request_management',
  'maintenance.locations_enhanced',
  'data_maintenance.waybill',
  'data_maintenance.waybill_enhanced',
  'contracts.list'
])
WHERE role = 'admin'
  AND NOT ('finance.invoice_request_management' = ANY(menu_permissions));

-- 2. 为finance角色添加财务相关权限
UPDATE public.role_permission_templates 
SET menu_permissions = array_cat(menu_permissions, ARRAY[
  'finance.invoice_request_management',
  'contracts.list'
])
WHERE role = 'finance'
  AND NOT ('finance.invoice_request_management' = ANY(menu_permissions));

-- 3. 为operator角色添加操作相关权限
UPDATE public.role_permission_templates 
SET menu_permissions = array_cat(menu_permissions, ARRAY[
  'finance.invoice_request_management',
  'maintenance.locations_enhanced',
  'data_maintenance.waybill',
  'data_maintenance.waybill_enhanced',
  'contracts.list'
])
WHERE role = 'operator'
  AND NOT ('finance.invoice_request_management' = ANY(menu_permissions));

-- 4. 为business角色添加业务相关权限
UPDATE public.role_permission_templates 
SET menu_permissions = array_cat(menu_permissions, ARRAY[
  'maintenance.locations_enhanced',
  'contracts.list'
])
WHERE role = 'business'
  AND NOT ('maintenance.locations_enhanced' = ANY(menu_permissions));

-- 5. 确保所有角色都有基本的合同管理权限
UPDATE public.role_permission_templates 
SET menu_permissions = array_append(menu_permissions, 'contracts.list')
WHERE role IN ('admin', 'finance', 'business', 'operator')
  AND NOT ('contracts.list' = ANY(menu_permissions));
