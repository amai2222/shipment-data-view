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
    'A listener indicated an asynchronous response by returning true, but the message channel closed',
    'chrome-extension://',
    'moz-extension://',
    'safari-extension://',
    'ERR_ADDRESS_INVALID', // Cloudflare Insights加载失败（非关键）
    'cloudflareinsights',
    'beacon.min.js'
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
  
  // 忽略浏览器扩展导致的Promise拒绝
  const ignoredRejections = [
    'A listener indicated an asynchronous response',
    'message channel closed',
    'chrome-extension://',
    'ERR_ADDRESS_INVALID',
    'cloudflareinsights'
  ];
  
  const shouldIgnore = ignoredRejections.some(pattern => 
    reason.includes(pattern)
  );
  
  if (shouldIgnore) {
    // 静默忽略
    event.preventDefault();
    return;
  }
  
  // 其他错误正常处理
  console.error('Unhandled promise rejection:', event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
