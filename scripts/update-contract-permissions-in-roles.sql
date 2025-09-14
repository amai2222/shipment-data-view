-- 更新角色模板，添加合同权限管理权限
-- 确保admin角色包含所有合同权限

-- 1. 更新admin角色的功能权限，添加合同审批权限
UPDATE public.role_permission_templates 
SET function_permissions = array_cat(
  function_permissions, 
  ARRAY['contract.approve']::text[]
)
WHERE role = 'admin' 
  AND NOT ('contract.approve' = ANY(function_permissions));

-- 2. 确保admin角色包含所有合同管理权限
UPDATE public.role_permission_templates 
SET function_permissions = array_cat(
  function_permissions, 
  ARRAY[
    'contract.view',
    'contract.create', 
    'contract.edit',
    'contract.delete',
    'contract.archive',
    'contract.files_upload',
    'contract.files_download', 
    'contract.files_delete',
    'contract.permissions_manage',
    'contract.audit_logs',
    'contract.reminders',
    'contract.tags',
    'contract.numbering',
    'contract.sensitive_fields',
    'contract.approve',
    'contract.export'
  ]::text[]
)
WHERE role = 'admin';

-- 3. 更新business角色的合同权限（业务人员应该有部分合同权限）
UPDATE public.role_permission_templates 
SET function_permissions = array_cat(
  function_permissions, 
  ARRAY[
    'contract.view',
    'contract.create',
    'contract.edit', 
    'contract.archive',
    'contract.files_upload',
    'contract.files_download',
    'contract.tags',
    'contract.numbering'
  ]::text[]
)
WHERE role = 'business'
  AND NOT ('contract.view' = ANY(function_permissions));

-- 4. 更新finance角色的合同权限（财务人员应该有财务相关权限）
UPDATE public.role_permission_templates 
SET function_permissions = array_cat(
  function_permissions, 
  ARRAY[
    'contract.view',
    'contract.files_download',
    'contract.sensitive_fields',
    'contract.approve',
    'contract.export'
  ]::text[]
)
WHERE role = 'finance'
  AND NOT ('contract.view' = ANY(function_permissions));

-- 5. 更新operator角色的合同权限（操作员只有查看权限）
UPDATE public.role_permission_templates 
SET function_permissions = array_cat(
  function_permissions, 
  ARRAY[
    'contract.view',
    'contract.files_download'
  ]::text[]
)
WHERE role = 'operator'
  AND NOT ('contract.view' = ANY(function_permissions));

-- 6. 更新viewer角色的合同权限（查看者只有查看权限）
UPDATE public.role_permission_templates 
SET function_permissions = array_cat(
  function_permissions, 
  ARRAY[
    'contract.view',
    'contract.files_download'
  ]::text[]
)
WHERE role = 'viewer'
  AND NOT ('contract.view' = ANY(function_permissions));

-- 7. 验证更新结果
SELECT 
  '=== 角色权限更新验证 ===' as section;

SELECT 
  role,
  array_length(function_permissions, 1) as total_permissions,
  array_length(
    array(
      SELECT unnest(function_permissions) 
      WHERE unnest(function_permissions) LIKE 'contract.%'
    ), 1
  ) as contract_permissions_count,
  array(
    SELECT unnest(function_permissions) 
    WHERE unnest(function_permissions) LIKE 'contract.%'
  ) as contract_permissions
FROM public.role_permission_templates
ORDER BY role;

-- 8. 检查合同权限管理权限是否已包含
SELECT 
  '=== 合同权限管理权限检查 ===' as section;

SELECT 
  role,
  CASE 
    WHEN 'contract.permissions_manage' = ANY(function_permissions) 
    THEN '✅ 已包含' 
    ELSE '❌ 未包含' 
  END as has_permission_manage,
  CASE 
    WHEN 'contract.approve' = ANY(function_permissions) 
    THEN '✅ 已包含' 
    ELSE '❌ 未包含' 
  END as has_approve_permission
FROM public.role_permission_templates
ORDER BY role;
