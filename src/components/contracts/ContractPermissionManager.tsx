import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Save, X, Shield, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface ContractPermission {
  id: string;
  contract_id: string;
  user_id?: string;
  department?: string;
  permission_type: 'view' | 'download' | 'edit' | 'delete';
  field_permissions?: any;
  file_permissions?: any;
  created_at: string;
  updated_at?: string;
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
    department: '',
    permission_type: 'view' as 'view' | 'download' | 'edit' | 'delete'
  });
  const [contracts, setContracts] = useState<any[]>([]);

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
        .select('*')
        .order('created_at', { ascending: false });

      if (contractId) {
        query = query.eq('contract_id', contractId);
      }

      const { data, error } = await query;

      if (error) throw error;
      const formattedData = (data || []).map(item => ({
        ...item,
        permission_type: item.permission_type as 'view' | 'download' | 'edit' | 'delete'
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
      const contractsResult = await supabase
        .from('contracts')
        .select('id, contract_number, counterparty_company, our_company')
        .order('created_at', { ascending: false });

      setContracts(contractsResult.data || []);
    } catch (error) {
      console.error('Error loading reference data:', error);
      setContracts([]);
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

    if (!formData.user_id && !formData.department) {
      toast({
        title: "错误",
        description: "请选择用户或部门",
        variant: "destructive",
      });
      return;
    }

    try {
      const permissionData = {
        contract_id: formData.contract_id,
        permission_type: formData.permission_type,
        user_id: formData.user_id || null,
        department: formData.department || null
      };

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
        department: '',
        permission_type: 'view'
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
      department: permission.department || '',
      permission_type: permission.permission_type
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
      department: '',
      permission_type: 'view'
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
                <Label htmlFor="user_id">用户ID</Label>
                <Input
                  id="user_id"
                  value={formData.user_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, user_id: e.target.value }))}
                  placeholder="输入用户ID"
                />
              </div>

              <div>
                <Label htmlFor="department">部门</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="输入部门名称"
                />
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
                  <TableHead>用户ID</TableHead>
                  <TableHead>部门</TableHead>
                  <TableHead>权限类型</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell>{permission.user_id || '-'}</TableCell>
                    <TableCell>{permission.department || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getPermissionTypeBadgeVariant(permission.permission_type)}>
                        {getPermissionTypeText(permission.permission_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(permission.created_at), 'yyyy-MM-dd HH:mm')}
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