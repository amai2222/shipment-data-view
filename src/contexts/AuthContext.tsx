import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type UserRole = 'admin' | 'finance' | 'business' | 'partner' | 'operator';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // 设置认证状态监听器
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // 获取用户配置文件
          setTimeout(async () => {
            try {
              const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (error) throw error;
              setProfile(profileData as UserProfile);
            } catch (error) {
              console.error('获取用户配置文件失败:', error);
              setProfile(null);
            }
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // 检查现有会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      setLoading(true);
      
      // 首先通过用户名查找对应的email
      const { data: userData, error: userError } = await supabase.rpc(
        'get_user_by_username',
        { username_input: username }
      );
      
      if (userError || !userData) {
        return { error: '用户名不存在或已被禁用' };
      }

      // 获取用户配置文件以获取email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('email, is_active')
        .eq('id', userData)
        .single();
      
      if (profileError || !profileData || !profileData.is_active) {
        return { error: '用户账户已被禁用或不存在' };
      }

      // 使用email和密码登录
      const { error } = await supabase.auth.signInWithPassword({
        email: profileData.email,
        password: password,
      });

      if (error) {
        return { error: '用户名或密码错误' };
      }

      return {};
    } catch (error) {
      console.error('登录失败:', error);
      return { error: '登录过程中发生错误，请稍后重试' };
    } finally {
      setLoading(false);
    }
  };

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