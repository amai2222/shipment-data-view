import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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

  if (requiredRoles && !requiredRoles.includes(profile.role)) {
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
            onClick={() => navigate('/home')} 
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

  return <>{children}</>;
}