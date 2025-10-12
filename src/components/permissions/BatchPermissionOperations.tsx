// 批量权限操作组件

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  CheckSquare, 
  Square, 
  UserX, 
  UserCheck,
  Trash2,
  Settings,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ROLES } from '@/config/permissions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface BatchPermissionOperationsProps {
  users: any[];
  projects: any[];
  onDataChange: () => void;
}

export function BatchPermissionOperations({ users, projects, onDataChange }: BatchPermissionOperationsProps) {
  const { toast } = useToast();
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [batchOperation, setBatchOperation] = useState('');
  const [batchRole, setBatchRole] = useState('');
  const [batchProject, setBatchProject] = useState('');
  const [loading, setLoading] = useState(false);

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(users.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  // 切换单个用户选择
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // 批量分配角色
  const handleBatchRoleAssign = async () => {
    if (selectedUsers.length === 0 || !batchRole) {
      toast({
        title: "错误",
        description: "请选择用户和角色",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({ role: batchRole as any })
        .in('id', selectedUsers);

      if (error) throw error;

      toast({
        title: "成功",
        description: `已为 ${selectedUsers.length} 个用户分配角色`,
      });

      onDataChange();
      setSelectedUsers([]);
      setBatchRole('');
    } catch (error) {
      console.error('批量角色分配失败:', error);
      toast({
        title: "错误",
        description: "批量角色分配失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 批量启用/禁用用户
  const handleBatchStatusChange = async (isActive: boolean) => {
    if (selectedUsers.length === 0) {
      toast({
        title: "错误",
        description: "请选择用户",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .in('id', selectedUsers);

      if (error) throw error;

      toast({
        title: "成功",
        description: `已${isActive ? '启用' : '禁用'} ${selectedUsers.length} 个用户`,
      });

      onDataChange();
      setSelectedUsers([]);
    } catch (error) {
      console.error('批量状态更新失败:', error);
      toast({
        title: "错误",
        description: "批量状态更新失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 批量删除用户权限
  const handleBatchDeletePermissions = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: "错误",
        description: "请选择用户",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('user_permissions')
        .delete()
        .in('user_id', selectedUsers);

      if (error) throw error;

      toast({
        title: "成功",
        description: `已删除 ${selectedUsers.length} 个用户的自定义权限`,
      });

      onDataChange();
      setSelectedUsers([]);
    } catch (error) {
      console.error('批量删除权限失败:', error);
      toast({
        title: "错误",
        description: "批量删除权限失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const allSelected = users.length > 0 && selectedUsers.length === users.length;
  const someSelected = selectedUsers.length > 0 && selectedUsers.length < users.length;

  return (
    <div className="space-y-6">
      {/* 批量操作控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            批量操作控制面板
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 选择统计 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm">
                已选择 {selectedUsers.length} / {users.length} 个用户
              </span>
            </div>
            
            {selectedUsers.length > 0 && (
              <Badge variant="secondary">
                {selectedUsers.length} 个用户待操作
              </Badge>
            )}
          </div>

          {/* 批量操作按钮组 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 批量角色分配 */}
            <div className="space-y-2">
              <Select value={batchRole} onValueChange={setBatchRole}>
                <SelectTrigger>
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLES).map(([key, role]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full ${role.color} mr-2`} />
                        {role.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleBatchRoleAssign}
                disabled={loading || selectedUsers.length === 0 || !batchRole}
                size="sm"
                className="w-full"
              >
                <Users className="h-4 w-4 mr-2" />
                批量分配角色
              </Button>
            </div>

            {/* 批量启用 */}
            <Button 
              onClick={() => handleBatchStatusChange(true)}
              disabled={loading || selectedUsers.length === 0}
              variant="outline"
              size="sm"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              批量启用
            </Button>

            {/* 批量禁用 */}
            <Button 
              onClick={() => handleBatchStatusChange(false)}
              disabled={loading || selectedUsers.length === 0}
              variant="outline"
              size="sm"
            >
              <UserX className="h-4 w-4 mr-2" />
              批量禁用
            </Button>

            {/* 批量删除权限 */}
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  disabled={selectedUsers.length === 0}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除权限
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                    确认删除权限
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    您即将删除 {selectedUsers.length} 个用户的自定义权限配置。
                    此操作不可撤销，这些用户将恢复为其角色的默认权限。
                  </p>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" size="sm">
                      取消
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleBatchDeletePermissions}
                      disabled={loading}
                    >
                      确认删除
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* 用户列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            用户列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {users.map(user => (
              <div 
                key={user.id} 
                className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                  selectedUsers.includes(user.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={() => toggleUserSelection(user.id)}
                  />
                  
                  <div>
                    <p className="text-sm font-medium">{user.full_name || user.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge 
                        variant="outline" 
                        className={ROLES[user.role]?.color || 'bg-gray-500'}
                      >
                        {ROLES[user.role]?.label || user.role}
                      </Badge>
                      <Badge 
                        variant={user.is_active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {user.is_active ? "活跃" : "禁用"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  ID: {user.id.slice(0, 8)}...
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}