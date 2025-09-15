// 用户权限管理组件 - 简化版本

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Users, Settings, Building2, Database } from 'lucide-react';
import { PermissionSelector } from './PermissionSelector';
import { 
  User, 
  Project, 
  UserPermission, 
  RoleTemplate, 
  AppRole 
} from '@/types/permission';
import { MENU_PERMISSIONS, FUNCTION_PERMISSIONS, PROJECT_PERMISSIONS, DATA_PERMISSIONS } from '@/config/permissionsNew';

interface UserPermissionManagementProps {
  users: User[];
  projects: Project[];
  userPermissions: UserPermission[];
  roleTemplates: Record<AppRole, RoleTemplate>;
  onSaveUserPermission: (permission: Partial<UserPermission>) => Promise<any>;
  onDeleteUserPermission: (userId: string, projectId?: string) => Promise<any>;
  loading?: boolean;
}

export function UserPermissionManagement({ 
  users, 
  projects, 
  userPermissions, 
  roleTemplates,
  onSaveUserPermission,
  onDeleteUserPermission,
  loading = false 
}: UserPermissionManagementProps) {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [currentPermission, setCurrentPermission] = useState<Partial<UserPermission>>({});
  const [inheritRole, setInheritRole] = useState(true);
  const [saving, setSaving] = useState(false);

  // 当选择用户或项目时，加载对应的权限
  useEffect(() => {
    if (selectedUser) {
      const existingPermission = userPermissions.find(p => 
        p.user_id === selectedUser && 
        (selectedProject ? p.project_id === selectedProject : !p.project_id)
      );

      if (existingPermission) {
        setCurrentPermission({
          user_id: existingPermission.user_id,
          project_id: existingPermission.project_id,
          menu_permissions: [...existingPermission.menu_permissions],
          function_permissions: [...existingPermission.function_permissions],
          project_permissions: [...existingPermission.project_permissions],
          data_permissions: [...existingPermission.data_permissions],
          inherit_role: existingPermission.inherit_role
        });
        setInheritRole(existingPermission.inherit_role);
      } else {
        // 创建新权限，默认继承角色权限
        setCurrentPermission({
          user_id: selectedUser,
          project_id: selectedProject || undefined,
          menu_permissions: [],
          function_permissions: [],
          project_permissions: [],
          data_permissions: [],
          inherit_role: true
        });
        setInheritRole(true);
      }
    }
  }, [selectedUser, selectedProject, userPermissions]);

  // 保存用户权限
  const handleSave = async () => {
    if (!selectedUser) {
      toast({
        title: "错误",
        description: "请选择用户",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      
      const permissionData = {
        ...currentPermission,
        inherit_role: inheritRole
      };

      const result = await onSaveUserPermission(permissionData);
      
      if (result.success) {
        toast({
          title: "成功",
          description: result.message
        });
      } else {
        toast({
          title: "错误",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "错误",
        description: `保存失败: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // 删除用户权限
  const handleDelete = async () => {
    if (!selectedUser) return;

    try {
      setSaving(true);
      
      const result = await onDeleteUserPermission(selectedUser, selectedProject || undefined);
      
      if (result.success) {
        toast({
          title: "成功",
          description: result.message
        });
        setCurrentPermission({
          user_id: selectedUser,
          project_id: selectedProject || undefined,
          menu_permissions: [],
          function_permissions: [],
          project_permissions: [],
          data_permissions: [],
          inherit_role: true
        });
        setInheritRole(true);
      } else {
        toast({
          title: "错误",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "错误",
        description: `删除失败: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // 更新权限
  const updatePermissions = (type: 'menu' | 'function' | 'project' | 'data', permissions: string[]) => {
    setCurrentPermission(prev => ({
      ...prev,
      [`${type}_permissions`]: permissions
    }));
  };

  // 计算总权限数
  const getTotalPermissions = () => {
    return (currentPermission.menu_permissions?.length || 0) +
           (currentPermission.function_permissions?.length || 0) +
           (currentPermission.project_permissions?.length || 0) +
           (currentPermission.data_permissions?.length || 0);
  };

  // 获取用户信息
  const selectedUserInfo = users.find(u => u.id === selectedUser);
  const selectedProjectInfo = projects.find(p => p.id === selectedProject);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">加载中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 用户和项目选择 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            用户权限管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">选择用户</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="选择用户" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm font-medium">选择项目（可选）</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="选择项目（全局权限）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全局权限</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedUserInfo && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">{selectedUserInfo.full_name}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedUserInfo.email} • {selectedUserInfo.role}
                </div>
                {selectedProjectInfo && (
                  <div className="text-sm text-muted-foreground">
                    项目: {selectedProjectInfo.name}
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="inherit-role"
                    checked={inheritRole}
                    onCheckedChange={setInheritRole}
                    disabled={saving}
                  />
                  <Label htmlFor="inherit-role">继承角色权限</Label>
                </div>
                
                <Badge variant="outline">
                  总权限: {getTotalPermissions()}
                </Badge>
                
                <div className="flex space-x-2">
                  <Button 
                    onClick={handleSave} 
                    disabled={saving}
                    size="sm"
                  >
                    {saving ? '保存中...' : '保存'}
                  </Button>
                  
                  {currentPermission.menu_permissions && currentPermission.menu_permissions.length > 0 && (
                    <Button 
                      onClick={handleDelete} 
                      disabled={saving}
                      variant="destructive"
                      size="sm"
                    >
                      删除
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 权限配置 */}
      {selectedUser && currentPermission && (
        <Tabs defaultValue="menu" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="menu" className="flex items-center">
              <Users className="h-4 w-4 mr-2" />
              菜单权限
            </TabsTrigger>
            <TabsTrigger value="function" className="flex items-center">
              <Settings className="h-4 w-4 mr-2" />
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

          <TabsContent value="menu">
            <PermissionSelector
              title="菜单权限"
              permissions={MENU_PERMISSIONS}
              selectedPermissions={currentPermission.menu_permissions || []}
              onPermissionChange={(permissions) => updatePermissions('menu', permissions)}
              disabled={inheritRole}
            />
          </TabsContent>

          <TabsContent value="function">
            <PermissionSelector
              title="功能权限"
              permissions={FUNCTION_PERMISSIONS}
              selectedPermissions={currentPermission.function_permissions || []}
              onPermissionChange={(permissions) => updatePermissions('function', permissions)}
              disabled={inheritRole}
            />
          </TabsContent>

          <TabsContent value="project">
            <PermissionSelector
              title="项目权限"
              permissions={PROJECT_PERMISSIONS}
              selectedPermissions={currentPermission.project_permissions || []}
              onPermissionChange={(permissions) => updatePermissions('project', permissions)}
              disabled={inheritRole}
            />
          </TabsContent>

          <TabsContent value="data">
            <PermissionSelector
              title="数据权限"
              permissions={DATA_PERMISSIONS}
              selectedPermissions={currentPermission.data_permissions || []}
              onPermissionChange={(permissions) => updatePermissions('data', permissions)}
              disabled={inheritRole}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
