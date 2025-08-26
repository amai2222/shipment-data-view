// 文件路径: src/pages/AuthCallback.tsx
// 描述: 接收企业微信回调，调用后端函数，并跳转到魔法链接以完成登录。

import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    const code = searchParams.get('code');

    const handleLogin = async (authCode: string) => {
      try {
        console.log("接收到 code，正在调用后端函数 'work-wechat-auth'...");

        const corpId = import.meta.env.VITE_WORK_WECHAT_CORPID;
        const agentId = import.meta.env.VITE_WORK_WECHAT_AGENTID;

        const { data, error } = await supabase.functions.invoke('work-wechat-auth', {
          body: JSON.stringify({
            code: authCode,
            corpId: corpId,
            agentId: agentId
          }),
        });

        if (error) {
          throw new Error(`后端函数调用失败: ${error.message}`);
        }

        console.log("后端返回成功, 准备跳转到魔法链接...");
        
        const authUrl = data?.auth_url;

        if (authUrl) {
          // 关键一步：重定向到魔法链接，以完成Supabase的会话设置
          window.location.href = authUrl;
        } else {
          throw new Error("后端未返回有效的 auth_url。");
        }

      } catch (err) {
        console.error('企业微信登录流程出错:', err);
        navigate('/auth-error'); // 登录失败，跳转到错误页面
      }
    };

    if (code) {
      handleLogin(code);
    } else {
      console.error("URL中未找到有效的 code 参数");
      navigate('/auth-error');
    }
  }, [searchParams, navigate]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      正在通过企业微信安全登录，请稍候...
    </div>
  );
};

export default AuthCallback;
