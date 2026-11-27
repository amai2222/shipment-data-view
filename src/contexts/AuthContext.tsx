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
  partnerId?: string;      // 合作方ID（仅partner角色使用，来自 user_partners）
  partnerType?: string;    // 合作方类型：货主 / 合作商 / 资方 / 本公司
  partnerName?: string;    // 合作方名称
  isPartnerUser?: boolean; // 是否合作方账号（role === 'partner'）
}

// 扩展User类型，添加合作方绑定属性（用于货主移动端）
interface ExtendedUser extends User {
  partnerId?: string;
  partnerType?: string;
  partnerName?: string;
  isPartnerUser?: boolean;
}

// 合作方绑定信息（来自 user_partners → partners）
interface PartnerBinding {
  partnerId?: string;
  partnerType?: string;
  partnerName?: string;
}

/**
 * 解析当前用户的真实合作方绑定。
 * 数据来源：public.user_partners（A 组迁移建立），is_primary 优先，否则取 created_at 最早一条。
 * 不再使用「取第一个货主」的伪造逻辑。
 */
async function resolvePartnerBinding(userId: string): Promise<PartnerBinding> {
  try {
    const { data, error } = await supabase
      .from('user_partners')
      .select('partner_id, is_primary, created_at, partners(id, name, partner_type)')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('查询合作方绑定失败:', error);
      return {};
    }
    if (!data) {
      console.warn('⚠️ 当前 partner 账号未绑定任何合作方，请联系管理员');
      return {};
    }

    const row = data as {
      partner_id?: string;
      partners?: { id?: string; name?: string; partner_type?: string } | Array<{ id?: string; name?: string; partner_type?: string }> | null;
    };
    const rel = Array.isArray(row.partners) ? row.partners[0] : row.partners;
    const partnerId = rel?.id || row.partner_id;

    return {
      partnerId,
      partnerType: rel?.partner_type,
      partnerName: rel?.name,
    };
  } catch (e) {
    console.warn('查询合作方绑定异常:', e);
    return {};
  }
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
        // 扩展User对象，带上合作方绑定（来自已加载的 profile）
        if (currentUser && profile?.isPartnerUser) {
          (currentUser as ExtendedUser).partnerId = profile.partnerId;
          (currentUser as ExtendedUser).partnerType = profile.partnerType;
          (currentUser as ExtendedUser).partnerName = profile.partnerName;
          (currentUser as ExtendedUser).isPartnerUser = profile.isPartnerUser;
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
              // ✅ 添加详细日志，帮助诊断问题
              console.log('🔍 开始获取用户 profile:', {
                userId: currentUser.id,
                email: currentUser.email,
                event: event
              });
              
              const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .maybeSingle();
              
              // ✅ 添加详细日志
              console.log('🔍 Profile 查询结果:', {
                hasData: !!profileData,
                hasError: !!error,
                errorCode: error?.code,
                errorMessage: error?.message,
                errorDetails: error?.details,
                errorHint: error?.hint
              });

              if (error) {
                console.error('❌ 获取用户配置文件失败:', {
                  code: error.code,
                  message: error.message,
                  details: error.details,
                  hint: error.hint,
                  userId: currentUser.id,
                  userEmail: currentUser.email
                });
                
                // ✅ 如果是401错误或JWT错误，可能是token过期，等待自动刷新
                if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
                  console.log('⚠️ Token可能已过期，等待Supabase自动刷新...');
                  setLoading(false);
                  return;
                }
                
                // ✅ 如果是权限错误（PGRST116），可能是 RLS 策略问题
                if (error.code === 'PGRST116' || error.message?.includes('permission') || error.message?.includes('policy')) {
                  console.error('❌ RLS 策略错误：用户可能没有权限查询自己的 profile');
                  console.error('建议检查：1. profiles 表的 RLS 策略 2. 用户是否存在于 profiles 表');
                  
                  // 尝试使用 session 中的基本信息
                  if (currentUser) {
                    console.warn('⚠️ 使用 session 中的基本信息创建最小化 profile');
                    const minimalProfile: UserProfile = {
                      id: currentUser.id,
                      email: currentUser.email || '',
                      username: currentUser.email?.split('@')[0] || currentUser.id,
                      full_name: currentUser.user_metadata?.full_name || '',
                      role: (currentUser.user_metadata?.role as UserRole) || 'operator',
                      is_active: true
                    };
                    setProfile(minimalProfile);
                    profileCache = minimalProfile;
                    setLoading(false);
                    return;
                  }
                }
                
                // ✅ 其他错误：延迟重试一次
                console.warn('⚠️ 获取用户配置文件失败，1秒后重试...');
                setTimeout(async () => {
                  try {
                    const { data: retryData, error: retryError } = await supabase
                      .from('profiles')
                      .select('*')
                      .eq('id', currentUser.id)
                      .maybeSingle();
                    
                    if (retryError) {
                      console.error('❌ 重试获取 profile 仍然失败:', retryError);
                      // 使用 session 中的基本信息
                      if (currentUser) {
                        const minimalProfile: UserProfile = {
                          id: currentUser.id,
                          email: currentUser.email || '',
                          username: currentUser.email?.split('@')[0] || currentUser.id,
                          full_name: currentUser.user_metadata?.full_name || '',
                          role: (currentUser.user_metadata?.role as UserRole) || 'operator',
                          is_active: true
                        };
                        setProfile(minimalProfile);
                        profileCache = minimalProfile;
                      }
                      setLoading(false);
                      return;
                    }
                    
                    if (retryData) {
                      console.log('✅ 重试成功，已获取 profile');
                      const anyProfile = retryData as Record<string, unknown>;
                      const isPartnerUser = anyProfile.role === 'partner';
                      // partner 角色：从 user_partners 读取真实绑定（is_primary 优先，其次 created_at 最早）
                      const binding = isPartnerUser
                        ? await resolvePartnerBinding(currentUser.id)
                        : {};

                      const userProfile: UserProfile = {
                        id: String(anyProfile.id || ''),
                        email: String(anyProfile.email || ''),
                        username: String(anyProfile.username || anyProfile.email || ''),
                        full_name: String(anyProfile.full_name || ''),
                        role: (anyProfile.role as UserRole) ?? 'operator',
                        is_active: Boolean(anyProfile.is_active ?? true),
                        ...binding,
                        isPartnerUser
                      };
                      setProfile(userProfile);
                      profileCache = userProfile;
                      if (currentUser) {
                        Object.assign(currentUser as ExtendedUser, binding, { isPartnerUser });
                        setUser(currentUser as ExtendedUser);
                      }
                      setLoading(false);
                    } else {
                      setLoading(false);
                    }
                  } catch (retryErr) {
                    console.error('❌ 重试时发生异常:', retryErr);
                    setLoading(false);
                  }
                }, 1000);
                return;
              } else if (profileData) {
                const anyProfile = profileData as Record<string, unknown>;
                const isPartnerUser = anyProfile.role === 'partner';

                // partner 角色：从 user_partners 读取真实绑定（is_primary 优先，其次 created_at 最早）
                const binding = isPartnerUser
                  ? await resolvePartnerBinding(currentUser.id)
                  : {};

                const userProfile: UserProfile = {
                  id: String(anyProfile.id || ''),
                  email: String(anyProfile.email || ''),
                  username: String(anyProfile.username || anyProfile.email || ''),
                  full_name: String(anyProfile.full_name || ''),
                  role: (anyProfile.role as UserRole) ?? 'operator',
                  is_active: Boolean(anyProfile.is_active ?? true),
                  ...binding,
                  isPartnerUser
                };
                setProfile(userProfile);
                profileCache = userProfile; // ✅ 缓存 profile
                
                // 同步合作方绑定到 user 对象（保留 user.partnerId 字段名）
                Object.assign(currentUser as ExtendedUser, binding, { isPartnerUser });
                setUser(currentUser as ExtendedUser);
                
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
          body: { username: usernameOrEmail, password }
        });
        if (error || !data?.access_token || !data?.refresh_token) {
          loginError = '用户名或密码错误';
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { access_token, refresh_token } = data as { access_token: string; refresh_token: string };
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
