import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// 菜单权限映射
const MENU_PERMISSION_MAP = {
  // 数据看板
  '/dashboard/transport': 'dashboard.transport',
  '/dashboard/financial': 'dashboard.financial', 
  '/dashboard/project': 'dashboard.project',
  '/m/dashboard/financial': 'dashboard.financial',
  '/m/dashboard/project': 'dashboard.project',
  
  // 信息维护
  '/projects': 'info.projects',
  '/drivers': 'info.drivers',
  '/locations': 'info.locations', 
  '/partners': 'info.partners',
  '/m/projects': 'info.projects',
  '/m/drivers': 'info.drivers',
  '/m/locations': 'info.locations',
  '/m/partners': 'info.partners',
  
  // 业务录入 
  '/business-entry': 'business.entry',
  '/scale-records': 'business.scale_records',
  '/payment-request': 'business.payment_request',
  '/payment-requests-list': 'business.payment_list',
  '/m/business-entry': 'business.entry',
  '/m/scale-records': 'business.scale_records',
  '/m/payment-request': 'business.payment_request',
  '/m/payment-requests-list': 'business.payment_list',
  
  // 财务对账
  '/finance/reconciliation': 'finance.reconciliation',
  '/finance/payment-invoice': 'finance.payment_invoice',
  
  // 设置
  '/settings/users': 'settings.users',
  '/settings/permissions': 'settings.permissions',
  '/m/settings/users': 'settings.users',
  '/m/settings/permissions': 'settings.permissions'
};

interface MenuPermissions {
  menuPermissions: string[];
  functionPermissions: string[];
  hasMenuAccess: (path: string) => boolean;
  hasFunctionAccess: (functionKey: string) => boolean;
  loading: boolean;
}

export function useMenuPermissions(): MenuPermissions {
  const { profile } = useAuth();
  const [menuPermissions, setMenuPermissions] = useState<string[]>([]);
  const [functionPermissions, setFunctionPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) {
      setMenuPermissions([]);
      setFunctionPermissions([]);
      setLoading(false);
      return;
    }

    loadUserPermissions();
  }, [profile?.id]);

  const loadUserPermissions = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);

      // 1. 首先获取用户特定权限（优先级最高）
      const { data: userPerms } = await supabase
        .from('user_permissions')
        .select('menu_permissions, function_permissions')
        .eq('user_id', profile.id)
        .is('project_id', null) // 全局权限
        .single();

      if (userPerms) {
        setMenuPermissions(userPerms.menu_permissions || []);
        setFunctionPermissions(userPerms.function_permissions || []);
        setLoading(false);
        return;
      }

      // 2. 如果没有用户特定权限，使用角色默认权限
      const { data: roleTemplate } = await supabase
        .from('role_permission_templates')
        .select('menu_permissions, function_permissions')
        .eq('role', profile.role)
        .single();

      if (roleTemplate) {
        setMenuPermissions(roleTemplate.menu_permissions || []);
        setFunctionPermissions(roleTemplate.function_permissions || []);
      } else {
        // 3. 如果没有角色模板，根据角色设置默认权限
        const defaultPermissions = getDefaultPermissionsByRole(profile.role);
        setMenuPermissions(defaultPermissions.menu);
        setFunctionPermissions(defaultPermissions.function);
      }

    } catch (error) {
      console.error('加载用户权限失败:', error);
      // 发生错误时使用角色默认权限
      const defaultPermissions = getDefaultPermissionsByRole(profile.role);
      setMenuPermissions(defaultPermissions.menu);
      setFunctionPermissions(defaultPermissions.function);
    } finally {
      setLoading(false);
    }
  };

  // 根据角色获取默认权限
  const getDefaultPermissionsByRole = (role: string) => {
    const rolePermissions: Record<string, { menu: string[], function: string[] }> = {
      admin: {
        menu: [
          'dashboard.transport', 'dashboard.financial', 'dashboard.project',
          'info.projects', 'info.drivers', 'info.locations', 'info.partners',
          'business.entry', 'business.scale_records', 'business.payment_request', 'business.payment_list',
          'finance.reconciliation', 'finance.payment_invoice',
          'settings.users', 'settings.permissions'
        ],
        function: [
          'data.create', 'data.edit', 'data.delete', 'data.export', 'data.import',
          'scale_records.create', 'scale_records.edit', 'scale_records.view', 'scale_records.delete',
          'finance.view_cost', 'finance.approve_payment', 'finance.generate_invoice', 'finance.reconcile',
          'system.manage_users', 'system.manage_roles', 'system.view_logs', 'system.backup'
        ]
      },
      finance: {
        menu: [
          'dashboard.transport', 'dashboard.financial', 'dashboard.project',
          'info.projects', 'info.drivers', 'info.locations', 'info.partners',
          'business.payment_request', 'business.payment_list',
          'finance.reconciliation', 'finance.payment_invoice'
        ],
        function: [
          'data.export', 'finance.view_cost', 'finance.approve_payment', 
          'finance.generate_invoice', 'finance.reconcile'
        ]
      },
      business: {
        menu: [
          'dashboard.transport', 'dashboard.project',
          'info.projects', 'info.drivers', 'info.locations',
          'business.entry', 'business.scale_records', 'business.payment_request'
        ],
        function: [
          'data.create', 'data.edit', 'data.export',
          'scale_records.create', 'scale_records.edit', 'scale_records.view'
        ]
      },
      operator: {
        menu: [
          'business.entry', 'business.scale_records'
        ],
        function: [
          'data.create', 'scale_records.create', 'scale_records.view'
        ]
      },
      partner: {
        menu: [],
        function: []
      },
      viewer: {
        menu: [
          'dashboard.transport', 'dashboard.financial', 'dashboard.project',
          'info.drivers', 'info.locations', 'info.partners'
        ],
        function: [
          'data.export'
        ]
      }
    };

    return rolePermissions[role] || { menu: [], function: [] };
  };

  const hasMenuAccess = (path: string): boolean => {
    // 管理员有所有权限
    if (profile?.role === 'admin') return true;
    
    // 检查路径是否需要权限验证
    const requiredPermission = MENU_PERMISSION_MAP[path as keyof typeof MENU_PERMISSION_MAP];
    if (!requiredPermission) return true; // 没有定义权限要求的页面默认可访问
    
    return menuPermissions.includes(requiredPermission);
  };

  const hasFunctionAccess = (functionKey: string): boolean => {
    // 管理员有所有权限
    if (profile?.role === 'admin') return true;
    
    return functionPermissions.includes(functionKey);
  };

  return {
    menuPermissions,
    functionPermissions,
    hasMenuAccess,
    hasFunctionAccess,
    loading
  };
}