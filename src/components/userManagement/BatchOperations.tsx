// 批量操作组件

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Users, UserCheck, UserX, Trash2 } from 'lucide-react';
import { AppRole } from '@/types/userManagement';
import { ROLES } from '@/config/permissionsNew';

interface BatchOperationsProps {
  selectedUsers: string[];
  onBatchUpdateRoles: (userIds: string[], role: AppRole) => Promise<any>;
  onBatchUpdateStatus: (userIds: string[], isActive: boolean) => Promise<any>;
  onBatchDeleteUsers: (userIds: string[]) => Promise<any>;
  loading?: boolean;
}

export function BatchOperations({ 
  selectedUsers, 
  onBatchUpdateRoles, 
  onBatchUpdateStatus, 
  onBatchDeleteUsers,
  loading = false 
}: BatchOperationsProps) {
  const [batchRole, setBatchRole] = useState<AppRole | ''>('');
  const [operating, setOperating] = useState(false);

  if (selectedUsers.length === 0) {
    return null;
  }

  const handleBatchUpdateRoles = async () => {
    if (!batchRole) return;
    
    try {
      setOperating(true);
      await onBatchUpdateRoles(selectedUsers, batchRole);
    } finally {
      setOperating(false);
    }
  };

  const handleBatchUpdateStatus = async (isActive: boolean) => {
    try {
      setOperating(true);
      await onBatchUpdateStatus(selectedUsers, isActive);
    } finally {
      setOperating(false);
    }
  };

  const handleBatchDeleteUsers = async () => {
    try {
      setOperating(true);
      await onBatchDeleteUsers(selectedUsers);
    } finally {
      setOperating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="h-5 w-5 mr-2" />
          批量操作
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            已选择 {selectedUsers.length} 个用户
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 批量更新角色 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">批量更新角色</label>
            <div className="flex space-x-2">
              <Select value={batchRole} onValueChange={(value) => setBatchRole(value as AppRole)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLES).map(([key, role]) => (
                    <SelectItem key={key} value={key}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleBatchUpdateRoles}
                disabled={!batchRole || loading || operating}
                size="sm"
              >
                {operating ? '更新中...' : '更新'}
              </Button>
            </div>
          </div>

          {/* 批量启用/禁用 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">批量状态操作</label>
            <div className="flex space-x-2">
              <Button 
                onClick={() => handleBatchUpdateStatus(true)}
                disabled={loading || operating}
                size="sm"
                className="flex-1"
              >
                <UserCheck className="h-4 w-4 mr-2" />
                启用
              </Button>
              <Button 
                onClick={() => handleBatchUpdateStatus(false)}
                disabled={loading || operating}
                size="sm"
                className="flex-1"
              >
                <UserX className="h-4 w-4 mr-2" />
                禁用
              </Button>
            </div>
          </div>

          {/* 批量删除 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">批量删除</label>
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  disabled={loading || operating}
                  size="sm"
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除用户
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                    确认批量删除用户
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    您即将删除 {selectedUsers.length} 个用户，此操作不可撤销。
                  </p>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" size="sm">
                      取消
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleBatchDeleteUsers}
                      disabled={operating}
                    >
                      {operating ? '删除中...' : '确认删除'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
