import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOptimizedPermissions } from '@/hooks/useOptimizedPermissions';
import { useToast } from '@/hooks/use-toast';
import { Users, Settings, Eye, Edit, Trash2, Plus, Save, RefreshCw, Copy, Key, Shield, Search, Building2 } from 'lucide-react';
import { MENU_PERMISSIONS, FUNCTION_PERMISSIONS } from '@/config/permissions';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { ProjectPermissionManager } from '@/components/ProjectPermissionManager';
import { useProjects } from '@/hooks/useProjects';

interface UserWithPermissions {
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

export default function MobileIntegratedUserManagement() {
  const { toast } = useToast();
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
    loadAllData
  } = useOptimizedPermissions();

  const [activeTab, setActiveTab] = useState('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<UserWithPermissions | null>(null);
  const [showRoleTemplateDialog, setShowRoleTemplateDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [selectedUserForPermission, setSelectedUserForPermission] = useState<UserWithPermissions | null>(null);
  const [showProjectPermissionManager, setShowProjectPermissionManager] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithPermissions | null>(null);
  const [userToChangePassword, setUserToChangePassword] = useState<UserWithPermissions | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showProjectAssignmentDialog, setShowProjectAssignmentDialog] = useState(false);
  const [userForProjectAssignment, setUserForProjectAssignment] = useState<UserWithPermissions | null>(null);
  const [userProjectAssignments, setUserProjectAssignments] = useState<Record<string, string[]>>({});

  // 合并用户和权限数据
  const usersWithPermissions = useMemo(() => {
    return users.map(user => {
      const userPerm = userPermissions.find(p => p.user_id === user.id);
      return {
        ...user,
        permissions: userPerm ? {
          menu: userPerm.menu_permissions || [],
          function: userPerm.function_permissions || [],
          project: userPerm.project_permissions || [],
          data: userPerm.data_permissions || []
        } : {
          menu: roleTemplates[user.role]?.menu_permissions || [],
          function: roleTemplates[user.role]?.function_permissions || [],
          project: roleTemplates[user.role]?.project_permissions || [],
          data: roleTemplates[user.role]?.data_permissions || []
        }
      };
    });
  }, [users, userPermissions, roleTemplates]);

  // 过滤用户
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return usersWithPermissions;
    return usersWithPermissions.filter(user =>
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [usersWithPermissions, searchTerm]);

  // 角色颜色映射
  const getRoleColor = (role: string) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      finance: 'bg-blue-100 text-blue-800',
      business: 'bg-green-100 text-green-800',
      operator: 'bg-yellow-100 text-yellow-800',
      partner: 'bg-purple-100 text-purple-800',
      viewer: 'bg-gray-100 text-gray-800'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // 获取权限数量
  const getPermissionCount = (permissions: any) => {
    if (!permissions) return 0;
    return (permissions.menu?.length || 0) + 
           (permissions.function?.length || 0) + 
           (permissions.project?.length || 0) + 
           (permissions.data?.length || 0);
  };

  // 保存权限
  const handleSavePermissions = async () => {
    await savePermissions(roleTemplates, userPermissions);
  };

  // 切换用户状态
  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "状态更新成功",
        description: `用户已${!currentStatus ? '启用' : '禁用'}`,
      });

      await loadAllData();
    } catch (error) {
      console.error('切换用户状态失败:', error);
      toast({
        title: "更新失败",
        description: "更新用户状态失败",
        variant: "destructive"
      });
    }
  };

  // 删除用户
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      // 首先删除用户权限
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userToDelete.id);

      // 然后删除用户档案
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userToDelete.id);

      if (error) throw error;

      toast({
        title: "删除成功",
        description: `用户 ${userToDelete.full_name} 已被删除`,
      });

      setShowDeleteDialog(false);
      setUserToDelete(null);
      await loadAllData();
    } catch (error) {
      console.error('删除用户失败:', error);
      toast({
        title: "删除失败",
        description: "删除用户失败，请重试",
        variant: "destructive"
      });
    }
  };

  // 修改密码
  const handleChangePassword = async () => {
    if (!userToChangePassword || !newPassword.trim()) return;

    try {
      const { error } = await supabase.auth.admin.updateUserById(
        userToChangePassword.id,
        { password: newPassword }
      );

      if (error) throw error;

      toast({
        title: "密码修改成功",
        description: `用户 ${userToChangePassword.full_name} 的密码已更新`,
      });

      setShowPasswordDialog(false);
      setUserToChangePassword(null);
      setNewPassword('');
    } catch (error) {
      console.error('修改密码失败:', error);
      toast({
        title: "修改失败",
        description: "修改密码失败，请重试",
        variant: "destructive"
      });
    }
  };

  // 加载用户项目分配（修复：加载can_view=false的项目）
  const loadUserProjectAssignments = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_projects')
        .select('project_id, can_view')
        .eq('user_id', userId);

      if (error) throw error;

      // 存储被限制访问的项目ID（can_view = false）
      const restrictedProjectIds = data?.filter(item => !item.can_view).map(item => item.project_id) || [];
      setUserProjectAssignments(prev => ({
        ...prev,
        [userId]: restrictedProjectIds
      }));
    } catch (error) {
      console.error('加载用户项目分配失败:', error);
    }
  };

  // 保存用户项目分配（修复：使用can_view标志）
  const handleSaveProjectAssignments = async () => {
    if (!userForProjectAssignment) return;

    try {
      const userId = userForProjectAssignment.id;
      const restrictedProjectIds = userProjectAssignments[userId] || [];

      // 删除现有的项目记录
      await supabase
        .from('user_projects')
        .delete()
        .eq('user_id', userId);

      // 添加新的项目限制（只存储被限制的项目，设置can_view=false）
      if (restrictedProjectIds.length > 0) {
        const currentUserId = (await supabase.auth.getUser()).data.user?.id;
        const restrictions = restrictedProjectIds.map(projectId => ({
          user_id: userId,
          project_id: projectId,
          role: 'viewer',
          can_view: false,
          can_edit: false,
          can_delete: false,
          created_by: currentUserId
        }));

        const { error } = await supabase
          .from('user_projects')
          .insert(restrictions);

        if (error) throw error;
      }

      toast({
        title: "项目访问限制更新成功",
        description: `用户 ${userForProjectAssignment.full_name} 的项目访问限制已更新`,
      });

      setShowProjectAssignmentDialog(false);
      setUserForProjectAssignment(null);
    } catch (error) {
      console.error('保存项目分配失败:', error);
      toast({
        title: "保存失败",
        description: "保存项目分配失败，请重试",
        variant: "destructive"
      });
    }
  };

  // 切换项目分配（修复：切换访问限制状态）
  const toggleProjectAssignment = (projectId: string) => {
    if (!userForProjectAssignment) return;

    const userId = userForProjectAssignment.id;
    const currentRestrictions = userProjectAssignments[userId] || [];
    
    // 如果项目在限制列表中，则移除限制（允许访问）
    // 如果项目不在限制列表中，则添加限制（禁止访问）
    const newRestrictions = currentRestrictions.includes(projectId)
      ? currentRestrictions.filter(id => id !== projectId)
      : [...currentRestrictions, projectId];

    setUserProjectAssignments(prev => ({
      ...prev,
      [userId]: newRestrictions
    }));
  };

  // 处理项目权限变更
  const handleProjectPermissionChange = async (projectId: string, hasAccess: boolean) => {
    if (!selectedUserForPermission) return;

    try {
      const updatedPermissions = [...userPermissions];
      const existingIndex = updatedPermissions.findIndex(p => p.user_id === selectedUserForPermission.id);
      
      if (existingIndex >= 0) {
        const currentPerms = updatedPermissions[existingIndex];
        const currentProjectPerms = currentPerms.project_permissions || [];
        
        let newProjectPerms;
        if (hasAccess) {
          if (!currentProjectPerms.includes(projectId)) {
            newProjectPerms = [...currentProjectPerms, projectId];
          } else {
            newProjectPerms = currentProjectPerms;
          }
        } else {
          newProjectPerms = currentProjectPerms.filter((id: string) => id !== projectId);
        }
        
        updatedPermissions[existingIndex] = {
          ...currentPerms,
          project_permissions: newProjectPerms
        };
      } else {
        const newProjectPerms = hasAccess ? [projectId] : [];
        updatedPermissions.push({
          user_id: selectedUserForPermission.id,
          project_permissions: newProjectPerms,
          menu_permissions: [],
          function_permissions: [],
          data_permissions: []
        });
      }
      
      setUserPermissions(updatedPermissions);
      setHasChanges(true);
      
      setSelectedUserForPermission({
        ...selectedUserForPermission,
        permissions: {
          ...selectedUserForPermission.permissions,
          project: hasAccess 
            ? [...selectedUserForPermission.permissions.project, projectId]
            : selectedUserForPermission.permissions.project.filter(id => id !== projectId)
        }
      });
    } catch (error) {
      console.error('更新项目权限失败:', error);
      toast({
        title: "更新失败",
        description: "更新项目权限失败",
        variant: "destructive"
      });
    }
  };

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
        {/* 头部操作区 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">用户权限管理</h1>
            <p className="text-sm text-muted-foreground">统一管理用户信息和权限配置</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAllData}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleSavePermissions}
              disabled={!hasChanges || loading}
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 搜索和筛选 */}
        <Card>
          <CardContent className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* 主要内容区域 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">用户</span>
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">权限</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">模板</span>
            </TabsTrigger>
          </TabsList>

          {/* 用户管理标签页 */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>用户列表</CardTitle>
                <CardDescription>管理用户信息、角色和权限</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="space-y-3">
                    {filteredUsers.map((user) => (
                      <Card key={user.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium truncate">{user.full_name}</h4>
                              <Badge className={getRoleColor(user.role)}>
                                {user.role}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {getPermissionCount(user.permissions)} 项权限
                              </Badge>
                              <Badge variant={user.is_active ? "default" : "secondary"} className="text-xs">
                                {user.is_active ? "启用" : "禁用"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedUserForPermission(user)}
                              title="配置权限"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUserToChangePassword(user);
                                setShowPasswordDialog(true);
                              }}
                              title="修改密码"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                setUserForProjectAssignment(user);
                                await loadUserProjectAssignments(user.id);
                                setShowProjectAssignmentDialog(true);
                              }}
                              title="项目限制"
                            >
                              <Building2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleUserStatus(user.id, user.is_active)}
                              title={user.is_active ? "禁用用户" : "启用用户"}
                            >
                              {user.is_active ? "禁用" : "启用"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUserToDelete(user);
                                setShowDeleteDialog(true);
                              }}
                              title="删除用户"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 权限配置标签页 */}
          <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>权限配置</CardTitle>
                <CardDescription>选择用户后配置个性化权限</CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedUserForPermission ? (
                  <div className="space-y-4">
                    <div className="text-center py-8 text-muted-foreground">
                      请先选择要配置权限的用户
                    </div>
                    <ScrollArea className="h-[calc(100vh-300px)]">
                      <div className="space-y-3">
                        {filteredUsers.map((user) => (
                          <Card 
                            key={user.id} 
                            className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => setSelectedUserForPermission(user)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">{user.full_name}</h4>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                              <Badge className={getRoleColor(user.role)}>
                                {user.role}
                              </Badge>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 用户信息头部 */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedUserForPermission(null)}
                        >
                          ← 返回
                        </Button>
                        <div>
                          <h3 className="font-semibold">{selectedUserForPermission.full_name}</h3>
                          <p className="text-sm text-muted-foreground">{selectedUserForPermission.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleColor(selectedUserForPermission.role)}>
                          {selectedUserForPermission.role}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowProjectPermissionManager(true)}
                        >
                          项目权限
                        </Button>
                      </div>
                    </div>
                    
                    {/* 简化的权限配置 */}
                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">菜单权限</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {MENU_PERMISSIONS.slice(0, 5).map((menu) => (
                              <div key={menu.key} className="flex items-center justify-between">
                                <Label className="text-sm">{menu.label}</Label>
                                <Checkbox
                                  checked={selectedUserForPermission.permissions.menu.includes(menu.key)}
                                  onCheckedChange={(checked) => {
                                    // 简化的权限更新逻辑
                                    setHasChanges(true);
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 角色模板标签页 */}
          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>角色权限模板</CardTitle>
                <CardDescription>管理各角色的默认权限配置</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="space-y-3">
                    {Object.entries(roleTemplates)
                      .sort(([a], [b]) => {
                        // 定义固定的角色排序顺序
                        const roleOrder = ['admin', 'finance', 'business', 'operator', 'partner', 'viewer'];
                        const aIndex = roleOrder.indexOf(a);
                        const bIndex = roleOrder.indexOf(b);
                        return aIndex - bIndex;
                      })
                      .map(([role, template]) => (
                      <Card key={role} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium capitalize">{role}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                菜单: {template.menu_permissions?.length || 0}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                功能: {template.function_permissions?.length || 0}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingRole(role);
                              setShowRoleTemplateDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 项目权限管理对话框 */}
        {showProjectPermissionManager && selectedUserForPermission && (
          <Dialog open={showProjectPermissionManager} onOpenChange={setShowProjectPermissionManager}>
            <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>项目权限管理 - {selectedUserForPermission.full_name}</DialogTitle>
                <DialogDescription>管理用户的项目访问权限</DialogDescription>
              </DialogHeader>
              
              <ProjectPermissionManager
                userId={selectedUserForPermission.id}
                userName={selectedUserForPermission.full_name}
                userRole={selectedUserForPermission.role}
                userProjectPermissions={selectedUserForPermission.permissions.project}
                onPermissionChange={handleProjectPermissionChange}
              />
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowProjectPermissionManager(false)}>
                  关闭
                </Button>
              </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 删除用户确认对话框 */}
      {showDeleteDialog && userToDelete && (
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="w-[95vw] max-w-md">
            <DialogHeader>
              <DialogTitle>确认删除用户</DialogTitle>
              <DialogDescription>
                此操作将永久删除用户及其所有相关数据，无法撤销。
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-red-600" />
                  <div>
                    <h4 className="font-medium text-red-800">删除用户: {userToDelete.full_name}</h4>
                    <p className="text-sm text-red-700">{userToDelete.email}</p>
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-gray-600">
                <p>删除后将同时移除：</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>用户账户信息</li>
                  <li>用户权限配置</li>
                  <li>所有相关数据记录</li>
                </ul>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                  取消
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteUser}
                >
                  确认删除
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 修改密码对话框 */}
      {showPasswordDialog && userToChangePassword && (
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent className="w-[95vw] max-w-md">
            <DialogHeader>
              <DialogTitle>修改密码</DialogTitle>
              <DialogDescription>
                为用户 {userToChangePassword.full_name} 设置新密码
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-password">新密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入新密码"
                  className="mt-1"
                />
              </div>
              
              <div className="text-sm text-gray-600">
                <p>密码要求：</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>至少6个字符</li>
                  <li>建议包含字母、数字和特殊字符</li>
                </ul>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setShowPasswordDialog(false);
                  setNewPassword('');
                }}>
                  取消
                </Button>
                <Button 
                  onClick={handleChangePassword}
                  disabled={!newPassword.trim() || newPassword.length < 6}
                >
                  确认修改
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 项目分配对话框 */}
      {showProjectAssignmentDialog && userForProjectAssignment && (
        <Dialog open={showProjectAssignmentDialog} onOpenChange={setShowProjectAssignmentDialog}>
          <DialogContent className="w-[95vw] max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>项目访问限制管理</DialogTitle>
              <DialogDescription>
                管理用户 {userForProjectAssignment.full_name} 的项目访问限制
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">项目访问限制说明</h4>
                <p className="text-sm text-blue-700">
                  <strong>默认所有项目都可访问</strong>。勾选的项目表示用户可以访问，取消勾选的项目表示用户被限制访问。
                </p>
              </div>
              
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {projects.map((project) => {
                  // 默认所有项目都可访问，只有被明确限制的项目才不勾选
                  const userRestrictedProjects = userProjectAssignments[userForProjectAssignment.id] || [];
                  const isRestricted = userRestrictedProjects.length > 0 && !userRestrictedProjects.includes(project.id);
                  const isAssigned = !isRestricted; // 默认可访问，除非被明确限制
                  
                  return (
                    <div key={project.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                      <Checkbox
                        checked={isAssigned}
                        onCheckedChange={() => toggleProjectAssignment(project.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{project.name}</div>
                        <div className="text-xs text-gray-500">
                          {project.loading_address} → {project.unloading_address}
                        </div>
                        <div className="text-xs text-gray-400">
                          {project.start_date} - {project.end_date}
                        </div>
                      </div>
                      <Badge variant={project.project_status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {project.project_status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
              
              {projects.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  暂无项目数据
                </div>
              )}
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowProjectAssignmentDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleSaveProjectAssignments}>
                  保存分配
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </MobileLayout>
  );
}
