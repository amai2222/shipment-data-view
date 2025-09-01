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
    const shouldRedirectToMobile = isMobile || isTablet;
    const isAlreadyOnMobilePath = location.pathname.startsWith('/m/');
    
    // 如果是移动设备且不在移动端路径，则重定向到移动端
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

  return <>{children}</>;
}