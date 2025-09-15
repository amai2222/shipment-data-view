// 权限配置页面
// 文件: src/pages/PermissionConfigPage.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Users, 
  Search, 
  Settings,
  Menu,
  Function,
  Building2,
  Database,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface UserPermission {
  id: string;
  user_id: string;
  project_id?: string;
  menu_permissions: string[];
  function_permissions: string[];
  project_permissions: string[];
  data_permissions: string[];
  inherit_role: boolean;
  custom_settings: any;
}

interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  permissions: PermissionItem[];
}

interface PermissionItem {
  id: string;
  name: string;
  description: string;
}

// 权限配置
const PERMISSION_GROUPS: Record<string, PermissionGroup[]> = {
  menu: [
    {
      id: 'dashboard',
      name: '数据看板',
      description: '访问各种数据看板',
      permissions: [
        { id: 'dashboard', name: '主看板', description: '访问主数据看板' },
        { id: 'dashboard.transport', name: '运输看板', description: '访问运输数据看板' },
        { id: 'dashboard.financial', name: '财务看板', description: '访问财务数据看板' },
        { id: 'dashboard.project', name: '项目看板', description: '访问项目数据看板' },
        { id: 'dashboard.quantity', name: '数量看板', description: '访问数量统计看板' },
      ]
    },
    {
      id: 'maintenance',
      name: '信息维护',
      description: '维护基础信息',
      permissions: [
        { id: 'maintenance', name: '信息维护', description: '访问信息维护模块' },
        { id: 'maintenance.projects', name: '项目管理', description: '管理项目信息' },
        { id: 'maintenance.drivers', name: '司机管理', description: '管理司机信息' },
        { id: 'maintenance.locations', name: '地点管理', description: '管理地点信息' },
        { id: 'maintenance.partners', name: '合作方管理', description: '管理合作方信息' },
      ]
    },
    {
      id: 'business',
      name: '业务管理',
      description: '业务操作相关',
      permissions: [
        { id: 'business', name: '业务管理', description: '访问业务管理模块' },
        { id: 'business.entry', name: '运单管理', description: '管理运单信息' },
        { id: 'business.scale', name: '磅单管理', description: '管理磅单信息' },
        { id: 'business.payment_request', name: '付款申请', description: '处理付款申请' },
        { id: 'business.payment_requests', name: '申请单管理', description: '管理申请单' },
      ]
    },
    {
      id: 'contracts',
      name: '合同管理',
      description: '合同相关功能',
      permissions: [
        { id: 'contracts', name: '合同管理', description: '访问合同管理模块' },
        { id: 'contracts.list', name: '合同列表', description: '查看合同列表' },
        { id: 'contracts.create', name: '创建合同', description: '创建新合同' },
        { id: 'contracts.edit', name: '编辑合同', description: '编辑合同信息' },
        { id: 'contracts.delete', name: '删除合同', description: '删除合同' },
        { id: 'contracts.files', name: '合同文件', description: '管理合同文件' },
        { id: 'contracts.permissions', name: '合同权限', description: '管理合同权限' },
        { id: 'contracts.audit', name: '审计日志', description: '查看合同审计日志' },
        { id: 'contracts.reminders', name: '合同提醒', description: '管理合同提醒' },
        { id: 'contracts.tags', name: '合同标签', description: '管理合同标签' },
        { id: 'contracts.numbering', name: '合同编号', description: '管理合同编号' },
      ]
    },
    {
      id: 'finance',
      name: '财务对账',
      description: '财务相关功能',
      permissions: [
        { id: 'finance', name: '财务对账', description: '访问财务对账模块' },
        { id: 'finance.reconciliation', name: '运费对账', description: '进行运费对账' },
        { id: 'finance.payment_invoice', name: '付款与开票', description: '处理付款与开票' },
      ]
    },
    {
      id: 'data_maintenance',
      name: '数据维护',
      description: '数据维护功能',
      permissions: [
        { id: 'data_maintenance', name: '数据维护', description: '访问数据维护模块' },
        { id: 'data_maintenance.waybill', name: '运单维护', description: '维护运单数据' },
      ]
    },
    {
      id: 'settings',
      name: '设置',
      description: '系统设置',
      permissions: [
        { id: 'settings', name: '设置', description: '访问系统设置' },
        { id: 'settings.users', name: '用户管理', description: '管理系统用户' },
        { id: 'settings.integrated', name: '集成权限管理', description: '管理集成权限' },
        { id: 'settings.audit_logs', name: '操作日志', description: '查看操作日志' },
      ]
    }
  ],
  function: [
    {
      id: 'data',
      name: '数据操作',
      description: '数据相关操作权限',
      permissions: [
        { id: 'data', name: '数据操作', description: '基础数据操作权限' },
        { id: 'data.view', name: '查看数据', description: '查看数据权限' },
        { id: 'data.create', name: '创建数据', description: '创建数据权限' },
        { id: 'data.edit', name: '编辑数据', description: '编辑数据权限' },
        { id: 'data.delete', name: '删除数据', description: '删除数据权限' },
        { id: 'data.export', name: '导出数据', description: '导出数据权限' },
        { id: 'data.import', name: '导入数据', description: '导入数据权限' },
      ]
    },
    {
      id: 'scale_records',
      name: '磅单记录',
      description: '磅单记录相关权限',
      permissions: [
        { id: 'scale_records', name: '磅单记录', description: '磅单记录基础权限' },
        { id: 'scale_records.create', name: '创建磅单', description: '创建磅单记录' },
        { id: 'scale_records.edit', name: '编辑磅单', description: '编辑磅单记录' },
        { id: 'scale_records.view', name: '查看磅单', description: '查看磅单记录' },
        { id: 'scale_records.delete', name: '删除磅单', description: '删除磅单记录' },
      ]
    },
    {
      id: 'finance',
      name: '财务功能',
      description: '财务相关功能权限',
      permissions: [
        { id: 'finance', name: '财务功能', description: '财务功能基础权限' },
        { id: 'finance.view_cost', name: '查看成本', description: '查看成本信息' },
        { id: 'finance.approve_payment', name: '审批付款', description: '审批付款申请' },
        { id: 'finance.generate_invoice', name: '生成发票', description: '生成发票' },
        { id: 'finance.reconcile', name: '对账', description: '进行财务对账' },
      ]
    },
    {
      id: 'contract_management',
      name: '合同管理',
      description: '合同管理功能权限',
      permissions: [
        { id: 'contract_management', name: '合同管理', description: '合同管理基础权限' },
        { id: 'contract.view', name: '查看合同', description: '查看合同信息' },
        { id: 'contract.create', name: '创建合同', description: '创建新合同' },
        { id: 'contract.edit', name: '编辑合同', description: '编辑合同信息' },
        { id: 'contract.delete', name: '删除合同', description: '删除合同' },
        { id: 'contract.archive', name: '归档合同', description: '归档合同' },
        { id: 'contract.files_upload', name: '上传文件', description: '上传合同文件' },
        { id: 'contract.files_download', name: '下载文件', description: '下载合同文件' },
        { id: 'contract.files_delete', name: '删除文件', description: '删除合同文件' },
        { id: 'contract.permissions_manage', name: '权限管理', description: '管理合同权限' },
        { id: 'contract.audit_logs', name: '审计日志', description: '查看审计日志' },
        { id: 'contract.reminders', name: '提醒管理', description: '管理合同提醒' },
        { id: 'contract.tags', name: '标签管理', description: '管理合同标签' },
        { id: 'contract.numbering', name: '编号管理', description: '管理合同编号' },
        { id: 'contract.sensitive_fields', name: '敏感字段', description: '管理敏感字段' },
        { id: 'contract.approve', name: '审批合同', description: '审批合同' },
        { id: 'contract.export', name: '导出合同', description: '导出合同数据' },
      ]
    },
    {
      id: 'system',
      name: '系统管理',
      description: '系统管理功能权限',
      permissions: [
        { id: 'system', name: '系统管理', description: '系统管理基础权限' },
        { id: 'system.manage_users', name: '用户管理', description: '管理系统用户' },
        { id: 'system.manage_roles', name: '角色管理', description: '管理系统角色' },
        { id: 'system.view_logs', name: '查看日志', description: '查看系统日志' },
        { id: 'system.backup', name: '系统备份', description: '执行系统备份' },
      ]
    }
  ],
  project: [
    {
      id: 'project_access',
      name: '项目访问',
      description: '项目访问权限',
      permissions: [
        { id: 'project_access', name: '项目访问', description: '项目访问基础权限' },
        { id: 'project.view_all', name: '查看所有项目', description: '查看所有项目' },
        { id: 'project.view_assigned', name: '查看分配项目', description: '查看分配的项目' },
        { id: 'project.manage', name: '项目管理', description: '管理项目信息' },
        { id: 'project.admin', name: '项目管理员', description: '项目管理员权限' },
      ]
    },
    {
      id: 'project_data',
      name: '项目数据',
      description: '项目数据权限',
      permissions: [
        { id: 'project_data', name: '项目数据', description: '项目数据基础权限' },
        { id: 'project_data.view_financial', name: '查看财务数据', description: '查看项目财务数据' },
        { id: 'project_data.edit_financial', name: '编辑财务数据', description: '编辑项目财务数据' },
        { id: 'project_data.view_operational', name: '查看运营数据', description: '查看项目运营数据' },
        { id: 'project_data.edit_operational', name: '编辑运营数据', description: '编辑项目运营数据' },
      ]
    }
  ],
  data: [
    {
      id: 'data_scope',
      name: '数据范围',
      description: '数据访问范围权限',
      permissions: [
        { id: 'data_scope', name: '数据范围', description: '数据范围基础权限' },
        { id: 'data.all', name: '所有数据', description: '访问所有数据' },
        { id: 'data.own', name: '个人数据', description: '访问个人数据' },
        { id: 'data.team', name: '团队数据', description: '访问团队数据' },
        { id: 'data.project', name: '项目数据', description: '访问项目数据' },
      ]
    },
    {
      id: 'data_operations',
      name: '数据操作',
      description: '数据操作权限',
      permissions: [
        { id: 'data_operations', name: '数据操作', description: '数据操作基础权限' },
        { id: 'data.create', name: '创建数据', description: '创建数据权限' },
        { id: 'data.edit', name: '编辑数据', description: '编辑数据权限' },
        { id: 'data.delete', name: '删除数据', description: '删除数据权限' },
        { id: 'data.export', name: '导出数据', description: '导出数据权限' },
      ]
    }
  ]
};

export default function PermissionConfigPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentPermissions, setCurrentPermissions] = useState<Record<string, string[]>>({
    menu: [],
    function: [],
    project: [],
    data: []
  });
  const [inheritRole, setInheritRole] = useState(true);

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 加载用户
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      if (usersError) throw usersError;

      // 加载用户权限
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('*');

      if (permissionsError) throw permissionsError;

      setUsers(usersData || []);
      setUserPermissions(permissionsData || []);
    } catch (error: any) {
      console.error('加载数据失败:', error);
      toast({
        title: "错误",
        description: `加载数据失败: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 过滤用户
  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 获取用户权限
  const getUserPermission = (userId: string) => {
    return userPermissions.find(up => up.user_id === userId);
  };

  // 打开权限配置对话框
  const openPermissionDialog = (user: User) => {
    setSelectedUser(user);
    const userPermission = getUserPermission(user.id);
    
    if (userPermission) {
      setCurrentPermissions({
        menu: userPermission.menu_permissions || [],
        function: userPermission.function_permissions || [],
        project: userPermission.project_permissions || [],
        data: userPermission.data_permissions || []
      });
      setInheritRole(userPermission.inherit_role);
    } else {
      setCurrentPermissions({
        menu: [],
        function: [],
        project: [],
        data: []
      });
      setInheritRole(true);
    }
    
    setIsDialogOpen(true);
  };

  // 切换权限
  const togglePermission = (type: string, permissionId: string) => {
    setCurrentPermissions(prev => {
      const current = prev[type] || [];
      const updated = current.includes(permissionId)
        ? current.filter(p => p !== permissionId)
        : [...current, permissionId];
      
      return {
        ...prev,
        [type]: updated
      };
    });
  };

  // 切换组权限
  const toggleGroupPermissions = (type: string, groupId: string) => {
    const group = PERMISSION_GROUPS[type]?.find(g => g.id === groupId);
    if (!group) return;

    const groupPermissionIds = group.permissions.map(p => p.id);
    const current = currentPermissions[type] || [];
    const hasAllPermissions = groupPermissionIds.every(id => current.includes(id));

    setCurrentPermissions(prev => {
      const current = prev[type] || [];
      if (hasAllPermissions) {
        // 移除组内所有权限
        return {
          ...prev,
          [type]: current.filter(id => !groupPermissionIds.includes(id))
        };
      } else {
        // 添加组内所有权限
        const newPermissions = [...current];
        groupPermissionIds.forEach(id => {
          if (!newPermissions.includes(id)) {
            newPermissions.push(id);
          }
        });
        return {
          ...prev,
          [type]: newPermissions
        };
      }
    });
  };

  // 保存权限
  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    try {
      const permissionData = {
        user_id: selectedUser.id,
        project_id: null,
        menu_permissions: currentPermissions.menu,
        function_permissions: currentPermissions.function,
        project_permissions: currentPermissions.project,
        data_permissions: currentPermissions.data,
        inherit_role: inheritRole,
        custom_settings: {}
      };

      const existingPermission = getUserPermission(selectedUser.id);
      
      if (existingPermission) {
        // 更新现有权限
        const { error } = await supabase
          .from('user_permissions')
          .update(permissionData)
          .eq('id', existingPermission.id);

        if (error) throw error;
      } else {
        // 创建新权限
        const { error } = await supabase
          .from('user_permissions')
          .insert(permissionData);

        if (error) throw error;
      }

      toast({
        title: "成功",
        description: "权限配置已保存",
      });

      setIsDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('保存权限失败:', error);
      toast({
        title: "错误",
        description: `保存权限失败: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // 渲染权限组
  const renderPermissionGroup = (type: string, group: PermissionGroup) => {
    const groupPermissionIds = group.permissions.map(p => p.id);
    const current = currentPermissions[type] || [];
    const hasAllPermissions = groupPermissionIds.every(id => current.includes(id));
    const hasSomePermissions = groupPermissionIds.some(id => current.includes(id));

    return (
      <Card key={group.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{group.name}</CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={hasAllPermissions}
                ref={(el) => {
                  if (el) el.indeterminate = hasSomePermissions && !hasAllPermissions;
                }}
                onCheckedChange={() => toggleGroupPermissions(type, group.id)}
              />
              <span className="text-sm text-gray-600">
                {current.filter(id => groupPermissionIds.includes(id)).length} / {groupPermissionIds.length}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.permissions.map((permission) => (
              <div key={permission.id} className="flex items-center space-x-2">
                <Checkbox
                  id={permission.id}
                  checked={current.includes(permission.id)}
                  onCheckedChange={() => togglePermission(type, permission.id)}
                />
                <div className="flex-1">
                  <Label htmlFor={permission.id} className="font-medium">
                    {permission.name}
                  </Label>
                  <p className="text-sm text-gray-600">{permission.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">权限配置</h1>
          <p className="text-gray-600">为用户配置个性化权限</p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 搜索 */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="搜索用户..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* 用户列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            用户列表 ({filteredUsers.length})
          </CardTitle>
          <CardDescription>
            选择用户进行权限配置
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((user) => {
              const userPermission = getUserPermission(user.id);
              const hasCustomPermissions = userPermission && !userPermission.inherit_role;
              
              return (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{user.full_name}</h3>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline">{user.role}</Badge>
                        {hasCustomPermissions ? (
                          <Badge variant="default">自定义权限</Badge>
                        ) : (
                          <Badge variant="secondary">继承角色</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => openPermissionDialog(user)}
                    variant="outline"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    配置权限
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 权限配置对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              权限配置 - {selectedUser?.full_name}
            </DialogTitle>
            <DialogDescription>
              为用户 {selectedUser?.email} 配置个性化权限
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* 继承角色选项 */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="inherit_role"
                checked={inheritRole}
                onCheckedChange={(checked) => setInheritRole(!!checked)}
              />
              <Label htmlFor="inherit_role">继承角色权限</Label>
            </div>

            {!inheritRole && (
              <Tabs defaultValue="menu" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="menu" className="flex items-center">
                    <Menu className="h-4 w-4 mr-2" />
                    菜单权限
                  </TabsTrigger>
                  <TabsTrigger value="function" className="flex items-center">
                    <Function className="h-4 w-4 mr-2" />
                    功能权限
                  </TabsTrigger>
                  <TabsTrigger value="project" className="flex items-center">
                    <Building2 className="h-4 w-4 mr-2" />
                    项目权限
                  </TabsTrigger>
                  <TabsTrigger value="data" className="flex items-center">
                    <Database className="h-4 w-4 mr-2" />
                    数据权限
                  </TabsTrigger>
                </TabsList>

                {Object.entries(PERMISSION_GROUPS).map(([type, groups]) => (
                  <TabsContent key={type} value={type} className="space-y-4">
                    {groups.map(group => renderPermissionGroup(type, group))}
                  </TabsContent>
                ))}
              </Tabs>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSavePermissions}>
                <Save className="h-4 w-4 mr-2" />
                保存权限
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
