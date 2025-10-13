import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  User, 
  Users, 
  Building, 
  Search,
  Filter,
  Download,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';

interface ContractPermission {
  id: string;
  contract_id: string;
  user_id?: string;
  role_id?: string;
  department_id?: string;
  permission_type: 'view' | 'download' | 'edit' | 'delete' | 'manage' | 'sensitive' | 'approve' | 'archive' | 'audit';
  granted_by?: string;
  granted_at: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // 关联信息
  contract_number?: string;
  counterparty_company?: string;
  our_company?: string;
  user_name?: string;
  role_name?: string;
  department_name?: string;
  granter_name?: string;
}

interface ContractPermissionManagerProps {
  contractId?: string;
  mode: 'global' | 'contract-specific';
  onPermissionUpdate?: () => void;
}

export function ContractPermissionManager({ 
  contractId, 
  mode, 
  onPermissionUpdate 
}: ContractPermissionManagerProps) {
  const { toast } = useToast();
  
  // 状态管理
  const [permissions, setPermissions] = useState<ContractPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPermission, setEditingPermission] = useState<ContractPermission | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  
  // 筛选和搜索
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    permissionType: 'all',
    targetType: 'all',
    status: 'active'
  });
  
  // 表单数据
  const [formData, setFormData] = useState({
    contract_id: contractId || '',
    user_id: '',
    role_id: '',
    department_id: '',
    permission_type: 'view' as ContractPermission['permission_type'],
    expires_at: '',
    description: ''
  });
  
  // 参考数据
  const [contracts, setContracts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // 权限类型配置
  const permissionTypes = [
    { value: 'view', label: '查看', icon: Eye, color: 'bg-blue-100 text-blue-800' },
    { value: 'download', label: '下载', icon: Download, color: 'bg-green-100 text-green-800' },
    { value: 'edit', label: '编辑', icon: Edit, color: 'bg-yellow-100 text-yellow-800' },
    { value: 'delete', label: '删除', icon: Trash2, color: 'bg-red-100 text-red-800' },
    { value: 'manage', label: '管理', icon: Settings, color: 'bg-purple-100 text-purple-800' },
    { value: 'sensitive', label: '敏感信息', icon: Shield, color: 'bg-orange-100 text-orange-800' },
    { value: 'approve', label: '审批', icon: CheckCircle, color: 'bg-indigo-100 text-indigo-800' },
    { value: 'archive', label: '归档', icon: Building, color: 'bg-gray-100 text-gray-800' },
    { value: 'audit', label: '审计', icon: BarChart3, color: 'bg-pink-100 text-pink-800' }
  ];

  // 加载数据
  useEffect(() => {
    loadPermissions();
    loadReferenceData();
  }, [contractId]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('contract_permissions')
        .select(`
          *,
          contracts!inner(contract_number, counterparty_company, our_company),
          profiles!contract_permissions_user_id_fkey(full_name, email),
          granter:profiles!contract_permissions_granted_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (contractId) {
        query = query.eq('contract_id', contractId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('加载权限失败:', error);
        if (error.message.includes('relation "contract_permissions" does not exist')) {
          toast({
            title: "提示",
            description: "合同权限表尚未创建，请联系管理员",
            variant: "destructive"
          });
        }
        return;
      }

      setPermissions((data || []) as any);
    } catch (error) {
      console.error('加载权限失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载权限数据",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      const [contractsRes, usersRes, rolesRes] = await Promise.all([
        supabase.from('contracts').select('id, contract_number, counterparty_company').order('contract_number'),
        supabase.from('profiles').select('id, full_name, email').order('full_name'),
        supabase.from('role_permission_templates').select('role').order('role')
      ]);

      setContracts(contractsRes.data || []);
      setUsers(usersRes.data || []);
      setRoles(rolesRes.data || []);
    } catch (error) {
      console.error('加载参考数据失败:', error);
    }
  };

  // 权限统计
  const permissionStats = useMemo(() => {
    const stats = {
      total: permissions.length,
      active: permissions.filter(p => p.is_active).length,
      expired: permissions.filter(p => p.expires_at && new Date(p.expires_at) < new Date()).length,
      byType: permissionTypes.reduce((acc, type) => {
        acc[type.value] = permissions.filter(p => p.permission_type === type.value).length;
        return acc;
      }, {} as Record<string, number>),
      byTarget: {
        user: permissions.filter(p => p.user_id).length,
        role: permissions.filter(p => p.role_id).length,
        department: permissions.filter(p => p.department_id).length
      }
    };
    return stats;
  }, [permissions]);

  // 筛选权限
  const filteredPermissions = useMemo(() => {
    return permissions.filter(permission => {
      // 搜索筛选
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          permission.contract_number?.toLowerCase().includes(searchLower) ||
          permission.user_name?.toLowerCase().includes(searchLower) ||
          permission.role_name?.toLowerCase().includes(searchLower) ||
          permission.department_name?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // 权限类型筛选
      if (filters.permissionType && filters.permissionType !== 'all' && permission.permission_type !== filters.permissionType) {
        return false;
      }

      // 目标类型筛选
      if (filters.targetType && filters.targetType !== 'all') {
        if (filters.targetType === 'user' && !permission.user_id) return false;
        if (filters.targetType === 'role' && !permission.role_id) return false;
        if (filters.targetType === 'department' && !permission.department_id) return false;
      }

      // 状态筛选
      if (filters.status === 'active' && !permission.is_active) return false;
      if (filters.status === 'expired' && (!permission.expires_at || new Date(permission.expires_at) >= new Date())) return false;

      return true;
    });
  }, [permissions, searchTerm, filters]);

  // 创建权限
  const handleCreatePermission = async () => {
    try {
      const { error } = await supabase
        .from('contract_permissions')
        .insert({
          ...formData,
          granted_by: (await supabase.auth.getUser()).data.user?.id,
          expires_at: formData.expires_at || null
        });

      if (error) throw error;

      toast({
        title: "创建成功",
        description: "权限已成功创建",
      });

      setShowCreateDialog(false);
      resetForm();
      await loadPermissions();
      onPermissionUpdate?.();
    } catch (error: any) {
      console.error('创建权限失败:', error);
      toast({
        title: "创建失败",
        description: error.message || "创建权限失败",
        variant: "destructive"
      });
    }
  };

  // 更新权限
  const handleUpdatePermission = async (permission: ContractPermission) => {
    try {
      const { error } = await supabase
        .from('contract_permissions')
        .update({
          permission_type: permission.permission_type,
          expires_at: permission.expires_at || null,
          is_active: permission.is_active
        })
        .eq('id', permission.id);

      if (error) throw error;

      toast({
        title: "更新成功",
        description: "权限已成功更新",
      });

      await loadPermissions();
      onPermissionUpdate?.();
    } catch (error: any) {
      console.error('更新权限失败:', error);
      toast({
        title: "更新失败",
        description: "更新权限失败",
        variant: "destructive"
      });
    }
  };

  // 删除权限
  const handleDeletePermission = async (permissionId: string) => {
    try {
      const { error } = await supabase
        .from('contract_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;

      toast({
        title: "删除成功",
        description: "权限已成功删除",
      });

      await loadPermissions();
      onPermissionUpdate?.();
    } catch (error: any) {
      console.error('删除权限失败:', error);
      toast({
        title: "删除失败",
        description: "删除权限失败",
        variant: "destructive"
      });
    }
  };

  // 批量操作
  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    try {
      const updates = selectedPermissions.map(id => ({ id }));
      
      switch (action) {
        case 'activate':
          await supabase
            .from('contract_permissions')
            .update({ is_active: true })
            .in('id', selectedPermissions);
          break;
        case 'deactivate':
          await supabase
            .from('contract_permissions')
            .update({ is_active: false })
            .in('id', selectedPermissions);
          break;
        case 'delete':
          await supabase
            .from('contract_permissions')
            .delete()
            .in('id', selectedPermissions);
          break;
      }

      toast({
        title: "批量操作成功",
        description: `已${action === 'delete' ? '删除' : action === 'activate' ? '启用' : '禁用'} ${selectedPermissions.length} 个权限`,
      });

      setSelectedPermissions([]);
      await loadPermissions();
      onPermissionUpdate?.();
    } catch (error: any) {
      console.error('批量操作失败:', error);
      toast({
        title: "操作失败",
        description: "批量操作失败",
        variant: "destructive"
      });
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      contract_id: contractId || '',
      user_id: '',
      role_id: '',
      department_id: '',
      permission_type: 'view',
      expires_at: '',
      description: ''
    });
  };

  // 获取权限类型信息
  const getPermissionTypeInfo = (type: string) => {
    return permissionTypes.find(t => t.value === type) || permissionTypes[0];
  };

  // 获取目标显示名称
  const getTargetDisplayName = (permission: ContractPermission) => {
    if (permission.user_name) return permission.user_name;
    if (permission.role_name) return permission.role_name;
    if (permission.department_name) return permission.department_name;
    return '未知';
  };

  // 获取目标类型
  const getTargetType = (permission: ContractPermission) => {
    if (permission.user_id) return '用户';
    if (permission.role_id) return '角色';
    if (permission.department_id) return '部门';
    return '未知';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">加载权限数据中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 权限统计面板 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总权限数</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permissionStats.total}</div>
            <p className="text-xs text-muted-foreground">所有权限记录</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">有效权限</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{permissionStats.active}</div>
            <p className="text-xs text-muted-foreground">当前有效权限</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">过期权限</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{permissionStats.expired}</div>
            <p className="text-xs text-muted-foreground">已过期权限</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">用户权限</CardTitle>
            <User className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{permissionStats.byTarget.user}</div>
            <p className="text-xs text-muted-foreground">用户级权限</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>权限列表</CardTitle>
              <CardDescription>
                {mode === 'global' ? '管理所有合同权限' : '管理当前合同权限'}
              </CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  新增权限
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>新增权限</DialogTitle>
                  <DialogDescription>
                    为合同分配新的访问权限
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* 合同选择 */}
                  <div className="space-y-2">
                    <Label htmlFor="contract">合同</Label>
                    <Select 
                      value={formData.contract_id} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, contract_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择合同" />
                      </SelectTrigger>
                      <SelectContent>
                        {contracts.map(contract => (
                          <SelectItem key={contract.id} value={contract.id}>
                            {contract.contract_number} - {contract.counterparty_company}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 权限对象选择 */}
                  <Tabs defaultValue="user" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="user">用户</TabsTrigger>
                      <TabsTrigger value="role">角色</TabsTrigger>
                      <TabsTrigger value="department">部门</TabsTrigger>
                    </TabsList>
                    <TabsContent value="user" className="space-y-2">
                      <Label htmlFor="user">用户</Label>
                      <Select 
                        value={formData.user_id} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, user_id: value, role_id: '', department_id: '' }))}
                      >
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
                    </TabsContent>
                    <TabsContent value="role" className="space-y-2">
                      <Label htmlFor="role">角色</Label>
                      <Select 
                        value={formData.role_id} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, role_id: value, user_id: '', department_id: '' }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择角色" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map(role => (
                            <SelectItem key={role.role} value={role.role}>
                              {role.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TabsContent>
                    <TabsContent value="department" className="space-y-2">
                      <Label htmlFor="department">部门</Label>
                      <Select 
                        value={formData.department_id} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, department_id: value, user_id: '', role_id: '' }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择部门" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="finance">财务部</SelectItem>
                          <SelectItem value="business">业务部</SelectItem>
                          <SelectItem value="legal">法务部</SelectItem>
                        </SelectContent>
                      </Select>
                    </TabsContent>
                  </Tabs>

                  {/* 权限类型 */}
                  <div className="space-y-2">
                    <Label>权限类型</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {permissionTypes.map(type => (
                        <div key={type.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={type.value}
                            checked={formData.permission_type === type.value}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData(prev => ({ ...prev, permission_type: type.value as any }));
                              }
                            }}
                          />
                          <Label htmlFor={type.value} className="text-sm">
                            <type.icon className="h-4 w-4 inline mr-1" />
                            {type.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 过期时间 */}
                  <div className="space-y-2">
                    <Label htmlFor="expires_at">过期时间（可选）</Label>
                    <Input
                      id="expires_at"
                      type="datetime-local"
                      value={formData.expires_at}
                      onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleCreatePermission} className="flex-1">
                      创建权限
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      取消
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* 搜索和筛选 */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索合同、用户、角色..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filters.permissionType} onValueChange={(value) => setFilters(prev => ({ ...prev, permissionType: value }))}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="权限类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {permissionTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.targetType} onValueChange={(value) => setFilters(prev => ({ ...prev, targetType: value }))}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="目标类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="user">用户</SelectItem>
                <SelectItem value="role">角色</SelectItem>
                <SelectItem value="department">部门</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">有效</SelectItem>
                <SelectItem value="expired">过期</SelectItem>
                <SelectItem value="all">全部</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 批量操作工具栏 */}
          {selectedPermissions.length > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Badge variant="secondary">
                已选择 {selectedPermissions.length} 个权限
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('activate')}
              >
                批量启用
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('deactivate')}
              >
                批量禁用
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('delete')}
                className="text-red-600 hover:text-red-700"
              >
                批量删除
              </Button>
            </div>
          )}

          {/* 权限列表 */}
          {filteredPermissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无权限记录</p>
              <p className="text-sm">点击"新增权限"开始创建</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedPermissions.length === filteredPermissions.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPermissions(filteredPermissions.map(p => p.id));
                        } else {
                          setSelectedPermissions([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>合同</TableHead>
                  <TableHead>目标</TableHead>
                  <TableHead>权限类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>授权时间</TableHead>
                  <TableHead>过期时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(filteredPermissions || []).map((permission) => {
                  if (!permission) return null;
                  
                  const typeInfo = getPermissionTypeInfo(permission.permission_type);
                  const isExpired = permission.expires_at && new Date(permission.expires_at) < new Date();
                  
                  return (
                    <TableRow key={permission.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPermissions.includes(permission.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPermissions(prev => [...prev, permission.id]);
                            } else {
                              setSelectedPermissions(prev => prev.filter(id => id !== permission.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{permission.contract_number}</div>
                          <div className="text-sm text-muted-foreground">
                            {permission.counterparty_company}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{getTargetDisplayName(permission)}</div>
                          <div className="text-sm text-muted-foreground">
                            {getTargetType(permission)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={typeInfo.color}>
                          <typeInfo.icon className="h-3 w-3 mr-1" />
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {permission.is_active ? (
                            <Badge variant="outline" className="text-green-700 border-green-300">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              有效
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-700 border-red-300">
                              <XCircle className="h-3 w-3 mr-1" />
                              禁用
                            </Badge>
                          )}
                          {isExpired && (
                            <Badge variant="outline" className="text-orange-700 border-orange-300">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              过期
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(permission.granted_at), 'yyyy-MM-dd HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {permission.expires_at 
                            ? format(new Date(permission.expires_at), 'yyyy-MM-dd HH:mm')
                            : '永久'
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingPermission(permission)}
                            title="编辑权限"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePermission(permission.id)}
                            title="删除权限"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
