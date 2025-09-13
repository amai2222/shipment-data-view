import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

declare global {
  interface Window {
    wx: {
      agentConfig: (config: {
        corpid: string;
        agentid: string;
        timestamp: number;
        nonceStr: string;
        signature: string;
        jsApiList: string[];
      }) => void;
      ready: (callback: () => void) => void;
      error: (callback: (res: { errMsg: string }) => void) => void;
    };
  }
}

interface WorkWechatAuthProps {
  onSuccess?: () => void;
}

export function WorkWechatAuth({ onSuccess }: WorkWechatAuthProps) {
  const { user } = useAuth();
  const corpId = "ww074db5e6770417d9";
  const agentId = "1000002";
  
  // 创建一个 ref 来防止重复执行认证逻辑
  const isProcessingAuth = useRef(false);

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
        const redirectUri = encodeURIComponent(window.location.origin + '/auth?source=work_wechat');
        const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&agentid=${agentId}&state=AUTH#wechat_redirect`;
        console.log('跳转到企业微信授权页面:', authUrl);
        window.location.href = authUrl;
        return;
      }

      // 检查是否是企业微信回调
      const source = new URLSearchParams(window.location.search).get('source');
      if (source === 'work_wechat' && code) {
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
          // 清除URL参数，避免重复尝试
          window.history.replaceState({}, '', '/auth');
          return;
        }

        if (data?.success) {
          toast.success('企业微信认证成功，正在登录...');
          console.log('认证成功，返回数据:', data);
          
          // 添加详细的数据结构日志
          console.log('数据结构检查 - 完整数据:', JSON.stringify(data, null, 2));
          console.log('数据结构检查 - auth_url:', data.auth_url);
          console.log('数据结构检查 - session:', data.session);
          console.log('数据结构检查 - access_token:', data.access_token);
          console.log('数据结构检查 - action_link:', data.action_link);
          
          // 检查是否有 auth_url 或 action_link (Magic Link)
          const authUrl = data.auth_url || data.action_link;
          if (authUrl) {
            console.log('使用 Magic Link 登录:', authUrl);
            window.location.href = authUrl;
          } else if (data.session && data.session.access_token) {
            // 如果有会话数据，直接设置会话
            console.log('设置用户会话，access_token:', data.session.access_token);
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            });
            
            if (sessionError) {
              console.error('设置会话失败:', sessionError);
              toast.error('登录失败，请重试');
            } else {
              toast.success('登录成功！');
              // 清除URL参数并跳转
              window.history.replaceState({}, '', '/');
              if (onSuccess) onSuccess();
            }
          } else if (data.access_token) {
            // 兼容直接返回 access_token 的情况
            console.log('直接设置会话，access_token:', data.access_token);
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: data.access_token,
              refresh_token: data.refresh_token,
            });
            
            if (sessionError) {
              console.error('设置会话失败:', sessionError);
              toast.error('登录失败，请重试');
            } else {
              toast.success('登录成功！');
              // 清除URL参数并跳转
              window.history.replaceState({}, '', '/');
              if (onSuccess) onSuccess();
            }
          } else {
            console.error('认证成功但缺少登录信息，完整返回数据:', JSON.stringify(data, null, 2));
            toast.error('认证成功但登录信息不完整，请联系管理员检查配置');
          }
        } else {
          console.error('认证响应异常:', data);
          toast.error(`企业微信认证失败: ${data?.error || '未知错误'}`);
          // 清除URL参数
          window.history.replaceState({}, '', '/auth');
        }
      }

    } catch (error) {
      console.error('企业微信认证错误:', error);
      toast.error(`企业微信认证失败: ${error.message || '网络连接错误'}`);
      // 清除URL参数
      window.history.replaceState({}, '', '/auth');
    }
  };

  // 在企业微信环境中自动触发认证或检测URL中的code
  useEffect(() => {
    // 如果正在处理中，则直接返回，防止重复执行
    if (isProcessingAuth.current) {
      return;
    }

    const code = new URLSearchParams(window.location.search).get('code');
    const source = new URLSearchParams(window.location.search).get('source');
    
    if (code && source === 'work_wechat' && !user) {
      // 在调用前设置标志位，表示处理已开始
      isProcessingAuth.current = true;
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
