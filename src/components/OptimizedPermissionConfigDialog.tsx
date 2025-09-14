// 优化的权限配置弹窗组件 - 使用 React.memo
// 文件: src/components/OptimizedPermissionConfigDialog.tsx

import React, { useState, useEffect, memo, useMemo } from 'react';
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

interface OptimizedPermissionConfigDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, permissions: Record<string, string[]>) => void;
}

// 权限配置项（从现有代码中提取）
const PERMISSION_CATEGORIES = {
  menu: [
    { id: 'dashboard', name: '仪表板', description: '查看系统概览' },
    { id: 'users', name: '用户管理', description: '管理系统用户' },
    { id: 'projects', name: '项目管理', description: '管理项目信息' },
    { id: 'contracts', name: '合同管理', description: '管理合同信息' },
    { id: 'logistics', name: '物流管理', description: '管理物流信息' },
    { id: 'reports', name: '报表管理', description: '查看各类报表' },
    { id: 'settings', name: '系统设置', description: '系统配置管理' }
  ],
  function: [
    { id: 'create', name: '创建', description: '创建新记录' },
    { id: 'edit', name: '编辑', description: '修改现有记录' },
    { id: 'delete', name: '删除', description: '删除记录' },
    { id: 'view', name: '查看', description: '查看记录详情' },
    { id: 'export', name: '导出', description: '导出数据' },
    { id: 'import', name: '导入', description: '导入数据' },
    { id: 'approve', name: '审批', description: '审批流程' }
  ],
  project: [
    { id: 'project_read', name: '项目查看', description: '查看项目信息' },
    { id: 'project_write', name: '项目编辑', description: '编辑项目信息' },
    { id: 'project_delete', name: '项目删除', description: '删除项目' },
    { id: 'project_admin', name: '项目管理', description: '项目管理员权限' }
  ],
  data: [
    { id: 'data_read', name: '数据查看', description: '查看业务数据' },
    { id: 'data_write', name: '数据编辑', description: '编辑业务数据' },
    { id: 'data_delete', name: '数据删除', description: '删除业务数据' },
    { id: 'data_admin', name: '数据管理', description: '数据管理员权限' }
  ]
};

export const OptimizedPermissionConfigDialog = memo<OptimizedPermissionConfigDialogProps>(({ 
  user, 
  isOpen, 
  onClose, 
  onSave 
}) => {
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, string[]>>({
    menu: [],
    function: [],
    project: [],
    data: []
  });
  const [activeTab, setActiveTab] = useState('menu');
  const [loading, setLoading] = useState(false);

  // 使用 useMemo 优化权限数据计算
  const permissionCategories = useMemo(() => PERMISSION_CATEGORIES, []);

  // 从数据库加载权限数据
  const loadPermissionsFromDatabase = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
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

    } catch (error) {
      console.error('加载权限数据失败:', error);
      // 使用默认权限作为后备
      setSelectedPermissions({
        menu: [],
        function: [],
        project: [],
        data: []
      });
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
    setSelectedPermissions(prev => ({
      ...prev,
      [category]: prev[category].includes(permissionId)
        ? prev[category].filter(id => id !== permissionId)
        : [...prev[category], permissionId]
    }));
  };

  const handleSelectAll = (category: string) => {
    const allPermissions = permissionCategories[category as keyof typeof permissionCategories].map(p => p.id);
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

  const handleSave = () => {
    if (user) {
      onSave(user.id, selectedPermissions);
      onClose();
    }
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
              </div>
            </CardContent>
          </Card>

          {/* 权限配置 */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="menu">菜单权限</TabsTrigger>
              <TabsTrigger value="function">功能权限</TabsTrigger>
              <TabsTrigger value="project">项目权限</TabsTrigger>
              <TabsTrigger value="data">数据权限</TabsTrigger>
            </TabsList>

            {Object.entries(permissionCategories).map(([category, permissions]) => (
              <TabsContent key={category} value={category} className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {category === 'menu' && <><Shield className="h-5 w-5 inline mr-2" />菜单权限</>}
                          {category === 'function' && <><Users className="h-5 w-5 inline mr-2" />功能权限</>}
                          {category === 'project' && <><Building2 className="h-5 w-5 inline mr-2" />项目权限</>}
                          {category === 'data' && <><Database className="h-5 w-5 inline mr-2" />数据权限</>}
                        </CardTitle>
                        <CardDescription>
                          配置用户的{category === 'menu' ? '菜单' : category === 'function' ? '功能' : category === 'project' ? '项目' : '数据'}访问权限
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectAll(category)}
                        >
                          全选
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeselectAll(category)}
                        >
                          全不选
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {permissions.map(permission => (
                        <div key={permission.id} className="flex items-center space-x-3">
                          <Checkbox
                            id={permission.id}
                            checked={selectedPermissions[category].includes(permission.id)}
                            onCheckedChange={() => handlePermissionToggle(category, permission.id)}
                          />
                          <div className="flex-1">
                            <label
                              htmlFor={permission.id}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {permission.name}
                            </label>
                            <p className="text-xs text-gray-500 mt-1">
                              {permission.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              保存权限
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数
  return (
    prevProps.user?.id === nextProps.user?.id &&
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.user?.role === nextProps.user?.role &&
    prevProps.user?.is_active === nextProps.user?.is_active
  );
});

OptimizedPermissionConfigDialog.displayName = 'OptimizedPermissionConfigDialog';
