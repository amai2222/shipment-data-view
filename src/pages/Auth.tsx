// src/pages/Auth.tsx

import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// --- 保留您所有的UI组件 ---
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Lock, Truck, AlertCircle } from 'lucide-react';
import { WorkWechatAuth } from '@/components/WorkWechatAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Auth() {
  // --- 保留您原始的 state 和 hooks ---
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { session, signIn } = useAuth(); // 注意这里我从 useAuth 中获取了 session
  const location = useLocation();
  const { toast } = useToast();
  
  // 增加一个专门用于企微自动登录的加载状态，避免影响密码登录
  const [isWechatAuthLoading, setIsWechatAuthLoading] = useState(true);

  // --- 新增的 useEffect，专门处理企业微信自动登录流程 ---
  useEffect(() => {
    const isWorkWechat = /wxwork/i.test(navigator.userAgent);
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    // 状态1: 如果在企微环境、未登录、且URL没有code，则自动跳转授权
    if (isWorkWechat && !session && !code) {
      console.log('企微环境自动登录启动...');
      const corpId = import.meta.env.VITE_WECOM_CORP_ID;
      const agentId = import.meta.env.VITE_WECOM_AGENT_ID;
      if (!corpId || !agentId) {
        console.error("环境变量 VITE_WECOM_CORP_ID 或 VITE_WECOM_AGENT_ID 未设置");
        setIsWechatAuthLoading(false); // 停止加载，显示页面让用户手动点击
        return;
      }
      const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
      const state = Math.random().toString(36).substring(7);
      const oauthUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&agentid=${agentId}&state=${state}#wechat_redirect`;
      window.location.href = oauthUrl;
      return; // 跳转后无需再执行后续逻辑
    }

    // 状态2: 如果URL中有code，说明是从企微授权后返回的，开始处理
    if (code && !session) {
      console.log('检测到code，开始调用后端函数...');
      supabase.functions.invoke('work-wechat-auth', {
        body: { 
          code,
          corpId: import.meta.env.VITE_WECOM_CORP_ID,
          agentId: import.meta.env.VITE_WECOM_AGENT_ID,
        },
      }).then(({ data, error }) => {
        if (error || (data && data.error)) {
          const errorMsg = error?.message || data?.error || '调用认证服务时出错。';
          toast({ title: '认证失败', description: errorMsg, variant: 'destructive' });
          setIsWechatAuthLoading(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (data.action_link) {
          console.log('获取到魔法链接，跳转登录...');
          window.location.href = data.action_link;
        } else {
          toast({ title: '认证失败', description: '未知错误，请联系管理员。', variant: 'destructive' });
          setIsWechatAuthLoading(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      });
      return; // 正在处理code，显示加载动画
    }

    // 所有自动登录条件都不满足，则停止加载
    setIsWechatAuthLoading(false);

  }, [session, toast]);


  // --- 保留您原有的登录后跳转逻辑 ---
  if (session) { // 使用 session 判断
    const from = location.state?.from?.pathname || '/home';
    return <Navigate to={from} replace />;
  }

  // --- 保留您原有的密码登录提交逻辑 ---
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
      if (result.error) {
        setError(result.error);
      }
      // 成功后，session会更新，上面的 if(session) 会自动处理跳转
    } catch (err) {
      setError('登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 在企微自动登录流程中，显示加载界面
  if (isWechatAuthLoading) {
     return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-gray-600">企业微信登录检测中...</p>
      </div>
    );
  }

  // --- 保留您完整的原始 JSX 渲染逻辑 ---
  const isInWorkWechat = () => /wxwork/i.test(navigator.userAgent);

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

        <Tabs defaultValue={isInWorkWechat() ? "wechat" : "password"} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="wechat">企业微信</TabsTrigger>
            <TabsTrigger value="password">用户名/密码</TabsTrigger>
          </TabsList>
          
          <TabsContent value="wechat" className="mt-6">
             {/* 这里的 WorkWechatAuth 主要是为了在非企微浏览器中提供一个“扫码”或“点击”的入口 */}
            <WorkWechatAuth onSuccess={() => {
                // onSuccess 现在可以留空，因为自动流程会处理一切
                // 或者用于处理手动点击后的成功提示
                toast({ title: '请在企业微信中继续操作' });
             }} />
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
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        登录中...
                      </>
                    ) : (
                      '登录'
                    )}
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
