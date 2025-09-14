import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  Users, 
  Building2, 
  Database,
  RefreshCw,
  Save,
  Copy,
  Key
} from 'lucide-react';
import { PermissionVisualizer } from '../PermissionVisualizer';
import { ProjectPermissionManager } from '../ProjectPermissionManager';
import { useProjects } from '@/hooks/useProjects';
import { UserWithPermissions, RoleTemplate } from '@/types/permissions';

interface PermissionConfigurationProps {
  users: UserWithPermissions[];
  roleTemplates: Record<string, RoleTemplate>;
  userPermissions: Record<string, any>;
  hasChanges: boolean;
  onSave: () => void;
  onLoadData: () => void;
  onSetHasChanges: (hasChanges: boolean) => void;
  onSetUserPermissions: (permissions: Record<string, any>) => void;
}

export function PermissionConfiguration({
  users,
  roleTemplates,
  userPermissions,
  hasChanges,
  onSave,
  onLoadData,
  onSetHasChanges,
  onSetUserPermissions
}: PermissionConfigurationProps) {
  const { toast } = useToast();
  const { projects } = useProjects();
  
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedPermissionType, setSelectedPermissionType] = useState<'menu' | 'function' | 'project' | 'data'>('menu');

  // 合并用户和权限数据
  const usersWithPermissions = useMemo(() => {
    return users.map(user => {
      const userPerms = userPermissions[user.id] || {};
      const roleTemplate = roleTemplates[user.role] || {};
      
      return {
        ...user,
        permissions: {
          menu: userPerms.menu_permissions || roleTemplate.menu_permissions || [],
          function: userPerms.function_permissions || roleTemplate.function_permissions || [],
          project: userPerms.project_permissions || roleTemplate.project_permissions || [],
          data: userPerms.data_permissions || roleTemplate.data_permissions || []
        }
      };
    });
  }, [users, userPermissions, roleTemplates]);

  const selectedUser = usersWithPermissions.find(u => u.id === selectedUserId);

  // 复制权限
  const handleCopyPermissions = async (sourceUserId: string, targetUserId: string) => {
    try {
      const sourcePermissions = userPermissions[sourceUserId] || {};
      
      const { error } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: targetUserId,
          menu_permissions: sourcePermissions.menu_permissions || [],
          function_permissions: sourcePermissions.function_permissions || [],
          project_permissions: sourcePermissions.project_permissions || [],
          data_permissions: sourcePermissions.data_permissions || []
        });

      if (error) throw error;

      toast({
        title: "复制成功",
        description: "权限已成功复制",
      });

      onLoadData();
    } catch (error: any) {
      console.error('复制权限失败:', error);
      toast({
        title: "复制失败",
        description: "复制权限失败",
        variant: "destructive"
      });
    }
  };

  // 重置权限
  const handleResetPermissions = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "重置成功",
        description: "权限已重置为角色默认权限",
      });

      onLoadData();
    } catch (error: any) {
      console.error('重置权限失败:', error);
      toast({
        title: "重置失败",
        description: "重置权限失败",
        variant: "destructive"
      });
    }
  };

  // 更新用户权限
  const handleUpdateUserPermissions = (permissions: any) => {
    if (!selectedUserId) return;
    
    const newUserPermissions = {
      ...userPermissions,
      [selectedUserId]: permissions
    };
    
    onSetUserPermissions(newUserPermissions);
    onSetHasChanges(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>权限配置</CardTitle>
          <CardDescription>
            选择用户后配置个性化权限，支持可视化权限管理
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 用户选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">选择用户</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择要配置权限的用户" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} ({user.email}) - {user.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 权限类型选择 */}
            {selectedUser && (
              <div className="space-y-2">
                <label className="text-sm font-medium">权限类型</label>
                <Select value={selectedPermissionType} onValueChange={(value: any) => setSelectedPermissionType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择权限类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="menu">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        菜单权限
                      </div>
                    </SelectItem>
                    <SelectItem value="function">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        功能权限
                      </div>
                    </SelectItem>
                    <SelectItem value="project">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        项目权限
                      </div>
                    </SelectItem>
                    <SelectItem value="data">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        数据权限
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 用户信息显示 */}
            {selectedUser && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{selectedUser.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">{selectedUser.role}</Badge>
                      <Badge variant={selectedUser.is_active ? "default" : "secondary"}>
                        {selectedUser.is_active ? "启用" : "禁用"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetPermissions(selectedUser.id)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      重置权限
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // 复制权限逻辑
                        const sourceUser = usersWithPermissions.find(u => u.id !== selectedUser.id);
                        if (sourceUser) {
                          handleCopyPermissions(sourceUser.id, selectedUser.id);
                        }
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      复制权限
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 权限配置区域 */}
            {selectedUser && (
              <div className="space-y-4">
                {selectedPermissionType === 'project' ? (
                  <ProjectPermissionManager
                    userId={selectedUser.id}
                    userName={selectedUser.full_name}
                    userRole={selectedUser.role}
                    userProjectPermissions={selectedUser.permissions?.project || []}
                    onPermissionChange={(projectId, hasAccess) => {
                      const currentPermissions = userPermissions[selectedUser.id] || {};
                      const newProjectPermissions = hasAccess 
                        ? [...(currentPermissions.project_permissions || []), projectId]
                        : (currentPermissions.project_permissions || []).filter(p => p !== projectId);
                      
                      const newPermissions = {
                        ...currentPermissions,
                        project_permissions: newProjectPermissions
                      };
                      handleUpdateUserPermissions(newPermissions);
                    }}
                  />
                ) : (
                  <PermissionVisualizer
                    userPermissions={selectedUser.permissions}
                    rolePermissions={{
                      menu: roleTemplates[selectedUser.role]?.menu_permissions || [],
                      function: roleTemplates[selectedUser.role]?.function_permissions || [],
                      project: roleTemplates[selectedUser.role]?.project_permissions || [],
                      data: roleTemplates[selectedUser.role]?.data_permissions || []
                    }}
                    onPermissionChange={(type, key, checked) => {
                      const currentPermissions = userPermissions[selectedUser.id] || {};
                      const newPermissions = {
                        ...currentPermissions,
                        [`${type}_permissions`]: checked 
                          ? [...(currentPermissions[`${type}_permissions`] || []), key]
                          : (currentPermissions[`${type}_permissions`] || []).filter(p => p !== key)
                      };
                      handleUpdateUserPermissions(newPermissions);
                    }}
                  />
                )}
              </div>
            )}

            {/* 操作按钮 */}
            {hasChanges && (
              <div className="flex items-center gap-2 pt-4 border-t">
                <Button onClick={onSave}>
                  <Save className="h-4 w-4 mr-2" />
                  保存更改
                </Button>
                <Button variant="outline" onClick={onLoadData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重新加载
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
