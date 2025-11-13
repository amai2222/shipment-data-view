// 货主移动端 - 设置页面（复用MobileSettings，但简化）

import { ShipperMobileLayout } from '@/components/mobile/ShipperMobileLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  Bell,
  Shield,
  LogOut,
  Info
} from 'lucide-react';

export default function MobileShipperSettings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('退出登录失败:', error);
      toast({
        title: '退出失败',
        description: '请重试',
        variant: 'destructive'
      });
    }
  };

  return (
    <ShipperMobileLayout>
      <div className="p-4 space-y-4">
        {/* 用户信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">账户信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{user?.email || '货主用户'}</p>
                <p className="text-sm text-gray-500">货主账户</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 功能设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">功能设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate('/m/shipper/notifications')}
            >
              <Bell className="h-4 w-4 mr-2" />
              通知设置
            </Button>
          </CardContent>
        </Card>

        {/* 关于 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">关于</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                toast({
                  title: '版本信息',
                  description: '货主移动端 v1.0.0'
                });
              }}
            >
              <Info className="h-4 w-4 mr-2" />
              版本信息
            </Button>
          </CardContent>
        </Card>

        {/* 退出登录 */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          退出登录
        </Button>
      </div>
    </ShipperMobileLayout>
  );
}

