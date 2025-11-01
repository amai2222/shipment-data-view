import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';

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
  const navigate = useNavigate();

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
    if (!hasPageAccess(requiredPermission)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h1 className="text-2xl font-bold text-destructive mb-2">访问被拒绝</h1>
          <p className="text-muted-foreground text-center">
            您没有访问此页面的权限。
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            需要权限: {requiredPermission}
          </p>
          <div className="mt-6">
            <Button 
              onClick={() => navigate('/')} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Button>
          </div>
        </div>
      );
    }
  }
  // 兼容旧的基于角色的检查
  else if (requiredRoles && requiredRoles.length > 0) {
    if (!hasRole(requiredRoles)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h1 className="text-2xl font-bold text-destructive mb-2">访问被拒绝</h1>
          <p className="text-muted-foreground text-center">
            您的当前角色 ({profile.role}) 没有权限访问此页面。
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            需要以下角色之一: {requiredRoles.join(', ')}
          </p>
          <div className="mt-6">
            <Button 
              onClick={() => navigate('/')} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}