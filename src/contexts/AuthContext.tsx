import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

// 1. 定义 Context 中值的类型
interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null; 
  loading: boolean;
}

// 2. 创建 Auth Context
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 3. 创建 Auth Provider 组件
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true); 

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        const currentUser = session ? session.user : null;
        setUser(currentUser);

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
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const value = {
    session,
    user,
    profile,
    loading,
  };

  // 【关键修复】修正了闭合标签的拼写错误
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 4. 创建一个自定义 Hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
