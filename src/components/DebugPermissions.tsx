import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSimplePermissions } from '@/hooks/useSimplePermissions';
import { DEFAULT_PERMISSIONS } from '@/config/permissions';

export function DebugPermissions() {
  const { user, profile } = useAuth();
  const { hasMenuAccess, loading } = useMenuPermissions();
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    if (user && profile) {
      const info = {
        user: {
          id: user.id,
          email: user.email,
        },
        profile: {
          id: profile.id,
          role: profile.role,
          username: profile.username,
          full_name: profile.full_name,
        },
        permissions: {
          userRole: profile.role,
          loading,
          defaultPermissions: DEFAULT_PERMISSIONS[profile.role as keyof typeof DEFAULT_PERMISSIONS]
        },
        menuChecks: {
          'data_maintenance.waybill': hasMenuAccess('data_maintenance.waybill'),
          'settings.users': hasMenuAccess('settings.users'),
          'settings.permissions': hasMenuAccess('settings.permissions'),
          'settings.integrated': hasMenuAccess('settings.integrated'),
          'settings.audit_logs': hasMenuAccess('settings.audit_logs'),
          'contracts.list': hasMenuAccess('contracts.list'),
          'finance.payment_invoice': hasMenuAccess('finance.payment_invoice'),
        }
      };
      setDebugInfo(info);
      console.log('=== 权限调试信息 ===', info);
    }
  }, [user, profile, hasMenuAccess, loading]);

  if (!debugInfo) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      border: '1px solid #ccc', 
      padding: '10px', 
      borderRadius: '5px',
      fontSize: '12px',
      maxWidth: '300px',
      zIndex: 9999
    }}>
      <h4>权限调试信息</h4>
      <div><strong>用户角色:</strong> {debugInfo.profile.role}</div>
      <div><strong>用户名:</strong> {debugInfo.profile.username}</div>
      <div><strong>权限加载状态:</strong> {debugInfo.permissions.loading ? '加载中...' : '已加载'}</div>
      <div><strong>数据维护权限:</strong> {debugInfo.menuChecks['data_maintenance.waybill'] ? '✅' : '❌'}</div>
      <div><strong>设置权限:</strong> {debugInfo.menuChecks['settings.users'] ? '✅' : '❌'}</div>
      <div><strong>合同权限:</strong> {debugInfo.menuChecks['contracts.list'] ? '✅' : '❌'}</div>
      <div><strong>财务权限:</strong> {debugInfo.menuChecks['finance.payment_invoice'] ? '✅' : '❌'}</div>
      <details>
        <summary>详细权限列表</summary>
        <pre style={{ fontSize: '10px', maxHeight: '200px', overflow: 'auto' }}>
          {JSON.stringify(debugInfo.permissions.defaultPermissions?.menu_permissions, null, 2)}
        </pre>
      </details>
    </div>
  );
}
