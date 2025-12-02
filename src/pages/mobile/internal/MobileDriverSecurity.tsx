// 司机移动端 - 安全设置（修改密码）

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DriverMobileLayout } from '@/components/mobile/DriverMobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MobileDriverSecurity() {
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

  // 密码强度检查
  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, text: '' };
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    const texts = ['', '弱', '中', '较强', '强', '很强'];
    return { strength: Math.min(strength, 5), text: texts[strength] };
  };

  const passwordStrength = getPasswordStrength(formData.newPassword);
  const isPasswordMatch = formData.newPassword && formData.confirmPassword && 
    formData.newPassword === formData.confirmPassword;

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
      
      // 延迟返回上一页
      setTimeout(() => {
        navigate(-1);
      }, 1500);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '密码修改失败';
      toast({ 
        title: '修改失败', 
        description: errorMessage,
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DriverMobileLayout title="修改密码">
      <div className="min-h-screen bg-gray-50/50">
        <div className="px-4 pt-4 pb-6">
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-6 space-y-6">
              {/* 旧密码 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">当前密码</Label>
                <div className="relative">
                  <Input
                    type={showOldPassword ? 'text' : 'password'}
                    value={formData.oldPassword}
                    onChange={e => setFormData(prev => ({...prev, oldPassword: e.target.value}))}
                    placeholder="请输入当前密码"
                    className={cn(
                      "h-12 pr-12 text-base bg-gray-50 border-gray-200 focus:bg-white focus:border-primary transition-colors",
                      formData.oldPassword && "bg-white border-primary/50"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    {showOldPassword ? (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              {/* 新密码 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">新密码</Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={formData.newPassword}
                    onChange={e => setFormData(prev => ({...prev, newPassword: e.target.value}))}
                    placeholder="请输入新密码（至少6位）"
                    className={cn(
                      "h-12 pr-12 text-base bg-gray-50 border-gray-200 focus:bg-white focus:border-primary transition-colors",
                      formData.newPassword && "bg-white border-primary/50"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                {/* 密码强度指示器 */}
                {formData.newPassword && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-300",
                            passwordStrength.strength <= 1 && "bg-red-500 w-1/3",
                            passwordStrength.strength === 2 && "bg-orange-500 w-2/3",
                            passwordStrength.strength >= 3 && "bg-green-500 w-full"
                          )}
                        />
                      </div>
                      {passwordStrength.text && (
                        <span className={cn(
                          "text-xs font-medium",
                          passwordStrength.strength <= 1 && "text-red-600",
                          passwordStrength.strength === 2 && "text-orange-600",
                          passwordStrength.strength >= 3 && "text-green-600"
                        )}>
                          {passwordStrength.text}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 确认新密码 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">确认新密码</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={e => setFormData(prev => ({...prev, confirmPassword: e.target.value}))}
                    placeholder="请再次输入新密码"
                    className={cn(
                      "h-12 pr-12 text-base bg-gray-50 border-gray-200 focus:bg-white focus:border-primary transition-colors",
                      formData.confirmPassword && "bg-white",
                      isPasswordMatch && "border-green-500",
                      formData.confirmPassword && !isPasswordMatch && "border-red-500"
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {formData.confirmPassword && isPasswordMatch && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Eye className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                {formData.confirmPassword && !isPasswordMatch && (
                  <p className="text-xs text-red-600">两次输入的密码不一致</p>
                )}
              </div>

              {/* 提示信息 */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium text-blue-900">密码安全提示</p>
                    <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                      <li>密码长度至少6位，建议8位以上</li>
                      <li>建议包含大小写字母、数字和特殊字符</li>
                      <li>避免使用生日、姓名等容易被猜到的密码</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 提交按钮 */}
              <Button 
                onClick={handleChangePassword} 
                disabled={loading || !formData.oldPassword || !formData.newPassword || !isPasswordMatch}
                className={cn(
                  "w-full h-12 text-base font-semibold rounded-lg",
                  "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "shadow-lg shadow-blue-500/25"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    修改中...
                  </>
                ) : (
                  <>
                    <Lock className="h-5 w-5 mr-2" />
                    确认修改
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DriverMobileLayout>
  );
}

