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
      if (!isInWorkWechat()) {
        toast.error('请在企业微信中打开此应用');
        return;
      }

      // 获取企业微信授权码
      const code = new URLSearchParams(window.location.search).get('code');
      
      if (!code) {
        // 重定向到企业微信授权页面
        const redirectUri = encodeURIComponent(window.location.href);
        const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&agentid=${agentId}&state=STATE#wechat_redirect`;
        window.location.href = authUrl;
        return;
      }

      toast.info('正在验证企业微信身份...');

      // 调用后端认证接口
      const { data, error } = await supabase.functions.invoke('work-wechat-auth', {
        body: {
          code,
          corpId,
          agentId
        }
      });

      if (error) {
        console.error('企业微信认证失败:', error);
        toast.error('企业微信认证失败');
        return;
      }

      if (data.success && data.auth_url) {
        toast.success('企业微信认证成功，正在登录...');
        // 重定向到Supabase认证URL完成登录
        window.location.href = data.auth_url;
      } else {
        toast.error('企业微信认证失败');
      }

    } catch (error) {
      console.error('企业微信认证错误:', error);
      toast.error('企业微信认证失败');
    }
  };

  // 在企业微信环境中自动触发认证
  useEffect(() => {
    if (isInWorkWechat() && !user) {
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        handleWorkWechatAuth();
      }
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
        {isInWorkWechat() ? (
          <Button 
            onClick={handleWorkWechatAuth}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
          >
            企业微信授权登录
          </Button>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              请在企业微信中打开此应用
            </p>
            <Button 
              onClick={() => {
                // 生成企业微信应用链接
                const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
                const workWechatUrl = `wxwork://message/?username=${corpId}&url=${encodeURIComponent(appUrl)}`;
                window.location.href = workWechatUrl;
              }}
              variant="outline"
              className="w-full"
            >
              在企业微信中打开
            </Button>
          </div>
        )}
        
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