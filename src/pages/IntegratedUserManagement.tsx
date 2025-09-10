import React from 'react';
import { AppLayout } from '@/components/AppLayout';
import { IntegratedUserPermissionManager } from '@/components/IntegratedUserPermissionManager';

export default function IntegratedUserManagement() {
  return (
    <AppLayout>
      <div className="container mx-auto py-6">
        <IntegratedUserPermissionManager />
      </div>
    </AppLayout>
  );
}
