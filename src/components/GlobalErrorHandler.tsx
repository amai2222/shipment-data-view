// 全局错误处理器
// 捕获所有未处理的JavaScript错误和Promise拒绝

import { useEffect } from 'react';
import { logErrorToDatabase, extractErrorInfo, extractUnhandledRejectionInfo, extractNetworkErrorInfo } from '@/utils/errorLogger';

export function GlobalErrorHandler({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 1. 捕获全局JavaScript错误
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.error?.message || event.message || '';
      const errorSource = event.filename || '';
      
      // 忽略一些常见的、不影响功能的错误
      const ignoredErrors = [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        'Script error', // 跨域脚本错误，通常无法获取详细信息
        'A listener indicated an asynchronous response by returning true, but the message channel closed',
        'chrome-extension://',
        'moz-extension://',
        'safari-extension://',
        'ERR_ADDRESS_INVALID', // Cloudflare Insights加载失败（非关键）
        'cloudflareinsights',
        'beacon.min.js',
        'static.cloudflareinsights.com',
        'Content Security Policy', // CSP违规（通常是浏览器扩展导致的）
        'violates the following Content Security Policy directive',
        'Executing inline script violates',
        'Either the \'unsafe-inline\' keyword',
        'tab.js', // 浏览器扩展脚本
        // Supabase相关错误（表不存在或查询失败，已有错误处理）
        'fleet manager projects',
        'internal driver vehicle change',
        'supabase.co/rest/v1/',
        '400 (Bad Request)',
        '404 (Not Found)'
      ];
      
      // 检查错误消息或来源
      const shouldIgnore = ignoredErrors.some(pattern => 
        errorMessage.includes(pattern) || errorSource.includes(pattern)
      );
      
      if (shouldIgnore) {
        // 静默忽略，不输出到控制台
        event.preventDefault();
        return;
      }
      
      console.error('全局JavaScript错误:', event);
      
      // 创建Error对象（如果event.error不存在）
      const error = event.error || new Error(event.message || 'Unknown error');
      
      // 记录错误到数据库
      const errorData = extractErrorInfo(error);
      errorData.metadata = {
        ...errorData.metadata,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: new Date().toISOString()
      };
      
      logErrorToDatabase(errorData).catch(err => {
        console.error('记录全局错误失败:', err);
      });
    };

    // 2. 捕获未处理的Promise拒绝
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || event.reason?.toString() || '';
      
      // 忽略浏览器扩展导致的Promise拒绝
      const ignoredRejections = [
        'A listener indicated an asynchronous response',
        'message channel closed',
        'chrome-extension://',
        'moz-extension://',
        'safari-extension://',
        'ERR_ADDRESS_INVALID',
        'cloudflareinsights',
        'beacon.min.js',
        'static.cloudflareinsights.com',
        'Content Security Policy',
        'violates the following Content Security Policy directive',
        'Executing inline script violates',
        'Either the \'unsafe-inline\' keyword',
        'tab.js', // 浏览器扩展脚本
        // Supabase相关错误（表不存在或查询失败，已有错误处理）
        'fleet manager projects',
        'internal driver vehicle change',
        'supabase.co/rest/v1/',
        '400 (Bad Request)',
        '404 (Not Found)'
      ];
      
      const shouldIgnore = ignoredRejections.some(pattern => 
        reason.includes(pattern)
      );
      
      if (shouldIgnore) {
        // 静默忽略
        event.preventDefault();
        return;
      }
      
      console.error('未处理的Promise拒绝:', event.reason);
      
      // 记录错误到数据库
      const errorData = extractUnhandledRejectionInfo(event.reason);
      logErrorToDatabase(errorData).catch(err => {
        console.error('记录Promise拒绝失败:', err);
      });
    };

    // 3. 捕获网络请求错误（通过fetch拦截）
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        const url = args[0]?.toString() || '';
        
        // 忽略Cloudflare Insights和浏览器扩展相关的错误
        const ignoredNetworkErrors = [
          'cloudflareinsights',
          'beacon.min.js',
          'static.cloudflareinsights.com',
          'chrome-extension://',
          'moz-extension://',
          'safari-extension://',
          'tab.js'
        ];
        
        const isIgnoredNetworkError = ignoredNetworkErrors.some(pattern => 
          url.includes(pattern)
        );
        
        // 忽略Supabase相关的400/404错误（表不存在或查询失败，已有错误处理）
        const ignoredSupabaseErrors = [
          'fleet manager projects',
          'internal driver vehicle change',
          'internal_vehicle_change_applications',
          'fleet_manager_projects',
          'supabase.co/rest/v1/'
        ];
        
        const isIgnoredSupabaseError = ignoredSupabaseErrors.some(pattern => 
          url.includes(pattern)
        ) && (response.status === 400 || response.status === 404);
        
        // 如果是应该忽略的网络错误，直接返回，不记录
        if (isIgnoredNetworkError) {
          return response;
        }
        
        // 如果响应状态码表示错误，记录到数据库（但忽略Cloudflare Insights和Supabase的400/404错误）
        if (!response.ok && response.status >= 400 && !isIgnoredNetworkError && !isIgnoredSupabaseError) {
          const method = (args[1]?.method || 'GET').toUpperCase();
          
          // 尝试读取响应文本（限制长度）
          let responseText = '';
          try {
            const clonedResponse = response.clone();
            const text = await clonedResponse.text();
            responseText = text.substring(0, 500); // 限制长度
          } catch (e) {
            // 忽略读取响应失败
          }
          
          // 记录网络错误到数据库
          const errorData = extractNetworkErrorInfo(
            url,
            method,
            response.status,
            response.statusText,
            responseText
          );
          
          logErrorToDatabase(errorData).catch(err => {
            console.error('记录网络错误失败:', err);
          });
        }
        
        return response;
      } catch (error) {
        // 网络请求本身失败（如网络断开）
        const url = args[0]?.toString() || '';
        const method = (args[1]?.method || 'GET').toUpperCase();
        
        // 忽略Cloudflare Insights和浏览器扩展相关的错误
        const ignoredNetworkErrors = [
          'cloudflareinsights',
          'beacon.min.js',
          'static.cloudflareinsights.com',
          'ERR_ADDRESS_INVALID',
          'chrome-extension://',
          'moz-extension://',
          'safari-extension://',
          'tab.js'
        ];
        
        const isIgnoredNetworkError = ignoredNetworkErrors.some(pattern => 
          url.includes(pattern) || (error as any)?.message?.includes(pattern)
        );
        
        // 忽略Supabase相关的错误
        const ignoredSupabaseErrors = [
          'fleet manager projects',
          'internal driver vehicle change',
          'supabase.co/rest/v1/'
        ];
        
        const isIgnoredSupabaseError = ignoredSupabaseErrors.some(pattern => 
          url.includes(pattern)
        );
        
        // 如果是应该忽略的网络错误，直接抛出，不记录
        if (isIgnoredNetworkError || isIgnoredSupabaseError) {
          // 静默忽略，不输出到控制台
          throw error; // 重新抛出，但不记录
        }
        
        if (!isIgnoredSupabaseError) {
          const errorData = extractNetworkErrorInfo(
            url,
            method,
            undefined,
            error instanceof Error ? error.message : String(error)
          );
          
          logErrorToDatabase(errorData).catch(err => {
            console.error('记录网络请求失败:', err);
          });
        }
        
        throw error;
      }
    };

    // 注册事件监听器
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // 清理函数
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.fetch = originalFetch; // 恢复原始fetch
    };
  }, []);

  return <>{children}</>;
}

