// 自动同步前端菜单权限到数据库
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';

// 从 AppSidebar.tsx 提取所有菜单 key
export const getAllMenuKeys = (): string[] => {
  return [
    // 数据看板
    'dashboard',
    'dashboard.transport',
    'dashboard.financial',
    'dashboard.project',
    'dashboard.shipper',
    'dashboard.quantity',
    
    // 合同管理
    'contracts',
    'contracts.list',
    'contracts.create',
    'contracts.edit',
    'contracts.delete',
    'contracts.audit',
    'contracts.files',
    'contracts.permissions',
    'contracts.reminders',
    'contracts.tags',
    'contracts.numbering',
    
    // 信息维护
    'maintenance',
    'maintenance.projects',
    'maintenance.drivers',
    'maintenance.locations',
    'maintenance.locations_enhanced',
    'maintenance.partners',
    
    // 业务管理
    'business',
    'business.entry',
    'business.scale',
    'business.payment_request',
    'business.payment_requests',
    'business.invoice_request',
    
    // 审核管理
    'audit',
    'audit.invoice',
    'audit.payment',
    
    // 财务管理
    'finance',
    'finance.reconciliation',
    'finance.payment_invoice',
    'finance.payment_requests',
    'finance.invoice_request_management',
    
    // 数据维护
    'data_maintenance',
    'data_maintenance.waybill',
    'data_maintenance.waybill_enhanced',
    
    // 设置
    'settings',
    'settings.users',
    'settings.permissions',
    'settings.contract_permissions',
    'settings.role_templates',
    'settings.integrated',
    'settings.audit_logs',
  ];
};

// 提取所有功能 key（可选）
export const getAllFunctionKeys = (): string[] => {
  return [
    'data', 'data.create', 'data.edit', 'data.delete', 'data.export', 'data.import',
    'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view', 'scale_records.delete',
    'finance', 'finance.view_cost', 'finance.approve_payment', 'finance.generate_invoice', 'finance.reconcile',
    'contract_management', 'contract.view', 'contract.create', 'contract.edit', 'contract.delete', 'contract.archive',
    'contract.files_upload', 'contract.files_download', 'contract.files_delete',
    'contract.permissions_manage', 'contract.audit_logs', 'contract.reminders', 'contract.tags', 'contract.numbering',
    'contract.sensitive_fields', 'contract.approve', 'contract.export',
    'system', 'system.manage_users', 'system.manage_roles', 'system.view_logs', 'system.backup'
  ];
};

// 自动同步菜单权限到数据库
export const autoSyncMenuPermissions = async (): Promise<void> => {
  try {
    const menuKeys = getAllMenuKeys();
    const functionKeys = getAllFunctionKeys();

    console.log('🔄 自动同步菜单权限到数据库...');
    console.log('菜单项数量:', menuKeys.length);
    console.log('功能项数量:', functionKeys.length);

    const { data, error } = await supabase.functions.invoke('sync-menu-permissions', {
      body: {
        menuKeys,
        functionKeys
      }
    });

    if (error) {
      console.warn('菜单权限同步失败（非致命错误）:', error);
      return;
    }

    if (data?.success) {
      console.log('✅ 菜单权限同步成功:', data.message);
      if (data.data?.menu?.added > 0 || data.data?.function?.added > 0) {
        console.log('📊 新增权限:', {
          菜单: data.data.menu.added,
          功能: data.data.function.added
        });
      }
    }
  } catch (error) {
    console.warn('菜单权限同步失败（非致命错误）:', error);
  }
};

// 版本号（当菜单结构变化时，修改这个版本号）
const MENU_VERSION = '2025-11-01-v1';

// 检查是否需要同步
export const shouldSyncMenuPermissions = (): boolean => {
  const lastSyncVersion = localStorage.getItem('menu_sync_version');
  return lastSyncVersion !== MENU_VERSION;
};

// 标记已同步
export const markMenuSynced = (): void => {
  localStorage.setItem('menu_sync_version', MENU_VERSION);
  localStorage.setItem('menu_sync_time', new Date().toISOString());
};

// 智能同步：只在需要时执行
export const smartSyncMenuPermissions = async (): Promise<void> => {
  if (shouldSyncMenuPermissions()) {
    await autoSyncMenuPermissions();
    markMenuSynced();
  } else {
    console.log('✅ 菜单权限已是最新，无需同步');
  }
};

