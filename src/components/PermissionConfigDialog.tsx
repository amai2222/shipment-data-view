// 权限配置弹窗组件
// 文件: src/components/PermissionConfigDialog.tsx

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Shield, 
  Users, 
  Building2, 
  Database,
  Save,
  X,
  RefreshCw,
  Copy,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PermissionDatabaseService } from '@/services/PermissionDatabaseService';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  permissions?: {
    menu: string[];
    function: string[];
    project: string[];
    data: string[];
  };
}

interface PermissionConfigDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, permissions: any) => void;
}

// 根据角色获取默认权限
const getDefaultPermissionsByRole = (role: string) => {
  const allPermissions = {
    menu: ['dashboard', 'users', 'contracts', 'reports', 'settings'],
    function: ['create_user', 'edit_user', 'delete_user', 'export_data', 'import_data'],
    project: ['project_view', 'project_create', 'project_edit', 'project_delete'],
    data: ['data_read', 'data_write', 'data_delete']
  };

  switch (role) {
    case 'admin':
      return allPermissions; // 超级用户拥有所有权限
    case 'operator':
      return {
        menu: ['dashboard', 'contracts', 'reports'],
        function: ['create_user', 'edit_user', 'export_data'],
        project: ['project_view', 'project_create', 'project_edit'],
        data: ['data_read', 'data_write']
      };
    case 'viewer':
      return {
        menu: ['dashboard'],
        function: [],
        project: ['project_view'],
        data: ['data_read']
      };
    default:
      return {
        menu: [],
        function: [],
        project: [],
        data: []
      };
  }
};

// 模拟权限数据
const mockPermissions = {
  menu: [
    { id: 'dashboard', name: '仪表盘', description: '查看系统仪表盘' },
    { id: 'users', name: '用户管理', description: '管理用户信息' },
    { id: 'contracts', name: '合同管理', description: '管理合同信息' },
    { id: 'reports', name: '报表管理', description: '查看各类报表' },
    { id: 'settings', name: '系统设置', description: '系统配置管理' }
  ],
  function: [
    { id: 'create_user', name: '创建用户', description: '创建新用户账户' },
    { id: 'edit_user', name: '编辑用户', description: '修改用户信息' },
    { id: 'delete_user', name: '删除用户', description: '删除用户账户' },
    { id: 'export_data', name: '导出数据', description: '导出系统数据' },
    { id: 'import_data', name: '导入数据', description: '导入系统数据' }
  ],
  project: [
    { id: 'project_view', name: '查看项目', description: '查看项目信息' },
    { id: 'project_create', name: '创建项目', description: '创建新项目' },
    { id: 'project_edit', name: '编辑项目', description: '修改项目信息' },
    { id: 'project_delete', name: '删除项目', description: '删除项目' }
  ],
  data: [
    { id: 'data_read', name: '读取数据', description: '读取系统数据' },
    { id: 'data_write', name: '写入数据', description: '修改系统数据' },
    { id: 'data_delete', name: '删除数据', description: '删除系统数据' }
  ]
};

export function PermissionConfigDialog({ 
  user, 
  isOpen, 
  onClose, 
  onSave 
}: PermissionConfigDialogProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, string[]>>({
    menu: [],
    function: [],
    project: [],
    data: []
  });

  const [activeTab, setActiveTab] = useState('menu');
  const [loading, setLoading] = useState(false);
  const [availablePermissions, setAvailablePermissions] = useState<Record<string, any[]>>({
    menu: [],
    function: [],
    project: [],
    data: []
  });

  // 从数据库加载权限数据
  const loadPermissionsFromDatabase = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // 使用数据库服务获取用户有效权限
      const effectivePermissions = await PermissionDatabaseService.getUserEffectivePermissions(
        user.id, 
        user.role
      );

      setSelectedPermissions({
        menu: effectivePermissions.menu_permissions,
        function: effectivePermissions.function_permissions,
        project: effectivePermissions.project_permissions,
        data: effectivePermissions.data_permissions
      });

      console.log(`权限来源: ${effectivePermissions.source}`, effectivePermissions);

    } catch (error) {
      console.error('加载权限数据失败:', error);
      // 使用默认权限作为后备
      const defaultPermissions = getDefaultPermissionsByRole(user.role);
      setSelectedPermissions(defaultPermissions);
    } finally {
      setLoading(false);
    }
  };

  // 初始化权限选择
  useEffect(() => {
    if (user && isOpen) {
      loadPermissionsFromDatabase();
    }
  }, [user, isOpen]);

  const handlePermissionToggle = (category: string, permissionId: string) => {
    setSelectedPermissions(prev => {
      const current = prev[category] || [];
      const updated = current.includes(permissionId)
        ? current.filter(id => id !== permissionId)
        : [...current, permissionId];
      
      return {
        ...prev,
        [category]: updated
      };
    });
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // 使用数据库服务保存权限
      await PermissionDatabaseService.saveUserPermissions(user.id, {
        menu_permissions: selectedPermissions.menu,
        function_permissions: selectedPermissions.function,
        project_permissions: selectedPermissions.project,
        data_permissions: selectedPermissions.data
      });

      // 调用父组件的保存回调
      onSave(user.id, selectedPermissions);
      onClose();
      
    } catch (error) {
      console.error('保存权限失败:', error);
      // 这里可以添加错误提示
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (user) {
      await loadPermissionsFromDatabase();
    }
  };

  const handleSelectAll = (category: string) => {
    const allPermissions = mockPermissions[category as keyof typeof mockPermissions].map(p => p.id);
    setSelectedPermissions(prev => ({
      ...prev,
      [category]: allPermissions
    }));
  };

  const handleDeselectAll = (category: string) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [category]: []
    }));
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            权限配置 - {user.full_name}
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </DialogTitle>
          <DialogDescription>
            为用户 {user.email} 配置个性化权限
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 用户信息卡片 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">{user.full_name}</h3>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={
                      user.role === 'admin' ? 'destructive' :
                      user.role === 'operator' ? 'default' :
                      'secondary'
                    }
                  >
                    {user.role}
                  </Badge>
                  <Badge variant={user.is_active ? "default" : "secondary"}>
                    {user.is_active ? "启用" : "禁用"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重置权限
                  </Button>
                  <Button variant="outline" size="sm">
                    <Copy className="h-4 w-4 mr-2" />
                    复制权限
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 权限配置标签页 */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="menu" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                菜单权限
              </TabsTrigger>
              <TabsTrigger value="function" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                功能权限
              </TabsTrigger>
              <TabsTrigger value="project" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                项目权限
              </TabsTrigger>
              <TabsTrigger value="data" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                数据权限
              </TabsTrigger>
            </TabsList>

            {/* 菜单权限 */}
            <TabsContent value="menu" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>菜单权限</span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSelectAll('menu')}
                      >
                        全选
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeselectAll('menu')}
                      >
                        全不选
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    控制用户可以访问的菜单项
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockPermissions.menu.map(permission => (
                      <div key={permission.id} className="flex items-center space-x-3">
                        <Checkbox
                          id={permission.id}
                          checked={selectedPermissions.menu?.includes(permission.id) || false}
                          onCheckedChange={() => handlePermissionToggle('menu', permission.id)}
                        />
                        <div className="flex-1">
                          <label 
                            htmlFor={permission.id}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {permission.name}
                          </label>
                          <p className="text-xs text-gray-600">{permission.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 功能权限 */}
            <TabsContent value="function" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>功能权限</span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSelectAll('function')}
                      >
                        全选
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeselectAll('function')}
                      >
                        全不选
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    控制用户可以执行的功能操作
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockPermissions.function.map(permission => (
                      <div key={permission.id} className="flex items-center space-x-3">
                        <Checkbox
                          id={permission.id}
                          checked={selectedPermissions.function?.includes(permission.id) || false}
                          onCheckedChange={() => handlePermissionToggle('function', permission.id)}
                        />
                        <div className="flex-1">
                          <label 
                            htmlFor={permission.id}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {permission.name}
                          </label>
                          <p className="text-xs text-gray-600">{permission.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 项目权限 */}
            <TabsContent value="project" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>项目权限</span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSelectAll('project')}
                      >
                        全选
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeselectAll('project')}
                      >
                        全不选
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    控制用户对项目的访问权限
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockPermissions.project.map(permission => (
                      <div key={permission.id} className="flex items-center space-x-3">
                        <Checkbox
                          id={permission.id}
                          checked={selectedPermissions.project?.includes(permission.id) || false}
                          onCheckedChange={() => handlePermissionToggle('project', permission.id)}
                        />
                        <div className="flex-1">
                          <label 
                            htmlFor={permission.id}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {permission.name}
                          </label>
                          <p className="text-xs text-gray-600">{permission.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 数据权限 */}
            <TabsContent value="data" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>数据权限</span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSelectAll('data')}
                      >
                        全选
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeselectAll('data')}
                      >
                        全不选
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    控制用户对数据的访问权限
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockPermissions.data.map(permission => (
                      <div key={permission.id} className="flex items-center space-x-3">
                        <Checkbox
                          id={permission.id}
                          checked={selectedPermissions.data?.includes(permission.id) || false}
                          onCheckedChange={() => handlePermissionToggle('data', permission.id)}
                        />
                        <div className="flex-1">
                          <label 
                            htmlFor={permission.id}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {permission.name}
                          </label>
                          <p className="text-xs text-gray-600">{permission.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              保存权限
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PermissionConfigDialog;

