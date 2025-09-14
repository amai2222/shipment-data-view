// 测试修复后的组件
// 文件: src/components/PermissionErrorTest.tsx

import React from 'react';
import { PermissionChangeConfirmDialog } from './PermissionChangeConfirmDialog';
import { PermissionConfigDialog } from './PermissionConfigDialog';

export function PermissionErrorTest() {
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [showConfigDialog, setShowConfigDialog] = React.useState(false);

  // 测试数据
  const testChanges = [
    {
      type: 'user_permission' as const,
      userId: 'test-user-1',
      userName: '测试用户1',
      oldValue: { menu: ['dashboard'] },
      newValue: { menu: ['dashboard', 'users'] },
      description: '修改用户权限: 测试用户1'
    },
    {
      type: 'user_role' as const,
      userId: 'test-user-2',
      userName: '测试用户2',
      oldValue: 'viewer',
      newValue: 'operator',
      description: '修改用户角色: 测试用户2'
    }
  ];

  const testUser = {
    id: 'test-user-1',
    full_name: '测试用户',
    email: 'test@example.com',
    role: 'viewer' as const,
    is_active: true,
    permissions: {
      menu: ['dashboard'],
      function: [],
      project: [],
      data: []
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">权限组件错误修复测试</h2>
      
      <div className="space-x-2">
        <button 
          onClick={() => setShowConfirmDialog(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          测试权限变更确认对话框
        </button>
        
        <button 
          onClick={() => setShowConfigDialog(true)}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          测试权限配置对话框
        </button>
      </div>

      {/* 权限变更确认对话框测试 */}
      <PermissionChangeConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => {
          console.log('确认权限变更');
          setShowConfirmDialog(false);
        }}
        changes={testChanges}
      />

      {/* 权限配置对话框测试 */}
      <PermissionConfigDialog
        user={testUser}
        isOpen={showConfigDialog}
        onClose={() => setShowConfigDialog(false)}
        onSave={(userId, permissions) => {
          console.log('保存权限:', userId, permissions);
          setShowConfigDialog(false);
        }}
      />
    </div>
  );
}

export default PermissionErrorTest;
