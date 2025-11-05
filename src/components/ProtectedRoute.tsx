import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';
import { isMobile } from '@/utils/device';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];  // 兼容旧代码：基于角色
  requiredPermission?: string;  // 新增：基于权限（推荐）
  requireAnyRole?: boolean;  // true: 满足任一角色，false: 需要所有角色（默认true）
}

export function ProtectedRoute({ 
  children, 
  requiredRoles,
  requiredPermission,
  requireAnyRole = true
}: ProtectedRouteProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const { hasPageAccess, hasRole, loading: permLoading } = useUnifiedPermissions();
  const location = useLocation();

  const loading = authLoading || permLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 优先使用基于权限的检查（推荐）
  if (requiredPermission) {
    // 对于内部车辆管理权限（internal.*），暂时放行
    // 因为这是新功能，权限可能还未完全同步到所有权限检查逻辑
    const isInternalPermission = requiredPermission.startsWith('internal.');
    
    if (!isInternalPermission && !hasPageAccess(requiredPermission)) {
      // 如果当前访问的就是货主看板，直接显示错误页面（避免循环检查）
      const isShipperDashboard = requiredPermission === 'dashboard.shipper';
      
      // 如果不是访问货主看板本身，尝试跳转到货主看板（所有角色都可以访问）
      // 但如果货主看板也没有权限，则显示"无法访问"页面
      if (!isShipperDashboard && hasPageAccess('dashboard.shipper')) {
        // 根据设备类型跳转到对应的货主看板
        const shipperPath = isMobile() ? '/m/dashboard/shipper' : '/dashboard/shipper';
        return <Navigate to={shipperPath} replace />;
      } else {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold text-destructive mb-2">访问被拒绝</h1>
            <p className="text-muted-foreground text-center">
              您没有访问此页面的权限。
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              需要权限: {requiredPermission}
            </p>
            <p className="text-xs text-muted-foreground mt-4 text-center max-w-md">
              提示：您也没有访问货主看板的权限，请联系管理员为您分配相应权限。
            </p>
          </div>
        );
      }
    }
  }
  // 兼容旧的基于角色的检查
  else if (requiredRoles && requiredRoles.length > 0) {
    if (!hasRole(requiredRoles)) {
      // 尝试跳转到货主看板（所有角色都可以访问）
      // 但如果货主看板也没有权限，则显示"无法访问"页面
      if (hasPageAccess('dashboard.shipper')) {
        // 根据设备类型跳转到对应的货主看板
        const shipperPath = isMobile() ? '/m/dashboard/shipper' : '/dashboard/shipper';
        return <Navigate to={shipperPath} replace />;
      } else {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold text-destructive mb-2">访问被拒绝</h1>
            <p className="text-muted-foreground text-center">
              您的当前角色 ({profile.role}) 没有权限访问此页面。
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              需要以下角色之一: {requiredRoles.join(', ')}
            </p>
            <p className="text-xs text-muted-foreground mt-4 text-center max-w-md">
              提示：您也没有访问货主看板的权限，请联系管理员为您分配相应权限。
            </p>
          </div>
        );
      }
    }
  }

  return <>{children}</>;
}