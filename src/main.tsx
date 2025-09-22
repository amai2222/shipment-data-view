import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// 全局错误处理器
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  
  // 特殊处理 toLocaleString 错误
  if (event.error?.message?.includes('toLocaleString')) {
    console.warn('toLocaleString error detected - this should be fixed in the code');
    // 可以在这里添加错误上报逻辑
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
