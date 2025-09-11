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

  // 保存权限
  const handleSavePermissions = async () => {
    await savePermissions(roleTemplates, userPermissions);
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
                            >
                              <Edit className="h-4 w-4" />
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
                    {Object.entries(roleTemplates).map(([role, template]) => (
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
      </div>
    </MobileLayout>
  );
}
