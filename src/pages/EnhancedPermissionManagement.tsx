// 增强的权限管理页面

import React from 'react';
import { UnifiedPermissionManager } from '@/components/permissions/UnifiedPermissionManager';
import { useAdvancedPermissions } from '@/hooks/useAdvancedPermissions';

export default function EnhancedPermissionManagement() {
  const { loading } = useAdvancedPermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载权限数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <UnifiedPermissionManager 
        onPermissionChange={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
