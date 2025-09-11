import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Save, X, Shield, User, Users, Building, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface ContractPermission {
  id: string;
  contract_id: string;
  user_id?: string;
  role_id?: string;
  department_id?: string;
  permission_type: 'view' | 'download' | 'edit' | 'delete';
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
  onPermissionUpdate?: () => void;
}

export function ContractPermissionManager({ contractId, onPermissionUpdate }: ContractPermissionManagerProps) {
  const [permissions, setPermissions] = useState<ContractPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPermission, setEditingPermission] = useState<ContractPermission | null>(null);
  const [formData, setFormData] = useState({
    contract_id: contractId || '',
    user_id: '',
    role_id: '',
    department_id: '',
    permission_type: 'view' as 'view' | 'download' | 'edit' | 'delete',
    expires_at: ''
  });
  const [contracts, setContracts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const { toast } = useToast();

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
          users!left(name),
          user_roles!left(name),
          departments!left(name),
          granter:users!granted_by(name)
        `)
        .order('created_at', { ascending: false });

      if (contractId) {
        query = query.eq('contract_id', contractId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const formattedData = (data || []).map(item => ({
        ...item,
        contract_number: item.contracts?.contract_number,
        counterparty_company: item.contracts?.counterparty_company,
        our_company: item.contracts?.our_company,
        user_name: item.users?.name,
        role_name: item.user_roles?.name,
        department_name: item.departments?.name,
        granter_name: item.granter?.name
      }));

      setPermissions(formattedData);
    } catch (error) {
      console.error('Error loading permissions:', error);
      toast({
        title: "错误",
        description: "加载权限列表失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      const [contractsResult, usersResult, rolesResult, departmentsResult] = await Promise.all([
        supabase.from('contracts').select('id, contract_number, counterparty_company, our_company').order('created_at', { ascending: false }),
        supabase.from('users').select('id, name, email').order('name'),
        supabase.from('user_roles').select('id, name').order('name'),
        supabase.from('departments').select('id, name').order('name')
      ]);

      setContracts(contractsResult.data || []);
      setUsers(usersResult.data || []);
      setRoles(rolesResult.data || []);
      setDepartments(departmentsResult.data || []);
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.contract_id) {
      toast({
        title: "错误",
        description: "请选择合同",
        variant: "destructive",
      });
      return;
    }

    if (!formData.user_id && !formData.role_id && !formData.department_id) {
      toast({
        title: "错误",
        description: "请选择用户、角色或部门",
        variant: "destructive",
      });
      return;
    }

    try {
      const permissionData = {
        contract_id: formData.contract_id,
        permission_type: formData.permission_type,
        expires_at: formData.expires_at || null,
        is_active: true
      };

      if (formData.user_id) {
        permissionData.user_id = formData.user_id;
      }
      if (formData.role_id) {
        permissionData.role_id = formData.role_id;
      }
      if (formData.department_id) {
        permissionData.department_id = formData.department_id;
      }

      if (editingPermission) {
        // 更新现有权限
        const { error } = await supabase
          .from('contract_permissions')
          .update(permissionData)
          .eq('id', editingPermission.id);

        if (error) throw error;

        toast({
          title: "成功",
          description: "权限更新成功",
        });
      } else {
        // 创建新权限
        const { error } = await supabase
          .from('contract_permissions')
          .insert(permissionData);

        if (error) throw error;

        toast({
          title: "成功",
          description: "权限创建成功",
        });
      }

      setShowForm(false);
      setEditingPermission(null);
      setFormData({
        contract_id: contractId || '',
        user_id: '',
        role_id: '',
        department_id: '',
        permission_type: 'view',
        expires_at: ''
      });
      loadPermissions();
      onPermissionUpdate?.();
    } catch (error) {
      console.error('Error saving permission:', error);
      toast({
        title: "错误",
        description: "保存权限失败",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (permission: ContractPermission) => {
    setEditingPermission(permission);
    setFormData({
      contract_id: permission.contract_id,
      user_id: permission.user_id || '',
      role_id: permission.role_id || '',
      department_id: permission.department_id || '',
      permission_type: permission.permission_type,
      expires_at: permission.expires_at ? format(new Date(permission.expires_at), 'yyyy-MM-dd') : ''
    });
    setShowForm(true);
  };

  const handleDelete = async (permission: ContractPermission) => {
    if (!confirm('确定要删除这个权限吗？')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contract_permissions')
        .delete()
        .eq('id', permission.id);

      if (error) throw error;

      toast({
        title: "成功",
        description: "权限删除成功",
      });

      loadPermissions();
      onPermissionUpdate?.();
    } catch (error) {
      console.error('Error deleting permission:', error);
      toast({
        title: "错误",
        description: "删除权限失败",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingPermission(null);
    setFormData({
      contract_id: contractId || '',
      user_id: '',
      role_id: '',
      department_id: '',
      permission_type: 'view',
      expires_at: ''
    });
  };

  const getPermissionTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'view': return 'secondary';
      case 'download': return 'outline';
      case 'edit': return 'default';
      case 'delete': return 'destructive';
      default: return 'secondary';
    }
  };

  const getPermissionTypeText = (type: string) => {
    switch (type) {
      case 'view': return '查看';
      case 'download': return '下载';
      case 'edit': return '编辑';
      case 'delete': return '删除';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">合同权限管理</h2>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新增权限
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingPermission ? '编辑权限' : '新增权限'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="contract_id">合同 *</Label>
                <Select
                  value={formData.contract_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, contract_id: value }))}
                  disabled={!!contractId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择合同" />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {contract.contract_number} - {contract.counterparty_company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>授权对象 *</Label>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="user_id" className="text-sm">用户</Label>
                    <Select
                      value={formData.user_id}
                      onValueChange={(value) => setFormData(prev => ({ 
                        ...prev, 
                        user_id: value,
                        role_id: '',
                        department_id: ''
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择用户" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">不选择用户</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="role_id" className="text-sm">角色</Label>
                    <Select
                      value={formData.role_id}
                      onValueChange={(value) => setFormData(prev => ({ 
                        ...prev, 
                        role_id: value,
                        user_id: '',
                        department_id: ''
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择角色" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">不选择角色</SelectItem>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="department_id" className="text-sm">部门</Label>
                    <Select
                      value={formData.department_id}
                      onValueChange={(value) => setFormData(prev => ({ 
                        ...prev, 
                        department_id: value,
                        user_id: '',
                        role_id: ''
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择部门" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">不选择部门</SelectItem>
                        {departments.map((department) => (
                          <SelectItem key={department.id} value={department.id}>
                            {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="permission_type">权限类型 *</Label>
                <Select
                  value={formData.permission_type}
                  onValueChange={(value: 'view' | 'download' | 'edit' | 'delete') =>
                    setFormData(prev => ({ ...prev, permission_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">查看</SelectItem>
                    <SelectItem value="download">下载</SelectItem>
                    <SelectItem value="edit">编辑</SelectItem>
                    <SelectItem value="delete">删除</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="expires_at">过期时间</Label>
                <Input
                  id="expires_at"
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  留空表示永不过期
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  取消
                </Button>
                <Button type="submit">
                  <Save className="h-4 w-4 mr-2" />
                  保存
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            权限列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : permissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无权限记录
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>合同</TableHead>
                  <TableHead>授权对象</TableHead>
                  <TableHead>权限类型</TableHead>
                  <TableHead>授权时间</TableHead>
                  <TableHead>过期时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-mono">{permission.contract_number}</div>
                        <div className="text-muted-foreground">
                          {permission.counterparty_company} - {permission.our_company}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {permission.user_name && (
                          <div className="flex items-center space-x-1">
                            <User className="h-3 w-3" />
                            <span className="text-sm">{permission.user_name}</span>
                          </div>
                        )}
                        {permission.role_name && (
                          <div className="flex items-center space-x-1">
                            <Users className="h-3 w-3" />
                            <span className="text-sm">{permission.role_name}</span>
                          </div>
                        )}
                        {permission.department_name && (
                          <div className="flex items-center space-x-1">
                            <Building className="h-3 w-3" />
                            <span className="text-sm">{permission.department_name}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPermissionTypeBadgeVariant(permission.permission_type)}>
                        {getPermissionTypeText(permission.permission_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(permission.granted_at), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                    <TableCell>
                      {permission.expires_at ? format(new Date(permission.expires_at), 'yyyy-MM-dd') : '永不过期'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={permission.is_active ? 'default' : 'secondary'}>
                        {permission.is_active ? '有效' : '无效'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(permission)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(permission)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
