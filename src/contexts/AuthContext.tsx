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
  const [loading, setLoading] = useState(true); // 初始状态为true
  const { toast } = useToast();

  // 【【【核心修复逻辑在这里】】】
  useEffect(() => {
    // onAuthStateChange 在订阅时会立即触发一次，返回当前会话
    // 这一个监听器就足以处理所有认证状态的检查和变化
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
                setProfile({
                  id: anyProfile.id,
                  email: anyProfile.email || '',
                  username: anyProfile.username || anyProfile.email || '',
                  full_name: anyProfile.full_name || '',
                  role: (anyProfile.role as UserRole) ?? 'operator',
                  is_active: anyProfile.is_active ?? true
                });
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
          // 如果没有用户，清空profile
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // 在组件卸载时，取消订阅
    return () => {
      subscription.unsubscribe();
    };
  }, []); // 空依赖数组确保这个effect只在组件挂载时运行一次

  const signIn = async (usernameOrEmail: string, password: string) => {
    try {
      setLoading(true);

      if (!usernameOrEmail.includes('@')) {
        // Secure path: call edge function to avoid exposing emails via RPC
        const { data, error } = await supabase.functions.invoke('username-login', {
          body: { username: usernameOrEmail, password }
        });
        if (error || !data?.access_token || !data?.refresh_token) {
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
      console.error('登录失败:', error);
      return { error: '登录过程中发生未知错误，请稍后重试' };
    } finally {
      // 登录成功由 onAuthStateChange 处理 loading 状态
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
