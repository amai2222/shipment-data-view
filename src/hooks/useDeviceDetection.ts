import { useState, useEffect } from 'react';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWorkWeChat: boolean;
  isTouchDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  userAgent: string;
}

export function useDeviceDetection(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    // 初始化检测
    const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
    
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isWorkWeChat: false,
      isTouchDevice: false,
      screenWidth,
      screenHeight,
      userAgent,
    };
  });

  useEffect(() => {
    const detectDevice = () => {
      const userAgent = navigator.userAgent;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      // 检测移动设备
      const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isSmallScreen = screenWidth <= 768;
      const isMobile = isMobileDevice || isSmallScreen;
      
      // 检测平板
      const isTablet = /iPad|Android/i.test(userAgent) && screenWidth > 768 && screenWidth <= 1024;
      
      // 检测桌面
      const isDesktop = !isMobile && !isTablet;
      
      // 检测企业微信环境
      const isWorkWeChat = /MicroMessenger/i.test(userAgent) && /wxwork/i.test(userAgent);
      
      // 检测触屏设备
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        isWorkWeChat,
        isTouchDevice,
        screenWidth,
        screenHeight,
        userAgent,
      });
    };

    // 初始检测
    detectDevice();

    // 监听窗口大小变化
    const handleResize = () => {
      detectDevice();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceInfo;
}

// 导出便捷的检测函数
export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  
  const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isSmallScreen = screenWidth <= 768;
  
  if (isMobileDevice || isSmallScreen) return 'mobile';
  if (/iPad|Android/i.test(userAgent) && screenWidth > 768 && screenWidth <= 1024) return 'tablet';
  return 'desktop';
};

export const isWorkWechatEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent;
  return /MicroMessenger/i.test(userAgent) && /wxwork/i.test(userAgent);
};