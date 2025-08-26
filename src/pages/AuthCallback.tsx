// src/pages/AuthCallback.tsx
import { useEffect, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
// 注意：我们不再需要 AuthContext 了，因为登录状态由 Supabase 的 onAuthStateChange 自动处理
import { supabase } from '../integrations/supabase/client';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    const code = searchParams.get('code');

    const handleLogin = async (authCode: string) => {
      try {
        console.log("接收到 code，正在调用后端函数...");

        // 从环境变量中获取 corpId 和 agentId，并传给后端
        const corpId = import.meta.env.VITE_WORK_WECHAT_CORPID;
        const agentId = import.meta.env.VITE_WORK_WECHAT_AGENTID;

        const { data, error } = await supabase.functions.invoke('work-wechat-auth', { // 函数名已更新
          body: JSON.stringify({
            code: authCode,
            corpId: corpId,
            agentId: agentId
          }),
        });

        if (error) {
          throw error;
        }

        console.log("后端返回成功, 正在准备跳转到魔法链接...");
        
        // 关键一步：从后端返回的数据中获取 auth_url
        const authUrl = data?.auth_url;

        if (authUrl) {
          // 将页面重定向到魔法链接，以完成Supabase的会话设置
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
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      正在通过企业微信安全登录，请稍候...
    </div>
  );
};

export default AuthCallback;
