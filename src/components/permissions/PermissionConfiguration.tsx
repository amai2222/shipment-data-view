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
  Key,
  User,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { PermissionVisualizer } from '../PermissionVisualizer';
import { ProjectPermissionManager } from '../ProjectPermissionManager';
import { useProjects } from '@/hooks/useProjects';
import { UserWithPermissions } from '@/types/index';
import { RoleTemplate } from '@/types/permission';
import { UserCardSelector } from '../UserCardSelector';
import { PermissionConfigDialog } from '../PermissionConfigDialog';
import { PermissionDatabaseService } from '@/services/PermissionDatabaseService';
import { useOptimizedPermissions } from '@/hooks/useOptimizedPermissions';
import { PermissionChangeConfirmDialog } from '../PermissionChangeConfirmDialog';

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
  users: propUsers,
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogUser, setDialogUser] = useState<UserWithPermissions | null>(null);
  const [showPermissionConfirmDialog, setShowPermissionConfirmDialog] = useState(false);
  const [pendingPermissionChanges, setPendingPermissionChanges] = useState<any[]>([]);

  // 使用优化的权限 Hook（与用户列表页面保持一致）
  const { users, loading, roleTemplates: realtimeRoleTemplates, userPermissions: realtimeUserPermissions, loadAllData } = useOptimizedPermissions();
  
  // 提供 refreshUsers 函数以保持兼容性
  const refreshUsers = loadAllData;

  // 合并用户和权限数据（使用统一的数据源）
  const usersWithPermissions = useMemo(() => {
    return users.map(user => {
      // 查找用户的权限记录
      const userPermission = realtimeUserPermissions.find(perm => perm.user_id === user.id);
      const roleTemplate = realtimeRoleTemplates[user.role] || {};
      
      return {
        ...user,
        permissions: {
          menu: userPermission?.menu_permissions || roleTemplate.menu_permissions || [],
          function: userPermission?.function_permissions || roleTemplate.function_permissions || [],
          project: userPermission?.project_permissions || roleTemplate.project_permissions || [],
          data: userPermission?.data_permissions || roleTemplate.data_permissions || []
        }
      };
    });
  }, [users, realtimeUserPermissions, realtimeRoleTemplates]);

  const selectedUser = usersWithPermissions.find(u => u.id === selectedUserId);

  // 复制权限（包括项目分配）
  const handleCopyPermissions = async (sourceUserId: string, targetUserId: string) => {
    try {
      const sourcePermissions = realtimeUserPermissions.find(perm => perm.user_id === sourceUserId) || {};
      
      // 复制用户权限
      const { error: userPermError } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: targetUserId,
          menu_permissions: sourcePermissions.menu_permissions || [],
          function_permissions: sourcePermissions.function_permissions || [],
          project_permissions: sourcePermissions.project_permissions || [],
          data_permissions: sourcePermissions.data_permissions || []
        });

      if (userPermError) throw userPermError;

      // 复制项目分配
      const { data: sourceProjectAssignments, error: fetchError } = await supabase
        .from('user_projects')
        .select('*')
        .eq('user_id', sourceUserId);

      if (fetchError) throw fetchError;

      if (sourceProjectAssignments && sourceProjectAssignments.length > 0) {
        // 先删除目标用户的所有项目分配
        await supabase
          .from('user_projects')
          .delete()
          .eq('user_id', targetUserId);

        // 复制项目分配
        const projectAssignments = sourceProjectAssignments.map(assignment => ({
          user_id: targetUserId,
          project_id: assignment.project_id,
          role: assignment.role,
          can_view: assignment.can_view,
          can_edit: assignment.can_edit,
          can_delete: assignment.can_delete,
          created_by: assignment.created_by
        }));

        const { error: projectError } = await supabase
          .from('user_projects')
          .insert(projectAssignments);

        if (projectError) throw projectError;
      }

      toast({
        title: "复制成功",
        description: "权限和项目分配已成功复制",
      });

      loadAllData();
    } catch (error: any) {
      console.error('复制权限失败:', error);
      toast({
        title: "复制失败",
        description: "复制权限失败",
        variant: "destructive"
      });
    }
  };

  // 重置权限（包括项目分配）
  const handleResetPermissions = async (userId: string) => {
    try {
      // 重置用户权限
      const { error: userPermError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      if (userPermError) throw userPermError;

      // 重置项目分配
      const { error: projectError } = await supabase
        .from('user_projects')
        .delete()
        .eq('user_id', userId);

      if (projectError) throw projectError;

      toast({
        title: "重置成功",
        description: "权限和项目分配已重置为角色默认权限",
      });

      loadAllData();
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
    
    // 由于现在使用实时数据，直接刷新数据而不是更新本地状态
    loadAllData();
    onSetHasChanges(true);
  };

  // 打开权限配置弹窗
  const handleOpenDialog = (user: UserWithPermissions) => {
    setDialogUser(user);
    setIsDialogOpen(true);
  };

  // 关闭权限配置弹窗
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setDialogUser(null);
  };

  // 保存权限配置
  const handleSavePermissions = async (userId: string, permissions: any) => {
    try {
      // 记录权限变更
      const user = users.find(u => u.id === userId);
      if (user) {
        const changes = [{
          type: 'user_permission',
          userId: userId,
          userName: user.full_name,
          oldValue: user.permissions,
          newValue: permissions,
          description: `修改用户权限: ${user.full_name}`
        }];

        setPendingPermissionChanges(changes);
        setShowPermissionConfirmDialog(true);
      }
    } catch (error) {
      console.error('记录权限变更失败:', error);
      toast({
        title: "记录失败",
        description: "无法记录权限变更",
        variant: "destructive"
      });
    }
  };

  // 确认权限变更
  const handleConfirmPermissionChanges = async () => {
    try {
      // 权限已经通过 PermissionConfigDialog 保存到数据库
      // 刷新权限数据
      await loadAllData();
      
      // 更新父组件的权限状态
      const userId = pendingPermissionChanges[0]?.userId;
      if (userId) {
        onSetUserPermissions(prev => ({
          ...prev,
          [userId]: pendingPermissionChanges[0]?.newValue
        }));
      }
      
      onSetHasChanges(true);
      
      toast({
        title: "保存成功",
        description: "权限配置已保存并立即生效",
      });

      setShowPermissionConfirmDialog(false);
      setPendingPermissionChanges([]);
    } catch (error) {
      console.error('更新权限状态失败:', error);
      toast({
        title: "更新失败",
        description: "权限已保存但状态更新失败",
        variant: "destructive"
      });
    }
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
            {/* 用户选择 - 卡片式布局 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">选择用户</label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="搜索用户..."
                      className="w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <Button 
                    onClick={refreshUsers} 
                    disabled={loading}
                    variant="outline"
                    size="sm"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              {/* 用户卡片网格 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {users.map(user => (
                  <Card 
                    key={user.id} 
                    className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-blue-300"
                    onClick={() => handleOpenDialog(user)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* 用户信息 */}
                        <div>
                          <h3 className="font-semibold text-gray-900">{user.full_name}</h3>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                        
                        {/* 角色标签 */}
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={
                              user.role === 'admin' ? 'destructive' :
                              user.role === 'operator' ? 'default' :
                              'secondary'
                            }
                            className="text-xs"
                          >
                            {user.role}
                          </Badge>
                        </div>
                        
                        {/* 权限数量 */}
                        <div className="text-sm text-gray-600">
                          权限数量: <span className="font-medium text-blue-600">
                            {(() => {
                              // 使用统一的权限计算逻辑
                              const userPermission = realtimeUserPermissions.find(perm => perm.user_id === user.id);
                              const roleTemplate = realtimeRoleTemplates[user.role] || {};
                              
                              // 计算实际生效的权限数量（用户自定义权限优先，否则使用角色模板权限）
                              const effectivePermissions = {
                                menu: userPermission?.menu_permissions || roleTemplate.menu_permissions || [],
                                function: userPermission?.function_permissions || roleTemplate.function_permissions || [],
                                project: userPermission?.project_permissions || roleTemplate.project_permissions || [],
                                data: userPermission?.data_permissions || roleTemplate.data_permissions || []
                              };
                              
                              return (
                                effectivePermissions.menu.length +
                                effectivePermissions.function.length +
                                effectivePermissions.project.length +
                                effectivePermissions.data.length
                              );
                            })()}项
                          </span>
                        </div>
                        
                        {/* 配置按钮 */}
                        <div className="pt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDialog(user);
                            }}
                          >
                            点击配置权限
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
                      const currentPermissions = realtimeUserPermissions.find(perm => perm.user_id === selectedUser.id) || {};
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
                      menu: realtimeRoleTemplates[selectedUser.role]?.menu_permissions || [],
                      function: realtimeRoleTemplates[selectedUser.role]?.function_permissions || [],
                      project: realtimeRoleTemplates[selectedUser.role]?.project_permissions || [],
                      data: realtimeRoleTemplates[selectedUser.role]?.data_permissions || []
                    }}
                    onPermissionChange={(type, key, checked) => {
                      const currentPermissions = realtimeUserPermissions.find(perm => perm.user_id === selectedUser.id) || {};
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
                <Button variant="outline" onClick={loadAllData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重新加载
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 权限配置弹窗 */}
      <PermissionConfigDialog
        user={dialogUser}
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSavePermissions}
      />

      {/* 权限变更确认对话框 */}
      <PermissionChangeConfirmDialog
        isOpen={showPermissionConfirmDialog}
        onClose={() => setShowPermissionConfirmDialog(false)}
        onConfirm={handleConfirmPermissionChanges}
        changes={pendingPermissionChanges}
      />
    </div>
  );
}
