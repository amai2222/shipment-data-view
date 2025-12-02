// 司机移动端 - 设置页面

import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DriverMobileLayout } from '@/components/mobile/DriverMobileLayout';
import { 
  ArrowLeft,
  Lock,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function MobileDriverSettings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: '已退出登录',
        description: '感谢使用'
      });
    } catch (error) {
      console.error('退出登录失败:', error);
      toast({
        title: '退出失败',
        description: '请重试',
        variant: 'destructive'
      });
    }
  };

  // 设置项列表
  const settingsItems = [
    {
      id: 'security',
      icon: Lock,
      title: '修改密码',
      description: '更改登录密码',
      onClick: () => navigate('/m/internal/driver-security'),
      showArrow: true
    }
  ];

  return (
    <DriverMobileLayout title="设置">
      <div className="min-h-screen bg-gray-50/50">
        {/* 设置列表 */}
        <div className="px-4 pt-4 pb-2">
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-0">
              {settingsItems.map((item, index) => (
                <div key={item.id}>
                  <button
                    onClick={item.onClick}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-4 bg-white hover:bg-gray-50/50 active:bg-gray-100 transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-0"
                    )}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-base font-medium text-foreground">
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                    {item.showArrow && (
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                  {index < settingsItems.length - 1 && (
                    <Separator className="mx-4" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* 退出登录 */}
        <div className="px-4 pt-4 pb-6">
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-0">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-4 bg-white hover:bg-red-50/50 active:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <LogOut className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-base font-medium text-red-600">
                    退出登录
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    安全退出当前账户
                  </p>
                </div>
              </button>
            </CardContent>
          </Card>
        </div>

        {/* 版本信息 */}
        <div className="px-4 pb-8">
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground">物流管理系统 v1.0.0</p>
            <p className="text-xs text-muted-foreground">© 2024 中科物流. 保留所有权利</p>
          </div>
        </div>
      </div>
    </DriverMobileLayout>
  );
}

