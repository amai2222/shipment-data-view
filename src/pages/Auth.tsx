// src/pages/Auth.tsx

import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Lock, Truck, AlertCircle } from 'lucide-react';
import { WorkWechatAuth } from '@/components/WorkWechatAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Auth() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { session, signIn } = useAuth(); // 使用 session 判断登录状态
  const location = useLocation();

  const isInWorkWechat = /wxwork/i.test(navigator.userAgent);

  // 如果已经登录，重定向到目标页面
  if (session) {
    const from = location.state?.from?.pathname || '/home';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!usernameOrEmail.trim() || !password.trim()) {
      setError('请输入用户名/邮箱和密码');
      return;
    }

    setIsLoading(true);
    
    try {
      // 假设您的 signIn 返回 { error: string | null }
      const result = await signIn(usernameOrEmail, password);
      if (result && result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError('登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== 核心修改逻辑在这里 ====================
  // 如果在企业微信环境中，则只显示企微认证组件和加载提示
  if (isInWorkWechat) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-gray-600">企业微信自动登录中...</p>
        {/* WorkWechatAuth 组件将在这里处理所有自动跳转和回调逻辑 */}
        <div className="opacity-0 absolute">
          <WorkWechatAuth />
        </div>
      </div>
    );
  }
  // ==========================================================

  // 在非企业微信环境中，显示完整的登录页面
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-full">
              <Truck className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">物流业务跟踪系统</h1>
          <p className="text-gray-600 mt-2">请选择登录方式</p>
        </div>

        <Tabs defaultValue="password" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="wechat">企业微信</TabsTrigger>
            <TabsTrigger value="password">用户名/密码</TabsTrigger>
          </TabsList>
          
          <TabsContent value="wechat" className="mt-6">
            <WorkWechatAuth />
          </TabsContent>
          
          <TabsContent value="password" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-center">系统登录</CardTitle>
                <CardDescription className="text-center">
                  请输入您的用户名或邮箱和密码
                </CardDescription>
              </Header>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="usernameOrEmail">用户名/邮箱</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="usernameOrEmail"
                        type="text"
                        placeholder="请输入用户名或邮箱"
                        value={usernameOrEmail}
                        onChange={(e) => setUsernameOrEmail(e.target.value)}
                        className="pl-10"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">密码</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="请输入密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />登录中...</>) : ('登录')}
                  </Button>
                </form>
                
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">初始管理员账号（测试用）</h3>
                  <div className="space-y-1 text-sm text-blue-800">
                    <p><strong>用户名:</strong> admin</p>
                    <p><strong>密码:</strong> admin123</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
