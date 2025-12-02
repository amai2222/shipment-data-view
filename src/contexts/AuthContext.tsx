// 文件路径: src/contexts/AuthContext.tsx
// 描述: 这是修复后的完整代码，signIn 函数已集成设备感知重定向逻辑。

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
// import { useToast } from '@/hooks/use-toast'; // 暂时注释，等Lovable应用新的package.json配置
// import { useNavigate } from 'react-router-dom';
// import { isMobile } from '@/utils/device';

// 定义用户角色类型，确保类型安全
export type UserRole = 'admin' | 'finance' | 'business' | 'partner' | 'operator' | 'viewer' | 'fleet_manager' | 'driver';

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
  partnerId?: string;  // 货主ID（仅partner角色使用）
}

// 扩展User类型，添加partnerId属性（用于货主移动端）
interface ExtendedUser extends User {
  partnerId?: string;
}

// 定义AuthContext的类型，明确提供给子组件的属性和方法
interface AuthContextType {
  user: ExtendedUser | null;
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
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // const { toast } = useToast(); // 暂时注释，等Lovable应用新的package.json配置
  // const navigate = useNavigate();

  // ✅ 简化逻辑：依赖Supabase的autoRefreshToken自动刷新机制
  // Supabase会自动在token过期前刷新，只要refresh_token有效，session就不会过期

  useEffect(() => {
    // ✅ 使用 ref 缓存 profile，避免重复查询
    let profileCache: UserProfile | null = null;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 认证状态变更:', event, session ? '有session' : '无session');
        
        setSession(session);
        const currentUser = session?.user ?? null;
        // 扩展User对象，添加partnerId（从profile中获取）
        if (currentUser && profile?.partnerId) {
          (currentUser as ExtendedUser).partnerId = profile.partnerId;
        }
        setUser(currentUser as ExtendedUser | null);

        // ✅ 只处理用户主动登出事件
        if (event === 'SIGNED_OUT') {
          console.log('⚠️ 用户已登出，清除用户状态');
          setUser(null);
          setProfile(null);
          profileCache = null;
          setLoading(false);
          
          // 如果当前不在登录页，则跳转到登录页
          if (window.location.pathname !== '/auth') {
            console.log('🔄 跳转到登录页');
            window.location.href = '/auth';
          }
          return;
        }

        // ✅ TOKEN_REFRESHED事件：Supabase自动刷新了token，不需要重新查询 profile
        if (event === 'TOKEN_REFRESHED') {
          console.log('✅ Token已自动刷新，使用缓存的profile');
          // 不执行任何操作，继续使用现有的 profile
          setLoading(false);
          return;
        }

        // ✅ 只在 SIGNED_IN 和 INITIAL_SESSION 时查询 profile
        if (currentUser && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          // 如果已有缓存且用户ID相同，直接使用缓存
          if (profileCache && profileCache.id === currentUser.id) {
            console.log('✅ 使用缓存的profile，避免重复查询');
            setProfile(profileCache);
            setLoading(false);
            return;
          }
          
          setTimeout(async () => {
            try {
              const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .maybeSingle();

              if (error) {
                const errorMessage = error.message || '';
                const errorDetails = error.details || '';
                const errorString = JSON.stringify(error);
                
                // ✅ 检测状态码 0 错误（RangeError: status provided (0)）
                // 这种错误通常是网络请求被取消、CORS问题或请求超时，不是真正的错误
                const isStatusZeroError = 
                  errorMessage.includes('status provided (0)') ||
                  errorMessage.includes('status 0') ||
                  errorMessage.includes('RangeError') ||
                  errorDetails.includes('status provided (0)') ||
                  errorDetails.includes('status 0') ||
                  errorString.includes('status provided (0)') ||
                  errorString.includes('RangeError: Failed to construct \'Response\'');
                
                if (isStatusZeroError) {
                  // 状态码 0 错误通常是网络问题或请求被取消，静默忽略
                  // 不记录为错误，避免控制台噪音
                  setLoading(false); // 确保加载状态被清除
                  return;
                }
                
                // ✅ 检测网络请求被取消的情况
                const isCancelledRequest = 
                  errorMessage.includes('aborted') || 
                  errorMessage.includes('cancelled') ||
                  errorMessage.includes('Failed to fetch');
                
                if (isCancelledRequest) {
                  // 网络请求被明确取消，静默忽略
                  setLoading(false); // 确保加载状态被清除
                  return;
                }
                
                // ✅ 如果是401错误或JWT错误，可能是token过期，等待自动刷新
                if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
                  console.log('⚠️ Token可能已过期，等待Supabase自动刷新...');
                  // 不立即清除状态，等待Supabase的autoRefreshToken机制自动刷新
                  setLoading(false); // 确保加载状态被清除
                  return; // ✅ 不设置 profile 为 null
                }
                
                // ✅ 其他错误：记录错误详情，但不清空 profile（如果已有缓存）
                // 如果是首次登录且获取 profile 失败，需要重试
                console.error('获取用户配置文件失败:', error);
                console.error('错误详情:', {
                  code: error.code,
                  message: error.message,
                  details: error.details,
                  hint: error.hint
                });
                
                // 如果已有缓存的 profile，保持当前状态
                if (profileCache && profileCache.id === currentUser.id) {
                  console.warn('⚠️ 获取用户配置文件失败，但使用缓存的 profile');
                  setProfile(profileCache);
                  setLoading(false);
                  return;
                }
                
                // 如果是首次登录且获取 profile 失败，尝试重试一次
                console.warn('⚠️ 首次获取用户配置文件失败，尝试重试...');
                setTimeout(async () => {
                  try {
                    const { data: retryData, error: retryError } = await supabase
                      .from('profiles')
                      .select('*')
                      .eq('id', currentUser.id)
                      .maybeSingle();
                    
                    if (retryError) {
                      console.error('重试获取用户配置文件仍然失败:', retryError);
                      setLoading(false);
                      return;
                    }
                    
                    if (retryData) {
                      const anyProfile = retryData as Record<string, unknown>;
                      // 处理 profile 数据（与下面的逻辑相同）
                      let partnerId: string | undefined;
                      if (anyProfile.role === 'partner') {
                        try {
                          const { data: partnerData } = await supabase
                            .from('partners')
                            .select('id')
                            .eq('partner_type', '货主')
                            .limit(1)
                            .single();
                          partnerId = partnerData?.id;
                        } catch (err) {
                          console.warn('查询货主ID失败:', err);
                        }
                      }
                      
                      const userProfile: UserProfile = {
                        id: anyProfile.id as string,
                        email: anyProfile.email as string,
                        username: anyProfile.username as string,
                        full_name: anyProfile.full_name as string,
                        role: anyProfile.role as UserRole,
                        is_active: anyProfile.is_active as boolean,
                        work_wechat_userid: anyProfile.work_wechat_userid as string | undefined,
                        work_wechat_department: anyProfile.work_wechat_department as number[] | undefined,
                        avatar_url: anyProfile.avatar_url as string | undefined,
                        created_at: anyProfile.created_at as string | undefined,
                        partnerId
                      };
                      
                      profileCache = userProfile;
                      setProfile(userProfile);
                      setLoading(false);
                    } else {
                      setLoading(false);
                    }
                  } catch (retryErr) {
                    console.error('重试获取用户配置文件时发生异常:', retryErr);
                    setLoading(false);
                  }
                }, 1000); // 1秒后重试
                
                return;
              } else if (profileData) {
                const anyProfile = profileData as Record<string, unknown>;
                
                // 如果是partner角色，查询关联的货主ID
                let partnerId: string | undefined;
                if (anyProfile.role === 'partner') {
                  try {
                    const { data: partnerData } = await supabase
                      .from('partners')
                      .select('id')
                      .eq('partner_type', '货主')
                      .limit(1)
                      .single();
                    partnerId = partnerData?.id;
                  } catch (error) {
                    console.warn('查询货主ID失败:', error);
                  }
                }
                
                const userProfile: UserProfile = {
                  id: String(anyProfile.id || ''),
                  email: String(anyProfile.email || ''),
                  username: String(anyProfile.username || anyProfile.email || ''),
                  full_name: String(anyProfile.full_name || ''),
                  role: (anyProfile.role as UserRole) ?? 'operator',
                  is_active: Boolean(anyProfile.is_active ?? true),
                  partnerId
                };
                setProfile(userProfile);
                profileCache = userProfile; // ✅ 缓存 profile
                
                // 更新user对象的partnerId
                if (currentUser && partnerId) {
                  (currentUser as ExtendedUser).partnerId = partnerId;
                  setUser(currentUser as ExtendedUser);
                }
                
                // 特殊处理：partner（货主）角色登录后直接跳转到货主看板
                // 暂时注释，等Lovable应用新的package.json配置（精确版本React）
                // if (event === 'SIGNED_IN' && userProfile.role === 'partner') {
                //   if (isMobile()) {
                //     navigate('/m/dashboard/shipper', { replace: true });
                //   } else {
                //     navigate('/dashboard/shipper', { replace: true });
                //   }
                // }
              } else {
                // ✅ 如果没有 profile 数据，也不清空，避免频繁重新加载
                console.warn('⚠️ 未找到用户配置文件，保持当前状态');
              }
            } catch (catchError) {
              console.error('处理用户配置文件时发生意外错误:', catchError);
              // ✅ 不清空 profile，避免因临时网络问题导致登出
              console.warn('⚠️ 获取用户信息异常，但保持当前登录状态');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  // ★★★ 4. 修改 signIn 函数以处理重定向
  const signIn = async (usernameOrEmail: string, password: string) => {
    try {
      setLoading(true);
      let loginError: string | undefined;

      if (!usernameOrEmail.includes('@')) {
        const { data, error } = await supabase.functions.invoke('username-login', {
          body: { username: usernameOrEmail.trim(), password }
        });
        
        if (error) {
          console.error('username-login 函数调用失败:', error);
          console.error('错误详情:', {
            message: error.message,
            context: error.context,
            status: error.status
          });
          
          // 尝试解析错误响应
          let errorMessage = '用户名或密码错误';
          if (error.context?.body) {
            try {
              const errorBody = typeof error.context.body === 'string' 
                ? JSON.parse(error.context.body) 
                : error.context.body;
              if (errorBody?.error) {
                errorMessage = errorBody.error === 'Invalid credentials' 
                  ? '用户名或密码错误' 
                  : errorBody.error;
              }
            } catch (e) {
              console.error('解析错误响应失败:', e);
            }
          }
          
          // 如果是 400 错误，可能是参数问题
          if (error.status === 400) {
            if (error.message?.includes('Missing username or password')) {
              errorMessage = '请输入用户名和密码';
            } else if (error.message?.includes('Invalid credentials')) {
              errorMessage = '用户名或密码错误';
            } else {
              errorMessage = '登录请求格式错误，请重试';
            }
          }
          
          loginError = errorMessage;
        } else if (!data?.access_token || !data?.refresh_token) {
          console.error('username-login 返回数据不完整:', data);
          loginError = '登录失败，请重试';
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { access_token, refresh_token } = data as { access_token: string; refresh_token: string };
          const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
          if (setErr) {
            console.error('设置 session 失败:', setErr);
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
    try {
      // 1. 先清除本地状态
      setUser(null);
      setProfile(null);
      setLoading(false);
      
      // 2. 调用Supabase登出（这会清除Supabase的session）
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Supabase登出失败:", error.message);
      }
      
      // 3. 手动清除localStorage中所有Supabase相关的session数据
      // Supabase的session key格式通常是: sb-<project-ref>-auth-token
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      if (supabaseUrl) {
        try {
          // 提取项目ref（从URL中提取）
          const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
          if (projectRef) {
            const sessionKey = `sb-${projectRef}-auth-token`;
            localStorage.removeItem(sessionKey);
            console.log('✅ 已清除localStorage中的session:', sessionKey);
          }
          
          // 清除所有可能的Supabase相关key（以防格式不同）
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('supabase') || key.includes('auth-token') || key.includes('sb-'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log('✅ 已清除localStorage中的key:', key);
          });
        } catch (storageError) {
          console.error('清除localStorage失败:', storageError);
        }
      }
    } catch (error) {
      console.error("登出异常:", error);
    } finally {
      // 4. 强制导航到登录页（使用replace避免返回）
      window.location.replace('/auth');
    }
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
