// 用户创建/编辑对话框组件

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { User, UserCreateData, UserUpdateData, AppRole } from '@/types/userManagement';
import { ROLES } from '@/config/permissionsNew';

interface UserDialogProps {
  user?: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: UserCreateData | UserUpdateData) => Promise<any>;
  loading?: boolean;
}

export function UserDialog({ user, open, onOpenChange, onSave, loading = false }: UserDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'viewer' as AppRole,
    phone: '',
    work_wechat_userid: '',
    password: '',
    confirmPassword: '',
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  const isEdit = !!user;

  // 当用户数据变化时，更新表单
  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone || '',
        work_wechat_userid: user.work_wechat_userid || '',
        password: '',
        confirmPassword: '',
        is_active: user.is_active
      });
    } else {
      setFormData({
        email: '',
        full_name: '',
        role: 'viewer',
        phone: '',
        work_wechat_userid: '',
        password: '',
        confirmPassword: '',
        is_active: true
      });
    }
  }, [user]);

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.full_name) {
      toast({
        title: "错误",
        description: "请填写邮箱和姓名",
        variant: "destructive"
      });
      return;
    }

    if (!isEdit && (!formData.password || formData.password !== formData.confirmPassword)) {
      toast({
        title: "错误",
        description: "密码不匹配",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      
      const submitData = isEdit 
        ? {
            id: user!.id,
            full_name: formData.full_name,
            role: formData.role,
            is_active: formData.is_active,
            phone: formData.phone || undefined,
            work_wechat_userid: formData.work_wechat_userid || undefined,
            password: formData.password || undefined
          } as UserUpdateData
        : {
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
            phone: formData.phone || undefined,
            work_wechat_userid: formData.work_wechat_userid || undefined,
            password: formData.password
          } as UserCreateData;

      const result = await onSave(submitData);
      
      if (result.success) {
        toast({
          title: "成功",
          description: result.message
        });
        onOpenChange(false);
      } else {
        toast({
          title: "错误",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "错误",
        description: `操作失败: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? '编辑用户' : '创建用户'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 邮箱 */}
          <div>
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              disabled={isEdit || loading || saving}
              required
            />
          </div>

          {/* 姓名 */}
          <div>
            <Label htmlFor="full_name">姓名</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              disabled={loading || saving}
              required
            />
          </div>

          {/* 角色 */}
          <div>
            <Label htmlFor="role">角色</Label>
            <Select 
              value={formData.role} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as AppRole }))}
              disabled={loading || saving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLES).map(([key, role]) => (
                  <SelectItem key={key} value={key}>
                      {(role as any).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 手机号 */}
          <div>
            <Label htmlFor="phone">手机号</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              disabled={loading || saving}
            />
          </div>

          {/* 企业微信ID */}
          <div>
            <Label htmlFor="work_wechat_userid">企业微信ID</Label>
            <Input
              id="work_wechat_userid"
              value={formData.work_wechat_userid}
              onChange={(e) => setFormData(prev => ({ ...prev, work_wechat_userid: e.target.value }))}
              disabled={loading || saving}
            />
          </div>

          {/* 密码（仅创建时） */}
          {!isEdit && (
            <>
              <div>
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  disabled={loading || saving}
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">确认密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  disabled={loading || saving}
                  required
                />
              </div>
            </>
          )}

          {/* 密码修改（仅编辑时） */}
          {isEdit && (
            <>
              <div>
                <Label htmlFor="password">新密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  disabled={loading || saving}
                  placeholder="留空表示不修改密码"
                />
              </div>
            </>
          )}

          {/* 账户状态（仅编辑时） */}
          {isEdit && (
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                disabled={loading || saving}
              />
              <Label htmlFor="is_active">启用账户</Label>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading || saving}
            >
              取消
            </Button>
            <Button 
              type="submit" 
              disabled={loading || saving}
            >
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
