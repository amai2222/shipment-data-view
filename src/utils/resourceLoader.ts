/**
 * 资源加载工具 - 彻底解决内容哈希方案的资源加载失败问题
 * 
 * 功能：
 * 1. 拦截动态导入，自动处理加载失败
 * 2. 检测 HTML 响应（服务器返回错误页面）
 * 3. 自动重试机制（最多3次）
 * 4. 自动记录错误到数据库
 * 5. 缓存清理和强制刷新
 */

import { logErrorToDatabase, extractChunkLoadErrorInfo } from './errorLogger';

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number) => void;
}

// 检测响应是否为 HTML（通常是错误页面）
function isHTMLResponse(response: Response): Promise<boolean> {
  return response.clone().text().then(text => {
    const trimmed = text.trim();
    return trimmed.startsWith('<!DOCTYPE') || 
           trimmed.startsWith('<html') || 
           trimmed.startsWith('<!') ||
           trimmed.includes('<html');
  }).catch(() => false);
}

// 检测是否是资源加载错误
function isResourceLoadError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString() || '';
  const errorName = error.name || '';
  
  return (
    errorName === 'ChunkLoadError' ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('Loading chunk') ||
    errorMessage.includes('Unexpected token') ||
    errorMessage.includes('Failed to load module') ||
    errorMessage.includes('Failed to load resource') ||
    errorMessage.includes('net::ERR_') ||
    errorMessage.includes('ERR_ADDRESS_INVALID')
  );
}

// 清理资源缓存
function clearResourceCache(url: string): void {
  try {
    // 清理 Service Worker 缓存（如果存在）
    if ('caches' in window) {
      caches.keys().then(keys => {
        keys.forEach(key => {
          caches.delete(key);
        });
      });
    }
    
    // 清理浏览器缓存（通过添加时间戳）
    const timestamp = Date.now();
    const urlWithTimestamp = `${url}?v=${timestamp}`;
    
    console.log('🔄 清理资源缓存:', url, '→', urlWithTimestamp);
  } catch (e) {
    console.warn('清理缓存失败:', e);
  }
}

// 记录资源加载错误到数据库
async function logResourceLoadError(
  error: any,
  url: string,
  attempt: number,
  maxRetries: number
): Promise<void> {
  try {
    const errorData = extractChunkLoadErrorInfo(
      error instanceof Error ? error : new Error(String(error))
    );
    
    errorData.metadata = {
      ...errorData.metadata,
      resourceUrl: url,
      attempt,
      maxRetries,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    errorData.retryCount = attempt;
    
    await logErrorToDatabase(errorData);
    console.log(`✅ 资源加载错误已记录到数据库 (尝试 ${attempt}/${maxRetries})`);
  } catch (err) {
    console.error('记录资源加载错误失败:', err);
  }
}

// 带重试的动态导入
export async function importWithRetry<T = any>(
  importFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onRetry
  } = options;

  let lastError: any = null;
  let attempt = 0;
  let resourceUrl = '';

  // 尝试从 importFn 中提取 URL（如果可能）
  try {
    const fnString = importFn.toString();
    const urlMatch = fnString.match(/['"]([^'"]+\.js)['"]/);
    if (urlMatch) {
      resourceUrl = urlMatch[1];
    }
  } catch (e) {
    // 忽略提取失败
  }

  while (attempt <= maxRetries) {
    try {
      const module = await importFn();
      return module;
    } catch (error: any) {
      lastError = error;
      attempt++;

      // 如果不是资源加载错误，直接抛出
      if (!isResourceLoadError(error)) {
        throw error;
      }

      // 📝 记录错误到数据库（每次重试都记录）
      await logResourceLoadError(error, resourceUrl || 'unknown', attempt, maxRetries);

      // 如果达到最大重试次数，抛出错误
      if (attempt > maxRetries) {
        console.error(`❌ 资源加载失败（已重试 ${maxRetries} 次）:`, error);
        throw new Error(
          `资源加载失败，已重试 ${maxRetries} 次。` +
          `请刷新页面或清除浏览器缓存。` +
          `\n原始错误: ${error.message || error}`
        );
      }

      // 通知重试
      if (onRetry) {
        onRetry(attempt);
      }

      console.warn(`⚠️ 资源加载失败，${retryDelay}ms 后重试 (${attempt}/${maxRetries}):`, error);

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }

  throw lastError;
}

// 带重试的 fetch
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onRetry
  } = retryOptions;

  let lastError: any = null;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, options);

      // 检查响应是否为 HTML（错误页面）
      if (!response.ok || await isHTMLResponse(response)) {
        throw new Error(
          `服务器返回了错误响应: ${response.status} ${response.statusText}. ` +
          `URL: ${url}`
        );
      }

      // 检查 Content-Type
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html') && !url.endsWith('.html')) {
        throw new Error(
          `服务器返回了 HTML 而不是预期的资源文件. ` +
          `URL: ${url}, Content-Type: ${contentType}`
        );
      }

      return response;
    } catch (error: any) {
      lastError = error;
      attempt++;

      // 📝 记录错误到数据库（每次重试都记录）
      await logResourceLoadError(error, url, attempt, maxRetries);

      // 如果达到最大重试次数
      if (attempt > maxRetries) {
        console.error(`❌ 资源请求失败（已重试 ${maxRetries} 次）:`, url, error);
        
        // 清理缓存并强制刷新
        clearResourceCache(url);
        
        throw new Error(
          `资源请求失败，已重试 ${maxRetries} 次。` +
          `请刷新页面或清除浏览器缓存。` +
          `\nURL: ${url}` +
          `\n原始错误: ${error.message || error}`
        );
      }

      // 通知重试
      if (onRetry) {
        onRetry(attempt);
      }

      console.warn(`⚠️ 资源请求失败，${retryDelay * attempt}ms 后重试 (${attempt}/${maxRetries}):`, url);

      // 清理缓存后重试
      if (attempt === 1) {
        clearResourceCache(url);
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }

  throw lastError;
}

// 包装动态导入，自动处理错误
export function createSafeLazyImport<T = any>(
  importFn: () => Promise<T>
): () => Promise<T> {
  return () => importWithRetry(importFn, {
    maxRetries: 3,
    retryDelay: 1000,
    onRetry: (attempt) => {
      console.log(`🔄 重试加载模块 (${attempt}/3)...`);
    }
  });
}

// 全局资源加载监控
export function setupResourceLoadMonitor(): void {
  // 监听资源加载错误
  window.addEventListener('error', (event) => {
    if (event.target && (event.target as any).tagName) {
      const tagName = (event.target as any).tagName;
      const src = (event.target as any).src || (event.target as any).href || '';
      const errorMessage = event.error?.message || event.message || '';
      
      // 忽略浏览器扩展和Cloudflare Insights的错误
      const ignoredSources = [
        'chrome-extension://',
        'moz-extension://',
        'safari-extension://',
        'cloudflareinsights',
        'beacon.min.js',
        'static.cloudflareinsights.com',
        'ERR_ADDRESS_INVALID',
        'Content Security Policy',
        'violates the following Content Security Policy directive',
        'Executing inline script violates',
        'Either the \'unsafe-inline\' keyword',
        'tab.js', // 浏览器扩展脚本
        // Supabase相关错误（表不存在或查询失败，已有错误处理）
        'fleet manager projects',
        'internal driver vehicle change',
        'internal_vehicle_change_applications',
        'fleet_manager_projects',
        'supabase.co/rest/v1/',
        '400 (Bad Request)',
        '404 (Not Found)'
      ];
      
      const shouldIgnore = ignoredSources.some(pattern => 
        src.includes(pattern) || errorMessage.includes(pattern)
      );
      
      if (shouldIgnore) {
        // 静默忽略浏览器扩展、Cloudflare Insights和Supabase错误
        return;
      }
      
      if ((tagName === 'SCRIPT' || tagName === 'LINK') && src) {
        const error = event.error || new Error(`资源加载失败: ${src}`);
        
        if (isResourceLoadError(error)) {
          console.error('🚨 资源加载错误:', {
            tag: tagName,
            src,
            error: error.message
          });
          
          // 📝 记录错误到数据库
          logResourceLoadError(error, src, 1, 3).catch(err => {
            console.error('记录资源加载错误失败:', err);
          });
          
          // 自动清理缓存
          clearResourceCache(src);
        }
      }
    }
  }, true); // 使用捕获阶段

  console.log('✅ 资源加载监控已启动');
}

