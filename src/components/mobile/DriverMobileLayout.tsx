// 司机版移动端布局组件 - APP样式（底部导航栏）
// 移除左侧菜单，使用主流的下方按钮导航

import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { MobileBottomNav, MobileBottomNavLayout } from './MobileBottomNav';
import { 
  Home, 
  FileText, 
  Calendar, 
  Truck,
  DollarSign,
  User,
  RefreshCw,
  Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverMobileLayoutProps {
  children: ReactNode;
  title?: string;
  showHeader?: boolean;
  showRefresh?: boolean;
  onRefresh?: () => void;
}

// 司机版底部导航配置
const driverNavItems = [
  {
    href: '/m/internal/driver-dashboard',
    icon: Home,
    label: '工作台'
  },
  {
    href: '/m/internal/my-dispatches',
    icon: FileText,
    label: '我的任务'
  },
  {
    href: '/m/internal/my-waybills',
    icon: Calendar,
    label: '我的行程'
  },
  {
    href: '/m/internal/my-vehicles',
    icon: Truck,
    label: '我的车辆'
  },
  {
    href: '/m/internal/driver-salary',
    icon: DollarSign,
    label: '我的收入'
  }
];

export function DriverMobileLayout({ 
  children, 
  title = '工作台',
  showHeader = true,
  showRefresh = false,
  onRefresh
}: DriverMobileLayoutProps) {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getUserInitials = (name?: string) => {
    if (!name) return 'U';
    // 处理中文姓名：取前两个字符
    if (/[\u4e00-\u9fa5]/.test(name)) {
      return name.substring(0, 2).toUpperCase();
    }
    // 处理英文姓名：取每个单词的首字母
    const names = name.split(' ');
    return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // 判断当前页面是否应该显示底部导航
  // 司机相关页面都显示底部导航
  const shouldShowBottomNav = location.pathname.startsWith('/m/internal/') && 
    (location.pathname.includes('driver') || 
     location.pathname.includes('my-') || 
     location.pathname.includes('quick-entry') ||
     location.pathname.includes('salary'));

  return (
    <MobileBottomNavLayout 
      navItems={driverNavItems}
      className={shouldShowBottomNav ? '' : 'pb-0'}
    >
      {/* 顶部导航栏 */}
      {showHeader && (
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4">
            {/* 左侧：用户头像和信息 */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getUserInitials(profile?.full_name || profile?.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.full_name || profile?.username || '司机'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {profile?.email || user?.email || ''}
                </p>
              </div>
            </div>

            {/* 中间：标题 */}
            <div className="flex-1 text-center">
              <h1 className="text-base font-semibold">{title}</h1>
            </div>

            {/* 右侧：刷新按钮或其他操作 */}
            <div className="flex items-center gap-2 flex-1 justify-end">
              {showRefresh && onRefresh && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={onRefresh}
                  className="h-8 w-8"
                  aria-label="刷新"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/m/notifications')}
                className="h-8 w-8"
                aria-label="通知"
              >
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
      )}

      {/* 主内容区域 */}
      <main className={cn(
        'flex-1 overflow-auto',
        showHeader && 'pt-0',
        shouldShowBottomNav && 'pb-20'
      )}>
        {children}
      </main>

      {/* 底部导航栏（仅在相关页面显示） */}
      {shouldShowBottomNav && (
        <MobileBottomNav items={driverNavItems} />
      )}
    </MobileBottomNavLayout>
  );
}

