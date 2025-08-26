// 文件路径: src/contexts/AuthContext.tsx
// 描述: [带调试日志的最终版] 用于定位无限加载问题的根本原因

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

  // ★★★ 这是带有详细日志的调试逻辑 ★★★
  useEffect(() => {
    console.log("[AuthContext] AuthProvider 已挂载，正在设置 onAuthStateChange 监听器...");

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[AuthContext] onAuthStateChange 事件触发! 事件类型: ${event}`);
        
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          console.log("[AuthContext] 检测到用户会话。用户ID:", currentUser.id);
          console.log("[AuthContext] 正在尝试获取用户 profile...");
          try {
            const { data: profileData, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', currentUser.id)
              .single();

            if (error) {
              console.error('[AuthContext] 获取用户 profile 失败:', error);
              setProfile(null);
            } else {
              console.log("[AuthContext] 成功获取 profile:", profileData);
              setProfile(profileData as UserProfile);
            }
          } catch (catchError) {
            console.error('[AuthContext] 获取 profile 时发生意外错误:', catchError);
            setProfile(null);
          }
        } else {
          console.log("[AuthContext] 未检测到用户会话。");
          setProfile(null);
        }

        console.log("[AuthContext] 认证状态检查完毕。正在将 loading 设置为 false...");
        setLoading(false);
      }
    );

    return () => {
      console.log("[AuthContext] AuthProvider 已卸载，正在取消订阅 onAuthStateChange。");
      subscription.unsubscribe();
    };
  }, []);

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
