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

// 权限配置项 - 使用数据库中的实际权限ID
const PERMISSION_CATEGORIES = {
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
    { id: 'settings.users', name: '用户管理', description: '用户管理设置' },
    { id: 'settings.permissions', name: '权限配置', description: '权限配置设置' },
    { id: 'settings.contract_permissions', name: '合同权限', description: '合同权限设置' },
    { id: 'settings.role_templates', name: '角色模板', description: '角色模板设置' },
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
