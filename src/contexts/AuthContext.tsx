import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

// 1. 定义 Context 中值的类型
// 这为整个应用提供了一个统一的认证状态接口
interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null; // 您可以在这里定义更具体的 Profile 类型
  loading: boolean;
}

// 2. 创建 Auth Context
// 使用 undefined 作为初始值，以便在 useAuth hook 中进行检查
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 3. 创建 Auth Provider 组件
// 这是包裹整个应用的核心组件，负责管理和分发认证状态
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true); // 初始状态为 loading，直到首次认证状态确定

  useEffect(() => {
    // onAuthStateChange 是 Supabase 推荐的最佳实践。
    // 它会在订阅时立即触发一次，获取当前会话，完美替代了手动的 getSession()。
    // 之后，它会在登录、登出、令牌刷新等任何认证状态变化时自动触发。
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        const currentUser = session ? session.user : null;
        setUser(currentUser);

        // 如果用户存在，则去获取他/她在 public.profiles 表中的详细信息
        if (currentUser) {
          const { data: userProfile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
          
          if (error) {
            console.error('获取用户 profile 失败:', error);
            setProfile(null);
          } else {
            setProfile(userProfile);
          }
        } else {
          // 如果用户不存在（例如已登出），则清空 profile
          setProfile(null);
        }

        // 【关键修复】
        // 无论是初始加载、令牌刷新、还是用户登出，
        // 都在这个回调的最后将 loading 状态设置为 false。
        // 这确保了应用不会再卡在“转圈”状态。
        setLoading(false);
      }
    );

    // 在组件卸载时，清理订阅，防止内存泄漏
    return () => {
      subscription.unsubscribe();
    };
  }, []); // 空依赖数组确保这个 effect 只在组件挂载时运行一次

  // 在首次加载完成前，显示一个全局的加载指示器
  // 这可以防止在认证状态确定前，页面因为缺少用户信息而闪烁或报错
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // 将所有认证相关的数据打包成一个 value 对象
  const value = {
    session,
    user,
    profile,
    loading,
  };

  // 通过 Provider 将 value 提供给应用中的所有子组件
  return <AuthContext.Provider value={value}>{children}</Auth-Context.Provider>;
};

// 4. 创建一个自定义 Hook
// 这让子组件可以非常方便地、安全地访问到认证状态
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // 如果组件没有被 AuthProvider 包裹，则抛出错误，帮助开发者快速定位问题
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
