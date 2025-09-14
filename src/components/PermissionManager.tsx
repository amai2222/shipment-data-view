// 权限管理组件

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  Users, 
  Settings, 
  Save, 
  RefreshCw, 
  User, 
  Building2, 
  Eye,
  Edit,
  Trash2,
  Plus
} from 'lucide-react';
import { 
  MENU_PERMISSIONS, 
  FUNCTION_PERMISSIONS, 
  PROJECT_PERMISSIONS, 
  DATA_PERMISSIONS,
  ROLES,
  DEFAULT_ROLE_PERMISSIONS
} from '@/config/permissions';
import { 
  UserPermission, 
  RolePermissionTemplate, 
  UserRole, 
  PermissionType 
} from '@/types/permissions';
import { supabase } from '@/integrations/supabase/client';

interface PermissionManagerProps {
  onPermissionChange?: () => void;
}

export function PermissionManager({ onPermissionChange }: PermissionManagerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('roles');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // 角色管理状态
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [roleTemplates, setRoleTemplates] = useState<Record<UserRole, RolePermissionTemplate>>({} as Record<UserRole, RolePermissionTemplate>);
  
  // 用户管理状态
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  
  // 项目列表
  const [projects, setProjects] = useState<any[]>([]);

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [usersResult, projectsResult, roleTemplatesResult, userPermissionsResult] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role, work_wechat_userid, work_wechat_name, phone').order('full_name'),
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('role_permission_templates').select('*'),
        supabase.from('user_permissions').select('*')
      ]);

      if (usersResult.error) throw usersResult.error;
      if (projectsResult.error) throw projectsResult.error;
      if (roleTemplatesResult.error) throw roleTemplatesResult.error;
      if (userPermissionsResult.error) throw userPermissionsResult.error;

      setUsers(usersResult.data || []);
      setProjects(projectsResult.data || []);
      
      // 处理用户权限数据，确保包含所有必需字段
      const userPerms = (userPermissionsResult.data || []).map(perm => ({
        id: perm.id,
        user_id: perm.user_id,
        project_id: perm.project_id,
        menu_permissions: perm.menu_permissions || [],
        function_permissions: perm.function_permissions || [],
        project_permissions: perm.project_permissions || [],
        data_permissions: perm.data_permissions || [],
        inherit_role: perm.inherit_role ?? true,
        custom_settings: typeof perm.custom_settings === 'object' && perm.custom_settings !== null ? perm.custom_settings : {},
        created_at: perm.created_at,
        updated_at: perm.updated_at,
        created_by: perm.created_by || ''
      }));
      setUserPermissions(userPerms);

      // 处理角色模板，确保包含所有必需字段
      const templates: Record<UserRole, RolePermissionTemplate> = {} as Record<UserRole, RolePermissionTemplate>;
      roleTemplatesResult.data?.forEach(template => {
        templates[template.role] = {
          id: template.id,
          role: template.role,
          name: template.name || ROLES[template.role]?.label || template.role,
          description: template.description || ROLES[template.role]?.description || '',
          color: template.color || ROLES[template.role]?.color || 'bg-gray-500',
          menu_permissions: template.menu_permissions || [],
          function_permissions: template.function_permissions || [],
          project_permissions: template.project_permissions || [],
          data_permissions: template.data_permissions || [],
          is_system: template.is_system ?? true,
          created_at: template.created_at,
          updated_at: template.updated_at
        };
      });
      setRoleTemplates(templates);

    } catch (error) {
      console.error('加载数据失败:', error);
      toast({
        title: "错误",
        description: "加载数据失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 获取当前角色权限
  const getCurrentRolePermissions = () => {
    const template = roleTemplates[selectedRole];
    if (template) {
      return {
        menu_permissions: template.menu_permissions,
        function_permissions: template.function_permissions,
        project_permissions: template.project_permissions,
        data_permissions: template.data_permissions
      };
    }
    return DEFAULT_ROLE_PERMISSIONS[selectedRole];
  };

  // 获取当前用户权限
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
    if (user && roleTemplates[user.role as UserRole]) {
      const template = roleTemplates[user.role as UserRole];
      return {
        user_id: selectedUser,
        project_id: selectedProject,
        inherit_role: true,
        menu_permissions: template.menu_permissions,
        function_permissions: template.function_permissions,
        project_permissions: template.project_permissions,
        data_permissions: template.data_permissions,
        custom_settings: {}
      };
    }

    return {
      user_id: selectedUser,
      project_id: selectedProject,
      inherit_role: true,
      menu_permissions: [],
      function_permissions: [],
      project_permissions: [],
      data_permissions: [],
      custom_settings: {}
    };
  };

  // 切换角色权限
  const toggleRolePermission = (type: PermissionType, key: string) => {
    setRoleTemplates(prev => {
      const current = prev[selectedRole] || {
        id: '',
        role: selectedRole,
        name: ROLES[selectedRole].label,
        description: ROLES[selectedRole].description,
        color: ROLES[selectedRole].color,
        menu_permissions: [],
        function_permissions: [],
        project_permissions: [],
        data_permissions: [],
        is_system: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const field = `${type}_permissions` as keyof RolePermissionTemplate;
      const currentPermissions = (current[field] as string[]) || [];
      const newPermissions = currentPermissions.includes(key)
        ? currentPermissions.filter(p => p !== key)
        : [...currentPermissions, key];
      
      return {
        ...prev,
        [selectedRole]: {
          ...current,
          [field]: newPermissions,
          updated_at: new Date().toISOString()
        }
      };
    });
  };

  // 切换用户权限
  const toggleUserPermission = (type: PermissionType, key: string) => {
    setUserPermissions(prev => {
      const current = getCurrentUserPermissions();
      const field = `${type}_permissions` as keyof UserPermission;
      const currentPermissions = (current[field] as string[]) || [];
      const newPermissions = currentPermissions.includes(key)
        ? currentPermissions.filter(p => p !== key)
        : [...currentPermissions, key];

      const updated: UserPermission = {
        id: 'id' in current ? current.id : '',
        user_id: current.user_id,
        project_id: current.project_id,
        menu_permissions: current.menu_permissions,
        function_permissions: current.function_permissions,
        project_permissions: current.project_permissions,
        data_permissions: current.data_permissions,
        inherit_role: current.inherit_role,
        custom_settings: current.custom_settings,
        created_at: 'created_at' in current ? current.created_at : new Date().toISOString(),
        created_by: 'created_by' in current ? current.created_by : '',
        updated_at: new Date().toISOString(),
        [field]: newPermissions
      };

      const existingIndex = prev.findIndex(p => 
        p.user_id === selectedUser && 
        (selectedProject ? p.project_id === selectedProject : p.project_id === null)
      );

      if (existingIndex >= 0) {
        const newPerms = [...prev];
        newPerms[existingIndex] = updated;
        return newPerms;
      } else {
        return [...prev, updated];
      }
    });
  };

  // 保存角色权限
  const saveRolePermissions = async () => {
    try {
      setSaving(true);
      const template = roleTemplates[selectedRole];
      
      // 使用 upsert 操作，避免更新失败
      const { error } = await supabase
        .from('role_permission_templates')
        .upsert({
          role: selectedRole,
          name: ROLES[selectedRole].label,
          description: ROLES[selectedRole].description,
          color: ROLES[selectedRole].color,
          menu_permissions: template.menu_permissions,
          function_permissions: template.function_permissions,
          project_permissions: template.project_permissions,
          data_permissions: template.data_permissions,
          is_system: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'role'
        });

      if (error) {
        console.error('数据库错误详情:', error);
        throw new Error(`数据库操作失败: ${error.message}`);
      }

      toast({
        title: "成功",
        description: "角色权限已保存",
      });

      onPermissionChange?.();
    } catch (error) {
      console.error('保存角色权限失败:', error);
      toast({
        title: "错误",
        description: "保存角色权限失败",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // 保存用户权限
  const saveUserPermissions = async () => {
    try {
      setSaving(true);
      const current = getCurrentUserPermissions();
      
      if ('id' in current && current.id && current.id !== '') {
        // 更新现有权限
        const { error } = await supabase
          .from('user_permissions')
          .update({
            menu_permissions: current.menu_permissions,
            function_permissions: current.function_permissions,
            project_permissions: current.project_permissions,
            data_permissions: current.data_permissions,
            inherit_role: current.inherit_role,
            custom_settings: current.custom_settings,
            updated_at: new Date().toISOString()
          })
          .eq('id', 'id' in current ? current.id : '');

        if (error) throw error;
      } else {
        // 创建新权限
        const { error } = await supabase
          .from('user_permissions')
          .insert({
            user_id: selectedUser,
            project_id: selectedProject || null,
            menu_permissions: current.menu_permissions,
            function_permissions: current.function_permissions,
            project_permissions: current.project_permissions,
            data_permissions: current.data_permissions,
            inherit_role: current.inherit_role,
            custom_settings: current.custom_settings
          });

        if (error) throw error;
      }

      toast({
        title: "成功",
        description: "用户权限已保存",
      });

      onPermissionChange?.();
    } catch (error) {
      console.error('保存用户权限失败:', error);
      toast({
        title: "错误",
        description: "保存用户权限失败",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // 渲染权限列表
  const renderPermissionList = (
    permissions: any[],
    currentPermissions: string[],
    onToggle: (key: string) => void,
    type: PermissionType
  ) => {
    return (
      <div className="space-y-4">
        {permissions.map(group => (
          <Card key={group.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{group.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.children?.map((permission: any) => (
                <div key={permission.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={permission.key}
                    checked={currentPermissions.includes(permission.key)}
                    onCheckedChange={() => onToggle(permission.key)}
                  />
                  <Label htmlFor={permission.key} className="text-sm">
                    {permission.label}
                  </Label>
                  {permission.description && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {permission.description}
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">加载中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">权限管理</h2>
          <p className="text-muted-foreground">管理系统角色和用户权限</p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="roles">角色权限</TabsTrigger>
          <TabsTrigger value="users">用户权限</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                角色权限管理
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4 mb-6">
                <div>
                  <Label htmlFor="role-select">选择角色</Label>
                  <Select value={selectedRole} onValueChange={(value: UserRole) => setSelectedRole(value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLES).map(([key, role]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full ${role.color} mr-2`} />
                            {role.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="outline" className={ROLES[selectedRole].color}>
                  {ROLES[selectedRole].label}
                </Badge>
              </div>

              <Tabs defaultValue="menu" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="menu">菜单权限</TabsTrigger>
                  <TabsTrigger value="function">功能权限</TabsTrigger>
                  <TabsTrigger value="project">项目权限</TabsTrigger>
                  <TabsTrigger value="data">数据权限</TabsTrigger>
                </TabsList>

                <TabsContent value="menu">
                  <ScrollArea className="h-96">
                    {renderPermissionList(
                      MENU_PERMISSIONS,
                      getCurrentRolePermissions().menu_permissions,
                      (key) => toggleRolePermission('menu', key),
                      'menu'
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="function">
                  <ScrollArea className="h-96">
                    {renderPermissionList(
                      FUNCTION_PERMISSIONS,
                      getCurrentRolePermissions().function_permissions,
                      (key) => toggleRolePermission('function', key),
                      'function'
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="project">
                  <ScrollArea className="h-96">
                    {renderPermissionList(
                      PROJECT_PERMISSIONS,
                      getCurrentRolePermissions().project_permissions,
                      (key) => toggleRolePermission('project', key),
                      'project'
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="data">
                  <ScrollArea className="h-96">
                    {renderPermissionList(
                      DATA_PERMISSIONS,
                      getCurrentRolePermissions().data_permissions,
                      (key) => toggleRolePermission('data', key),
                      'data'
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end mt-6">
                <Button onClick={saveRolePermissions} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? '保存中...' : '保存角色权限'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                用户权限管理
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4 mb-6">
                <div>
                  <Label htmlFor="user-select">选择用户</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="选择用户" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-2" />
                            {user.full_name} ({user.email})
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="project-select">选择项目</Label>
                  <Select value={selectedProject || 'global'} onValueChange={(value) => setSelectedProject(value === 'global' ? '' : value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="全局权限" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">全局权限</SelectItem>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          <div className="flex items-center">
                            <Building2 className="h-4 w-4 mr-2" />
                            {project.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedUser && (
                <>
                  <Tabs defaultValue="menu" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="menu">菜单权限</TabsTrigger>
                      <TabsTrigger value="function">功能权限</TabsTrigger>
                      <TabsTrigger value="project">项目权限</TabsTrigger>
                      <TabsTrigger value="data">数据权限</TabsTrigger>
                    </TabsList>

                    <TabsContent value="menu">
                      <ScrollArea className="h-96">
                        {renderPermissionList(
                          MENU_PERMISSIONS,
                          getCurrentUserPermissions().menu_permissions,
                          (key) => toggleUserPermission('menu', key),
                          'menu'
                        )}
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="function">
                      <ScrollArea className="h-96">
                        {renderPermissionList(
                          FUNCTION_PERMISSIONS,
                          getCurrentUserPermissions().function_permissions,
                          (key) => toggleUserPermission('function', key),
                          'function'
                        )}
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="project">
                      <ScrollArea className="h-96">
                        {renderPermissionList(
                          PROJECT_PERMISSIONS,
                          getCurrentUserPermissions().project_permissions,
                          (key) => toggleUserPermission('project', key),
                          'project'
                        )}
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="data">
                      <ScrollArea className="h-96">
                        {renderPermissionList(
                          DATA_PERMISSIONS,
                          getCurrentUserPermissions().data_permissions,
                          (key) => toggleUserPermission('data', key),
                          'data'
                        )}
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>

                  <div className="flex justify-end mt-6">
                    <Button onClick={saveUserPermissions} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? '保存中...' : '保存用户权限'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
