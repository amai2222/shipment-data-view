// 权限变更确认对话框
// 文件: src/components/PermissionChangeConfirmDialog.tsx

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, User, Settings } from 'lucide-react';

interface PermissionChange {
  type: 'user_permission' | 'role_template' | 'user_role' | 'user_status';
  userId?: string;
  userName?: string;
  oldValue?: any;
  newValue?: any;
  description: string;
}

interface PermissionChangeConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  changes: PermissionChange[];
  loading?: boolean;
}

export function PermissionChangeConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  changes,
  loading = false
}: PermissionChangeConfirmDialogProps) {
  
  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'user_permission':
        return <Shield className="h-4 w-4" />;
      case 'role_template':
        return <Settings className="h-4 w-4" />;
      case 'user_role':
        return <User className="h-4 w-4" />;
      case 'user_status':
        return <User className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'user_permission':
        return '用户权限';
      case 'role_template':
        return '角色模板';
      case 'user_role':
        return '用户角色';
      case 'user_status':
        return '用户状态';
      default:
        return '未知变更';
    }
  };

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'user_permission':
        return 'bg-blue-100 text-blue-800';
      case 'role_template':
        return 'bg-purple-100 text-purple-800';
      case 'user_role':
        return 'bg-green-100 text-green-800';
      case 'user_status':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            确认权限变更
          </DialogTitle>
          <DialogDescription>
            您即将进行以下权限变更，这些操作将立即生效。请仔细确认变更内容：
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 变更概览 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">变更概览</CardTitle>
              <CardDescription>
                共 {changes.length} 项变更
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {changes.reduce((acc, change) => {
                  const type = change.type;
                  acc[type] = (acc[type] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {getChangeIcon(type)}
                      <span className="font-medium">{getChangeTypeLabel(type)}</span>
                    </div>
                    <Badge className={getChangeTypeColor(type)}>
                      {count} 项
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 详细变更列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">详细变更</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {changes.map((change, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getChangeIcon(change.type)}
                        <span className="font-medium">{getChangeTypeLabel(change.type)}</span>
                        <Badge className={getChangeTypeColor(change.type)}>
                          {change.type}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      {change.description}
                    </div>

                    {change.userName && (
                      <div className="text-sm text-gray-500">
                        用户: {change.userName}
                      </div>
                    )}

                    {change.oldValue !== undefined && change.newValue !== undefined && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-red-600">原值:</span>
                          <span className="font-mono">{JSON.stringify(change.oldValue)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-green-600">新值:</span>
                          <span className="font-mono">{JSON.stringify(change.newValue)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 影响说明 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                影响说明
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <span>权限变更将立即生效，用户下次登录时会应用新的权限设置</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <span>角色变更会影响用户的所有权限，请确认变更范围</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <span>用户状态变更会立即影响用户的登录和访问权限</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <span>所有变更都会记录在审计日志中</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? '处理中...' : '确认变更'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PermissionChangeConfirmDialog;
