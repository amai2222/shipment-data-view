// 企业级用户编辑对话框
// 文件: src/components/EnterpriseUserEditDialog.tsx

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  User, 
  Mail, 
  Key, 
  Shield, 
  Building2, 
  Smartphone,
  Save,
  X,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff
} from '@/components/icons-placeholder';
import { UserWithPermissions, UserRole } from '@/types';

interface EnterpriseUserEditDialogProps {
  user: UserWithPermissions | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedUser: UserWithPermissions) => void;
}

interface UserEditForm {
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  phone?: string;
  work_wechat_userid?: string;
  password?: string;
  confirmPassword?: string;
}

export function EnterpriseUserEditDialog({
  user,
  isOpen,
  onClose,
  onSave
}: EnterpriseUserEditDialogProps) {
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<UserEditForm>({
    full_name: '',
    email: '',
    role: 'viewer',
    is_active: true,
    phone: '',
    work_wechat_userid: '',
    password: '',
    confirmPassword: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<UserEditForm | null>(null);

  // 初始化表单数�?
  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        role: user.role || 'viewer',
        is_active: user.is_active ?? true,
        phone: (user as any).phone || '',
        work_wechat_userid: (user as any).work_wechat_userid || '',
        password: '',
        confirmPassword: ''
      });
      setHasChanges(false);
    }
  }, [user, isOpen]);

  // 检测表单变�?
  const handleFormChange = (field: keyof UserEditForm, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // 显示确认对话�?
  const handleSave = () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    // 验证密码
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast({
        title: "密码不匹�?,
        description: "新密码和确认密码不一�?,
        variant: "destructive"
      });
      return;
    }

    setPendingChanges(formData);
    setShowConfirmDialog(true);
  };

  // 确认保存
  const confirmSave = async () => {
    if (!user || !pendingChanges) return;

    try {
      setLoading(true);

      // 更新用户基本信息
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: pendingChanges.full_name,
          email: pendingChanges.email,
          role: pendingChanges.role,
          is_active: pendingChanges.is_active,
          phone: pendingChanges.phone,
          work_wechat_userid: pendingChanges.work_wechat_userid,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 如果修改了密�?
      if (pendingChanges.password) {
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          user.id,
          { password: pendingChanges.password }
        );

        if (passwordError) throw passwordError;
      }

      // 如果修改了邮�?
      if (pendingChanges.email !== user.email) {
        const { error: emailError } = await supabase.auth.admin.updateUserById(
          user.id,
          { email: pendingChanges.email }
        );

        if (emailError) throw emailError;
      }

      toast({
        title: "保存成功",
        description: "用户信息已更�?,
      });

      // 更新本地用户数据
      const updatedUser: UserWithPermissions = {
        ...user,
        full_name: pendingChanges.full_name,
        email: pendingChanges.email,
        role: pendingChanges.role,
        is_active: pendingChanges.is_active,
        phone: pendingChanges.phone,
        work_wechat_userid: pendingChanges.work_wechat_userid
      };

      onSave(updatedUser);
      setShowConfirmDialog(false);
      onClose();
    } catch (error: any) {
      console.error('更新用户失败:', error);
      toast({
        title: "更新失败",
        description: error.message || "更新用户信息失败",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // 取消确认
  const cancelConfirm = () => {
    setShowConfirmDialog(false);
    setPendingChanges(null);
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              编辑用户信息
            </DialogTitle>
            <DialogDescription>
              修改用户的基本信息、角色、企业微信关联等
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">姓名 *</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => handleFormChange('full_name', e.target.value)}
                      placeholder="请输入用户姓�?
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">邮箱 *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                      placeholder="请输入邮箱地址"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">手机�?/Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                    placeholder="请输入手机号"
                  />
                </div>

              </CardContent>
            </Card>

            {/* 角色和状�?*/}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  角色和状�?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">用户角色</Label>
                    <Select value={formData.role} onValueChange={(value) => handleFormChange('role', value as UserRole)}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择角色" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">管理�?/SelectItem>
                        <SelectItem value="operator">操作�?/SelectItem>
                        <SelectItem value="viewer">查看�?/SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="is_active">账户状�?/Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => handleFormChange('is_active', checked)}
                      />
                      <Label htmlFor="is_active">
                        {formData.is_active ? '启用' : '禁用'}
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 企业微信关联 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  企业微信关联
                </CardTitle>
                <CardDescription>
                  关联企业微信账号，实现统一身份认证
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="work_wechat_userid">企业微信ID</Label>
                    <Input
                      id="work_wechat_userid"
                      value={formData.work_wechat_userid}
                      onChange={(e) => handleFormChange('work_wechat_userid', e.target.value)}
                      placeholder="请输入企业微信用户ID"
                    />
                  </div>
                  
                  {formData.work_wechat_userid && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700">
                        已关联企业微信账�?
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 密码修改 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  密码修改
                </CardTitle>
                <CardDescription>
                  留空表示不修改密�?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">新密�?/Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => handleFormChange('password', e.target.value)}
                      placeholder="请输入新密码"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">确认新密�?/Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => handleFormChange('confirmPassword', e.target.value)}
                      placeholder="请再次输入新密码"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? '保存�?..' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 确认对话�?*/}
      <Dialog open={showConfirmDialog} onOpenChange={cancelConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              确认修改用户信息
            </DialogTitle>
            <DialogDescription>
              您即将修改用户信息，此操作将立即生效。请确认是否继续�?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">修改内容�?/h4>
              <ul className="space-y-1 text-sm text-gray-600">
                {pendingChanges?.full_name !== user.full_name && (
                  <li>�?姓名: {user.full_name} �?{pendingChanges?.full_name}</li>
                )}
                {pendingChanges?.email !== user.email && (
                  <li>�?邮箱: {user.email} �?{pendingChanges?.email}</li>
                )}
                {pendingChanges?.role !== user.role && (
                  <li>�?角色: {user.role} �?{pendingChanges?.role}</li>
                )}
                {pendingChanges?.is_active !== user.is_active && (
                  <li>�?状�? {user.is_active ? '启用' : '禁用'} �?{pendingChanges?.is_active ? '启用' : '禁用'}</li>
                )}
                {pendingChanges?.password && (
                  <li>�?密码: 已修�?/li>
                )}
                {pendingChanges?.work_wechat_userid !== (user as any).work_wechat_userid && (
                  <li>�?企业微信ID: {(user as any).work_wechat_userid || '未设�?} �?{pendingChanges?.work_wechat_userid || '未设�?}</li>
                )}
              </ul>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={cancelConfirm}>
              取消
            </Button>
            <Button onClick={confirmSave} disabled={loading}>
              {loading ? '保存�?..' : '确认保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default EnterpriseUserEditDialog;
