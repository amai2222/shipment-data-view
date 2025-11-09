// 移动端 - 安全设置
// 功能：修改密码

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import {
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Shield
} from 'lucide-react';

export default function MobileSecurity() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleChangePassword = async () => {
    // 验证
    if (!formData.oldPassword || !formData.newPassword || !formData.confirmPassword) {
      toast({ title: '请填写所有字段', variant: 'destructive' });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast({ title: '两次输入的新密码不一致', variant: 'destructive' });
      return;
    }

    if (formData.newPassword.length < 6) {
      toast({ title: '新密码至少6位', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // 调用Supabase修改密码
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword
      });

      if (error) throw error;

      toast({ 
        title: '密码修改成功', 
        description: '请使用新密码登录'
      });
      
      // 清空表单
      setFormData({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
    } catch (error: any) {
      toast({ 
        title: '修改失败', 
        description: error.message || '密码修改失败',
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileLayout>
      <div className="space-y-4 pb-6">
        {/* 头部 */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm sticky top-0 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold flex-1">安全设置</h1>
        </div>

        {/* 修改密码 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <h2 className="font-semibold">修改密码</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>旧密码</Label>
              <div className="relative">
                <Input
                  type={showOldPassword ? 'text' : 'password'}
                  value={formData.oldPassword}
                  onChange={e => setFormData(prev => ({...prev, oldPassword: e.target.value}))}
                  placeholder="输入当前密码"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                >
                  {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label>新密码</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={e => setFormData(prev => ({...prev, newPassword: e.target.value}))}
                  placeholder="输入新密码（至少6位）"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label>确认新密码</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={e => setFormData(prev => ({...prev, confirmPassword: e.target.value}))}
                  placeholder="再次输入新密码"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-blue-800">
                <Shield className="h-4 w-4 inline mr-1" />
                <strong>提示：</strong>密码至少6位，建议包含字母和数字
              </p>
            </div>

            <Button 
              onClick={handleChangePassword} 
              disabled={loading}
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
              修改密码
            </Button>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}

