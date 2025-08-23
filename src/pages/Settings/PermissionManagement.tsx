import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Menu, Settings, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// 角色定义
const ROLES = [
  { value: 'admin', label: '系统管理员', color: 'bg-red-500' },
  { value: 'finance', label: '财务人员', color: 'bg-blue-500' },
  { value: 'business', label: '业务人员', color: 'bg-green-500' },
  { value: 'operator', label: '操作员', color: 'bg-yellow-500' },
  { value: 'partner', label: '合作方', color: 'bg-purple-500' },
  { value: 'viewer', label: '查看者', color: 'bg-gray-500' }
];

// 菜单权限定义
const MENU_PERMISSIONS = [
  {
    group: '数据看板',
    permissions: [
      { key: 'dashboard.transport', label: '运输看板' },
      { key: 'dashboard.financial', label: '财务看板' },
      { key: 'dashboard.project', label: '项目看板' }
    ]
  },
  {
    group: '信息维护',
    permissions: [
      { key: 'info.projects', label: '项目管理' },
      { key: 'info.drivers', label: '司机管理' },
      { key: 'info.locations', label: '地点管理' },
      { key: 'info.partners', label: '合作方管理' }
    ]
  },
  {
    group: '业务录入',
    permissions: [
      { key: 'business.entry', label: '运单录入' },
      { key: 'business.payment_request', label: '付款申请' },
      { key: 'business.payment_list', label: '申请单管理' }
    ]
  },
  {
    group: '财务对账',
    permissions: [
      { key: 'finance.reconciliation', label: '运费对账' },
      { key: 'finance.payment_invoice', label: '付款与开票' }
    ]
  },
  {
    group: '设置',
    permissions: [
      { key: 'settings.users', label: '用户管理' },
      { key: 'settings.permissions', label: '权限管理' }
    ]
  }
];

// 功能权限定义
const FUNCTION_PERMISSIONS = [
  {
    group: '数据操作',
    permissions: [
      { key: 'data.create', label: '新增数据' },
      { key: 'data.edit', label: '编辑数据' },
      { key: 'data.delete', label: '删除数据' },
      { key: 'data.export', label: '导出数据' },
      { key: 'data.import', label: '导入数据' }
    ]
  },
  {
    group: '财务操作',
    permissions: [
      { key: 'finance.view_cost', label: '查看成本信息' },
      { key: 'finance.approve_payment', label: '审批付款' },
      { key: 'finance.generate_invoice', label: '生成发票' },
      { key: 'finance.reconcile', label: '财务对账' }
    ]
  },
  {
    group: '系统管理',
    permissions: [
      { key: 'system.manage_users', label: '管理用户' },
      { key: 'system.manage_roles', label: '管理角色' },
      { key: 'system.view_logs', label: '查看日志' },
      { key: 'system.backup', label: '系统备份' }
    ]
  }
];

// 默认权限配置
const DEFAULT_PERMISSIONS = {
  admin: {
    menus: MENU_PERMISSIONS.flatMap(group => group.permissions.map(p => p.key)),
    functions: FUNCTION_PERMISSIONS.flatMap(group => group.permissions.map(p => p.key))
  },
  finance: {
    menus: ['dashboard.transport', 'dashboard.financial', 'dashboard.project', 'info.drivers', 'info.locations', 'info.partners', 'business.payment_request', 'business.payment_list', 'finance.reconciliation', 'finance.payment_invoice'],
    functions: ['data.export', 'finance.view_cost', 'finance.approve_payment', 'finance.generate_invoice', 'finance.reconcile']
  },
  business: {
    menus: ['dashboard.transport', 'dashboard.project', 'info.projects', 'info.drivers', 'info.locations', 'info.partners', 'business.entry', 'business.payment_request', 'business.payment_list'],
    functions: ['data.create', 'data.edit', 'data.export', 'data.import']
  },
  operator: {
    menus: ['dashboard.transport', 'info.drivers', 'info.locations', 'business.entry'],
    functions: ['data.create', 'data.edit']
  },
  partner: {
    menus: ['dashboard.transport'],
    functions: []
  },
  viewer: {
    menus: ['dashboard.transport', 'dashboard.financial', 'dashboard.project', 'info.drivers', 'info.locations', 'info.partners'],
    functions: ['data.export']
  }
};

export default function PermissionManagement() {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState('admin');
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [hasChanges, setHasChanges] = useState(false);

  // 获取当前角色的权限
  const currentRolePermissions = permissions[selectedRole as keyof typeof permissions] || { menus: [], functions: [] };

  // 检查菜单权限
  const hasMenuPermission = (key: string) => {
    return currentRolePermissions.menus.includes(key);
  };

  // 检查功能权限
  const hasFunctionPermission = (key: string) => {
    return currentRolePermissions.functions.includes(key);
  };

  // 切换菜单权限
  const toggleMenuPermission = (key: string) => {
    setPermissions(prev => {
      const rolePerms = prev[selectedRole as keyof typeof prev] || { menus: [], functions: [] };
      const newMenus = rolePerms.menus.includes(key)
        ? rolePerms.menus.filter(m => m !== key)
        : [...rolePerms.menus, key];
      
      return {
        ...prev,
        [selectedRole]: {
          ...rolePerms,
          menus: newMenus
        }
      };
    });
    setHasChanges(true);
  };

  // 切换功能权限
  const toggleFunctionPermission = (key: string) => {
    setPermissions(prev => {
      const rolePerms = prev[selectedRole as keyof typeof prev] || { menus: [], functions: [] };
      const newFunctions = rolePerms.functions.includes(key)
        ? rolePerms.functions.filter(f => f !== key)
        : [...rolePerms.functions, key];
      
      return {
        ...prev,
        [selectedRole]: {
          ...rolePerms,
          functions: newFunctions
        }
      };
    });
    setHasChanges(true);
  };

  // 保存权限配置
  const savePermissions = () => {
    // 这里应该调用 API 保存权限配置到数据库
    console.log('保存权限配置:', permissions);
    toast({
      title: "保存成功",
      description: "权限配置已更新",
    });
    setHasChanges(false);
  };

  // 重置为默认权限
  const resetToDefault = () => {
    setPermissions(DEFAULT_PERMISSIONS);
    setHasChanges(true);
    toast({
      title: "已重置",
      description: "权限配置已重置为默认值",
    });
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">权限管理</h1>
            <p className="text-muted-foreground">配置各角色的菜单访问权限和功能权限</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefault}>
            重置为默认
          </Button>
          <Button 
            onClick={savePermissions} 
            disabled={!hasChanges}
            className="bg-gradient-primary text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            保存配置
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 角色选择 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              选择角色
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ROLES.map(role => (
                <div
                  key={role.value}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedRole === role.value 
                      ? 'bg-gradient-primary text-white shadow-lg' 
                      : 'bg-card hover:bg-muted border'
                  }`}
                  onClick={() => setSelectedRole(role.value)}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${role.color}`} />
                    <span className="font-medium">{role.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 权限配置 */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                权限配置 - {ROLES.find(r => r.value === selectedRole)?.label}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  菜单权限: {currentRolePermissions.menus.length}
                </Badge>
                <Badge variant="outline">
                  功能权限: {currentRolePermissions.functions.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="menus" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="menus" className="flex items-center gap-2">
                    <Menu className="h-4 w-4" />
                    菜单权限
                  </TabsTrigger>
                  <TabsTrigger value="functions" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    功能权限
                  </TabsTrigger>
                </TabsList>

                {/* 菜单权限 */}
                <TabsContent value="menus" className="space-y-4">
                  {MENU_PERMISSIONS.map(group => (
                    <Card key={group.group}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{group.group}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {group.permissions.map(permission => (
                            <div key={permission.key} className="flex items-center space-x-2">
                              <Checkbox
                                id={permission.key}
                                checked={hasMenuPermission(permission.key)}
                                onCheckedChange={() => toggleMenuPermission(permission.key)}
                              />
                              <Label 
                                htmlFor={permission.key}
                                className="text-sm cursor-pointer"
                              >
                                {permission.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                {/* 功能权限 */}
                <TabsContent value="functions" className="space-y-4">
                  {FUNCTION_PERMISSIONS.map(group => (
                    <Card key={group.group}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{group.group}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {group.permissions.map(permission => (
                            <div key={permission.key} className="flex items-center space-x-2">
                              <Checkbox
                                id={permission.key}
                                checked={hasFunctionPermission(permission.key)}
                                onCheckedChange={() => toggleFunctionPermission(permission.key)}
                              />
                              <Label 
                                htmlFor={permission.key}
                                className="text-sm cursor-pointer"
                              >
                                {permission.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}