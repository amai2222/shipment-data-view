// 用户权限管理组件

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { User, Save, UserCog } from 'lucide-react';
import { 
  MENU_PERMISSIONS, 
  FUNCTION_PERMISSIONS, 
  ROLES
} from '@/config/permissions';
import { supabase } from '@/integrations/supabase/client';

interface UserPermissionManagementProps {
  users: any[];
  projects: any[];
  userPermissions: any[];
  roleTemplates: any[];
  onDataChange: () => void;
}

export function UserPermissionManagement({ 
  users, 
  projects, 
  userPermissions, 
  roleTemplates,
  onDataChange 
}: UserPermissionManagementProps) {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [saving, setSaving] = useState(false);
  const [inheritRole, setInheritRole] = useState(true);
  const [currentPermissions, setCurrentPermissions] = useState({
    menu_permissions: [] as string[],
    function_permissions: [] as string[]
  });

  // 获取当前用户权限配置
  React.useEffect(() => {
    if (!selectedUser) return;

    const userPerm = userPermissions.find(p => 
      p.user_id === selectedUser && 
      (selectedProject ? p.project_id === selectedProject : !p.project_id)
    );

    if (userPerm) {
      setCurrentPermissions({
        menu_permissions: userPerm.menu_permissions || [],
        function_permissions: userPerm.function_permissions || []
      });
      setInheritRole(userPerm.inherit_role ?? true);
    } else {
      // 获取用户角色的默认权限
      const user = users.find(u => u.id === selectedUser);
      const roleTemplate = roleTemplates.find(t => t.role === user?.role);
      
      if (roleTemplate) {
        setCurrentPermissions({
          menu_permissions: roleTemplate.menu_permissions || [],
          function_permissions: roleTemplate.function_permissions || []
        });
      } else {
        setCurrentPermissions({
          menu_permissions: [],
          function_permissions: []
        });
      }
      setInheritRole(true);
    }
  }, [selectedUser, selectedProject, userPermissions, users, roleTemplates]);

  // 切换权限
  const togglePermission = (type: string, key: string) => {
    setCurrentPermissions(prev => {
      const field = `${type}_permissions` as keyof typeof prev;
      const current = prev[field] || [];
      const updated = current.includes(key)
        ? current.filter(p => p !== key)
        : [...current, key];
      
      return {
        ...prev,
        [field]: updated
      };
    });
  };

  // 保存用户权限
  const handleSaveUserPermissions = async () => {
    if (!selectedUser) {
      toast({
        title: "错误",
        description: "请选择用户",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      
      const existingPerm = userPermissions.find(p => 
        p.user_id === selectedUser && 
        (selectedProject ? p.project_id === selectedProject : !p.project_id)
      );

      const permissionData = {
        user_id: selectedUser,
        project_id: selectedProject || null,
        menu_permissions: currentPermissions.menu_permissions,
        function_permissions: currentPermissions.function_permissions,
        project_permissions: [],
        data_permissions: [],
        inherit_role: inheritRole,
        custom_settings: {}
      };

      if (existingPerm) {
        // 更新现有权限
        const { error } = await supabase
          .from('user_permissions')
          .update(permissionData)
          .eq('id', existingPerm.id);

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
        description: "用户权限已保存",
      });

      onDataChange();
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
    permissions: any,
    currentPerms: string[],
    type: string
  ) => {
    return (
      <div className="space-y-4">
        {Object.entries(permissions).map(([key, group]: [string, any]) => (
          <Card key={key} className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{group.label}</CardTitle>
                <Badge variant="outline">
                  {group.children?.filter((child: any) => currentPerms.includes(child.key)).length || 0} / {group.children?.length || 0}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.children?.map((permission: any) => (
                <div key={permission.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={permission.key}
                    checked={currentPerms.includes(permission.key)}
                    onCheckedChange={() => togglePermission(type, permission.key)}
                    disabled={inheritRole}
                  />
                  <Label 
                    htmlFor={permission.key} 
                    className={`text-sm flex-1 ${inheritRole ? 'text-muted-foreground' : ''}`}
                  >
                    {permission.label}
                  </Label>
                  {permission.description && (
                    <span className="text-xs text-muted-foreground">
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

  const selectedUserInfo = users.find(u => u.id === selectedUser);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <UserCog className="h-5 w-5 mr-2" />
          用户权限管理
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 用户和项目选择 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="user-select">选择用户</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="选择用户" />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      {user.full_name || user.email}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="project-select">选择项目 (可选)</Label>
            <Select value={selectedProject || 'global'} onValueChange={(value) => setSelectedProject(value === 'global' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="全局权限" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">全局权限</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 用户信息显示 */}
        {selectedUserInfo && (
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedUserInfo.full_name || selectedUserInfo.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge className={ROLES[selectedUserInfo.role]?.color || 'bg-gray-500'}>
                      {ROLES[selectedUserInfo.role]?.label || selectedUserInfo.role}
                    </Badge>
                    <Badge variant={selectedUserInfo.is_active ? "default" : "secondary"}>
                      {selectedUserInfo.is_active ? "活跃" : "禁用"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 继承角色权限开关 */}
        {selectedUser && (
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="inherit-role" className="font-medium">
                继承角色权限
              </Label>
              <p className="text-sm text-muted-foreground">
                启用后将使用角色的默认权限，禁用后可自定义权限
              </p>
            </div>
            <Switch
              id="inherit-role"
              checked={inheritRole}
              onCheckedChange={setInheritRole}
            />
          </div>
        )}

        {/* 权限配置 */}
        {selectedUser && (
          <Tabs defaultValue="menu" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="menu">
                菜单权限 ({currentPermissions.menu_permissions.length})
              </TabsTrigger>
              <TabsTrigger value="function">
                功能权限 ({currentPermissions.function_permissions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="menu">
              <ScrollArea className="h-96">
                {renderPermissionList(
                  MENU_PERMISSIONS,
                  currentPermissions.menu_permissions,
                  'menu'
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="function">
              <ScrollArea className="h-96">
                {renderPermissionList(
                  FUNCTION_PERMISSIONS,
                  currentPermissions.function_permissions,
                  'function'
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        {/* 保存按钮 */}
        {selectedUser && (
          <div className="flex justify-end">
            <Button onClick={handleSaveUserPermissions} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? '保存中...' : '保存用户权限'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}