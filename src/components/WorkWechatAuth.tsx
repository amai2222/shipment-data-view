// src/components/WorkWechatAuth.tsx

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function WorkWechatAuth() {
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(false); // 增加一个加载状态

  const corpId = import.meta.env.VITE_WECOM_CORP_ID;
  const agentId = import.meta.env.VITE_WECOM_AGENT_ID;

  // 核心认证逻辑，包含跳转、回调处理
  const handleWorkWechatAuth = async () => {
    setIsLoading(true);
    try {
      const code = new URLSearchParams(window.location.search).get('code');
      const source = new URLSearchParams(window.location.search).get('source');

      // 如果有 code 并且 source 正确，说明是回调，直接处理
      if (code && source === 'work_wechat') {
        toast.info('正在验证企业微信身份...');
        console.log('准备调用后端认证:', { code, corpId, agentId });

        const { data, error } = await supabase.functions.invoke('work-wechat-auth', {
          body: { code, corpId, agentId }
        });

        console.log('后端认证响应:', { data, error });

        if (error || (data && data.error)) {
          const errorMsg = error?.message || data?.error || '未知错误';
          console.error('企业微信认证失败:', errorMsg);
          toast.error(`企业微信认证失败: ${errorMsg}`);
          window.history.replaceState({}, '', '/auth'); // 清理URL，防止循环
          setIsLoading(false);
          return;
        }

        if (data.action_link) {
          toast.success('企业微信认证成功，正在登录...');
          console.log('认证成功，跳转到魔法链接:', data.action_link);
          // 重定向到Supabase认证URL完成登录
          window.location.href = data.action_link;
        } else {
          toast.error(`企业微信认证失败: 认证响应异常`);
          window.history.replaceState({}, '', '/auth');
          setIsLoading(false);
        }
      } else {
        // 如果没有 code，说明是首次进入，需要跳转到企业微信授权
        const redirectUri = encodeURIComponent(window.location.origin + '/auth?source=work_wechat');
        const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&agentid=${agentId}&state=AUTH#wechat_redirect`;
        console.log('跳转到企业微信授权页面:', authUrl);
        window.location.href = authUrl;
      }
    } catch (error: any) {
      console.error('企业微信认证流程出错:', error);
      toast.error(`企业微信认证失败: ${error.message || '网络连接错误'}`);
      window.history.replaceState({}, '', '/auth');
      setIsLoading(false);
    }
  };

  // 自动执行认证逻辑的 useEffect
  useEffect(() => {
    // 只有在未登录时才执行自动认证
    if (!session) {
      handleWorkWechatAuth();
    }
  }, [session]); // 依赖 session，确保只在 session 状态明确后执行

  // 这个组件的UI主要是为非企微环境下的手动点击准备的
  return (
    <Card className="w-full max-w-md mx-auto border-0 shadow-none">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">企业微信登录</CardTitle>
        <CardDescription>
          使用企业微信账号登录系统
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button  
          onClick={handleWorkWechatAuth}
          className="w-full bg-green-600 hover:bg-green-700"
          size="lg"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isLoading ? '处理中...' : '企业微信授权登录'}
        </Button>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            点击按钮将跳转到企业微信进行身份验证
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
