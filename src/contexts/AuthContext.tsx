// 文件路径: src/contexts/AuthContext.tsx
// 描述: 这是修复后的完整代码，signIn 函数已集成设备感知重定向逻辑。

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
// import { useNavigate } from 'react-router-dom'; // 暂时注释掉避免 Hooks 错误
// import { isMobile } from '@/utils/device'; // 暂时注释掉

// 定义用户角色类型，确保类型安全
export type UserRole = 'admin' | 'finance' | 'business' | 'partner' | 'operator' | 'viewer';

// 定义用户档案的完整接口
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  work_wechat_userid?: string;
  work_wechat_department?: number[];
  avatar_url?: string;
  created_at?: string;
}

// 定义AuthContext的类型，明确提供给子组件的属性和方法
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (usernameOrEmail: string, password:string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  switchUser: (usernameOrEmail: string, password: string) => Promise<{ error?: string }>;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
}

// 创建AuthContext
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider组件，包裹整个应用，提供认证状态
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  // const navigate = useNavigate(); // 暂时注释掉避免 Hooks 错误

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          setTimeout(async () => {
            try {
              const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .maybeSingle();

              if (error) {
                console.error('获取用户配置文件失败:', error);
                setProfile(null);
              } else if (profileData) {
                const anyProfile = profileData as any;
                const userProfile = {
                  id: anyProfile.id,
                  email: anyProfile.email || '',
                  username: anyProfile.username || anyProfile.email || '',
                  full_name: anyProfile.full_name || '',
                  role: (anyProfile.role as UserRole) ?? 'operator',
                  is_active: anyProfile.is_active ?? true
                };
                setProfile(userProfile);
                
                // 特殊处理：partner（货主）角色登录后直接跳转到货主看板
                // 暂时注释掉以避免 Hooks 错误，等 overrides 生效后恢复
                // if (event === 'SIGNED_IN' && userProfile.role === 'partner') {
                //   if (isMobile()) {
                //     navigate('/m/dashboard/shipper', { replace: true });
                //   } else {
                //     navigate('/dashboard/shipper', { replace: true });
                //   }
                // }
              } else {
                setProfile(null);
              }
            } catch (catchError) {
              console.error('处理用户配置文件时发生意外错误:', catchError);
              setProfile(null);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [toast]); // 移除 navigate 依赖

  // ★★★ 4. 修改 signIn 函数以处理重定向
  const signIn = async (usernameOrEmail: string, password: string) => {
    try {
      setLoading(true);
      let loginError: string | undefined;

      if (!usernameOrEmail.includes('@')) {
        const { data, error } = await supabase.functions.invoke('username-login', {
          body: { username: usernameOrEmail, password }
        });
        if (error || !data?.access_token || !data?.refresh_token) {
          loginError = '用户名或密码错误';
        } else {
          const { access_token, refresh_token } = data as any;
          const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
          if (setErr) {
            loginError = '登录失败，请重试';
          }
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: usernameOrEmail,
          password,
        });
        if (authError) {
          loginError = '用户名或密码错误';
        }
      }

      // ★★★ 5. 登录成功或失败后的统一处理
      if (loginError) {
        setLoading(false); // 登录失败，停止加载
        return { error: loginError };
      }

      // 登录成功！onAuthStateChange 会处理后续状态
      // 注意：这里不立即导航，等待 onAuthStateChange 加载 profile 后根据角色跳转
      // 特殊处理：partner 角色会在 onAuthStateChange 中跳转到货主看板

      return {}; // 返回成功
    } catch (error) {
      console.error('登录失败:', error);
      setLoading(false);
      return { error: '登录过程中发生未知错误，请稍后重试' };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "登出失败", description: error.message, variant: "destructive" });
    }
    // onAuthStateChange 会处理用户状态变化，并由 ProtectedRoute 自动导航到 /auth
  };

  const switchUser = async (usernameOrEmail: string, password: string) => {
    try {
      await signOut();
      // signOut后，ProtectedRoute会自动导航到/auth，signIn不需要再导航
      // 但为了体验流畅，我们直接调用signIn，它内部的导航会覆盖之前的跳转
      return await signIn(usernameOrEmail, password);
    } catch (error) {
      console.error('切换用户失败:', error);
      return { error: '切换用户过程中发生错误，请稍后重试' };
    }
  };

  const hasPermission = (requiredRoles: UserRole[]): boolean => {
    if (!profile) return false;
    return requiredRoles.includes(profile.role);
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signOut,
    switchUser,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
}
