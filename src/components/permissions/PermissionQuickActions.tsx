// 权限快速操作组件

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Zap, 
  UserPlus, 
  Shield, 
  Copy, 
  Eye,
  EyeOff,
  Lock,
  Unlock,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ROLES } from '@/config/permissions';

interface PermissionQuickActionsProps {
  users: any[];
  projects: any[];
  onDataChange: () => void;
}

export function PermissionQuickActions({ users, projects, onDataChange }: PermissionQuickActionsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedProject, setSelectedProject] = useState('');

  // 快速分配角色
  const handleQuickRoleAssign = async () => {
    if (!selectedUser || !selectedRole) {
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
        .update({ role: selectedRole as 'admin' | 'finance' | 'business' | 'operator' | 'partner' | 'viewer' })
        .eq('id', selectedUser);

      if (error) throw error;

      toast({
        title: "成功",
        description: "角色分配成功",
      });

      onDataChange();
      setSelectedUser('');
      setSelectedRole('');
    } catch (error) {
      console.error('角色分配失败:', error);
      toast({
        title: "错误",
        description: "角色分配失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 复制权限配置
  const handleCopyPermissions = async () => {
    // 实现权限复制逻辑
    toast({
      title: "提示",
      description: "权限复制功能正在开发中",
    });
  };

  // 启用/禁用用户
  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "成功",
        description: currentStatus ? "用户已禁用" : "用户已启用",
      });

      onDataChange();
    } catch (error) {
      console.error('用户状态更新失败:', error);
      toast({
        title: "错误",
        description: "用户状态更新失败",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 快速操作面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="h-5 w-5 mr-2" />
            快速操作
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 快速分配角色 */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">快速分配角色</h4>
            <div className="flex space-x-2">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="选择用户" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="flex-1">
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
                onClick={handleQuickRoleAssign}
                disabled={loading || !selectedUser || !selectedRole}
                size="sm"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 其他快速操作按钮 */}
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={handleCopyPermissions}>
              <Copy className="h-4 w-4 mr-2" />
              复制权限
            </Button>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Shield className="h-4 w-4 mr-2" />
                  权限审计
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>权限审计</DialogTitle>
                </DialogHeader>
                <div className="p-4">
                  <p className="text-muted-foreground">权限审计功能正在开发中...</p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* 用户状态管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            用户状态管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {users.map(user => (
              <div key={user.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center space-x-3">
                  <div>
                    <p className="text-sm font-medium">{user.full_name || user.email}</p>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className={ROLES[user.role]?.color || 'bg-gray-500'}>
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
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleUserStatus(user.id, user.is_active)}
                >
                  {user.is_active ? (
                    <EyeOff className="h-4 w-4 text-red-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-green-500" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}