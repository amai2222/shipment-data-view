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

    // ✅ PC端内部车辆管理路径（/internal/*）- 永不重定向
    if (location.pathname.startsWith('/internal/')) {
      return;  // PC端专用，不做任何重定向
    }

    // 对于移动端内部车辆管理路径（/m/internal/*），不做任何重定向
    // 因为这些页面是专为移动端设计的，即使在PC端也应该保持移动端路径
    if (location.pathname.startsWith('/m/internal/')) {
      return;
    }

    // ✅ PC端专用路径（不重定向到移动端）
    const pcOnlyPaths = [
      '/internal/',  // 内部车辆管理（PC端）
      '/dashboard/',  // 看板（PC端）
      '/business-entry',  // 业务录入（PC端）
      '/settings/',  // 设置（PC端）
      '/data-maintenance',  // 数据维护（PC端）
      '/payment-request',  // 付款申请（PC端）
      '/invoice-request',  // 开票申请（PC端）
    ];
    
    const isPCOnlyPath = pcOnlyPaths.some(path => location.pathname.startsWith(path));

    const shouldRedirectToMobile = isMobile || isTablet;
    const isAlreadyOnMobilePath = location.pathname.startsWith('/m/');
    
    // 如果是移动设备且不在移动端路径，且不是PC专用路径，则重定向到移动端
    if (shouldRedirectToMobile && !isAlreadyOnMobilePath && !isPCOnlyPath) {
      const mobilePath = `/m${location.pathname}${location.search}`;
      navigate(mobilePath, { replace: true });
      return;
    }
    
    // 如果是桌面设备但在移动端路径，则重定向回桌面版
    // 但排除内部车辆管理路径（已在上面处理）
    if (!shouldRedirectToMobile && isAlreadyOnMobilePath) {
      const desktopPath = location.pathname.replace(/^\/m/, '') || '/';
      navigate(desktopPath + location.search, { replace: true });
      return;
    }
  }, [isMobile, isTablet, location.pathname, location.search, navigate]);

  return <>{children}</>;
}
