import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOptimizedPermissions } from '@/hooks/useOptimizedPermissions';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, Settings, Eye, Edit, Trash2, Plus, Save, RefreshCw, Copy, Key, Shield } from 'lucide-react';
import { MENU_PERMISSIONS, FUNCTION_PERMISSIONS } from '@/config/permissions';
import { PermissionQuickActions } from './PermissionQuickActions';
import { PermissionVisualizer } from './PermissionVisualizer';

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

export function IntegratedUserPermissionManager() {
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
    return (permissions.menu?.length || 0) + 
           (permissions.function?.length || 0) + 
           (permissions.project?.length || 0) + 
           (permissions.data?.length || 0);
  };

  // 批量操作处理
  const handleBulkPermissionUpdate = async (action: string, data: any) => {
    if (selectedUsers.length === 0) return;

    try {
      switch (action) {
        case 'change-role':
          const updates = selectedUsers.map(userId => ({
            id: userId,
            role: data.role
          }));

          const { error } = await supabase
            .from('profiles')
            .upsert(updates);

          if (error) throw error;
          break;

        case 'apply-template':
          // 应用权限模板逻辑
          const templatePermissions = roleTemplates[data.template];
          if (templatePermissions) {
            const permissionUpdates = selectedUsers.map(userId => ({
              user_id: userId,
              menu_permissions: templatePermissions.menu_permissions,
              function_permissions: templatePermissions.function_permissions,
              project_permissions: templatePermissions.project_permissions,
              data_permissions: templatePermissions.data_permissions
            }));

            await supabase
              .from('user_permissions')
              .upsert(permissionUpdates, { onConflict: 'user_id' });
          }
          break;
      }

      setSelectedUsers([]);
      await loadAllData();
    } catch (error) {
      toast({
        title: "更新失败",
        description: "批量操作失败",
        variant: "destructive"
      });
    }
  };

  // 复制权限
  const handleCopyPermissions = async (fromUserId: string, toUserIds: string[]) => {
    try {
      const sourcePermission = userPermissions.find(p => p.user_id === fromUserId);
      if (!sourcePermission) return;

      const permissionUpdates = toUserIds.map(userId => ({
        user_id: userId,
        menu_permissions: sourcePermission.menu_permissions,
        function_permissions: sourcePermission.function_permissions,
        project_permissions: sourcePermission.project_permissions,
        data_permissions: sourcePermission.data_permissions
      }));

      await supabase
        .from('user_permissions')
        .upsert(permissionUpdates, { onConflict: 'user_id' });

      await loadAllData();
    } catch (error) {
      toast({
        title: "复制失败",
        description: "复制权限失败",
        variant: "destructive"
      });
    }
  };

  // 重置权限到角色默认
  const handleResetToRole = async (userIds: string[]) => {
    try {
      // 删除用户的自定义权限，让其使用角色默认权限
      await supabase
        .from('user_permissions')
        .delete()
        .in('user_id', userIds);

      await loadAllData();
    } catch (error) {
      toast({
        title: "重置失败",
        description: "重置权限失败",
        variant: "destructive"
      });
    }
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
      toast({
        title: "更新失败",
        description: "更新用户状态失败",
        variant: "destructive"
      });
    }
  };

  // 保存权限
  const handleSavePermissions = async () => {
    await savePermissions(roleTemplates, userPermissions);
  };

  return (
    <div className="space-y-6">
      {/* 头部操作区 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">用户权限管理</h2>
          <p className="text-muted-foreground">统一管理用户信息和权限配置</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadAllData}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button
            onClick={handleSavePermissions}
            disabled={!hasChanges || loading}
          >
            <Save className="h-4 w-4 mr-2" />
            保存权限
          </Button>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="搜索用户姓名、邮箱或角色..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {selectedUsers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  已选择 {selectedUsers.length} 个用户
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedUsers([])}
                >
                  清除选择
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 快速操作区域 */}
      <PermissionQuickActions
        selectedUsers={selectedUsers}
        onBulkPermissionUpdate={handleBulkPermissionUpdate}
        onCopyPermissions={handleCopyPermissions}
        onResetToRole={handleResetToRole}
        users={users}
      />

      {/* 主要内容区域 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            用户管理
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            权限配置
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            角色模板
          </TabsTrigger>
        </TabsList>

        {/* 用户管理标签页 */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>用户列表</CardTitle>
              <CardDescription>
                管理用户信息、角色和权限
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedUsers(filteredUsers.map(u => u.id));
                          } else {
                            setSelectedUsers([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>用户信息</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>权限数量</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUsers([...selectedUsers, user.id]);
                            } else {
                              setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleColor(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getPermissionCount(user.permissions)} 项权限
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? "启用" : "禁用"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleUserStatus(user.id, user.is_active)}
                          >
                            {user.is_active ? "禁用" : "启用"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 权限配置标签页 */}
        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>权限配置</CardTitle>
              <CardDescription>
                为特定用户配置个性化权限，支持可视化权限管理
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {filteredUsers.map((user) => {
                  const rolePermissions = roleTemplates[user.role] || {
                    menu_permissions: [],
                    function_permissions: [],
                    project_permissions: [],
                    data_permissions: []
                  };

                  return (
                    <Card key={user.id} className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h4 className="text-lg font-semibold">{user.full_name}</h4>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getRoleColor(user.role)}>
                            {user.role}
                          </Badge>
                          <Badge variant="outline">
                            {getPermissionCount(user.permissions)} 项权限
                          </Badge>
                        </div>
                      </div>
                      
                      <PermissionVisualizer
                        userPermissions={user.permissions}
                        rolePermissions={{
                          menu: rolePermissions.menu_permissions || [],
                          function: rolePermissions.function_permissions || [],
                          project: rolePermissions.project_permissions || [],
                          data: rolePermissions.data_permissions || []
                        }}
                        onPermissionChange={(type, key, checked) => {
                          // 更新用户权限
                          const updatedPermissions = [...userPermissions];
                          const existingIndex = updatedPermissions.findIndex(p => p.user_id === user.id);
                          
                          if (existingIndex >= 0) {
                            // 更新现有权限
                            const currentPerms = updatedPermissions[existingIndex];
                            const newPerms = [...(currentPerms[`${type}_permissions`] || [])];
                            
                            if (checked) {
                              if (!newPerms.includes(key)) {
                                newPerms.push(key);
                              }
                            } else {
                              const index = newPerms.indexOf(key);
                              if (index > -1) {
                                newPerms.splice(index, 1);
                              }
                            }
                            
                            updatedPermissions[existingIndex] = {
                              ...currentPerms,
                              [`${type}_permissions`]: newPerms
                            };
                          } else {
                            // 创建新权限记录
                            const newPerms = checked ? [key] : [];
                            updatedPermissions.push({
                              user_id: user.id,
                              [`${type}_permissions`]: newPerms,
                              menu_permissions: type === 'menu' ? newPerms : [],
                              function_permissions: type === 'function' ? newPerms : [],
                              project_permissions: type === 'project' ? newPerms : [],
                              data_permissions: type === 'data' ? newPerms : []
                            });
                          }
                          
                          setUserPermissions(updatedPermissions);
                          setHasChanges(true);
                        }}
                      />
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 角色模板标签页 */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>角色权限模板</CardTitle>
              <CardDescription>
                管理各角色的默认权限配置
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(roleTemplates).map(([role, template]) => (
                  <Card key={role} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium capitalize">{role}</h4>
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
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>菜单权限:</span>
                        <Badge variant="outline">
                          {template.menu_permissions?.length || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>功能权限:</span>
                        <Badge variant="outline">
                          {template.function_permissions?.length || 0}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 用户编辑对话框 */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>编辑用户</DialogTitle>
              <DialogDescription>
                修改用户信息和权限配置
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">姓名</Label>
                  <Input
                    id="name"
                    value={editingUser.full_name}
                    onChange={(e) => setEditingUser({
                      ...editingUser,
                      full_name: e.target.value
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({
                      ...editingUser,
                      email: e.target.value
                    })}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="role">角色</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(value) => setEditingUser({
                    ...editingUser,
                    role: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="finance">财务</SelectItem>
                    <SelectItem value="business">业务</SelectItem>
                    <SelectItem value="operator">操作员</SelectItem>
                    <SelectItem value="partner">合作伙伴</SelectItem>
                    <SelectItem value="viewer">查看者</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  取消
                </Button>
                <Button onClick={() => {
                  // 实现保存用户信息的逻辑
                  setEditingUser(null);
                }}>
                  保存
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 角色模板编辑对话框 */}
      {showRoleTemplateDialog && editingRole && (
        <Dialog open={showRoleTemplateDialog} onOpenChange={() => {
          setShowRoleTemplateDialog(false);
          setEditingRole(null);
        }}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>编辑角色模板 - {editingRole}</DialogTitle>
              <DialogDescription>
                配置 {editingRole} 角色的默认权限
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* 菜单权限配置 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">菜单权限</h3>
                <div className="grid grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                  {MENU_PERMISSIONS.map((menu) => (
                    <div key={menu.key} className="flex items-center space-x-2">
                      <Checkbox
                        checked={roleTemplates[editingRole]?.menu_permissions?.includes(menu.key) || false}
                        onCheckedChange={(checked) => {
                          const currentTemplate = roleTemplates[editingRole] || { menu_permissions: [], function_permissions: [] };
                          const newMenuPermissions = checked 
                            ? [...(currentTemplate.menu_permissions || []), menu.key]
                            : (currentTemplate.menu_permissions || []).filter((p: string) => p !== menu.key);
                          
                          setRoleTemplates({
                            ...roleTemplates,
                            [editingRole]: {
                              ...currentTemplate,
                              menu_permissions: newMenuPermissions
                            }
                          });
                          setHasChanges(true);
                        }}
                      />
                      <Label className="text-sm">{menu.title}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* 功能权限配置 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">功能权限</h3>
                <div className="grid grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                  {FUNCTION_PERMISSIONS.map((func) => (
                    <div key={func.key} className="flex items-center space-x-2">
                      <Checkbox
                        checked={roleTemplates[editingRole]?.function_permissions?.includes(func.key) || false}
                        onCheckedChange={(checked) => {
                          const currentTemplate = roleTemplates[editingRole] || { menu_permissions: [], function_permissions: [] };
                          const newFunctionPermissions = checked 
                            ? [...(currentTemplate.function_permissions || []), func.key]
                            : (currentTemplate.function_permissions || []).filter((p: string) => p !== func.key);
                          
                          setRoleTemplates({
                            ...roleTemplates,
                            [editingRole]: {
                              ...currentTemplate,
                              function_permissions: newFunctionPermissions
                            }
                          });
                          setHasChanges(true);
                        }}
                      />
                      <Label className="text-sm">{func.title}</Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setShowRoleTemplateDialog(false);
                  setEditingRole(null);
                }}>
                  取消
                </Button>
                <Button onClick={() => {
                  setShowRoleTemplateDialog(false);
                  setEditingRole(null);
                }}>
                  保存
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
