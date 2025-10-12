import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  User, 
  Users, 
  Building, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Settings
} from 'lucide-react';

interface Permission {
  id: string;
  contract_id?: string;
  user_id?: string;
  role_id?: string;
  department?: string;
  permission_type: 'view' | 'edit' | 'delete' | 'download' | 'admin';
  field_permissions?: {
    [key: string]: boolean;
  };
  file_permissions?: {
    original: boolean;
    attachment: boolean;
  };
  created_at: string;
  // 关联信息
  user_email?: string;
  user_name?: string;
  role_name?: string;
  contract_number?: string;
}

interface User {
  id: string;
  email: string;
  full_name?: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
}

interface ContractAdvancedPermissionsProps {
  contractId?: string;
  onPermissionUpdate?: () => void;
}

export function ContractAdvancedPermissions({ contractId, onPermissionUpdate }: ContractAdvancedPermissionsProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [permissionForm, setPermissionForm] = useState({
    permission_type: 'view' as 'view' | 'edit' | 'delete' | 'download' | 'admin',
    user_id: '',
    role_id: '',
    department: '',
    field_permissions: {
      contract_number: true,
      counterparty_company: true,
      our_company: true,
      contract_amount: true,
      start_date: true,
      end_date: true,
      remarks: true,
      responsible_person: true,
      department: true,
      priority: true,
      status: true
    },
    file_permissions: {
      original: true,
      attachment: true
    }
  });

  const { toast } = useToast();

  useEffect(() => {
    loadPermissions();
    loadUsers();
    loadRoles();
  }, [contractId]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('contract_permissions')
        .select(`
          *,
          contracts(contract_number)
        `)
        .order('created_at', { ascending: false });

      if (contractId) {
        query = query.eq('contract_id', contractId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Database error:', error);
        // 如果表不存在，返回空数组而不是抛出错误
        if (error.message.includes('relation "contract_permissions" does not exist')) {
          setPermissions([]);
          return;
        }
        throw error;
      }
      
      const formattedData = (data || []).map(item => ({
        ...item,
        user_email: item.user_id ? `用户 ${item.user_id}` : null,
        user_name: item.user_id ? `用户 ${item.user_id}` : null,
        role_name: (item as any).role_name || null,
        contract_number: item.contracts?.contract_number,
        granted_at: item.created_at
      }));

      setPermissions(formattedData as any);
    } catch (error) {
      console.error('Error loading permissions:', error);
      toast({
        title: "错误",
        description: "加载权限列表失败，请检查数据库连接",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      // 由于 profiles 表可能不存在，设置为空数组
      setUsers([]);
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    }
  };

  const loadRoles = async () => {
    try {
      // 由于 roles 表可能不存在，设置为空数组
      setRoles([]);
    } catch (error) {
      console.error('Error loading roles:', error);
      setRoles([]);
    }
  };

  const createPermission = async () => {
    if (!permissionForm.user_id && !permissionForm.role_id && !permissionForm.department) {
      toast({
        title: "错误",
        description: "请选择用户、角色或部门",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('contract_permissions')
        .insert({
          contract_id: contractId,
          user_id: permissionForm.user_id || null,
          role_id: permissionForm.role_id || null,
          department: permissionForm.department || null,
          permission_type: permissionForm.permission_type,
          field_permissions: permissionForm.field_permissions,
          file_permissions: permissionForm.file_permissions
        });

      if (error) throw error;

      toast({
        title: "成功",
        description: "权限已创建",
      });

      setShowCreateDialog(false);
      setPermissionForm({
        permission_type: 'view',
        user_id: '',
        role_id: '',
        department: '',
        field_permissions: {
          contract_number: true,
          counterparty_company: true,
          our_company: true,
          contract_amount: true,
          start_date: true,
          end_date: true,
          remarks: true,
          responsible_person: true,
          department: true,
          priority: true,
          status: true
        },
        file_permissions: {
          original: true,
          attachment: true
        }
      });
      loadPermissions();
      onPermissionUpdate?.();
    } catch (error) {
      console.error('Error creating permission:', error);
      toast({
        title: "错误",
        description: "创建权限失败",
        variant: "destructive",
      });
    }
  };

  const updatePermission = async () => {
    if (!selectedPermission) return;

    try {
      const { error } = await supabase
        .from('contract_permissions')
        .update({
          permission_type: permissionForm.permission_type,
          field_permissions: permissionForm.field_permissions,
          file_permissions: permissionForm.file_permissions
        })
        .eq('id', selectedPermission.id);

      if (error) throw error;

      toast({
        title: "成功",
        description: "权限已更新",
      });

      setShowEditDialog(false);
      setSelectedPermission(null);
      loadPermissions();
      onPermissionUpdate?.();
    } catch (error) {
      console.error('Error updating permission:', error);
      toast({
        title: "错误",
        description: "更新权限失败",
        variant: "destructive",
      });
    }
  };

  const deletePermission = async (permissionId: string) => {
    if (!confirm('确定要删除这个权限吗？')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contract_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;

      toast({
        title: "成功",
        description: "权限已删除",
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

  const getPermissionBadgeVariant = (type: string) => {
    switch (type) {
      case 'admin': return 'destructive';
      case 'edit': return 'default';
      case 'view': return 'secondary';
      case 'download': return 'outline';
      case 'delete': return 'destructive';
      default: return 'outline';
    }
  };

  const getPermissionText = (type: string) => {
    switch (type) {
      case 'admin': return '管理员';
      case 'edit': return '编辑';
      case 'view': return '查看';
      case 'download': return '下载';
      case 'delete': return '删除';
      default: return type;
    }
  };

  const handleEditPermission = (permission: Permission) => {
    setSelectedPermission(permission);
    setPermissionForm({
      permission_type: permission.permission_type,
      user_id: permission.user_id || '',
      role_id: permission.role_id || '',
      department: permission.department || '',
      field_permissions: (permission.field_permissions || {
        contract_number: true,
        counterparty_company: true,
        our_company: true,
        contract_amount: true,
        start_date: true,
        end_date: true,
        remarks: true,
        responsible_person: true,
        department: true,
        priority: true,
        status: true
      }) as any,
      file_permissions: permission.file_permissions || {
        original: true,
        attachment: true
      }
    });
    setShowEditDialog(true);
  };

  const updateFieldPermission = (field: string, value: boolean) => {
    setPermissionForm(prev => ({
      ...prev,
      field_permissions: {
        ...prev.field_permissions,
        [field]: value
      }
    }));
  };

  const updateFilePermission = (fileType: 'original' | 'attachment', value: boolean) => {
    setPermissionForm(prev => ({
      ...prev,
      file_permissions: {
        ...prev.file_permissions,
        [fileType]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">高级权限管理</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              添加权限
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>添加权限</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>用户</Label>
                  <Select value={permissionForm.user_id || 'none'} onValueChange={(value) => setPermissionForm(prev => ({ ...prev, user_id: value === 'none' ? '' : value, role_id: '', department: '' }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择用户" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不指定用户</SelectItem>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>角色</Label>
                  <Select value={permissionForm.role_id || 'none'} onValueChange={(value) => setPermissionForm(prev => ({ ...prev, role_id: value === 'none' ? '' : value, user_id: '', department: '' }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择角色" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不指定角色</SelectItem>
                      {roles.map(role => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>部门</Label>
                <Input
                  placeholder="输入部门名称"
                  value={permissionForm.department}
                  onChange={(e) => setPermissionForm(prev => ({ ...prev, department: e.target.value, user_id: '', role_id: '' }))}
                />
              </div>

              <div>
                <Label>权限类型</Label>
                <Select value={permissionForm.permission_type} onValueChange={(value: 'view' | 'edit' | 'delete' | 'download' | 'admin') => setPermissionForm(prev => ({ ...prev, permission_type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">查看</SelectItem>
                    <SelectItem value="edit">编辑</SelectItem>
                    <SelectItem value="download">下载</SelectItem>
                    <SelectItem value="delete">删除</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>字段权限</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(permissionForm.field_permissions).map(([field, value]) => (
                    <div key={field} className="flex items-center space-x-2">
                      <Checkbox
                        id={field}
                        checked={value}
                        onCheckedChange={(checked) => updateFieldPermission(field, checked as boolean)}
                      />
                      <Label htmlFor={field} className="text-sm">
                        {field === 'contract_number' ? '合同编号' :
                         field === 'counterparty_company' ? '对方公司' :
                         field === 'our_company' ? '我方公司' :
                         field === 'contract_amount' ? '合同金额' :
                         field === 'start_date' ? '开始日期' :
                         field === 'end_date' ? '结束日期' :
                         field === 'remarks' ? '备注' :
                         field === 'responsible_person' ? '负责人' :
                         field === 'department' ? '部门' :
                         field === 'priority' ? '优先级' :
                         field === 'status' ? '状态' : field}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>文件权限</Label>
                <div className="flex space-x-4 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="original"
                      checked={permissionForm.file_permissions.original}
                      onCheckedChange={(checked) => updateFilePermission('original', checked as boolean)}
                    />
                    <Label htmlFor="original" className="text-sm">合同原件</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="attachment"
                      checked={permissionForm.file_permissions.attachment}
                      onCheckedChange={(checked) => updateFilePermission('attachment', checked as boolean)}
                    />
                    <Label htmlFor="attachment" className="text-sm">合同附件</Label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  取消
                </Button>
                <Button onClick={createPermission}>
                  创建权限
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 权限列表 */}
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
                  <TableHead>用户/角色/部门</TableHead>
                  <TableHead>权限类型</TableHead>
                  <TableHead>字段权限</TableHead>
                  <TableHead>文件权限</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(permissions || []).map((permission) => {
                  if (!permission) return null;
                  
                  return (
                    <TableRow key={permission.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {permission.user_id ? (
                          <>
                            <User className="h-4 w-4 text-blue-600" />
                            <div>
                              <p className="text-sm font-medium">{permission.user_name || '未知用户'}</p>
                              <p className="text-xs text-muted-foreground">{permission.user_email}</p>
                            </div>
                          </>
                        ) : permission.role_id ? (
                          <>
                            <Users className="h-4 w-4 text-green-600" />
                            <div>
                              <p className="text-sm font-medium">{permission.role_name}</p>
                              <p className="text-xs text-muted-foreground">角色权限</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <Building className="h-4 w-4 text-orange-600" />
                            <div>
                              <p className="text-sm font-medium">{permission.department}</p>
                              <p className="text-xs text-muted-foreground">部门权限</p>
                            </div>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPermissionBadgeVariant(permission.permission_type)}>
                        {getPermissionText(permission.permission_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {permission.field_permissions && Object.entries(permission.field_permissions).map(([field, value]) => (
                          <Badge
                            key={field}
                            variant={value ? 'default' : 'outline'}
                            className="text-xs"
                          >
                            {value ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {permission.file_permissions && (
                          <>
                            <Badge
                              variant={permission.file_permissions.original ? 'default' : 'outline'}
                              className="text-xs"
                            >
                              {permission.file_permissions.original ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                              原件
                            </Badge>
                            <Badge
                              variant={permission.file_permissions.attachment ? 'default' : 'outline'}
                              className="text-xs"
                            >
                              {permission.file_permissions.attachment ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                              附件
                            </Badge>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(permission.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditPermission(permission)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deletePermission(permission.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
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

      {/* 编辑权限对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑权限</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>权限类型</Label>
              <Select value={permissionForm.permission_type} onValueChange={(value: 'view' | 'edit' | 'delete' | 'download' | 'admin') => setPermissionForm(prev => ({ ...prev, permission_type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">查看</SelectItem>
                  <SelectItem value="edit">编辑</SelectItem>
                  <SelectItem value="download">下载</SelectItem>
                  <SelectItem value="delete">删除</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>字段权限</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {Object.entries(permissionForm.field_permissions).map(([field, value]) => (
                  <div key={field} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-${field}`}
                      checked={value}
                      onCheckedChange={(checked) => updateFieldPermission(field, checked as boolean)}
                    />
                    <Label htmlFor={`edit-${field}`} className="text-sm">
                      {field === 'contract_number' ? '合同编号' :
                       field === 'counterparty_company' ? '对方公司' :
                       field === 'our_company' ? '我方公司' :
                       field === 'contract_amount' ? '合同金额' :
                       field === 'start_date' ? '开始日期' :
                       field === 'end_date' ? '结束日期' :
                       field === 'remarks' ? '备注' :
                       field === 'responsible_person' ? '负责人' :
                       field === 'department' ? '部门' :
                       field === 'priority' ? '优先级' :
                       field === 'status' ? '状态' : field}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>文件权限</Label>
              <div className="flex space-x-4 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-original"
                    checked={permissionForm.file_permissions.original}
                    onCheckedChange={(checked) => updateFilePermission('original', checked as boolean)}
                  />
                  <Label htmlFor="edit-original" className="text-sm">合同原件</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-attachment"
                    checked={permissionForm.file_permissions.attachment}
                    onCheckedChange={(checked) => updateFilePermission('attachment', checked as boolean)}
                  />
                  <Label htmlFor="edit-attachment" className="text-sm">合同附件</Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                取消
              </Button>
              <Button onClick={updatePermission}>
                更新权限
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
