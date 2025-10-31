// 用户列表组件

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, Edit, Trash2, UserPlus } from 'lucide-react';
import { User, AppRole } from '@/types/userManagement';
import { ROLES } from '@/config/permissionsNew';

interface UserListProps {
  users: User[];
  selectedUsers: string[];
  onSelectUser: (userId: string) => void;
  onSelectAll: () => void;
  onEditUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onCreateUser: () => void;
  loading?: boolean;
}

export function UserList({ 
  users, 
  selectedUsers, 
  onSelectUser, 
  onSelectAll, 
  onEditUser, 
  onDeleteUser, 
  onCreateUser,
  loading = false 
}: UserListProps) {
  const allSelected = users.length > 0 && selectedUsers.length === users.length;
  const someSelected = selectedUsers.length > 0 && selectedUsers.length < users.length;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">加载中...</div>
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">暂无用户数据</p>
            <Button onClick={onCreateUser}>
              <UserPlus className="h-4 w-4 mr-2" />
              创建用户
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>用户列表</CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              已选择 {selectedUsers.length} / {users.length}
            </Badge>
            <Button onClick={onCreateUser} size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              新增用户
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
                  checked={allSelected}
                  ref={(el) => {
                    if (el && el instanceof HTMLInputElement) {
                      el.indeterminate = someSelected;
                    }
                  }}
                  onCheckedChange={onSelectAll}
                />
              </TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead>企业微信</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={() => onSelectUser(user.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={ROLES[user.role]?.color || 'bg-gray-500'}
                  >
                    {ROLES[user.role]?.label || user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.is_active ? "default" : "secondary"}>
                    {user.is_active ? "启用" : "禁用"}
                  </Badge>
                </TableCell>
                <TableCell>{user.phone || '-'}</TableCell>
                <TableCell>{user.work_wechat_userid || '-'}</TableCell>
                <TableCell>
                  <div className="flex space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditUser(user)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center">
                            <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                            确认删除用户
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            您即将删除用户 "{user.full_name}"，此操作不可撤销。
                          </p>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" size="sm">
                              取消
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => onDeleteUser(user.id)}
                            >
                              确认删除
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
