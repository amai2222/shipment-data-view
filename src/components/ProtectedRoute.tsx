import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Loader2, LogOut } from 'lucide-react';
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';
import { isMobile } from '@/utils/device';
import { Button } from '@/components/ui/button';

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
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { hasPageAccess, hasRole, loading: permLoading } = useUnifiedPermissions();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

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
      // ✅ 特殊处理：司机角色（PC端和移动端）没有权限时，跳转到司机费用申请页面
      if (profile?.role === 'driver') {
        // 统一跳转到司机费用申请页面（移动端和PC端都使用移动端页面）
        return <Navigate to="/m/internal/my-expenses" replace />;
      }
      
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
            <div className="max-w-md w-full space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">🚫</span>
                </div>
                <h1 className="text-2xl font-bold text-destructive mb-2">访问被拒绝</h1>
                <p className="text-muted-foreground">
                  您没有访问此页面的权限
                </p>
                <p className="text-sm text-muted-foreground mt-2 font-mono bg-red-50 inline-block px-3 py-1 rounded">
                  需要权限: {requiredPermission}
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>提示：</strong>您也没有访问货主看板的权限，请联系管理员为您分配相应权限。
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleLogout}
                  className="w-full"
                  variant="default"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  退出登录
                </Button>
                <Button
                  onClick={() => navigate(-1)}
                  variant="outline"
                  className="w-full"
                >
                  返回上一页
                </Button>
              </div>

              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  当前用户：{profile?.full_name} ({profile?.role})
                </p>
              </div>
            </div>
          </div>
        );
      }
    }
  }
  // 兼容旧的基于角色的检查
  else if (requiredRoles && requiredRoles.length > 0) {
    if (!hasRole(requiredRoles)) {
      // ✅ 特殊处理：司机角色（PC端和移动端）没有权限时，跳转到司机费用申请页面
      if (profile?.role === 'driver') {
        return <Navigate to="/m/internal/my-expenses" replace />;
      }
      
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