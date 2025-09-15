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

// 根据角色获取默认权限 - 使用数据库中的实际权限ID
const getDefaultPermissionsByRole = (role: string) => {
  const allPermissions = {
    menu: [
      'dashboard', 'dashboard.transport', 'dashboard.financial', 'dashboard.project', 'dashboard.quantity',
      'maintenance', 'maintenance.projects', 'maintenance.drivers', 'maintenance.locations', 'maintenance.partners',
      'business', 'business.entry', 'business.scale', 'business.payment_request', 'business.payment_requests',
      'contracts', 'contracts.list', 'contracts.create', 'contracts.edit', 'contracts.delete', 'contracts.files',
      'contracts.permissions', 'contracts.audit', 'contracts.reminders', 'contracts.tags', 'contracts.numbering',
      'finance', 'finance.reconciliation', 'finance.payment_invoice',
      'data_maintenance', 'data_maintenance.waybill',
      'settings', 'settings.integrated', 'settings.audit_logs'
    ],
    function: [
      'data', 'data.create', 'data.edit', 'data.delete', 'data.export', 'data.import',
      'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view', 'scale_records.delete',
      'finance', 'finance.view_cost', 'finance.approve_payment', 'finance.generate_invoice', 'finance.reconcile',
      'contract_management', 'contract.view', 'contract.create', 'contract.edit', 'contract.delete', 'contract.archive',
      'contract.files_upload', 'contract.files_download', 'contract.files_delete', 'contract.permissions_manage',
      'contract.audit_logs', 'contract.reminders', 'contract.tags', 'contract.numbering', 'contract.sensitive_fields',
      'contract.approve', 'contract.export',
      'system', 'system.manage_users', 'system.manage_roles', 'system.view_logs', 'system.backup'
    ],
    project: [
      'project_access', 'project.view_all', 'project.view_assigned', 'project.manage', 'project.admin',
      'project_data', 'project_data.view_financial', 'project_data.edit_financial', 'project_data.view_operational', 'project_data.edit_operational'
    ],
    data: [
      'data_scope', 'data.all', 'data.own', 'data.team', 'data.project',
      'data_operations', 'data.create', 'data.edit', 'data.delete', 'data.export'
    ]
  };

  switch (role) {
    case 'admin':
      return allPermissions; // 超级用户拥有所有权限
    case 'operator':
      return {
        menu: ['dashboard', 'dashboard.transport', 'dashboard.project', 'business', 'business.entry', 'business.scale', 'contracts', 'contracts.list'],
        function: ['data', 'data.create', 'data.edit', 'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view'],
        project: ['project_access', 'project.view_assigned', 'project_data', 'project_data.view_operational'],
        data: ['data_scope', 'data.own', 'data_operations', 'data.create', 'data.edit']
      };
    case 'viewer':
      return {
        menu: ['dashboard'],
        function: [],
        project: ['project_access', 'project.view_assigned'],
        data: ['data_scope', 'data.own']
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

// 模拟权限数据 - 使用数据库中的实际权限ID
const mockPermissions = {
  menu: [
    { id: 'dashboard', name: '仪表盘', description: '查看系统仪表盘' },
    { id: 'dashboard.transport', name: '运输仪表盘', description: '运输数据概览' },
    { id: 'dashboard.financial', name: '财务仪表盘', description: '财务数据概览' },
    { id: 'dashboard.project', name: '项目仪表盘', description: '项目数据概览' },
    { id: 'dashboard.quantity', name: '数量仪表盘', description: '数量统计概览' },
    { id: 'maintenance', name: '维护管理', description: '系统维护管理' },
    { id: 'maintenance.projects', name: '项目管理', description: '项目维护管理' },
    { id: 'maintenance.drivers', name: '司机管理', description: '司机信息维护' },
    { id: 'maintenance.locations', name: '地点管理', description: '地点信息维护' },
    { id: 'maintenance.partners', name: '合作方管理', description: '合作方信息维护' },
    { id: 'business', name: '业务管理', description: '业务操作管理' },
    { id: 'business.entry', name: '业务录入', description: '业务数据录入' },
    { id: 'business.scale', name: '磅单管理', description: '磅单数据管理' },
    { id: 'business.payment_request', name: '付款申请', description: '付款申请管理' },
    { id: 'business.payment_requests', name: '付款申请列表', description: '付款申请列表管理' },
    { id: 'contracts', name: '合同管理', description: '合同信息管理' },
    { id: 'contracts.list', name: '合同列表', description: '合同列表查看' },
    { id: 'contracts.create', name: '创建合同', description: '创建新合同' },
    { id: 'contracts.edit', name: '编辑合同', description: '修改合同信息' },
    { id: 'contracts.delete', name: '删除合同', description: '删除合同' },
    { id: 'contracts.files', name: '合同文件', description: '合同文件管理' },
    { id: 'contracts.permissions', name: '合同权限', description: '合同权限管理' },
    { id: 'contracts.audit', name: '合同审计', description: '合同审计日志' },
    { id: 'contracts.reminders', name: '合同提醒', description: '合同提醒管理' },
    { id: 'contracts.tags', name: '合同标签', description: '合同标签管理' },
    { id: 'contracts.numbering', name: '合同编号', description: '合同编号管理' },
    { id: 'finance', name: '财务管理', description: '财务数据管理' },
    { id: 'finance.reconciliation', name: '财务对账', description: '财务对账管理' },
    { id: 'finance.payment_invoice', name: '付款发票', description: '付款发票管理' },
    { id: 'data_maintenance', name: '数据维护', description: '数据维护管理' },
    { id: 'data_maintenance.waybill', name: '运单维护', description: '运单数据维护' },
    { id: 'settings', name: '系统设置', description: '系统配置管理' },
    { id: 'settings.integrated', name: '集成设置', description: '集成权限管理' },
    { id: 'settings.audit_logs', name: '审计日志', description: '系统审计日志' }
  ],
  function: [
    { id: 'data', name: '数据管理', description: '数据操作管理' },
    { id: 'data.create', name: '创建数据', description: '创建新数据' },
    { id: 'data.edit', name: '编辑数据', description: '修改数据信息' },
    { id: 'data.delete', name: '删除数据', description: '删除数据' },
    { id: 'data.export', name: '导出数据', description: '导出系统数据' },
    { id: 'data.import', name: '导入数据', description: '导入系统数据' },
    { id: 'scale_records', name: '磅单记录', description: '磅单记录管理' },
    { id: 'scale_records.create', name: '创建磅单', description: '创建新磅单' },
    { id: 'scale_records.edit', name: '编辑磅单', description: '修改磅单信息' },
    { id: 'scale_records.view', name: '查看磅单', description: '查看磅单信息' },
    { id: 'scale_records.delete', name: '删除磅单', description: '删除磅单' },
    { id: 'finance', name: '财务管理', description: '财务功能管理' },
    { id: 'finance.view_cost', name: '查看成本', description: '查看成本信息' },
    { id: 'finance.approve_payment', name: '审批付款', description: '审批付款申请' },
    { id: 'finance.generate_invoice', name: '生成发票', description: '生成付款发票' },
    { id: 'finance.reconcile', name: '财务对账', description: '执行财务对账' },
    { id: 'contract_management', name: '合同管理', description: '合同管理功能' },
    { id: 'contract.view', name: '查看合同', description: '查看合同信息' },
    { id: 'contract.create', name: '创建合同', description: '创建新合同' },
    { id: 'contract.edit', name: '编辑合同', description: '修改合同信息' },
    { id: 'contract.delete', name: '删除合同', description: '删除合同' },
    { id: 'contract.archive', name: '归档合同', description: '归档合同' },
    { id: 'contract.files_upload', name: '上传文件', description: '上传合同文件' },
    { id: 'contract.files_download', name: '下载文件', description: '下载合同文件' },
    { id: 'contract.files_delete', name: '删除文件', description: '删除合同文件' },
    { id: 'contract.permissions_manage', name: '权限管理', description: '管理合同权限' },
    { id: 'contract.audit_logs', name: '审计日志', description: '查看合同审计日志' },
    { id: 'contract.reminders', name: '合同提醒', description: '管理合同提醒' },
    { id: 'contract.tags', name: '合同标签', description: '管理合同标签' },
    { id: 'contract.numbering', name: '合同编号', description: '管理合同编号' },
    { id: 'contract.sensitive_fields', name: '敏感字段', description: '管理敏感字段' },
    { id: 'contract.approve', name: '审批合同', description: '审批合同' },
    { id: 'contract.export', name: '导出合同', description: '导出合同数据' },
    { id: 'system', name: '系统管理', description: '系统管理功能' },
    { id: 'system.manage_users', name: '用户管理', description: '管理系统用户' },
    { id: 'system.manage_roles', name: '角色管理', description: '管理系统角色' },
    { id: 'system.view_logs', name: '查看日志', description: '查看系统日志' },
    { id: 'system.backup', name: '系统备份', description: '执行系统备份' }
  ],
  project: [
    { id: 'project_access', name: '项目访问', description: '项目访问权限' },
    { id: 'project.view_all', name: '查看所有项目', description: '查看所有项目信息' },
    { id: 'project.view_assigned', name: '查看分配项目', description: '查看分配的项目' },
    { id: 'project.manage', name: '项目管理', description: '项目管理权限' },
    { id: 'project.admin', name: '项目管理员', description: '项目管理员权限' },
    { id: 'project_data', name: '项目数据', description: '项目数据权限' },
    { id: 'project_data.view_financial', name: '查看财务数据', description: '查看项目财务数据' },
    { id: 'project_data.edit_financial', name: '编辑财务数据', description: '编辑项目财务数据' },
    { id: 'project_data.view_operational', name: '查看运营数据', description: '查看项目运营数据' },
    { id: 'project_data.edit_operational', name: '编辑运营数据', description: '编辑项目运营数据' }
  ],
  data: [
    { id: 'data_scope', name: '数据范围', description: '数据访问范围' },
    { id: 'data.all', name: '所有数据', description: '访问所有数据' },
    { id: 'data.own', name: '个人数据', description: '访问个人数据' },
    { id: 'data.team', name: '团队数据', description: '访问团队数据' },
    { id: 'data.project', name: '项目数据', description: '访问项目数据' },
    { id: 'data_operations', name: '数据操作', description: '数据操作权限' },
    { id: 'data.create', name: '创建数据', description: '创建新数据' },
    { id: 'data.edit', name: '编辑数据', description: '修改数据' },
    { id: 'data.delete', name: '删除数据', description: '删除数据' },
    { id: 'data.export', name: '导出数据', description: '导出数据' }
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
    const categoryPermissions = mockPermissions[category as keyof typeof mockPermissions];
    if (categoryPermissions && Array.isArray(categoryPermissions)) {
      const allPermissions = categoryPermissions.map(p => p.id);
      setSelectedPermissions(prev => ({
        ...prev,
        [category]: allPermissions
      }));
    }
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
                    {(mockPermissions.menu || []).map(permission => (
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
                    {(mockPermissions.function || []).map(permission => (
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
                    {(mockPermissions.project || []).map(permission => (
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
                    {(mockPermissions.data || []).map(permission => (
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

