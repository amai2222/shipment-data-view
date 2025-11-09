// 全局API错误处理工具
// 用于统一处理Supabase API请求的错误，特别是401认证错误

import { relaxedSupabase as supabase } from './supabase-helpers';

/**
 * 检查错误是否为认证错误（401或token过期）
 */
export function isAuthError(error: any): boolean {
  if (!error) return false;
  
  // 检查HTTP状态码
  if (error.status === 401 || error.statusCode === 401) {
    return true;
  }
  
  // 检查Supabase错误代码
  if (error.code === 'PGRST301' || error.code === 'PGRST116') {
    return true;
  }
  
  // 检查错误消息
  const errorMessage = error.message || error.toString() || '';
  if (
    errorMessage.includes('JWT') ||
    errorMessage.includes('token') ||
    errorMessage.includes('expired') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('authentication')
  ) {
    return true;
  }
  
  return false;
}

/**
 * 处理认证错误 - 清除session并跳转到登录页
 */
export function handleAuthError(error: any): void {
  console.warn('🔐 检测到认证错误，清除session并跳转到登录页:', error);
  
  // 清除Supabase session
  supabase.auth.signOut().catch(err => {
    console.error('清除session失败:', err);
  });
  
  // 跳转到登录页（如果不在登录页）
  if (window.location.pathname !== '/auth') {
    // 保存当前路径，以便登录后跳转回来
    const returnPath = window.location.pathname + window.location.search;
    window.location.href = `/auth?return=${encodeURIComponent(returnPath)}`;
  }
}

/**
 * 包装Supabase查询，自动处理认证错误
 */
export async function safeSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  try {
    const result = await queryFn();
    
    // 如果返回错误且是认证错误，处理它
    if (result.error && isAuthError(result.error)) {
      handleAuthError(result.error);
      return { data: null, error: result.error };
    }
    
    return result;
  } catch (error: any) {
    // 捕获异常中的认证错误
    if (isAuthError(error)) {
      handleAuthError(error);
    }
    return { data: null, error };
  }
}

