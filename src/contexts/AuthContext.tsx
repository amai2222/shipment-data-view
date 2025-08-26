// 文件路径: src/contexts/AuthContext.tsx
// 描述: [最终修正版] 修复了导致无限加载的问题

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// 定义用户角色类型
export type UserRole = 'admin' | 'finance' | 'business' | 'partner' | 'operator' | 'viewer';

// 定义用户档案接口
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

// 定义Context类型
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  signIn: (usernameOrEmail: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  switchUser: (usernameOrEmail: string, password: string) => Promise<{ error?: string }>;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
  login: (user: any, token: string) => void;
}

// 导出AuthContext
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider组件
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // ★★★ 这是修复无限加载问题的核心逻辑 ★★★
  useEffect(() => {
    // onAuthStateChange 会在订阅时及后续认证状态变化时触发
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      // 1. 将回调函数设为 async，以便在内部使用 await
      async (_event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        // 2. 移除不必要的 setTimeout，直接处理逻辑
        if (currentUser) {
          try {
            const { data: profileData, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', currentUser.id)
              .single(); // .single() 确保只返回一条记录

            if (error) {
              console.error('获取用户配置文件失败:', error);
              setProfile(null);
            } else {
              setProfile(profileData as UserProfile);
            }
          } catch (catchError) {
            console.error('处理用户配置文件时发生意外错误:', catchError);
            setProfile(null);
          }
        } else {
          // 如果没有用户，清空profile
          setProfile(null);
        }

        // 3. 无论成功与否，只要检查完毕，就将loading设为false
        setLoading(false);
      }
    );

    // 在组件卸载时，取消订阅以防止内存泄漏
    return () => {
      subscription.unsubscribe();
    };
  }, []); // 空依赖数组确保这个effect只在组件挂载时运行一次

  // --- 以下函数保持不变 ---

  const signIn = async (usernameOrEmail: string, password: string) => {
    setLoading(true);
    try {
      if (!usernameOrEmail.includes('@')) {
        const { data, error } = await supabase.functions.invoke('username-login', {
          body: { username: usernameOrEmail, password }
        });
        if (error || !data?.access_token) {
          setLoading(false);
          return { error: '用户名或密码错误' };
        }
        const { access_token, refresh_token } = data as any;
        const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
        if (setErr) {
          setLoading(false);
          return { error: '登录失败，请重试' };
        }
        return {};
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: usernameOrEmail,
        password,
      });

      if (authError) {
        setLoading(false);
        return { error: '用户名或密码错误' };
      }
      return {};
    } catch (error) {
      setLoading(false);
      return { error: '登录过程中发生未知错误' };
    }
  };
  
  const login = (userData: any, token: string) => {
    console.log("Magic link flow initiated. Auth state will be updated by onAuthStateChange listener.", userData, token);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "登出失败", description: error.message, variant: "destructive" });
    }
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
    isAuthenticated: !!user,
    loading,
    signIn,
    signOut,
    switchUser,
    hasPermission,
    login,
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
