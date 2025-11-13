// 货主移动端布局组件
// 限货主角色（partner角色，且partner_type为"货主"）登录

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Menu, 
  Home, 
  Bell, 
  DollarSign, 
  FileText, 
  Upload, 
  History, 
  Truck,
  Settings,
  LogOut,
  Wallet,
  CreditCard,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface ShipperMobileLayoutProps {
  children: React.ReactNode;
  showBack?: boolean;
  title?: string;
}

// 货主移动端菜单
const shipperMenuItems = [
  {
    name: '首页',
    href: '/m/shipper',
    icon: Home,
    description: '查看余额和待付款'
  },
  {
    name: '待付款',
    href: '/m/shipper/pending-payments',
    icon: AlertCircle,
    description: '待付款申请单列表',
    badge: 'pending'
  },
  {
    name: '余额充值',
    href: '/m/shipper/recharge',
    icon: Wallet,
    description: '账户余额充值'
  },
  {
    name: '提交回单',
    href: '/m/shipper/submit-receipt',
    icon: Upload,
    description: '上传银行回单'
  },
  {
    name: '运单查询',
    href: '/m/shipper/waybills',
    icon: Truck,
    description: '查询运单信息'
  },
  {
    name: '流水记录',
    href: '/m/shipper/transactions',
    icon: History,
    description: '余额流水记录'
  },
  {
    name: '设置',
    href: '/m/shipper/settings',
    icon: Settings,
    description: '个人设置'
  }
];

export function ShipperMobileLayout({ children, showBack, title }: ShipperMobileLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  // 检查是否为货主角色
  const isShipper = user?.role === 'partner' && user?.partnerId;

  // 获取未读通知数量
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['shipper-unread-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data, error } = await supabase.rpc('get_unread_notification_count', {
        p_user_id: user.id
      });
      if (error) throw error;
      return data || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30 * 1000
  });

  // 获取待付款数量
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['shipper-pending-payments-count', user?.partnerId],
    queryFn: async () => {
      if (!user?.partnerId) return 0;
      const { data, error } = await supabase.rpc('get_invoice_requests_filtered_1114', {
        p_invoicing_partner_id: user.partnerId,
        p_status: 'Completed',
        p_page_number: 1,
        p_page_size: 1
      });
      if (error) throw error;
      const result = data as { total_count?: number };
      // 筛选未全额收款的
      return result.total_count || 0;
    },
    enabled: !!user?.partnerId,
    refetchInterval: 60 * 1000
  });

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

  // 如果不是货主角色，显示错误
  if (!isShipper) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">权限不足</h2>
          <p className="text-gray-600 mb-4">您不是货主用户，无法访问此页面</p>
          <Button onClick={() => navigate('/auth')}>返回登录</Button>
        </div>
      </div>
    );
  }

  const currentPath = location.pathname;
  const pageTitle = title || shipperMenuItems.find(item => item.href === currentPath)?.name || '货主中心';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3 flex-1">
            {showBack !== false && currentPath !== '/m/shipper' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="h-9 w-9"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-lg font-semibold text-gray-900 truncate">{pageTitle}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* 通知按钮 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/m/shipper/notifications')}
              className="relative h-9 w-9"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-red-500">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Button>

            {/* 菜单按钮 */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[340px] p-0">
                <div className="flex flex-col h-full">
                  {/* 用户信息 */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-blue-500 text-white">
                          {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {user?.email || '货主用户'}
                        </p>
                        <p className="text-sm text-gray-500">货主账户</p>
                      </div>
                    </div>
                  </div>

                  {/* 菜单列表 */}
                  <ScrollArea className="flex-1">
                    <div className="p-2">
                      {shipperMenuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentPath === item.href;
                        const badgeCount = item.badge === 'pending' ? pendingCount : item.badge === 'notifications' ? unreadCount : 0;

                        return (
                          <button
                            key={item.href}
                            onClick={() => {
                              navigate(item.href);
                              setMenuOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-1 transition-colors",
                              isActive
                                ? "bg-blue-50 text-blue-600"
                                : "text-gray-700 hover:bg-gray-100"
                            )}
                          >
                            <Icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-blue-600")} />
                            <div className="flex-1 text-left min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{item.name}</p>
                                {badgeCount > 0 && (
                                  <Badge className="h-5 px-1.5 text-xs bg-red-500">
                                    {badgeCount > 99 ? '99+' : badgeCount}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">{item.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  {/* 退出登录 */}
                  <div className="p-4 border-t border-gray-200">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      退出登录
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="pb-4">
        {children}
      </main>

      {/* 底部导航栏 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
        <div className="flex items-center justify-around h-16">
          {shipperMenuItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.href;
            const badgeCount = item.badge === 'pending' ? pendingCount : 0;

            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 h-full relative",
                  isActive ? "text-blue-600" : "text-gray-500"
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {badgeCount > 0 && item.badge === 'pending' && (
                    <Badge className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-xs bg-red-500">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </Badge>
                  )}
                </div>
                <span className="text-xs font-medium">{item.name}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

