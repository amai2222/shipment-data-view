import { useEffect, useState } from 'react';
import { useDeviceDetection } from './useDeviceDetection';

/**
 * 移动端优化Hook
 * 提供移动端性能优化和体验优化相关功能
 */
export function useMobileOptimization() {
  const { isMobile, isTablet } = useDeviceDetection();
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // 检测网络连接状态
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 检测网络速度
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const updateConnectionStatus = () => {
        const effectiveType = connection?.effectiveType;
        setIsSlowConnection(effectiveType === 'slow-2g' || effectiveType === '2g');
      };
      
      updateConnectionStatus();
      connection?.addEventListener('change', updateConnectionStatus);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection?.removeEventListener('change', updateConnectionStatus);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 禁用缩放(移动端体验优化)
  useEffect(() => {
    if (isMobile || isTablet) {
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
        );
      }
    }
  }, [isMobile, isTablet]);

  // 防止iOS橡皮筋效果
  useEffect(() => {
    if (isMobile || isTablet) {
      const preventBounce = (e: TouchEvent) => {
        const target = e.target as HTMLElement;
        const scrollable = target.closest('[data-scrollable]');
        
        if (!scrollable) {
          e.preventDefault();
        }
      };

      document.body.addEventListener('touchmove', preventBounce, { passive: false });

      return () => {
        document.body.removeEventListener('touchmove', preventBounce);
      };
    }
  }, [isMobile, isTablet]);

  return {
    isMobile,
    isTablet,
    isSlowConnection,
    isOnline,
    shouldReduceMotion: isSlowConnection,
    shouldLazyLoad: isMobile || isTablet || isSlowConnection,
    shouldUseVirtualList: isMobile || isTablet
  };
}

/**
 * 触觉反馈Hook (支持的设备)
 */
export function useHapticFeedback() {
  const vibrate = (pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  return {
    lightImpact: () => vibrate(10),
    mediumImpact: () => vibrate(20),
    heavyImpact: () => vibrate(30),
    success: () => vibrate([10, 50, 10]),
    warning: () => vibrate([10, 50, 10, 50, 10]),
    error: () => vibrate([50, 100, 50])
  };
}

/**
 * 安全区域Hook (适配刘海屏等)
 */
export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  });

  useEffect(() => {
    const updateSafeArea = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      setSafeArea({
        top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0'),
        right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0'),
        bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
        left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0')
      });
    };

    updateSafeArea();
    window.addEventListener('resize', updateSafeArea);

    return () => window.removeEventListener('resize', updateSafeArea);
  }, []);

  return safeArea;
}

