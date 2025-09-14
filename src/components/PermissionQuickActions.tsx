import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { 
  Zap, 
  Copy, 
  RotateCcw, 
  Shield, 
  Users, 
  Settings, 
  Plus,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PermissionQuickActionsProps {
  hasChanges: boolean;
  onSave: () => void;
  onReload: () => void;
  users: Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
  }>;
  selectedUsers: string[];
  onBulkPermissionUpdate: (action: string, data: any) => void;
  onCopyPermissions: (fromUserId: string, toUserIds: string[]) => void;
  onResetToRole: (userIds: string[]) => void;
}

// 预设权限模板
const permissionTemplates = {
  'admin': {
    name: '管理员权限',
    description: '拥有所有菜单和功能权限',
    icon: Shield,
    color: 'bg-red-100 text-red-800'
  },
  'finance': {
    name: '财务权限',
    description: '财务相关菜单和功能',
    icon: Settings,
    color: 'bg-blue-100 text-blue-800'
  },
  'business': {
    name: '业务权限',
    description: '业务操作相关权限',
    icon: Users,
    color: 'bg-green-100 text-green-800'
  },
  'operator': {
    name: '操作员权限',
    description: '基础操作权限',
    icon: Settings,
    color: 'bg-yellow-100 text-yellow-800'
  },
  'partner': {
    name: '合作伙伴权限',
    description: '合作伙伴专用权限',
    icon: Users,
    color: 'bg-purple-100 text-purple-800'
  },
  'viewer': {
    name: '查看者权限',
    description: '只读权限',
    icon: Settings,
    color: 'bg-gray-100 text-gray-800'
  }
};

export function PermissionQuickActions({ 
  hasChanges,
  onSave,
  onReload,
  users,
  selectedUsers, 
  onBulkPermissionUpdate, 
  onCopyPermissions, 
  onResetToRole 
}: PermissionQuickActionsProps) {
  const { toast } = useToast();
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  
  const [bulkAction, setBulkAction] = useState('');
  const [bulkRole, setBulkRole] = useState('');
  const [copyFromUser, setCopyFromUser] = useState('');
  const [templateRole, setTemplateRole] = useState('');

  const selectedCount = selectedUsers.length;

  // 批量操作处理
  const handleBulkAction = () => {
    if (!bulkAction || selectedCount === 0) return;

    switch (bulkAction) {
      case 'change-role':
        if (bulkRole) {
          onBulkPermissionUpdate('change-role', { role: bulkRole });
          toast({
            title: "批量更新成功",
            description: `已将 ${selectedCount} 个用户的角色更新为 ${bulkRole}`,
          });
        }
        break;
      case 'reset-permissions':
        onResetToRole(selectedUsers);
        toast({
          title: "权限重置成功",
          description: `已将 ${selectedCount} 个用户的权限重置为角色默认权限`,
        });
        break;
      case 'apply-template':
        if (templateRole) {
          onBulkPermissionUpdate('apply-template', { template: templateRole });
          toast({
            title: "模板应用成功",
            description: `已将 ${templateRole} 权限模板应用到 ${selectedCount} 个用户`,
          });
        }
        break;
    }

    setShowBulkDialog(false);
    setBulkAction('');
    setBulkRole('');
    setTemplateRole('');
  };

  // 复制权限处理
  const handleCopyPermissions = () => {
    if (!copyFromUser || selectedCount === 0) return;

    onCopyPermissions(copyFromUser, selectedUsers);
    toast({
      title: "权限复制成功",
      description: `已将用户权限复制到 ${selectedCount} 个用户`,
    });

    setShowCopyDialog(false);
    setCopyFromUser('');
  };

  // 快速操作按钮
  const quickActionButtons = [
    {
      id: 'change-role',
      label: '批量改角色',
      icon: Users,
      color: 'bg-blue-500 hover:bg-blue-600',
      disabled: selectedCount === 0
    },
    {
      id: 'reset-permissions',
      label: '重置权限',
      icon: RotateCcw,
      color: 'bg-orange-500 hover:bg-orange-600',
      disabled: selectedCount === 0
    },
    {
      id: 'copy-permissions',
      label: '复制权限',
      icon: Copy,
      color: 'bg-green-500 hover:bg-green-600',
      disabled: selectedCount === 0
    },
    {
      id: 'apply-template',
      label: '应用模板',
      icon: Shield,
      color: 'bg-purple-500 hover:bg-purple-600',
      disabled: selectedCount === 0
    }
  ];

  return (
    <div className="space-y-4">
      {/* 快速操作卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            快速操作
          </CardTitle>
          <CardDescription>
            批量管理用户权限，提高操作效率
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActionButtons.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                className={`h-auto p-4 flex flex-col items-center gap-2 ${action.color} text-white border-0`}
                disabled={action.disabled}
                onClick={() => {
                  switch (action.id) {
                    case 'change-role':
                    case 'apply-template':
                    case 'reset-permissions':
                      setBulkAction(action.id);
                      setShowBulkDialog(true);
                      break;
                    case 'copy-permissions':
                      setShowCopyDialog(true);
                      break;
                  }
                }}
              >
                <action.icon className="h-5 w-5" />
                <span className="text-sm font-medium">{action.label}</span>
                {selectedCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedCount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 权限模板展示 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            权限模板
          </CardTitle>
          <CardDescription>
            预设的权限配置模板，可快速应用到用户
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(permissionTemplates).map(([role, template]) => {
              const Icon = template.icon;
              return (
                <div key={role} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="h-5 w-5 text-gray-600" />
                    <div>
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-gray-500">{template.description}</p>
                    </div>
                  </div>
                  <Badge className={template.color}>
                    {role}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 批量操作对话框 */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量操作</DialogTitle>
            <DialogDescription>
              对选中的 {selectedCount} 个用户执行批量操作
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {bulkAction === 'change-role' && (
              <div>
                <Label htmlFor="role-select">选择新角色</Label>
                <Select value={bulkRole} onValueChange={setBulkRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择角色" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(permissionTemplates).map(([role, template]) => (
                      <SelectItem key={role} value={role}>
                        <div className="flex items-center gap-2">
                          <Badge className={template.color}>{role}</Badge>
                          <span>{template.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {bulkAction === 'apply-template' && (
              <div>
                <Label htmlFor="template-select">选择权限模板</Label>
                <Select value={templateRole} onValueChange={setTemplateRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择模板" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(permissionTemplates).map(([role, template]) => (
                      <SelectItem key={role} value={role}>
                        <div className="flex items-center gap-2">
                          <Badge className={template.color}>{role}</Badge>
                          <span>{template.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {bulkAction === 'reset-permissions' && (
              <div className="flex items-center gap-2 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-orange-800">确认重置权限</p>
                  <p className="text-sm text-orange-600">
                    这将把选中用户的权限重置为角色默认权限，自定义权限将被清除。
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
                取消
              </Button>
              <Button 
                onClick={handleBulkAction}
                disabled={
                  (bulkAction === 'change-role' && !bulkRole) ||
                  (bulkAction === 'apply-template' && !templateRole)
                }
              >
                确认执行
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 复制权限对话框 */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>复制权限</DialogTitle>
            <DialogDescription>
              从其他用户复制权限到选中的 {selectedCount} 个用户
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="copy-from">选择源用户</Label>
              <Select value={copyFromUser} onValueChange={setCopyFromUser}>
                <SelectTrigger>
                  <SelectValue placeholder="选择要复制权限的用户" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter(user => !selectedUsers.includes(user.id))
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <span>{user.full_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {user.role}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-800">权限复制说明</p>
                <p className="text-sm text-blue-600">
                  将复制源用户的所有自定义权限设置，包括菜单权限、功能权限等。
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
                取消
              </Button>
              <Button 
                onClick={handleCopyPermissions}
                disabled={!copyFromUser}
              >
                确认复制
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
