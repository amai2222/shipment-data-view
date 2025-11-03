// 顶部加载进度条组件
// 参考中国主流企业系统（钉钉、企业微信、飞书）的加载样式

import { useEffect, useState } from 'react';
import { useNavigation } from 'react-router-dom';

export function TopLoadingBar() {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isLoading) {
      // 快速到达90%
      const timer1 = setTimeout(() => setProgress(30), 100);
      const timer2 = setTimeout(() => setProgress(60), 200);
      const timer3 = setTimeout(() => setProgress(90), 300);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    } else {
      // 完成后快速到100%然后隐藏
      setProgress(100);
      const timer = setTimeout(() => {
        setProgress(0);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div
        className="h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300 ease-out shadow-lg"
        style={{
          width: `${progress}%`,
          boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)'
        }}
      />
    </div>
  );
}

// 简化版：不依赖路由，通过props控制
export function SimpleTopLoadingBar({ loading }: { loading?: boolean }) {
  const [progress, setProgress] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (loading) {
      setShow(true);
      setProgress(0);
      
      const timer1 = setTimeout(() => setProgress(30), 100);
      const timer2 = setTimeout(() => setProgress(60), 300);
      const timer3 = setTimeout(() => setProgress(85), 500);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    } else if (show) {
      setProgress(100);
      const timer = setTimeout(() => {
        setShow(false);
        setProgress(0);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [loading, show]);

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div
        className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
          opacity: progress === 100 ? 0 : 1
        }}
      >
        {/* 闪光效果 */}
        <div className="absolute right-0 top-0 h-full w-20 bg-gradient-to-r from-transparent to-white/30 animate-pulse" />
      </div>
    </div>
  );
}

