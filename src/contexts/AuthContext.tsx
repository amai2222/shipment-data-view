import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// 定义用户角色类型，确保类型安全
export type UserRole = 'admin' | 'finance' | 'business' | 'partner' | 'operator';

// 定义用户档案的完整接口
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

// 定义AuthContext的类型，明确提供给子组件的属性和方法
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
}

// 创建AuthContext
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider组件，包裹整个应用，提供认证状态
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // 【修改】将首次加载和状态监听合并，并统一处理加载状态
    setLoading(true);

    const handleAuthChange = async (session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (error) {
            // 【关键修改】不再因为获取profile失败而强制登出。
            // 这是一个更具弹性的策略，允许网络波动等瞬时错误发生。
            console.error('获取用户配置文件失败，但会话将保持:', error);
            setProfile(null); // 清空旧的profile以避免数据不一致
          } else {
            setProfile(profileData as UserProfile);
          }
        } catch (catchError) {
          console.error('处理用户配置文件时发生意外错误:', catchError);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      // 【关键修改】确保在所有逻辑路径的最后都设置loading为false
      setLoading(false);
    };

    // 首次加载时，获取会话并处理
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthChange(session);
    });

    // 设置认证状态的实时监听器
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // 【关键修改】在处理任何认证事件前，都先进入加载状态
        setLoading(true);
        handleAuthChange(session);
      }
    );

    // 组件卸载时，取消监听
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * 终极的、正确的、经过重构的signIn函数
   * 它遵循了安全和效率的最佳实践
   */
  const signIn = async (username: string, password: string) => {
    try {
      setLoading(true);
      
      // 第一步：调用后端升级后的RPC函数，直接通过用户名获取email
      // 这个操作利用了函数的SECURITY DEFINER权限，安全地绕过了RLS限制
      const { data: emailData, error: rpcError } = await supabase.rpc(
        'get_user_by_username',
        { username_input: username }
      );
      
      // 如果RPC调用出错或未返回email，说明用户不存在或账户被禁用
      if (rpcError || !emailData) {
        return { error: '用户名不存在或已被禁用' };
      }

      // 第二步：使用获取到的email和前端传入的密码进行最终认证
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailData, // 使用从安全后端函数获取的email
        password: password,
      });

      // 如果认证失败，说明密码错误
      if (authError) {
        return { error: '用户名或密码错误' };
      }

      // 登录成功，返回空对象
      return {};
    } catch (error) {
      console.error('登录失败:', error);
      return { error: '登录过程中发生错误，请稍后重试' };
    } finally {
      setLoading(false);
    }
  };

  // 登出函数
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "登出失败",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // 权限检查函数
  const hasPermission = (requiredRoles: UserRole[]): boolean => {
    if (!profile) return false;
    return requiredRoles.includes(profile.role);
  };

  // 传递给Context的值
  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signOut,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// 自定义Hook，方便子组件使用AuthContext
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
}
