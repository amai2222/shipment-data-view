// 无权限访问页面

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldX, ArrowLeft, Home, LogOut } from 'lucide-react';

export default function Unauthorized() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleGoHome = () => {
    // 根据角色跳转到对应首页
    const roleHomePage: Record<string, string> = {
      driver: '/m/internal/my-expenses',
      fleet_manager: '/m/internal/fleet-dashboard',
      partner: '/m/dashboard/shipper',
      finance: '/m/dashboard/financial',
      operator: '/m/business-entry',
      admin: '/m/',
      business: '/m/',
      viewer: '/m/'
    };

    const homePath = roleHomePage[profile?.role || ''] || '/m/';
    navigate(homePath);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-12 pb-8">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* 图标 */}
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <ShieldX className="h-10 w-10 text-red-600" />
            </div>

            {/* 标题 */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">访问被拒绝</h1>
              <p className="text-gray-600">
                您没有访问此页面的权限
              </p>
            </div>

            {/* 用户信息 */}
            {profile && (
              <div className="bg-gray-50 rounded-lg p-4 w-full">
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="font-medium">用户：</span>{profile.full_name || profile.username}</p>
                  <p><span className="font-medium">角色：</span>{profile.role}</p>
                </div>
              </div>
            )}

            {/* 提示信息 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 w-full">
              <p className="text-sm text-yellow-800">
                💡 如果您认为这是错误，请联系系统管理员分配相应的访问权限。
              </p>
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-col gap-3 w-full">
              <Button
                onClick={handleGoHome}
                className="w-full"
                size="lg"
              >
                <Home className="h-4 w-4 mr-2" />
                返回首页
              </Button>

              <Button
                onClick={() => navigate(-1)}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回上一页
              </Button>

              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                size="lg"
              >
                <LogOut className="h-4 w-4 mr-2" />
                退出登录
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

