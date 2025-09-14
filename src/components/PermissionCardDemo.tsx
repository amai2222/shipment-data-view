// 权限配置卡片式布局演示组件
// 文件: src/components/PermissionCardDemo.tsx

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PermissionConfigDialog } from './PermissionConfigDialog';

// 模拟用户数据
const mockUsers = [
  {
    id: '1',
    full_name: 'szf',
    email: 'dmuxue@gmail.com',
    role: 'admin',
    is_active: true,
    permissions: {
      menu: ['dashboard', 'users', 'contracts', 'reports', 'settings'],
      function: ['create_user', 'edit_user', 'delete_user', 'export_data'],
      project: ['project_view', 'project_create', 'project_edit'],
      data: ['data_read', 'data_write']
    }
  },
  {
    id: '2',
    full_name: '沈朱峰',
    email: 'LaoShen@company.local',
    role: 'admin',
    is_active: true,
    permissions: {
      menu: ['dashboard', 'users', 'contracts', 'reports', 'settings'],
      function: ['create_user', 'edit_user', 'delete_user', 'export_data'],
      project: ['project_view', 'project_create', 'project_edit'],
      data: ['data_read', 'data_write']
    }
  },
  {
    id: '3',
    full_name: 'Administrator',
    email: 'admin@example.com',
    role: 'admin',
    is_active: true,
    permissions: {
      menu: ['dashboard', 'users', 'contracts', 'reports', 'settings'],
      function: ['create_user', 'edit_user', 'delete_user', 'export_data'],
      project: ['project_view', 'project_create', 'project_edit'],
      data: ['data_read', 'data_write']
    }
  },
  {
    id: '4',
    full_name: '王乐',
    email: 'wangle@qq.com',
    role: 'operator',
    is_active: true,
    permissions: {
      menu: ['dashboard', 'contracts'],
      function: ['create_user', 'edit_user'],
      project: ['project_view'],
      data: ['data_read']
    }
  },
  {
    id: '5',
    full_name: '杨晔',
    email: 'ooh@company.local',
    role: 'viewer',
    is_active: true,
    permissions: {
      menu: ['dashboard'],
      function: [],
      project: ['project_view'],
      data: ['data_read']
    }
  },
  {
    id: '6',
    full_name: 'yangye',
    email: 'yangye@example.com',
    role: 'operator',
    is_active: true,
    permissions: {
      menu: ['dashboard', 'contracts'],
      function: ['create_user', 'edit_user'],
      project: ['project_view'],
      data: ['data_read']
    }
  }
];

export function PermissionCardDemo() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogUser, setDialogUser] = useState<any>(null);

  const handleOpenDialog = (user: any) => {
    setDialogUser(user);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setDialogUser(null);
  };

  const handleSavePermissions = (userId: string, permissions: any) => {
    console.log('保存权限:', userId, permissions);
    // 这里可以添加保存逻辑
  };

  const getPermissionCount = (user: any) => {
    if (!user.permissions) return 0;
    return Object.values(user.permissions).flat().length;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>权限配置</CardTitle>
          <CardDescription>
            选择用户后配置个性化权限，支持可视化权限管理
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 搜索栏 */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">选择用户</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜索用户..."
                  className="w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* 用户卡片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockUsers.map(user => (
                <Card 
                  key={user.id} 
                  className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-blue-300"
                  onClick={() => handleOpenDialog(user)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* 用户信息 */}
                      <div>
                        <h3 className="font-semibold text-gray-900">{user.full_name}</h3>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      
                      {/* 角色标签 */}
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={
                            user.role === 'admin' ? 'destructive' :
                            user.role === 'operator' ? 'default' :
                            'secondary'
                          }
                          className="text-xs"
                        >
                          {user.role}
                        </Badge>
                      </div>
                      
                      {/* 权限数量 */}
                      <div className="text-sm text-gray-600">
                        权限数量: <span className="font-medium text-blue-600">
                          {getPermissionCount(user)}项
                        </span>
                      </div>
                      
                      {/* 配置按钮 */}
                      <div className="pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDialog(user);
                          }}
                        >
                          点击配置权限
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 权限配置弹窗 */}
      <PermissionConfigDialog
        user={dialogUser}
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSavePermissions}
      />
    </div>
  );
}

export default PermissionCardDemo;
