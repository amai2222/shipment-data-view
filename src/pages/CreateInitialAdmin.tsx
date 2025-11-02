import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function CreateInitialAdmin() {
  const [email, setEmail] = useState('admin@company.com');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleCreateAdmin = async () => {
    setLoading(true);
    setError('');

    try {
      // 首先创建auth用户
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            username: 'admin',
            full_name: '系统管理员',
            role: 'admin'
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // 创建profile记录
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: email,
            username: 'admin',
            full_name: '系统管理员',
            role: 'admin',
            is_active: true
          });

        if (profileError) throw profileError;

        setSuccess(true);
        toast({
          title: "成功",
          description: "初始管理员账户已创建成功！",
        });
      }
    } catch (error: any) {
      console.error('创建管理员失败:', error);
      setError(error.message || '创建管理员账户时发生错误');
      toast({
        title: "错误",
        description: error.message || '创建管理员账户失败',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              创建成功
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              初始管理员账户已成功创建！
            </p>
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground">登录信息：</p>
              <p className="font-mono text-sm">用户名: admin</p>
              <p className="font-mono text-sm">密码: 123456</p>
            </div>
            <Button
              onClick={() => window.location.href = '/auth'}
              className="w-full"
            >
              前往登录
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            创建初始管理员
          </CardTitle>
          <p className="text-muted-foreground">设置系统的第一个管理员账户</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱地址</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">初始密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="123456"
                disabled={loading}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleCreateAdmin}
              className="w-full"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                '创建管理员账户'
              )}
            </Button>
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>说明：</strong>此操作将创建一个具有完整系统权限的管理员账户。
              创建后，您可以使用 admin/123456 登录系统。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}