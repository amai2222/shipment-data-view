// src/pages/Auth.tsx

import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// --- 您可以保留这些UI组件用于非企微环境 ---
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, Lock, Truck, AlertCircle } from 'lucide-react';
import { WorkWechatAuth } from '@/components/WorkWechatAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';


export default function Auth() {
  const { session } = useAuth(); // 从您的 AuthContext 获取 session
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // 状态1: 自动检测企业微信环境并跳转获取 code
  useEffect(() => {
    // 检查URL中是否已有 code，如果有，则说明已从企微授权返回，无需再次跳转
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    // 如果有错误参数，说明用户可能拒绝了授权
    if (error) {
      toast({
        title: '授权失败',
        description: '您取消了企业微信授权或授权已过期。',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    // 检查是否在企微环境
    const isWorkWechat = /wxwork/i.test(navigator.userAgent);

    // 核心条件：如果 未登录 且 在企微环境 且 URL中没有code，才发起跳转
    if (!session && isWorkWechat && !code) {
      console.log('在企业微信中，且未登录、无code，准备跳转授权...');
      setIsLoading(true); // 显示加载提示
      const corpId = import.meta.env.VITE_WECOM_CORP_ID;
      const agentId = import.meta.env.VITE_WECOM_AGENT_ID;
      const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
      const state = Math.random().toString(36).substring(7);
      const oauthUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&agentid=${agentId}&state=${state}#wechat_redirect`;
      
      // 执行跳转
      window.location.href = oauthUrl;
    } else {
      // 其他情况（已登录、不在企微、已有code），则停止加载，准备进入下一步或显示页面
      setIsLoading(false);
    }
  }, [session, toast]);

  // 状态2: 处理从企业微信回调后URL中的 code
  useEffect(() => {
    const handleWorkWechatCallback = async (code: string) => {
      console.log('检测到 code，正在调用后端函数...');
      setIsLoading(true);

      const { data, error } = await supabase.functions.invoke('work-wechat-auth', {
        body: { 
          code,
          corpId: import.meta.env.VITE_WECOM_CORP_ID,
          agentId: import.meta.env.VITE_WECOM_AGENT_ID,
        },
      });

      if (error || (data && data.error)) {
        const errorMsg = error?.message || data?.error || '调用认证服务时出错。';
        console.error('后端函数调用失败:', errorMsg);
        toast({
          title: '认证失败',
          description: errorMsg,
          variant: 'destructive',
        });
        setIsLoading(false);
        // 清理URL中的code，防止刷新页面时重复触发
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (data.action_link) {
        // 如果成功，后端会返回一个 action_link (魔法链接)
        console.log('后端函数成功，获取到魔法链接，准备跳转...');
        // **必须跳转到这个链接才能完成登录**
        window.location.href = data.action_link;
      } else {
        console.error('认证失败，后端未返回有效的登录链接:', data);
        toast({
          title: '认证失败',
          description: '未知错误，请联系管理员。',
          variant: 'destructive',
        });
        setIsLoading(false);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    // 只有在 未登录 且 URL中带有code 时才执行此逻辑
    if (code && !session) {
      handleWorkWechatCallback(code);
    }
  }, [session, toast]);

  // 如果已经登录，重定向到目标页面
  if (session) {
    const from = location.state?.from?.pathname || '/home';
    return <Navigate to={from} replace />;
  }
  
  // 在自动登录处理期间，显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-gray-600">企业微信登录中，请稍候...</p>
      </div>
    );
  }

  // 如果不在企微环境，或自动登录流程失败，则显示您的原始登录页面
  // 您可以保留这部分UI作为后备方案
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

        <Tabs defaultValue="wechat" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="wechat">企业微信</TabsTrigger>
            <TabsTrigger value="password">用户名/密码</TabsTrigger>
          </TabsList>
          
          <TabsContent value="wechat" className="mt-6 text-center">
             <p className="text-sm text-muted-foreground p-4">请在企业微信客户端中打开此页面以自动登录。</p>
             {/* 这里的 WorkWechatAuth 按钮在自动流程下不会被用户看到 */}
             <WorkWechatAuth onSuccess={() => {}} />
          </TabsContent>
          
          <TabsContent value="password" className="mt-6">
             {/* 您的密码登录表单可以保留在这里 */}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
