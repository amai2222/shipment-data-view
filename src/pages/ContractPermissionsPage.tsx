// 合同权限页面
// 文件: src/pages/ContractPermissionsPage.tsx

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
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Users,
  Shield,
  Building2,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  Upload,
  Archive,
  Tag,
  Hash,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Contract {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ContractPermission {
  id: string;
  contract_id: string;
  user_id: string;
  permission_type: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_export: boolean;
  can_upload_files: boolean;
  can_download_files: boolean;
  can_delete_files: boolean;
  can_manage_permissions: boolean;
  can_view_audit_logs: boolean;
  can_manage_reminders: boolean;
  can_manage_tags: boolean;
  can_manage_numbering: boolean;
  can_view_sensitive_fields: boolean;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

// 合同权限类型
const CONTRACT_PERMISSION_TYPES = {
  owner: { label: '合同所有者', description: '拥有合同的完全控制权' },
  editor: { label: '编辑者', description: '可以编辑合同内容' },
  viewer: { label: '查看者', description: '只能查看合同内容' },
  approver: { label: '审批者', description: '可以审批合同' },
  auditor: { label: '审计者', description: '可以查看审计日志' }
};

// 权限配置
const PERMISSION_CONFIG = [
  {
    id: 'basic',
    name: '基础权限',
    permissions: [
      { id: 'can_view', name: '查看合同', description: '查看合同基本信息' },
      { id: 'can_edit', name: '编辑合同', description: '修改合同内容' },
      { id: 'can_delete', name: '删除合同', description: '删除合同' },
      { id: 'can_approve', name: '审批合同', description: '审批合同状态' },
      { id: 'can_export', name: '导出合同', description: '导出合同数据' }
    ]
  },
  {
    id: 'files',
    name: '文件权限',
    permissions: [
      { id: 'can_upload_files', name: '上传文件', description: '上传合同相关文件' },
      { id: 'can_download_files', name: '下载文件', description: '下载合同文件' },
      { id: 'can_delete_files', name: '删除文件', description: '删除合同文件' }
    ]
  },
  {
    id: 'management',
    name: '管理权限',
    permissions: [
      { id: 'can_manage_permissions', name: '权限管理', description: '管理合同权限' },
      { id: 'can_view_audit_logs', name: '审计日志', description: '查看合同审计日志' },
      { id: 'can_manage_reminders', name: '提醒管理', description: '管理合同提醒' },
      { id: 'can_manage_tags', name: '标签管理', description: '管理合同标签' },
      { id: 'can_manage_numbering', name: '编号管理', description: '管理合同编号' },
      { id: 'can_view_sensitive_fields', name: '敏感字段', description: '查看敏感字段' }
    ]
  }
];

export default function ContractPermissionsPage() {
  const { toast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [contractPermissions, setContractPermissions] = useState<ContractPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Partial<ContractPermission>>({});
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [permissionType, setPermissionType] = useState<string>('viewer');
  const [currentPermissions, setCurrentPermissions] = useState<Record<string, boolean>>({});

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 加载合同
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .order('name');

      if (contractsError) throw contractsError;

      // 加载用户
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name');

      if (usersError) throw usersError;

      // 加载合同权限
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('contract_permissions')
        .select('*');

      if (permissionsError) throw permissionsError;

      setContracts(contractsData || []);
      setUsers(usersData || []);
      setContractPermissions(permissionsData || []);
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

  // 过滤合同
  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contract.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = contractFilter === 'all' || contract.status === contractFilter;
    
    return matchesSearch && matchesFilter;
  });

  // 获取合同的权限
  const getContractPermissions = (contractId: string) => {
    return contractPermissions.filter(cp => cp.contract_id === contractId);
  };

  // 获取用户对合同的权限
  const getUserContractPermission = (contractId: string, userId: string) => {
    return contractPermissions.find(cp => cp.contract_id === contractId && cp.user_id === userId);
  };

  // 打开权限配置对话框
  const openPermissionDialog = (contract: Contract) => {
    setSelectedContract(contract);
    setEditingPermission({});
    setSelectedUsers([]);
    setPermissionType('viewer');
    setCurrentPermissions({});
    setIsDialogOpen(true);
  };

  // 切换权限
  const togglePermission = (permissionId: string) => {
    setCurrentPermissions(prev => ({
      ...prev,
      [permissionId]: !prev[permissionId]
    }));
  };

  // 切换组权限
  const toggleGroupPermissions = (groupId: string) => {
    const group = PERMISSION_CONFIG.find(g => g.id === groupId);
    if (!group) return;

    const groupPermissionIds = group.permissions.map(p => p.id);
    const current = currentPermissions;
    const hasAllPermissions = groupPermissionIds.every(id => current[id]);

    setCurrentPermissions(prev => {
      const newPermissions = { ...prev };
      groupPermissionIds.forEach(id => {
        newPermissions[id] = !hasAllPermissions;
      });
      return newPermissions;
    });
  };

  // 保存权限
  const handleSavePermissions = async () => {
    if (!selectedContract || selectedUsers.length === 0) return;

    try {
      // 删除现有权限
      await supabase
        .from('contract_permissions')
        .delete()
        .eq('contract_id', selectedContract.id)
        .in('user_id', selectedUsers);

      // 创建新权限
      const permissions = selectedUsers.map(userId => ({
        contract_id: selectedContract.id,
        user_id: userId,
        permission_type: permissionType,
        can_view: currentPermissions.can_view || false,
        can_edit: currentPermissions.can_edit || false,
        can_delete: currentPermissions.can_delete || false,
        can_approve: currentPermissions.can_approve || false,
        can_export: currentPermissions.can_export || false,
        can_upload_files: currentPermissions.can_upload_files || false,
        can_download_files: currentPermissions.can_download_files || false,
        can_delete_files: currentPermissions.can_delete_files || false,
        can_manage_permissions: currentPermissions.can_manage_permissions || false,
        can_view_audit_logs: currentPermissions.can_view_audit_logs || false,
        can_manage_reminders: currentPermissions.can_manage_reminders || false,
        can_manage_tags: currentPermissions.can_manage_tags || false,
        can_manage_numbering: currentPermissions.can_manage_numbering || false,
        can_view_sensitive_fields: currentPermissions.can_view_sensitive_fields || false
      }));

      const { error } = await supabase
        .from('contract_permissions')
        .insert(permissions);

      if (error) throw error;

      toast({
        title: "成功",
        description: "合同权限配置已保存",
      });

      setIsDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('保存权限失败:', error);
      toast({
        title: "错误",
        description: `保存权限失败: ${error.message}`,
        variant: "destructive",
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
        title: "成功",
        description: "权限删除成功",
      });

      loadData();
    } catch (error: any) {
      console.error('删除权限失败:', error);
      toast({
        title: "错误",
        description: `删除权限失败: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // 渲染权限组
  const renderPermissionGroup = (group: any) => {
    const groupPermissionIds = group.permissions.map((p: any) => p.id);
    const current = currentPermissions;
    const hasAllPermissions = groupPermissionIds.every((id: string) => current[id]);
    const hasSomePermissions = groupPermissionIds.some((id: string) => current[id]);

    return (
      <Card key={group.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{group.name}</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={hasAllPermissions}
                ref={(el) => {
                  if (el) el.indeterminate = hasSomePermissions && !hasAllPermissions;
                }}
                onCheckedChange={() => toggleGroupPermissions(group.id)}
              />
              <span className="text-sm text-gray-600">
                {groupPermissionIds.filter(id => current[id]).length} / {groupPermissionIds.length}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.permissions.map((permission: any) => (
              <div key={permission.id} className="flex items-center space-x-2">
                <Checkbox
                  id={permission.id}
                  checked={currentPermissions[permission.id] || false}
                  onCheckedChange={() => togglePermission(permission.id)}
                />
                <div className="flex-1">
                  <Label htmlFor={permission.id} className="font-medium">
                    {permission.name}
                  </Label>
                  <p className="text-sm text-gray-600">{permission.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
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
          <h1 className="text-2xl font-bold">合同权限</h1>
          <p className="text-gray-600">管理合同访问权限</p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 搜索和过滤 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="搜索合同..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={contractFilter} onValueChange={setContractFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有状态</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="active">激活</SelectItem>
                <SelectItem value="completed">完成</SelectItem>
                <SelectItem value="archived">归档</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 合同列表 */}
      <div className="space-y-4">
        {filteredContracts.map((contract) => {
          const permissions = getContractPermissions(contract.id);
          const permissionCount = permissions.length;
          
          return (
            <Card key={contract.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{contract.name}</h3>
                      {contract.description && (
                        <p className="text-sm text-gray-600">{contract.description}</p>
                      )}
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant="outline">{contract.status}</Badge>
                        <Badge variant="secondary">
                          {permissionCount} 个权限
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => openPermissionDialog(contract)}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      管理权限
                    </Button>
                  </div>
                </div>
                
                {/* 权限详情 */}
                {permissions.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">当前权限配置:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {permissions.map((permission) => {
                        const user = users.find(u => u.id === permission.user_id);
                        return (
                          <div key={permission.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium">{user?.full_name}</span>
                              <Badge variant="outline" className="text-xs">
                                {CONTRACT_PERMISSION_TYPES[permission.permission_type as keyof typeof CONTRACT_PERMISSION_TYPES]?.label || permission.permission_type}
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeletePermission(permission.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 权限配置对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              合同权限配置 - {selectedContract?.name}
            </DialogTitle>
            <DialogDescription>
              为用户配置合同访问权限
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* 用户选择 */}
            <div>
              <Label className="text-base font-medium">选择用户</Label>
              <div className="mt-2 max-h-32 overflow-y-auto space-y-2">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={user.id}
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUsers(prev => [...prev, user.id]);
                        } else {
                          setSelectedUsers(prev => prev.filter(id => id !== user.id));
                        }
                      }}
                    />
                    <Label htmlFor={user.id} className="flex-1">
                      <div className="flex items-center justify-between">
                        <span>{user.full_name}</span>
                        <Badge variant="outline" className="text-xs">{user.role}</Badge>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* 权限类型 */}
            <div>
              <Label className="text-base font-medium">权限类型</Label>
              <Select value={permissionType} onValueChange={setPermissionType}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="选择权限类型" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_PERMISSION_TYPES).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      <div>
                        <div className="font-medium">{value.label}</div>
                        <div className="text-sm text-gray-600">{value.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 详细权限配置 */}
            <div>
              <Label className="text-base font-medium">详细权限</Label>
              <div className="mt-2 space-y-4">
                {PERMISSION_CONFIG.map(group => renderPermissionGroup(group))}
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSavePermissions}>
                <Save className="h-4 w-4 mr-2" />
                保存权限
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
