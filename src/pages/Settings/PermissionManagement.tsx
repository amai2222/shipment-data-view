import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Menu, Settings, Save, Search, User, Building2, Trash, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOptimizedPermissions } from '@/hooks/useOptimizedPermissions';

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
      { key: 'business.scale_records', label: '磅单录入' },
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
    group: '磅单管理',
    permissions: [
      { key: 'scale_records.create', label: '新增磅单' },
      { key: 'scale_records.edit', label: '编辑磅单' },
      { key: 'scale_records.view', label: '查看磅单' },
      { key: 'scale_records.delete', label: '删除磅单' }
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

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Project {
  id: string;
  name: string;
}

interface UserPermission {
  user_id: string;
  project_id: string | null;
  menu_permissions: string[];
  function_permissions: string[];
}

interface RoleTemplate {
  role: string;
  menu_permissions: string[];
  function_permissions: string[];
}

export default function PermissionManagement() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('role-templates');
  const [selectedRole, setSelectedRole] = useState('admin');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);

  // 使用优化的权限管理 Hook
  const {
    loading,
    roleTemplates,
    users,
    userPermissions,
    hasChanges,
    setHasChanges,
    setRoleTemplates,
    setUserPermissions,
    savePermissions,
    cleanupDuplicatePermissions,
    forceRefresh
  } = useOptimizedPermissions();

  // 加载项目数据
  useEffect(() => {
    const loadProjects = async () => {
      const { data: projectData } = await supabase
        .from('projects')
        .select('id, name');
      
      if (projectData) {
        setProjects(projectData);
      }
    };
    loadProjects();
  }, []);

  // 清理重复数据按钮
  const handleCleanupDuplicates = async () => {
    try {
      await cleanupDuplicatePermissions();
      toast({
        title: "清理完成",
        description: "已清理重复的权限数据",
      });
    } catch (error) {
      toast({
        title: "清理失败", 
        description: "清理重复数据时发生错误",
        variant: "destructive"
      });
    }
  };

  // 强制刷新数据
  const handleForceRefresh = async () => {
    try {
      await forceRefresh();
      toast({
        title: "刷新完成",
        description: "权限数据已强制刷新",
      });
    } catch (error) {
      toast({
        title: "刷新失败", 
        description: "强制刷新数据时发生错误",
        variant: "destructive"
      });
    }
  };

  // 获取当前角色模板的权限
  const getCurrentRolePermissions = () => {
    return roleTemplates[selectedRole] || { menu_permissions: [], function_permissions: [] };
  };

  // 获取当前用户的权限
  const getCurrentUserPermissions = () => {
    const userPerm = userPermissions.find(
      p => p.user_id === selectedUser && 
      (selectedProject ? p.project_id === selectedProject : p.project_id === null)
    );
    
    if (userPerm) {
      return userPerm;
    }

    // 如果没有用户特定权限，返回角色默认权限
    const user = users.find(u => u.id === selectedUser);
    if (user && roleTemplates[user.role]) {
      return {
        user_id: selectedUser,
        project_id: selectedProject,
        menu_permissions: roleTemplates[user.role].menu_permissions || [],
        function_permissions: roleTemplates[user.role].function_permissions || []
      };
    }

    return {
      user_id: selectedUser,
      project_id: selectedProject,
      menu_permissions: [],
      function_permissions: []
    };
  };

  // 切换角色模板权限
  const toggleRolePermission = (type: 'menu' | 'function', key: string) => {
    setRoleTemplates(prev => {
      const current = prev[selectedRole] || { role: selectedRole, menu_permissions: [], function_permissions: [] };
      const field = type === 'menu' ? 'menu_permissions' : 'function_permissions';
      const newPermissions = current[field].includes(key)
        ? current[field].filter(p => p !== key)
        : [...current[field], key];
      
      return {
        ...prev,
        [selectedRole]: {
          ...current,
          [field]: newPermissions
        }
      };
    });
    setHasChanges(true);
  };

  // 切换用户权限
  const toggleUserPermission = (type: 'menu' | 'function', key: string) => {
    setUserPermissions(prev => {
      const existing = prev.find(
        p => p.user_id === selectedUser && 
        (selectedProject ? p.project_id === selectedProject : p.project_id === null)
      );

      const field = type === 'menu' ? 'menu_permissions' : 'function_permissions';
      
      if (existing) {
        // 更新现有权限
        const newPermissions = existing[field].includes(key)
          ? existing[field].filter(p => p !== key)
          : [...existing[field], key];
          
        return prev.map(p => 
          p.user_id === selectedUser && 
          (selectedProject ? p.project_id === selectedProject : p.project_id === null)
            ? { ...p, [field]: newPermissions }
            : p
        );
      } else {
        // 创建新权限记录
        const newPermission: UserPermission = {
          user_id: selectedUser,
          project_id: selectedProject,
          menu_permissions: type === 'menu' ? [key] : [],
          function_permissions: type === 'function' ? [key] : []
        };
        return [...prev, newPermission];
      }
    });
    setHasChanges(true);
  };

  // 保存权限配置 - 优化版本
  const handleSavePermissions = async () => {
    await savePermissions(roleTemplates, userPermissions);
  };

  // 过滤用户
  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64">加载中...</div>;
  }

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
            <p className="text-muted-foreground">配置角色模板和用户的菜单访问权限与功能权限</p>
          </div>
        </div>
        <Button 
          onClick={handleSavePermissions} 
          disabled={!hasChanges || loading}
          className="bg-gradient-primary text-white mr-2"
        >
          <Save className="h-4 w-4 mr-2" />
          {loading ? '保存中...' : '保存配置'}
        </Button>
        <Button 
          onClick={handleCleanupDuplicates} 
          disabled={loading}
          variant="outline"
          className="mr-2"
        >
          <Trash className="h-4 w-4 mr-2" />
          清理重复数据
        </Button>
        <Button 
          onClick={handleForceRefresh} 
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          强制刷新
        </Button>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="role-templates" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            角色模板管理
          </TabsTrigger>
          <TabsTrigger value="user-permissions" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            用户权限管理
          </TabsTrigger>
        </TabsList>

        {/* 角色模板管理 */}
        <TabsContent value="role-templates" className="space-y-6">
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
              <RolePermissionEditor
                role={selectedRole}
                permissions={getCurrentRolePermissions()}
                onTogglePermission={toggleRolePermission}
              />
            </div>
          </div>
        </TabsContent>

        {/* 用户权限管理 */}
        <TabsContent value="user-permissions" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* 用户和项目选择 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  选择用户和项目
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 搜索用户 */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索用户..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* 用户列表 */}
                <div className="max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {filteredUsers.map(user => (
                      <div
                        key={user.id}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          selectedUser === user.id 
                            ? 'bg-gradient-primary text-white shadow-lg' 
                            : 'bg-card hover:bg-muted border'
                        }`}
                        onClick={() => setSelectedUser(user.id)}
                      >
                        <div className="space-y-1">
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-xs opacity-80">{user.email}</div>
                          <Badge 
                            variant="outline" 
                            className={selectedUser === user.id ? 'border-white text-white' : ''}
                          >
                            {ROLES.find(r => r.value === user.role)?.label}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 项目选择 */}
                {selectedUser && (
                  <div className="space-y-2">
                    <Label>选择项目 (可选)</Label>
                    <Select value={selectedProject || 'global'} onValueChange={(value) => setSelectedProject(value === 'global' ? null : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择项目或全局权限" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">全局权限</SelectItem>
                        {projects.filter(project => project.id && project.id.trim() !== '').map(project => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 用户权限配置 */}
            {selectedUser && (
              <div className="lg:col-span-3">
                <UserPermissionEditor
                  user={users.find(u => u.id === selectedUser)!}
                  project={selectedProject ? projects.find(p => p.id === selectedProject) : null}
                  permissions={getCurrentUserPermissions()}
                  onTogglePermission={toggleUserPermission}
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// 角色权限编辑组件
function RolePermissionEditor({ 
  role, 
  permissions, 
  onTogglePermission 
}: {
  role: string;
  permissions: { menu_permissions: string[]; function_permissions: string[] };
  onTogglePermission: (type: 'menu' | 'function', key: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          角色权限模板 - {ROLES.find(r => r.value === role)?.label}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            菜单权限: {permissions.menu_permissions.length}
          </Badge>
          <Badge variant="outline">
            功能权限: {permissions.function_permissions.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <PermissionEditor
          menuPermissions={permissions.menu_permissions}
          functionPermissions={permissions.function_permissions}
          onToggleMenu={(key) => onTogglePermission('menu', key)}
          onToggleFunction={(key) => onTogglePermission('function', key)}
        />
      </CardContent>
    </Card>
  );
}

// 用户权限编辑组件
function UserPermissionEditor({ 
  user, 
  project, 
  permissions, 
  onTogglePermission 
}: {
  user: User;
  project: Project | null;
  permissions: UserPermission;
  onTogglePermission: (type: 'menu' | 'function', key: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          用户权限配置 - {user.full_name}
        </CardTitle>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              角色: {ROLES.find(r => r.value === user.role)?.label}
            </Badge>
            {project && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                项目: {project.name}
              </Badge>
            )}
            {!project && (
              <Badge variant="outline">
                全局权限
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              菜单权限: {permissions.menu_permissions.length}
            </Badge>
            <Badge variant="outline">
              功能权限: {permissions.function_permissions.length}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <PermissionEditor
          menuPermissions={permissions.menu_permissions}
          functionPermissions={permissions.function_permissions}
          onToggleMenu={(key) => onTogglePermission('menu', key)}
          onToggleFunction={(key) => onTogglePermission('function', key)}
        />
      </CardContent>
    </Card>
  );
}

// 权限编辑器组件
function PermissionEditor({
  menuPermissions,
  functionPermissions,
  onToggleMenu,
  onToggleFunction
}: {
  menuPermissions: string[];
  functionPermissions: string[];
  onToggleMenu: (key: string) => void;
  onToggleFunction: (key: string) => void;
}) {
  return (
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
                      checked={menuPermissions.includes(permission.key)}
                      onCheckedChange={() => onToggleMenu(permission.key)}
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
                      checked={functionPermissions.includes(permission.key)}
                      onCheckedChange={() => onToggleFunction(permission.key)}
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
  );
}