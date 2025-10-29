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
import { useToast } from '@/hooks/use-toast';

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
      'settings', 'settings.users', 'settings.permissions', 'settings.contract_permissions', 'settings.role_templates', 'settings.integrated', 'settings.audit_logs'
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
        menu: [
          'dashboard', 'dashboard.transport', 'dashboard.financial',
          'maintenance', 'maintenance.drivers', 'maintenance.locations', 'maintenance.partners',
          'business', 'business.entry', 'business.scale', 'business.invoice_request', 'business.payment_request',
          'finance', 'finance.reconciliation', 'finance.payment_invoice', 'finance.payment_requests',
          'data_maintenance', 'data_maintenance.waybill',
          'contracts', 'contracts.list'
        ],
        function: [
          'data', 'data.create', 'data.edit', 'data.view', 'data.export',
          'scale_records', 'scale_records.create', 'scale_records.edit', 'scale_records.view', 'scale_records.delete',
          'finance', 'finance.view_cost', 'finance.generate_invoice', 'finance.reconcile',
          'contract_management', 'contract.view'
        ],
        project: ['project_access', 'project.view_assigned', 'project.view_all', 'project_data', 'project_data.view_operational', 'project_data.view_financial'],
        data: ['data_scope', 'data.own', 'data.team', 'data.all', 'data_operations', 'data.create', 'data.edit', 'data.view', 'data.export']
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

// 权限数据 - 与 AppSidebar.tsx 保持一致
const mockPermissions = {
  menu: [
    // 数据看板
    { id: 'dashboard.transport', name: '运输看板', description: '运输数据看板' },
    { id: 'dashboard.financial', name: '财务看板', description: '财务数据看板' },
    { id: 'dashboard.project', name: '项目看板', description: '项目数据看板' },
    { id: 'dashboard.shipper', name: '货主看板', description: '货主数据和层级统计' },
    
    // 合同管理
    { id: 'contracts.list', name: '合同列表', description: '合同列表查看' },
    
    // 信息维护
    { id: 'maintenance.projects', name: '项目管理', description: '项目信息维护' },
    { id: 'maintenance.drivers', name: '司机管理', description: '司机信息维护' },
    { id: 'maintenance.locations', name: '地点管理', description: '地点信息维护' },
    { id: 'maintenance.locations_enhanced', name: '地点管理（增强版）', description: '地点信息维护增强版' },
    { id: 'maintenance.partners', name: '合作方管理', description: '合作方信息维护' },
    
    // 业务管理
    { id: 'business.entry', name: '运单管理', description: '运单数据录入和管理' },
    { id: 'business.scale', name: '磅单管理', description: '磅单数据管理' },
    { id: 'business.invoice_request', name: '开票申请', description: '开票申请管理' },
    { id: 'business.payment_request', name: '付款申请', description: '付款申请管理' },
    
    // 审核管理
    { id: 'audit', name: '审核管理', description: '审核管理权限（开票和付款审核）' },
    { id: 'audit.invoice', name: '开票审核', description: '开票申请审核' },
    { id: 'audit.payment', name: '付款审核', description: '付款申请审核' },
    
    // 财务管理
    { id: 'finance.reconciliation', name: '运费对账', description: '运费对账管理' },
    { id: 'finance.payment_invoice', name: '付款与开票', description: '付款与开票管理' },
    { id: 'finance.invoice_request_management', name: '财务开票', description: '开票申请单管理' },
    { id: 'finance.payment_requests', name: '财务付款', description: '付款申请单管理' },
    
    // 数据维护
    { id: 'data_maintenance.waybill', name: '运单维护', description: '运单数据维护' },
    { id: 'data_maintenance.waybill_enhanced', name: '运单维护（增强版）', description: '运单数据维护增强版' },
    
    // 设置
    { id: 'settings.users', name: '用户管理', description: '用户管理设置' },
    { id: 'settings.permissions', name: '权限配置', description: '权限配置设置' },
    { id: 'settings.contract_permissions', name: '合同权限', description: '合同权限设置' },
    { id: 'settings.role_templates', name: '角色模板', description: '角色模板设置' },
    { id: 'settings.audit_logs', name: '操作日志', description: '系统审计日志' }
  ],
  function: [
    // 数据管理功能
    { id: 'data.create', name: '创建数据', description: '创建新数据' },
    { id: 'data.edit', name: '编辑数据', description: '修改数据信息' },
    { id: 'data.delete', name: '删除数据', description: '删除数据' },
    { id: 'data.export', name: '导出数据', description: '导出系统数据' },
    
    // 磅单功能
    { id: 'scale_records.create', name: '创建磅单', description: '创建新磅单' },
    { id: 'scale_records.edit', name: '编辑磅单', description: '修改磅单信息' },
    { id: 'scale_records.view', name: '查看磅单', description: '查看磅单信息' },
    
    // 财务功能
    { id: 'finance.view_cost', name: '查看成本', description: '查看成本信息' },
    { id: 'finance.approve_payment', name: '审批付款', description: '审批付款申请' },
    
    // 合同功能
    { id: 'contract.view', name: '查看合同', description: '查看合同信息' },
    { id: 'contract.create', name: '创建合同', description: '创建新合同' },
    { id: 'contract.edit', name: '编辑合同', description: '修改合同信息' },
    { id: 'contract.delete', name: '删除合同', description: '删除合同' }
  ],
  project: [
    { id: 'project.view_all', name: '查看所有项目', description: '查看所有项目信息' },
    { id: 'project.view_assigned', name: '查看分配项目', description: '查看分配的项目' }
  ],
  data: [
    { id: 'data.all', name: '所有数据', description: '访问所有数据' },
    { id: 'data.own', name: '个人数据', description: '访问个人数据' },
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
  const { toast } = useToast();
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
      const result = await PermissionDatabaseService.saveUserPermissions(user.id, {
        menu_permissions: selectedPermissions.menu || [],
        function_permissions: selectedPermissions.function || [],
        project_permissions: selectedPermissions.project || [],
        data_permissions: selectedPermissions.data || []
      });

      // 调用父组件的保存回调
      onSave(user.id, selectedPermissions);
      
      // 显示成功提示
      toast({
        title: "保存成功",
        description: "用户权限已成功保存",
      });
      
      onClose();
      
    } catch (error: any) {
      console.error('保存权限失败:', error);
      
      // 显示错误提示
      toast({
        title: "保存失败",
        description: `权限保存失败: ${error.message || '未知错误'}`,
        variant: "destructive",
      });
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

