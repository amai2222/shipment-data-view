import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

declare global {
  interface Window {
    wx: {
      agentConfig: (config: any) => void;
      ready: (callback: () => void) => void;
      error: (callback: (res: any) => void) => void;
    };
  }
}

interface WorkWechatAuthProps {
  onSuccess?: () => void;
}

export function WorkWechatAuth({ onSuccess }: WorkWechatAuthProps) {
  const { user } = useAuth();
  const corpId = import.meta.env.VITE_WORK_WECHAT_CORPID;
  const agentId = import.meta.env.VITE_WORK_WECHAT_AGENTID;

  // 检测是否在企业微信环境中
  const isInWorkWechat = () => {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('wxwork');
  };

  useEffect(() => {
    // 如果用户已登录，则跳转
    if (user && onSuccess) {
      onSuccess();
    }
  }, [user, onSuccess]);

  // 企业微信认证
  const handleWorkWechatAuth = async () => {
    try {
      // 获取企业微信授权码
      const code = new URLSearchParams(window.location.search).get('code');
      
      console.log('当前URL:', window.location.href);
      console.log('获取到的code:', code);
      
      if (!code) {
        // 重定向到企业微信授权页面
        const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
        const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&agentid=${agentId}&state=AUTH#wechat_redirect`;
        console.log('跳转到企业微信授权页面:', authUrl);
        window.location.href = authUrl;
        return;
      }

      toast.info('正在验证企业微信身份...');

      console.log('准备调用后端认证:', { code, corpId, agentId });

      // 调用后端认证接口
      const { data, error } = await supabase.functions.invoke('work-wechat-auth', {
        body: {
          code,
          corpId,
          agentId
        }
      });

      console.log('后端认证响应:', { data, error });

      if (error) {
        console.error('企业微信认证失败:', error);
        toast.error(`企业微信认证失败: ${error.message || '网络错误'}`);
        return;
      }

      if (data?.success && data?.auth_url) {
        toast.success('企业微信认证成功，正在登录...');
        console.log('认证成功，跳转到:', data.auth_url);
        // 重定向到Supabase认证URL完成登录
        window.location.href = data.auth_url;
      } else {
        console.error('认证响应异常:', data);
        toast.error(`企业微信认证失败: ${data?.error || '未知错误'}`);
      }

    } catch (error) {
      console.error('企业微信认证错误:', error);
      toast.error(`企业微信认证失败: ${error.message || '网络连接错误'}`);
    }
  };

  // 在企业微信环境中自动触发认证或检测URL中的code
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code && !user) {
      handleWorkWechatAuth();
    }
  }, []);

  return (
    <Card className="w-full max-w-md mx-auto">
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
        >
          企业微信授权登录
        </Button>
        
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            点击按钮将跳转到企业微信进行身份验证
          </p>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            企业ID: {corpId}
          </p>
          <p className="text-sm text-muted-foreground">
            应用ID: {agentId}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}