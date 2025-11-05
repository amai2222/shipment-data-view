
import { useAuth, UserRole } from '@/contexts/AuthContext';

export function usePermissions() {
  const { profile, hasPermission } = useAuth();

  const rolePermissions: Record<UserRole, {
    canViewFinance: boolean;
    canManageProjects: boolean;
    canManagePartners: boolean;
    canExportData: boolean;
    canManageUsers: boolean;
    canViewAllRecords: boolean;
    canCreateRecords: boolean;
    canDeleteRecords: boolean;
  }> = {
    admin: {
      canViewFinance: true,
      canManageProjects: true,
      canManagePartners: true,
      canExportData: true,
      canManageUsers: true,
      canViewAllRecords: true,
      canCreateRecords: true,
      canDeleteRecords: true,
    },
    finance: {
      canViewFinance: true,
      canManageProjects: true,
      canManagePartners: true,
      canExportData: true,
      canManageUsers: false,
      canViewAllRecords: true,
      canCreateRecords: false,
      canDeleteRecords: false,
    },
    business: {
      canViewFinance: true,
      canManageProjects: true,
      canManagePartners: false,
      canExportData: true,
      canManageUsers: false,
      canViewAllRecords: true,
      canCreateRecords: true,
      canDeleteRecords: false,
    },
    operator: {
      canViewFinance: false,
      canManageProjects: false,
      canManagePartners: false,
      canExportData: false,
      canManageUsers: false,
      canViewAllRecords: false,
      canCreateRecords: true,
      canDeleteRecords: false,
    },
    partner: {
      canViewFinance: false,
      canManageProjects: false,
      canManagePartners: false,
      canExportData: false,
      canManageUsers: false,
      canViewAllRecords: false,
      canCreateRecords: false,
      canDeleteRecords: false,
    },
    viewer: {
      canViewFinance: true,
      canManageProjects: false,
      canManagePartners: false,
      canExportData: true,
      canManageUsers: false,
      canViewAllRecords: true,
      canCreateRecords: false,
      canDeleteRecords: false,
    },
    fleet_manager: {
      canViewFinance: false,
      canManageProjects: false,
      canManagePartners: false,
      canExportData: false,
      canManageUsers: false,
      canViewAllRecords: false,
      canCreateRecords: false,
      canDeleteRecords: false,
    },
    driver: {
      canViewFinance: false,
      canManageProjects: false,
      canManagePartners: false,
      canExportData: false,
      canManageUsers: false,
      canViewAllRecords: false,
      canCreateRecords: false,
      canDeleteRecords: false,
    },
  };

  const permissions = profile ? rolePermissions[profile.role] : null;

  // 添加调试日志
  console.log('当前用户角色:', profile?.role);
  console.log('权限检查 - isAdmin:', profile?.role === 'admin');

  return {
    permissions,
    hasPermission,
    role: profile?.role,
    isAdmin: profile?.role === 'admin',
    isFinance: profile?.role === 'finance',
    isBusiness: profile?.role === 'business',
    isOperator: profile?.role === 'operator',
    isPartner: profile?.role === 'partner',
    isViewer: profile?.role === 'viewer',
  };
}
