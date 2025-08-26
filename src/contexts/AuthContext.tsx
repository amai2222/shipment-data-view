// 文件路径: src/contexts/AuthContext.tsx
// 这是修复后的完整代码，请直接替换

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
}

// 定义AuthContext的类型，明确提供给子组件的属性和方法
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isAuthenticated: boolean; // 增加一个明确的布尔值
  loading: boolean;
  signIn: (usernameOrEmail: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  switchUser: (usernameOrEmail: string, password: string) => Promise<{ error?: string }>;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
  login: (user: any, token: string) => void; // 添加 login 方法的类型定义
}

// ★★★ 核心修复：在这里导出 AuthContext ★★★
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider组件，包裹整个应用，提供认证状态
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          try {
            const { data: profileData, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', currentUser.id)
              .single();

            if (error) {
              console.error('获取用户配置文件失败:', error);
              setProfile(null);
            } else if (profileData) {
              setProfile(profileData as UserProfile);
            } else {
              setProfile(null);
            }
          } catch (catchError) {
            console.error('处理用户配置文件时发生意外错误:', catchError);
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (usernameOrEmail: string, password: string) => {
    setLoading(true);
    try {
      if (!usernameOrEmail.includes('@')) {
        const { data, error } = await supabase.functions.invoke('username-login', {
          body: { username: usernameOrEmail, password }
        });
        if (error || !data?.access_token) {
          return { error: '用户名或密码错误' };
        }
        const { access_token, refresh_token } = data as any;
        const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
        if (setErr) {
          return { error: '登录失败，请重试' };
        }
        return {};
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: usernameOrEmail,
        password,
      });

      if (authError) {
        return { error: '用户名或密码错误' };
      }
      return {};
    } catch (error) {
      return { error: '登录过程中发生未知错误' };
    } finally {
      // onAuthStateChange will set loading to false
    }
  };
  
  // 为 AuthCallback 提供一个临时的登录方法
  const login = (userData: any, token: string) => {
    // 这个方法在 Magic Link 流程中可以留空
    // 因为 onAuthStateChange 会自动处理状态更新
    // 但为了类型匹配，我们保留它
    console.log("Magic link flow initiated, user will be set by onAuthStateChange.", userData, token);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const switchUser = async (usernameOrEmail: string, password: string) => {
    await signOut();
    return await signIn(usernameOrEmail, password);
  };

  const hasPermission = (requiredRoles: UserRole[]): boolean => {
    if (!profile) return false;
    return requiredRoles.includes(profile.role);
  };

  const value = {
    user,
    profile,
    session,
    isAuthenticated: !!user, // 根据 user 是否存在来判断
    loading,
    signIn,
    signOut,
    switchUser,
    hasPermission,
    login, // 导出 login 方法
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
