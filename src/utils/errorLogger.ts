// 前端错误日志记录工具
// 用于将浏览器控制台错误自动记录到数据库

import { supabase } from '@/integrations/supabase/client';

export interface ErrorLogData {
  errorType: 'javascript' | 'network' | 'react' | 'chunk_load' | 'unhandled_rejection';
  errorName?: string;
  errorMessage: string;
  errorStack?: string;
  errorInfo?: any; // React的errorInfo
  url?: string;
  userAgent?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  retryCount?: number;
  metadata?: Record<string, any>;
}

/**
 * 记录前端错误到数据库
 */
export async function logErrorToDatabase(errorData: ErrorLogData): Promise<void> {
  try {
    // 获取浏览器信息
    const userAgent = navigator.userAgent;
    const url = window.location.href;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 调用RPC函数记录错误
    const { data, error } = await supabase.rpc('log_frontend_error', {
      p_error_type: errorData.errorType,
      p_error_name: errorData.errorName || null,
      p_error_message: errorData.errorMessage,
      p_error_stack: errorData.errorStack || null,
      p_error_info: errorData.errorInfo ? JSON.parse(JSON.stringify(errorData.errorInfo)) : null,
      p_url: errorData.url || url,
      p_user_agent: errorData.userAgent || userAgent,
      p_viewport_width: errorData.viewportWidth || viewportWidth,
      p_viewport_height: errorData.viewportHeight || viewportHeight,
      p_retry_count: errorData.retryCount || 0,
      p_metadata: errorData.metadata || {}
    });

    if (error) {
      console.error('记录错误日志失败:', error);
    } else {
      console.log('✅ 错误日志已记录到数据库:', data);
    }
  } catch (err) {
    // 静默失败，避免影响用户体验
    console.error('记录错误日志时发生异常:', err);
  }
}

/**
 * 从Error对象提取错误信息
 */
export function extractErrorInfo(error: Error, errorInfo?: any): ErrorLogData {
  return {
    errorType: 'javascript',
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
    errorInfo: errorInfo,
    metadata: {
      errorName: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * 从网络错误提取错误信息
 */
export function extractNetworkErrorInfo(
  url: string,
  method: string,
  status?: number,
  statusText?: string,
  responseText?: string
): ErrorLogData {
  return {
    errorType: 'network',
    errorName: 'NetworkError',
    errorMessage: `网络请求失败: ${method} ${url}${status ? ` (${status} ${statusText})` : ''}`,
    metadata: {
      url,
      method,
      status,
      statusText,
      responseText: responseText?.substring(0, 500), // 限制长度
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * 从React错误提取错误信息
 */
export function extractReactErrorInfo(
  error: Error,
  errorInfo: any
): ErrorLogData {
  return {
    errorType: 'react',
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
    errorInfo: {
      componentStack: errorInfo?.componentStack,
      errorBoundary: errorInfo?.errorBoundary
    },
    metadata: {
      errorName: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * 从ChunkLoadError提取错误信息
 */
export function extractChunkLoadErrorInfo(error: Error): ErrorLogData {
  return {
    errorType: 'chunk_load',
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
    metadata: {
      errorName: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * 从未处理的Promise拒绝提取错误信息
 */
export function extractUnhandledRejectionInfo(reason: any): ErrorLogData {
  const errorMessage = reason instanceof Error 
    ? reason.message 
    : String(reason);
  const errorStack = reason instanceof Error 
    ? reason.stack 
    : undefined;
  const errorName = reason instanceof Error 
    ? reason.name 
    : 'UnhandledRejection';

  return {
    errorType: 'unhandled_rejection',
    errorName,
    errorMessage,
    errorStack,
    metadata: {
      reason: String(reason),
      timestamp: new Date().toISOString()
    }
  };
}

