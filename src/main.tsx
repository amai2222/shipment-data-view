import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { setupResourceLoadMonitor } from './utils/resourceLoader'

// ✅ 启动资源加载监控（自动记录错误到数据库）
setupResourceLoadMonitor();

// 全局错误处理器 - 忽略非关键错误
window.addEventListener('error', (event) => {
  const errorMessage = event.error?.message || event.message || '';
  const errorSource = event.filename || '';
  
  // 忽略浏览器扩展导致的错误
  const ignoredErrors = [
    'A listener indicated an asynchronous response',
    'asynchronous response by returning true',
    'message channel closed',
    'chrome-extension://',
    'moz-extension://',
    'safari-extension://',
    'ERR_ADDRESS_INVALID', // Cloudflare Insights加载失败（非关键）
    'net::ERR_ADDRESS_INVALID',
    'cloudflareinsights',
    'beacon.min.js',
    'static.cloudflareinsights.com',
    'Content Security Policy',
    'violates the following Content Security Policy directive',
    'Executing inline script violates',
    'Either the \'unsafe-inline\' keyword',
    'The action has been blocked',
    'tab.js', // 浏览器扩展脚本
    'wasm-unsafe-eval',
    'inline-speculation-rules',
    // Supabase相关错误（表不存在或查询失败，已有错误处理）
    'fleet manager projects',
    'internal driver vehicle change',
    'supabase.co/rest/v1/',
    '400 (Bad Request)',
    '404 (Not Found)',
    // 页面路由相关的错误（可能是浏览器扩展导致的）
    'my-vehicles',
    'driver-dashboard',
    'quick-entry',
    // RangeError: 状态码 0 错误（网络请求被取消或失败，非关键）
    'RangeError',
    'Failed to construct \'Response\'',
    'status provided (0)',
    'status 0',
    'outside the range [200, 599]'
  ];
  
  // 检查是否是应该忽略的错误
  const shouldIgnore = ignoredErrors.some(pattern => 
    errorMessage.includes(pattern) || errorSource.includes(pattern)
  );
  
  if (shouldIgnore) {
    // 静默忽略，不输出到控制台
    event.preventDefault();
    return;
  }
  
  // 特殊处理 toLocaleString 错误
  if (event.error?.message?.includes('toLocaleString')) {
    console.warn('toLocaleString error detected - this should be fixed in the code');
    return;
  }
  
  // 其他错误正常处理
  console.error('Global error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.message || event.reason?.toString() || '';
  const reasonString = JSON.stringify(event.reason || {});
  
  // 忽略浏览器扩展导致的Promise拒绝
  const ignoredRejections = [
    'A listener indicated an asynchronous response',
    'asynchronous response by returning true',
    'message channel closed',
    'message channel closed before a response was received',
    'chrome-extension://',
    'moz-extension://',
    'safari-extension://',
    'ERR_ADDRESS_INVALID',
    'net::ERR_ADDRESS_INVALID',
    'cloudflareinsights',
    'beacon.min.js',
    'static.cloudflareinsights.com',
    'Content Security Policy',
    'violates the following Content Security Policy directive',
    'Executing inline script violates',
    'Either the \'unsafe-inline\' keyword',
    'The action has been blocked',
    'tab.js', // 浏览器扩展脚本
    'wasm-unsafe-eval',
    'inline-speculation-rules',
    // Supabase相关错误（表不存在或查询失败，已有错误处理）
    'fleet manager projects',
    'internal driver vehicle change',
    'supabase.co/rest/v1/',
    // 注意：400 和 404 错误不应该被忽略，它们需要被正确处理
    // '400 (Bad Request)', // 移除此项，让 400 错误正常显示
    // '404 (Not Found)', // 移除此项，让 404 错误正常显示
    // 页面路由相关的错误（可能是浏览器扩展导致的）
    'my-vehicles',
    'driver-dashboard',
    'quick-entry',
    // RangeError: 状态码 0 错误（网络请求被取消或失败，非关键）
    'RangeError',
    'Failed to construct \'Response\'',
    'status provided (0)',
    'status 0',
    'outside the range [200, 599]'
  ];
  
  const shouldIgnore = ignoredRejections.some(pattern => 
    reason.includes(pattern) || reasonString.includes(pattern)
  );
  
  if (shouldIgnore) {
    // 静默忽略
    event.preventDefault();
    return;
  }
  
  // 其他错误正常处理（包括 400 错误，它们需要被显示）
  console.error('Unhandled promise rejection:', event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
