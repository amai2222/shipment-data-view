// 用户管理页面
// 文件: src/pages/UserManagementPage.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  Building2,
  UserCheck,
  Shield,
  Mail,
  Phone,
  Calendar,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  projects?: Project[];
}

interface Project {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface UserProject {
  user_id: string;
  project_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export default function UserManagementPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [userProjects, setUserProjects] = useState<UserProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User>>({});
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 加载用户
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (usersError) throw usersError;

      // 加载项目
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (projectsError) throw projectsError;

      // 加载用户项目关联
      const { data: userProjectsData, error: userProjectsError } = await supabase
        .from('user_projects')
        .select('*');

      if (userProjectsError) throw userProjectsError;

      setUsers(usersData || []);
      setProjects(projectsData || []);
      setUserProjects(userProjectsData || []);
    } catch (error: any) {
      console.error('加载数据失败:', error);
      toast({
        title: "错误",
        description: `加载数据失败: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 过滤用户
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && user.is_active) ||
                         (statusFilter === 'inactive' && !user.is_active);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  // 获取用户的项目权限
  const getUserProjects = (userId: string) => {
    return userProjects.filter(up => up.user_id === userId);
  };

  // 获取用户可访问的项目
  const getUserAccessibleProjects = (userId: string) => {
    const userProjectIds = getUserProjects(userId).map(up => up.project_id);
    return projects.filter(p => userProjectIds.includes(p.id));
  };

  // 创建用户
  const handleCreateUser = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .insert([editingUser]);

      if (error) throw error;

      toast({
        title: "成功",
        description: "用户创建成功",
      });

      setIsDialogOpen(false);
      setEditingUser({});
      loadData();
    } catch (error: any) {
      console.error('创建用户失败:', error);
      toast({
        title: "错误",
        description: `创建用户失败: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // 更新用户
  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(editingUser)
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast({
        title: "成功",
        description: "用户更新成功",
      });

      setIsDialogOpen(false);
      setSelectedUser(null);
      setEditingUser({});
      loadData();
    } catch (error: any) {
      console.error('更新用户失败:', error);
      toast({
        title: "错误",
        description: `更新用户失败: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "成功",
        description: "用户删除成功",
      });

      loadData();
    } catch (error: any) {
      console.error('删除用户失败:', error);
      toast({
        title: "错误",
        description: `删除用户失败: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // 分配项目权限
  const handleAssignProjects = async () => {
    if (!selectedUser) return;

    try {
      // 删除现有项目权限
      await supabase
        .from('user_projects')
        .delete()
        .eq('user_id', selectedUser.id);

      // 添加新的项目权限
      if (selectedProjects.length > 0) {
        const projectPermissions = selectedProjects.map(projectId => ({
          user_id: selectedUser.id,
          project_id: projectId,
          can_view: true,
          can_edit: true,
          can_delete: false
        }));

        const { error } = await supabase
          .from('user_projects')
          .insert(projectPermissions);

        if (error) throw error;
      }

      toast({
        title: "成功",
        description: "项目权限分配成功",
      });

      setIsProjectDialogOpen(false);
      setSelectedProjects([]);
      loadData();
    } catch (error: any) {
      console.error('分配项目权限失败:', error);
      toast({
        title: "错误",
        description: `分配项目权限失败: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // 打开编辑对话框
  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditingUser({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      is_active: user.is_active
    });
    setIsDialogOpen(true);
  };

  // 打开项目分配对话框
  const openProjectDialog = (user: User) => {
    setSelectedUser(user);
    const userProjectIds = getUserProjects(user.id).map(up => up.project_id);
    setSelectedProjects(userProjectIds);
    setIsProjectDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-gray-600">管理系统用户和项目权限</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setSelectedUser(null);
              setEditingUser({});
            }}>
              <Plus className="h-4 w-4 mr-2" />
              添加用户
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedUser ? '编辑用户' : '添加用户'}
              </DialogTitle>
              <DialogDescription>
                {selectedUser ? '修改用户信息' : '创建新用户'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="full_name">姓名</Label>
                <Input
                  id="full_name"
                  value={editingUser.full_name || ''}
                  onChange={(e) => setEditingUser(prev => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={editingUser.email || ''}
                  onChange={(e) => setEditingUser(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="phone">电话</Label>
                <Input
                  id="phone"
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="role">角色</Label>
                <Select value={editingUser.role || ''} onValueChange={(value) => setEditingUser(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择角色" />
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
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={editingUser.is_active || false}
                  onCheckedChange={(checked) => setEditingUser(prev => ({ ...prev, is_active: !!checked }))}
                />
                <Label htmlFor="is_active">激活状态</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={selectedUser ? handleUpdateUser : handleCreateUser}>
                  {selectedUser ? '更新' : '创建'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 搜索和过滤 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="搜索用户..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有角色</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
                <SelectItem value="finance">财务</SelectItem>
                <SelectItem value="business">业务</SelectItem>
                <SelectItem value="operator">操作员</SelectItem>
                <SelectItem value="partner">合作伙伴</SelectItem>
                <SelectItem value="viewer">查看者</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有状态</SelectItem>
                <SelectItem value="active">激活</SelectItem>
                <SelectItem value="inactive">未激活</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 用户列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            用户列表 ({filteredUsers.length})
          </CardTitle>
          <CardDescription>
            管理系统中的所有用户
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">{user.full_name}</h3>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? '激活' : '未激活'}
                      </Badge>
                      <Badge variant="outline">{user.role}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      项目权限: {getUserAccessibleProjects(user.id).length} 个
                    </p>
                    <p className="text-xs text-gray-500">
                      创建时间: {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openProjectDialog(user)}
                  >
                    <Building2 className="h-4 w-4 mr-1" />
                    项目
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(user)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    编辑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteUser(user.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 项目分配对话框 */}
      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>分配项目权限</DialogTitle>
            <DialogDescription>
              为用户 {selectedUser?.full_name} 分配项目访问权限
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-64 overflow-y-auto space-y-2">
              {projects.map((project) => (
                <div key={project.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={project.id}
                    checked={selectedProjects.includes(project.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedProjects(prev => [...prev, project.id]);
                      } else {
                        setSelectedProjects(prev => prev.filter(id => id !== project.id));
                      }
                    }}
                  />
                  <Label htmlFor={project.id} className="flex-1">
                    <div>
                      <p className="font-medium">{project.name}</p>
                      {project.description && (
                        <p className="text-sm text-gray-600">{project.description}</p>
                      )}
                    </div>
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsProjectDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleAssignProjects}>
                保存权限
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
