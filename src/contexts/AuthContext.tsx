// 文件路径: src/contexts/AuthContext.tsx
// 描述: [VmXwk 最终修复版] 实现了使用用户名或邮箱登录的终极解决方案。

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
  signIn: (usernameOrEmail: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  switchUser: (usernameOrEmail: string, password: string) => Promise<{ error?: string }>;
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
            console.error('获取用户配置文件失败，但会话将保持:', error);
            setProfile(null);
          } else {
            setProfile({
              id: profileData.id,
              email: profileData.email || '',
              username: profileData.username || profileData.email || '',
              full_name: profileData.full_name || '',
              role: profileData.role as UserRole,
              is_active: profileData.is_active ?? true
            });
          }
        } catch (catchError) {
          console.error('处理用户配置文件时发生意外错误:', catchError);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthChange(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setLoading(true);
        handleAuthChange(session);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * [VmXwk 最终修复] 终极的、正确的、经过重构的signIn函数
   * 它现在可以接受用户名或邮箱进行登录。
   */
  const signIn = async (usernameOrEmail: string, password: string) => {
    try {
      setLoading(true);
      
      // 第一步：调用我们新创建的后端RPC函数，安全地获取用户的真实邮箱
      const { data: rpcData, error: rpcError } = await supabase.rpc('login_with_username_or_email', {
        identifier: usernameOrEmail
      });

      if (rpcError) {
        console.error('RPC call failed:', rpcError);
        return { error: '登录服务暂时不可用，请稍后重试' };
      }
      
      // 如果RPC未返回任何数据，说明用户不存在或账户被禁用
      if (!rpcData || rpcData.length === 0) {
        return { error: '用户名不存在或已被禁用' };
      }

      const userEmail = rpcData[0].user_email;

      // 第二步：使用获取到的真实email和前端传入的密码进行最终认证
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: password,
      });

      // 如果认证失败，说明密码错误
      if (authError) {
        // Supabase对于不存在的用户和密码错误返回相同的错误信息，这是为了安全
        return { error: '用户名或密码错误' };
      }

      // 登录成功，返回空对象
      return {};
    } catch (error) {
      console.error('登录失败:', error);
      return { error: '登录过程中发生未知错误，请稍后重试' };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "登出失败", description: error.message, variant: "destructive" });
    }
  };

  const switchUser = async (usernameOrEmail: string, password: string) => {
    try {
      await signOut();
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
