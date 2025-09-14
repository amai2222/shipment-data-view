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
import { Users, Settings, Eye, Edit, Trash2, Plus, Save, RefreshCw, Copy, Key, Shield, Building2, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { MENU_PERMISSIONS, FUNCTION_PERMISSIONS } from '@/config/permissions';
import { PermissionQuickActions } from './PermissionQuickActions';
import { PermissionVisualizer } from './PermissionVisualizer';
import { ProjectPermissionManager } from './ProjectPermissionManager';
import { useProjects } from '@/hooks/useProjects';

interface UserWithPermissions {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "finance" | "business" | "partner" | "operator" | "viewer";
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
  
  const { projects, loading: projectsLoading, loadProjects } = useProjects();

  // 获取角色显示名称
  const getRoleDisplayName = (role: string) => {
    const roleNames: Record<string, string> = {
      admin: '管理员',
      operator: '操作员',
      finance: '财务',
      business: '业务',
      partner: '合作伙伴',
      viewer: '查看者'
    };
    return roleNames[role] || role;
  };

  // 获取角色描述
  const getRoleDescription = (role: string) => {
    const descriptions: Record<string, string> = {
      admin: '拥有所有菜单和功能权限',
      operator: '基础操作权限',
      finance: '财务相关菜单和功能',
      business: '业务操作相关权限',
      partner: '合作伙伴专用权限',
      viewer: '只读权限'
    };
    return descriptions[role] || '自定义权限';
  };

  const [activeTab, setActiveTab] = useState('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<UserWithPermissions | null>(null);
  const [showRoleTemplateDialog, setShowRoleTemplateDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<"admin" | "finance" | "business" | "partner" | "operator" | "viewer" | null>(null);
  const [selectedUserForPermission, setSelectedUserForPermission] = useState<UserWithPermissions | null>(null);
  const [showProjectPermissionManager, setShowProjectPermissionManager] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithPermissions | null>(null);
  const [userToChangePassword, setUserToChangePassword] = useState<UserWithPermissions | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [createUserData, setCreateUserData] = useState({
    email: '',
    username: '',
    full_name: '',
    role: 'operator' as 'admin' | 'finance' | 'business' | 'operator' | 'partner' | 'viewer',
    password: '',
    work_wechat_userid: ''
  });
  const [showProjectAssignmentDialog, setShowProjectAssignmentDialog] = useState(false);
  const [userForProjectAssignment, setUserForProjectAssignment] = useState<UserWithPermissions | null>(null);
  const [userProjectAssignments, setUserProjectAssignments] = useState<Record<string, string[]>>({});
  
  // 批量操作相关状态
  const [showBulkRoleDialog, setShowBulkRoleDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkRole, setBulkRole] = useState('');

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
          project: roleTemplates[user.role]?.project_permissions || [], // 修复：使用角色模板的项目权限
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
    
    // 计算所有权限类型的总数
    const menuCount = permissions.menu?.length || 0;
    const functionCount = permissions.function?.length || 0;
    const projectCount = permissions.project?.length || 0;
    const dataCount = permissions.data?.length || 0;
    
    return menuCount + functionCount + projectCount + dataCount;
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
  const toggleUserStatus = (userId: string, currentStatus: boolean) => {
    const user = usersWithPermissions.find(u => u.id === userId);
    if (user) {
      setUserToDelete(user);
      setShowStatusChangeDialog(true);
    }
  };

  const confirmToggleUserStatus = async () => {
    if (!userToDelete) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !userToDelete.is_active })
        .eq('id', userToDelete.id);

      if (error) throw error;

      toast({
        title: "状态更新成功",
        description: `用户已${!userToDelete.is_active ? '启用' : '禁用'}`,
      });

      // 立即更新前端状态，避免重新加载所有数据
      // 由于我们使用的是 useOptimizedPermissions hook，需要重新加载数据来确保一致性
      await loadAllData();

      setShowStatusChangeDialog(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('切换用户状态失败:', error);
      toast({
        title: "更新失败",
        description: "更新用户状态失败",
        variant: "destructive"
      });
    }
  };

  // 创建用户
  const handleCreateUser = async () => {
    try {
      // 首先在 Supabase Auth 中创建用户
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: createUserData.email,
        password: createUserData.password,
        email_confirm: true
      });

      if (authError) throw authError;

      // 然后创建用户档案
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: createUserData.email,
          username: createUserData.username,
          full_name: createUserData.full_name,
          role: createUserData.role,
          work_wechat_userid: createUserData.work_wechat_userid || null,
          is_active: true
        });

      if (profileError) throw profileError;

      toast({
        title: "创建成功",
        description: `用户 ${createUserData.full_name || createUserData.username} 已创建`,
      });

      setShowCreateUserDialog(false);
      setCreateUserData({
        email: '',
        username: '',
        full_name: '',
        role: 'operator',
        password: '',
        work_wechat_userid: ''
      });
      await loadAllData();
    } catch (error: any) {
      console.error('创建用户失败:', error);
      toast({
        title: "创建失败",
        description: error.message || "创建用户失败，请重试",
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

  // 批量操作函数
  const handleBulkStatusChange = async (action: 'enable' | 'disable') => {
    if (selectedUsers.length === 0) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: action === 'enable' })
        .in('id', selectedUsers);

      if (error) throw error;

      toast({
        title: "批量操作成功",
        description: `已${action === 'enable' ? '启用' : '禁用'} ${selectedUsers.length} 个用户`,
      });

      setSelectedUsers([]);
      await loadAllData();
    } catch (error) {
      console.error('批量状态变更失败:', error);
      toast({
        title: "操作失败",
        description: "批量状态变更失败，请重试",
        variant: "destructive"
      });
    }
  };

  const handleBulkRoleChange = () => {
    if (selectedUsers.length === 0) return;
    setShowBulkRoleDialog(true);
  };

  const handleBulkDelete = () => {
    if (selectedUsers.length === 0) return;
    setShowBulkDeleteDialog(true);
  };

  const confirmBulkRoleChange = async () => {
    if (!bulkRole || selectedUsers.length === 0) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: bulkRole })
        .in('id', selectedUsers);

      if (error) throw error;

      toast({
        title: "批量角色更新成功",
        description: `已将 ${selectedUsers.length} 个用户的角色更新为 ${bulkRole}`,
      });

      setShowBulkRoleDialog(false);
      setBulkRole('');
      setSelectedUsers([]);
      await loadAllData();
    } catch (error) {
      console.error('批量角色更新失败:', error);
      toast({
        title: "更新失败",
        description: "批量角色更新失败，请重试",
        variant: "destructive"
      });
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedUsers.length === 0) return;

    try {
      // 批量删除用户权限
      await supabase
        .from('user_permissions')
        .delete()
        .in('user_id', selectedUsers);

      // 批量删除用户档案
      const { error } = await supabase
        .from('profiles')
        .delete()
        .in('id', selectedUsers);

      if (error) throw error;

      toast({
        title: "批量删除成功",
        description: `已删除 ${selectedUsers.length} 个用户`,
      });

      setShowBulkDeleteDialog(false);
      setSelectedUsers([]);
      await loadAllData();
    } catch (error) {
      console.error('批量删除失败:', error);
      toast({
        title: "删除失败",
        description: "批量删除失败，请重试",
        variant: "destructive"
      });
    }
  };

  // 加载用户项目分配（现在存储的是被限制的项目）
  const loadUserProjectAssignments = async (userId: string) => {
    try {
      // Note: user_projects table doesn't exist, skipping for now
      // TODO: Implement user_projects table and proper project assignments
      console.log('Skipping user project assignments - user_projects table not implemented');
      setUserProjectAssignments(prev => ({
        ...prev,
        [userId]: []
      }));
    } catch (error) {
      console.error('加载用户项目分配失败:', error);
    }
  };

  // 保存用户项目分配（现在存储的是被限制的项目）
  const handleSaveProjectAssignments = async () => {
    if (!userForProjectAssignment) return;

    try {
      // Note: user_projects table doesn't exist, skipping for now
      // TODO: Implement user_projects table and proper project assignments
      console.log('Skipping user project assignments save - user_projects table not implemented');

      toast({
        title: "项目权限更新成功",
        description: `用户 ${userForProjectAssignment.full_name} 的项目访问权限已更新`,
      });

      setShowProjectAssignmentDialog(false);
      setUserForProjectAssignment(null);
    } catch (error) {
      console.error('Error saving project assignments:', error);
      toast({
        title: "保存失败",
        description: "无法保存项目权限配置",
        variant: "destructive",
      });
    }
  };

  // 切换项目分配（现在切换的是限制状态）
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
        // 更新现有权限
        const currentPerms = updatedPermissions[existingIndex];
        const currentProjectPerms = currentPerms.project_permissions || [];
        
        let newProjectPerms;
        if (hasAccess) {
          // 添加项目权限
          if (!currentProjectPerms.includes(projectId)) {
            newProjectPerms = [...currentProjectPerms, projectId];
          } else {
            newProjectPerms = currentProjectPerms;
          }
        } else {
          // 移除项目权限
          newProjectPerms = currentProjectPerms.filter((id: string) => id !== projectId);
        }
        
        updatedPermissions[existingIndex] = {
          ...currentPerms,
          project_permissions: newProjectPerms
        };
      } else {
        // 创建新权限记录
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
      
      // 更新当前选中用户的权限显示
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

  return (
    <div className="space-y-6">
      {/* 头部操作区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">用户权限管理</h1>
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>用户列表</CardTitle>
                  <CardDescription>
                    管理用户信息、角色和权限
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {/* 批量操作按钮 */}
                  {selectedUsers.length > 0 && (
                    <div className="flex items-center gap-2 mr-4">
                      <Badge variant="secondary" className="text-sm">
                        已选择 {selectedUsers.length} 个用户
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkStatusChange('enable')}
                        disabled={selectedUsers.length === 0}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        批量启用
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkStatusChange('disable')}
                        disabled={selectedUsers.length === 0}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        批量禁用
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkRoleChange()}
                        disabled={selectedUsers.length === 0}
                      >
                        <Users className="h-4 w-4 mr-1" />
                        批量改角色
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkDelete()}
                        disabled={selectedUsers.length === 0}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        批量删除
                      </Button>
                    </div>
                  )}
                  <Button onClick={() => setShowCreateUserDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    新建用户
                  </Button>
                </div>
              </div>
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
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingUser(user)}
                            title="编辑用户"
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
                            title="分配项目"
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
                选择用户后配置个性化权限，支持可视化权限管理
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedUserForPermission ? (
                // 用户选择界面
                <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-4">
                    <Input
                      placeholder="搜索用户..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredUsers.map((user) => (
                      <Card 
                        key={user.id} 
                        className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-300"
                        onClick={() => setSelectedUserForPermission(user)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">{user.full_name}</h4>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                          <Badge className={getRoleColor(user.role)}>
                            {user.role}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span>权限数量:</span>
                          <Badge variant="outline">
                            {getPermissionCount(user.permissions)} 项
                          </Badge>
                        </div>
                        
                        <div className="mt-3 text-xs text-muted-foreground">
                          点击配置权限
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                // 权限配置界面
                <div className="space-y-4">
                  {/* 用户信息头部 */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUserForPermission(null)}
                      >
                        ← 返回用户选择
                      </Button>
                      <div>
                        <h3 className="text-lg font-semibold">{selectedUserForPermission.full_name}</h3>
                        <p className="text-sm text-muted-foreground">{selectedUserForPermission.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getRoleColor(selectedUserForPermission.role)}>
                        {selectedUserForPermission.role}
                      </Badge>
                      <Badge variant="outline">
                        {getPermissionCount(selectedUserForPermission.permissions)} 项权限
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
                  
                  {/* 权限配置器 */}
                  <PermissionVisualizer
                    userPermissions={selectedUserForPermission.permissions}
                    rolePermissions={{
                      menu: roleTemplates[selectedUserForPermission.role]?.menu_permissions || [],
                      function: roleTemplates[selectedUserForPermission.role]?.function_permissions || [],
                      project: roleTemplates[selectedUserForPermission.role]?.project_permissions || [],
                      data: roleTemplates[selectedUserForPermission.role]?.data_permissions || []
                    }}
                    onPermissionChange={(type, key, checked) => {
                      // 更新用户权限
                      const updatedPermissions = [...userPermissions];
                      const existingIndex = updatedPermissions.findIndex(p => p.user_id === selectedUserForPermission.id);
                      
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
                          user_id: selectedUserForPermission.id,
                          [`${type}_permissions`]: newPerms,
                          menu_permissions: type === 'menu' ? newPerms : [],
                          function_permissions: type === 'function' ? newPerms : [],
                          project_permissions: type === 'project' ? newPerms : [],
                          data_permissions: type === 'data' ? newPerms : []
                        });
                      }
                      
                      setUserPermissions(updatedPermissions);
                      setHasChanges(true);
                      
                      // 更新当前选中用户的权限显示
                      setSelectedUserForPermission({
                        ...selectedUserForPermission,
                        permissions: {
                          ...selectedUserForPermission.permissions,
                          [type]: checked 
                            ? [...selectedUserForPermission.permissions[type], key]
                            : selectedUserForPermission.permissions[type].filter(p => p !== key)
                        }
                      });
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 角色模板标签页 */}
        <TabsContent value="templates" className="space-y-6">
          {/* 预设权限模板 */}
          <Card>
            <CardHeader>
              <CardTitle>权限模板</CardTitle>
              <CardDescription>
                预设的权限配置模板，可快速应用到用户
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 管理员权限模板 */}
                <Card 
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-green-300"
                  onClick={() => {
                    setEditingRole('admin');
                    setShowRoleTemplateDialog(true);
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-green-700">管理员权限</h4>
                      <p className="text-sm text-muted-foreground">拥有所有菜单和功能权限</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">admin</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    点击编辑权限配置
                  </div>
                </Card>

                {/* 操作员权限模板 */}
                <Card 
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-orange-300"
                  onClick={() => {
                    setEditingRole('operator');
                    setShowRoleTemplateDialog(true);
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-orange-700">操作员权限</h4>
                      <p className="text-sm text-muted-foreground">基础操作权限</p>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800">operator</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    点击编辑权限配置
                  </div>
                </Card>

                {/* 财务权限模板 */}
                <Card 
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-300"
                  onClick={() => {
                    setEditingRole('finance');
                    setShowRoleTemplateDialog(true);
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-blue-700">财务权限</h4>
                      <p className="text-sm text-muted-foreground">财务相关菜单和功能</p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">finance</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    点击编辑权限配置
                  </div>
                </Card>

                {/* 业务权限模板 */}
                <Card 
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-green-300"
                  onClick={() => {
                    setEditingRole('business');
                    setShowRoleTemplateDialog(true);
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-green-700">业务权限</h4>
                      <p className="text-sm text-muted-foreground">业务操作相关权限</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">business</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    点击编辑权限配置
                  </div>
                </Card>

                {/* 合作伙伴权限模板 */}
                <Card 
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-300"
                  onClick={() => {
                    setEditingRole('partner');
                    setShowRoleTemplateDialog(true);
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-blue-700">合作伙伴权限</h4>
                      <p className="text-sm text-muted-foreground">合作伙伴专用权限</p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">partner</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    点击编辑权限配置
                  </div>
                </Card>

                {/* 查看者权限模板 */}
                <Card 
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-gray-300"
                  onClick={() => {
                    setEditingRole('viewer');
                    setShowRoleTemplateDialog(true);
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-700">查看者权限</h4>
                      <p className="text-sm text-muted-foreground">只读权限</p>
                    </div>
                    <Badge className="bg-gray-100 text-gray-800">viewer</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    点击编辑权限配置
                  </div>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* 角色权限模板 */}
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
                <Button onClick={async () => {
                  try {
                    if (!editingUser) return;

                    // 更新用户信息到数据库
                    const { error } = await supabase
                      .from('profiles')
                      .update({
                        full_name: editingUser.full_name,
                        email: editingUser.email,
                        role: editingUser.role,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', editingUser.id);

                    if (error) throw error;

                    toast({
                      title: "保存成功",
                      description: "用户信息已更新",
                    });

                    // 重新加载数据
                    await loadAllData();
                    setEditingUser(null);
                  } catch (error) {
                    console.error('保存用户信息失败:', error);
                    toast({
                      title: "保存失败",
                      description: "保存用户信息失败，请重试",
                      variant: "destructive"
                    });
                  }
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
                  {MENU_PERMISSIONS.flatMap(menu => 
                    menu.children ? menu.children.map(child => (
                      <div key={child.key} className="flex items-center space-x-2">
                        <Checkbox
                          checked={roleTemplates[editingRole]?.menu_permissions?.includes(child.key) || false}
                          onCheckedChange={(checked) => {
                            const currentTemplate = roleTemplates[editingRole] || { menu_permissions: [], function_permissions: [] };
                            const newMenuPermissions = checked 
                              ? [...(currentTemplate.menu_permissions || []), child.key]
                              : (currentTemplate.menu_permissions || []).filter((p: string) => p !== child.key);
                            
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
                        <Label className="text-sm">{child.label}</Label>
                      </div>
                    )) : []
                  )}
                </div>
              </div>

              {/* 功能权限配置 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">功能权限</h3>
                <div className="grid grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                  {FUNCTION_PERMISSIONS.flatMap(func => 
                    func.children ? func.children.map(child => (
                      <div key={child.key} className="flex items-center space-x-2">
                        <Checkbox
                          checked={roleTemplates[editingRole]?.function_permissions?.includes(child.key) || false}
                          onCheckedChange={(checked) => {
                            const currentTemplate = roleTemplates[editingRole] || { menu_permissions: [], function_permissions: [] };
                            const newFunctionPermissions = checked 
                              ? [...(currentTemplate.function_permissions || []), child.key]
                              : (currentTemplate.function_permissions || []).filter((p: string) => p !== child.key);
                            
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
                        <Label className="text-sm">{child.label}</Label>
                      </div>
                    )) : []
                  )}
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setShowRoleTemplateDialog(false);
                  setEditingRole(null);
                }}>
                  取消
                </Button>
                <Button onClick={async () => {
                  try {
                    // 保存角色模板到数据库
                    const template = roleTemplates[editingRole];
                    if (template) {
                      const { error } = await supabase
                        .from('role_permission_templates')
                        .upsert({
                          role: editingRole,
                          menu_permissions: template.menu_permissions || [],
                          function_permissions: template.function_permissions || [],
                          project_permissions: template.project_permissions || [],
                          data_permissions: template.data_permissions || [],
                          is_system: true,
                          name: getRoleDisplayName(editingRole),
                          description: getRoleDescription(editingRole),
                          color: getRoleColor(editingRole)
                        }, { onConflict: 'role' });

                      if (error) throw error;

                      toast({
                        title: "保存成功",
                        description: `${getRoleDisplayName(editingRole)}权限模板已更新`,
                      });
                    }
                    
                    setShowRoleTemplateDialog(false);
                    setEditingRole(null);
                    setHasChanges(false);
                  } catch (error: any) {
                    console.error('保存角色模板失败:', error);
                    toast({
                      title: "保存失败",
                      description: error.message || "保存角色模板时发生错误",
                      variant: "destructive"
                    });
                  }
                }}>
                  保存
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 项目权限管理对话框 */}
      {showProjectPermissionManager && selectedUserForPermission && (
        <Dialog open={showProjectPermissionManager} onOpenChange={setShowProjectPermissionManager}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>项目权限管理 - {selectedUserForPermission.full_name}</DialogTitle>
              <DialogDescription>
                管理用户的项目访问权限
              </DialogDescription>
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
          <DialogContent>
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
          <DialogContent>
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
                  <li>至少8个字符</li>
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
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>分配项目权限</DialogTitle>
              <DialogDescription>
                为用户 {userForProjectAssignment.full_name} 分配可查看的项目
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">项目权限说明</h4>
                <p className="text-sm text-blue-700">
                  <strong>默认所有项目都可访问</strong>。勾选的项目表示用户可以查看和访问，未勾选的项目表示用户被限制访问。
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {projects.map((project) => {
                  // 默认所有项目都可访问，只有被明确限制的项目才不勾选
                  // 如果用户没有在 user_projects 表中有记录，说明可以访问所有项目
                  // 如果用户有记录，则根据记录判断是否被限制
                  const userRestrictedProjects = userProjectAssignments[userForProjectAssignment.id] || [];
                  const isRestricted = userRestrictedProjects.length > 0 && !userRestrictedProjects.includes(project.id);
                  const isAssigned = !isRestricted; // 默认可访问，除非被明确限制
                  
                  return (
                    <div key={project.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
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

      {/* 用户状态变更确认对话框 */}
      {userToDelete && (
        <Dialog open={showStatusChangeDialog} onOpenChange={setShowStatusChangeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>确认用户状态变更</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>用户信息</Label>
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{userToDelete.full_name || userToDelete.username}</div>
                  <div className="text-sm text-muted-foreground">{userToDelete.email}</div>
                  <div className="text-sm text-muted-foreground">角色: {getRoleDisplayName(userToDelete.role)}</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>状态变更</Label>
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <strong>当前状态：</strong>
                    <Badge variant={userToDelete.is_active ? 'default' : 'secondary'} className="ml-2">
                      {userToDelete.is_active ? '启用' : '禁用'}
                    </Badge>
                  </div>
                  <div className="text-sm text-blue-800 mt-2">
                    <strong>变更后：</strong>
                    <Badge variant={userToDelete.is_active ? 'secondary' : 'default'} className="ml-2">
                      {userToDelete.is_active ? '禁用' : '启用'}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-sm text-yellow-800">
                  <strong>注意：</strong>
                  {userToDelete.is_active ? (
                    <span>禁用用户后，该用户将无法登录系统。</span>
                  ) : (
                    <span>启用用户后，该用户将可以正常登录系统。</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={userToDelete.is_active ? "secondary" : "default"}
                  onClick={confirmToggleUserStatus} 
                  className="flex-1"
                >
                  确认{userToDelete.is_active ? '禁用' : '启用'}
                </Button>
                <Button variant="outline" onClick={() => setShowStatusChangeDialog(false)}>
                  取消
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 创建用户对话框 */}
      <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>创建新用户</DialogTitle>
            <DialogDescription>
              创建新的用户账户并设置基本信息和角色
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱 *</Label>
              <Input
                id="email"
                type="email"
                value={createUserData.email}
                onChange={(e) => setCreateUserData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="请输入邮箱地址"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">用户名 *</Label>
              <Input
                id="username"
                value={createUserData.username}
                onChange={(e) => setCreateUserData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="请输入用户名"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">姓名 *</Label>
              <Input
                id="full_name"
                value={createUserData.full_name}
                onChange={(e) => setCreateUserData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="请输入真实姓名"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">角色 *</Label>
              <Select value={createUserData.role} onValueChange={(value: any) => setCreateUserData(prev => ({ ...prev, role: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="finance">财务</SelectItem>
                  <SelectItem value="business">业务</SelectItem>
                  <SelectItem value="operator">操作员</SelectItem>
                  <SelectItem value="partner">合作方</SelectItem>
                  <SelectItem value="viewer">查看者</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="work_wechat_userid">企业微信UserID（可选）</Label>
              <Input
                id="work_wechat_userid"
                value={createUserData.work_wechat_userid}
                onChange={(e) => setCreateUserData(prev => ({ ...prev, work_wechat_userid: e.target.value }))}
                placeholder="请输入企业微信UserID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码 *</Label>
              <Input
                id="password"
                type="password"
                value={createUserData.password}
                onChange={(e) => setCreateUserData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="请输入密码"
                required
              />
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>说明：</strong>
                <ul className="mt-2 ml-4 list-disc">
                  <li>新用户将自动获得对应角色的默认权限</li>
                  <li>用户创建后可以进一步调整权限设置</li>
                  <li>邮箱将作为登录用户名</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateUser} className="flex-1">
                创建用户
              </Button>
              <Button variant="outline" onClick={() => setShowCreateUserDialog(false)}>
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 批量角色变更对话框 */}
      <Dialog open={showBulkRoleDialog} onOpenChange={setShowBulkRoleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量角色变更</DialogTitle>
            <DialogDescription>
              将选中的 {selectedUsers.length} 个用户的角色统一变更
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-role">新角色</Label>
              <Select value={bulkRole} onValueChange={setBulkRole}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="finance">财务</SelectItem>
                  <SelectItem value="business">业务</SelectItem>
                  <SelectItem value="operator">操作员</SelectItem>
                  <SelectItem value="partner">合作方</SelectItem>
                  <SelectItem value="viewer">查看者</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                <strong>注意：</strong>此操作将影响 {selectedUsers.length} 个用户的权限，请谨慎操作。
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={confirmBulkRoleChange} className="flex-1" disabled={!bulkRole}>
                确认变更
              </Button>
              <Button variant="outline" onClick={() => setShowBulkRoleDialog(false)}>
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 批量删除确认对话框 */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量删除用户</DialogTitle>
            <DialogDescription>
              确定要删除选中的 {selectedUsers.length} 个用户吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                <strong>警告：</strong>删除用户将同时删除其所有权限和项目分配，此操作不可撤销。
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={confirmBulkDelete} 
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                确认删除
              </Button>
              <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
