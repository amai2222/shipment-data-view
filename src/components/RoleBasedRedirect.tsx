// 根据角色自动重定向到对应的首页
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isMobile } from '@/utils/device';

export default function RoleBasedRedirect() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !profile) return;

    const role = profile.role;
    const mobile = isMobile();

    // 根据角色和设备跳转
    if (role === 'driver') {
      // 司机：跳转到移动端我的车辆
      if (mobile) {
        navigate('/m/internal/my-vehicles', { replace: true });
      } else {
        // PC端司机没有权限，跳转到无权限页面
        navigate('/unauthorized', { replace: true });
      }
    } else if (role === 'fleet_manager') {
      // 车队长：跳转到移动端工作台
      if (mobile) {
        navigate('/m/internal/fleet-dashboard', { replace: true });
      } else {
        // PC端跳转到内部车辆管理
        navigate('/internal/vehicles', { replace: true });
      }
    } else if (role === 'partner') {
      // 货主：跳转到货主看板
      navigate(mobile ? '/m/dashboard/shipper' : '/dashboard/shipper', { replace: true });
    } else if (role === 'admin') {
      // 管理员：跳转到运输概览
      navigate('/dashboard/transport', { replace: true });
    } else if (role === 'finance') {
      // 财务：跳转到运输概览
      navigate('/dashboard/transport', { replace: true });
    } else {
      // 其他角色：跳转到业务录入
      navigate('/business-entry', { replace: true });
    }
  }, [profile, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">正在加载...</p>
        </div>
      </div>
    );
  }

  return null;
}

