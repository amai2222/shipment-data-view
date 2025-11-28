import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Settings, Save, Search, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { ScrollArea } from "@/components/ui/scroll-area";
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FUNCTION_PERMISSIONS } from '@/config/dynamicPermissions';

// 角色定义
const ROLES = [
  { value: 'admin', label: '系统管理员', color: 'bg-red-500' },
  { value: 'finance', label: '财务人员', color: 'bg-blue-500' },
  { value: 'business', label: '业务人员', color: 'bg-green-500' },
  { value: 'operator', label: '操作员', color: 'bg-yellow-500' },
  { value: 'partner', label: '合作方', color: 'bg-purple-500' },
  { value: 'viewer', label: '查看者', color: 'bg-gray-500' }
];

// 移动端优化的菜单权限定义
const MENU_PERMISSIONS = [
  {
    group: '数据看板',
    permissions: [
      { key: 'dashboard.transport', label: '运输看板' },
      { key: 'dashboard.financial', label: '财务看板' },
      { key: 'dashboard.project', label: '项目看板' },
      { key: 'dashboard.shipper', label: '货主看板' }
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
      { key: 'business.payment_request', label: '付款申请' }
    ]
  },
  {
    group: '财务对账',
    permissions: [
      { key: 'finance.reconciliation', label: '运费对账' },
      { key: 'finance.payment_invoice', label: '财务收款' }
    ]
  }
];

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface RoleTemplate {
  role: string;
  menu_permissions: string[];
  function_permissions: string[];
}

interface UserPermission {
  user_id: string;
  project_id: string | null;
  menu_permissions: string[];
  function_permissions: string[];
}

export default function MobilePermissionManagement() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('role-templates');
  const [selectedRole, setSelectedRole] = useState('operator');
  const [roleTemplates, setRoleTemplates] = useState<Record<string, RoleTemplate>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // 控制折叠组的状态
  const [openGroups, setOpenGroups] = useState<string[]>(['数据看板']);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 加载角色模板
      const { data: templates } = await supabase
        .from('role_permission_templates')
        .select('*');
      
      if (templates) {
        const templateMap = templates.reduce((acc, template) => {
          acc[template.role] = template;
          return acc;
        }, {} as Record<string, RoleTemplate>);
        setRoleTemplates(templateMap);
      }

      // 加载用户列表
      const { data: userData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('is_active', true);
      
      if (userData) {
        setUsers(userData);
      }

      // 加载用户权限
      const { data: permissionData } = await supabase
        .from('user_permissions')
        .select('*');
      
      if (permissionData) {
        setUserPermissions(permissionData);
      }

    } catch (error) {
      console.error('加载数据失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载权限数据",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentRolePermissions = () => {
    return roleTemplates[selectedRole] || { menu_permissions: [], function_permissions: [] };
  };

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

  const getCurrentUserPermissions = () => {
    const userPerm = userPermissions.find(p => p.user_id === selectedUser && p.project_id === null);
    
    if (userPerm) {
      return userPerm;
    }

    const user = users.find(u => u.id === selectedUser);
    if (user && roleTemplates[user.role]) {
      return {
        user_id: selectedUser,
        project_id: null,
        menu_permissions: roleTemplates[user.role].menu_permissions || [],
        function_permissions: roleTemplates[user.role].function_permissions || []
      };
    }

    return {
      user_id: selectedUser,
      project_id: null,
      menu_permissions: [],
      function_permissions: []
    };
  };

  const toggleUserPermission = (type: 'menu' | 'function', key: string) => {
    setUserPermissions(prev => {
      const existing = prev.find(p => p.user_id === selectedUser && p.project_id === null);
      const field = type === 'menu' ? 'menu_permissions' : 'function_permissions';
      
      if (existing) {
        const newPermissions = existing[field].includes(key)
          ? existing[field].filter(p => p !== key)
          : [...existing[field], key];
          
        return prev.map(p => 
          p.user_id === selectedUser && p.project_id === null
            ? { ...p, [field]: newPermissions }
            : p
        );
      } else {
        const newPermission: UserPermission = {
          user_id: selectedUser,
          project_id: null,
          menu_permissions: type === 'menu' ? [key] : [],
          function_permissions: type === 'function' ? [key] : []
        };
        return [...prev, newPermission];
      }
    });
    setHasChanges(true);
  };

  const savePermissions = async () => {
    try {
      // 保存角色模板
      for (const [roleKey, template] of Object.entries(roleTemplates)) {
        await supabase
          .from('role_permission_templates')
          .upsert({
            role: roleKey,
            menu_permissions: template.menu_permissions,
            function_permissions: template.function_permissions
          });
      }

      // 保存用户权限
      for (const userPerm of userPermissions) {
        await supabase
          .from('user_permissions')
          .upsert({
            user_id: userPerm.user_id,
            project_id: userPerm.project_id,
            menu_permissions: userPerm.menu_permissions,
            function_permissions: userPerm.function_permissions,
            created_by: (await supabase.auth.getUser()).data.user?.id
          });
      }

      toast({
        title: "保存成功",
        description: "权限配置已更新",
      });
      setHasChanges(false);
    } catch (error) {
      console.error('保存失败:', error);
      toast({
        title: "保存失败",
        description: "无法保存权限配置",
        variant: "destructive"
      });
    }
  };

  const toggleGroup = (groupName: string) => {
    setOpenGroups(prev => 
      prev.includes(groupName) 
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    );
  };

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">加载中...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">权限管理</h1>
              <p className="text-sm text-muted-foreground">配置角色和用户权限</p>
            </div>
          </div>
          <Button 
            onClick={savePermissions} 
            disabled={!hasChanges}
            size="sm"
            className="bg-gradient-primary"
          >
            <Save className="h-4 w-4 mr-1" />
            保存
          </Button>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="role-templates" className="text-xs">
              <Settings className="h-4 w-4 mr-1" />
              角色模板
            </TabsTrigger>
            <TabsTrigger value="user-permissions" className="text-xs">
              <User className="h-4 w-4 mr-1" />
              用户权限
            </TabsTrigger>
          </TabsList>

          {/* 角色模板管理 */}
          <TabsContent value="role-templates" className="space-y-4">
            {/* 角色选择 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">选择角色</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
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
                        <div className={`w-2 h-2 rounded-full ${role.color}`} />
                        <span className="text-sm font-medium">{role.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 权限配置 */}
            <MobilePermissionEditor
              permissions={getCurrentRolePermissions()}
              onTogglePermission={toggleRolePermission}
              openGroups={openGroups}
              onToggleGroup={toggleGroup}
            />
          </TabsContent>

          {/* 用户权限管理 */}
          <TabsContent value="user-permissions" className="space-y-4">
            {/* 用户选择 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">选择用户</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索用户..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {filteredUsers.map(user => (
                      <div
                        key={user.id}
                        className={`p-2 rounded-lg cursor-pointer transition-all ${
                          selectedUser === user.id 
                            ? 'bg-gradient-primary text-white shadow-lg' 
                            : 'bg-card hover:bg-muted border'
                        }`}
                        onClick={() => setSelectedUser(user.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{user.full_name}</div>
                            <div className="text-xs opacity-80">{user.email}</div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${selectedUser === user.id ? 'border-white text-white' : ''}`}
                          >
                            {ROLES.find(r => r.value === user.role)?.label}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* 用户权限配置 */}
            {selectedUser && (
              <MobilePermissionEditor
                permissions={getCurrentUserPermissions()}
                onTogglePermission={toggleUserPermission}
                openGroups={openGroups}
                onToggleGroup={toggleGroup}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
}

// 移动端权限编辑器组件
interface MobilePermissionEditorProps {
  permissions: { menu_permissions: string[]; function_permissions: string[] };
  onTogglePermission: (type: 'menu' | 'function', key: string) => void;
  openGroups: string[];
  onToggleGroup: (groupName: string) => void;
}

function MobilePermissionEditor({ permissions, onTogglePermission, openGroups, onToggleGroup }: MobilePermissionEditorProps) {
  return (
    <Tabs defaultValue="menu" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="menu" className="text-xs">菜单权限</TabsTrigger>
        <TabsTrigger value="function" className="text-xs">功能权限</TabsTrigger>
      </TabsList>
      
      <TabsContent value="menu" className="space-y-3">
        {MENU_PERMISSIONS.map(group => (
          <Card key={group.group}>
            <Collapsible 
              open={openGroups.includes(group.group)} 
              onOpenChange={() => onToggleGroup(group.group)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer py-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    {group.group}
                    <span className="text-xs text-muted-foreground">
                      {permissions.menu_permissions.filter(p => 
                        group.permissions.some(gp => gp.key === p)
                      ).length}/{group.permissions.length}
                    </span>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {group.permissions.map(permission => (
                      <div key={permission.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={permission.key}
                          checked={permissions.menu_permissions.includes(permission.key)}
                          onCheckedChange={() => onTogglePermission('menu', permission.key)}
                        />
                        <Label htmlFor={permission.key} className="text-sm">
                          {permission.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </TabsContent>
      
      <TabsContent value="function" className="space-y-3">
        {FUNCTION_PERMISSIONS.map(group => (
          <Card key={group.group}>
            <Collapsible 
              open={openGroups.includes(group.group)} 
              onOpenChange={() => onToggleGroup(group.group)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer py-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    {group.group}
                    <span className="text-xs text-muted-foreground">
                      {permissions.function_permissions.filter(p => 
                        group.children?.some(gp => gp.key === p)
                      ).length}/{group.children?.length || 0}
                    </span>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {group.children?.map(permission => (
                      <div key={permission.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={permission.key}
                          checked={permissions.function_permissions.includes(permission.key)}
                          onCheckedChange={() => onTogglePermission('function', permission.key)}
                        />
                        <Label htmlFor={permission.key} className="text-sm">
                          {permission.label}
                        </Label>
                        {permission.description && (
                          <p className="text-xs text-muted-foreground ml-2">
                            {permission.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </TabsContent>
    </Tabs>
  );
}