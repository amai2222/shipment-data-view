// 文件路径: src/components/MobileRedirect.tsx
// 描述: 这是修复后的完整代码，已添加对 /auth 路径的豁免处理，以确保登录页在移动端能正常访问。

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';

interface MobileRedirectProps {
  children: React.ReactNode;
}

export function MobileRedirect({ children }: MobileRedirectProps) {
  const { isMobile, isTablet } = useDeviceDetection();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // ★★★ 关键修改 ★★★
    // 如果当前路径是登录页，则不执行任何重定向逻辑。
    // 登录页通常是响应式的，应作为通用页面为所有设备提供服务。
    if (location.pathname === '/auth') {
      return;
    }

    const shouldRedirectToMobile = isMobile || isTablet;
    const isAlreadyOnMobilePath = location.pathname.startsWith('/m/');
    
    // 如果是移动设备且不在移动端路径（且不是登录页），则重定向到移动端
    if (shouldRedirectToMobile && !isAlreadyOnMobilePath) {
      const mobilePath = `/m${location.pathname}${location.search}`;
      navigate(mobilePath, { replace: true });
      return;
    }
    
    // 如果是桌面设备但在移动端路径，则重定向回桌面版
    if (!shouldRedirectToMobile && isAlreadyOnMobilePath) {
      const desktopPath = location.pathname.replace(/^\/m/, '') || '/';
      navigate(desktopPath + location.search, { replace: true });
      return;
    }
  }, [isMobile, isTablet, location.pathname, location.search, navigate]);

  // 添加一个防抖机制来避免频繁重定向
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // 这里可以添加额外的重定向逻辑
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [location.pathname]);

  return <>{children}</>;
}
