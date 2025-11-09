import { useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Menu, 
  Home, 
  Truck, 
  Users, 
  MapPin, 
  FileText, 
  CreditCard, 
  BarChart3,
  Settings,
  LogOut,
  Building2,
  Scale,
  Receipt,
  FileSignature,
  Shield,
  History,
  Database,
  Calculator,
  DollarSign,
  Banknote,
  TreePine,
  CheckCircle,
  Calendar,
  ArrowLeft
} from 'lucide-react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';
import { cn } from '@/lib/utils';

interface MobileLayoutProps {
  children: React.ReactNode;
  showBack?: boolean;  // 是否显示返回按钮（默认自动判断）
  title?: string;      // 自定义标题（默认显示"物流管理系统"）
}

// 移动端菜单分组配置，仿照桌面端分组
const menuGroups = [
  {
    title: '数据看板',
    icon: BarChart3,
    items: [
      {
        name: '运输概览',
        href: '/m/',
        icon: Home,
        roles: ['admin', 'finance', 'business', 'operator', 'viewer']
      },
      {
        name: '项目看板',
        href: '/m/dashboard/project',
        icon: BarChart3,
        roles: ['admin', 'finance', 'business', 'viewer']
      },
      {
        name: '货主看板',
        href: '/m/dashboard/shipper',
        icon: TreePine,
        roles: ['admin', 'finance', 'business', 'operator', 'viewer', 'partner']
      },
      {
        name: '财务概览',
        href: '/m/dashboard/financial',
        icon: DollarSign,
        roles: ['admin', 'finance', 'viewer']
      }
    ]
  },
  {
    title: '合同管理',
    icon: FileSignature,
    items: [
      {
        name: '合同列表',
        href: '/m/contracts',
        icon: FileSignature,
        roles: ['admin', 'finance', 'business']
      }
    ]
  },
  {
    title: '信息维护',
    icon: Database,
    items: [
      {
        name: '项目管理',
        href: '/m/projects',
        icon: Building2,
        roles: ['admin', 'business']
      },
      {
        name: '司机管理',
        href: '/m/drivers',
        icon: Users,
        roles: ['admin', 'finance', 'business', 'operator', 'viewer']
      },
      {
        name: '地点管理',
        href: '/m/locations',
        icon: MapPin,
        roles: ['admin', 'finance', 'business', 'operator', 'viewer']
      },
      {
        name: '地点管理（增强版）',
        href: '/m/locations-enhanced',
        icon: MapPin,
        roles: ['admin', 'finance', 'business', 'operator', 'viewer']
      },
      {
        name: '合作伙伴',
        href: '/m/partners',
        icon: Truck,
        roles: ['admin', 'finance', 'business', 'viewer']
      },
      {
        name: '货主层级管理',
        href: '/m/partners/hierarchy',
        icon: TreePine,
        roles: ['admin', 'finance', 'business']
      }
    ]
  },
  {
    title: '业务管理',
    icon: FileText,
    items: [
      {
        name: '运单管理',
        href: '/m/business-entry',
        icon: FileText,
        roles: ['admin', 'finance', 'business', 'operator']
      },
      {
        name: '磅单记录',
        href: '/m/scale-records',
        icon: Scale,
        roles: ['admin', 'finance', 'business', 'operator']
      },
      {
        name: '开票申请',
        href: '/m/invoice-request',
        icon: FileText,
        roles: ['admin', 'finance', 'operator']
      },
      {
        name: '付款申请',
        href: '/m/payment-request',
        icon: CreditCard,
        roles: ['admin', 'finance']
      }
    ]
  },
  {
    title: '审核管理',
    icon: CheckCircle,
    items: [
      {
        name: '开票审核',
        href: '/m/audit/invoice',
        icon: FileText,
        roles: ['admin', 'finance', 'operator']
      },
      {
        name: '付款审核',
        href: '/m/audit/payment',
        icon: DollarSign,
        roles: ['admin', 'finance', 'operator']
      }
    ]
  },
  {
    title: '内部车辆管理',
    icon: Truck,
    items: [
      // 车队长菜单
      {
        name: '车队工作台',
        href: '/m/internal/fleet-dashboard',
        icon: BarChart3,
        roles: ['fleet_manager']
      },
      {
        name: '派单管理',
        href: '/m/internal/dispatch-order',
        icon: FileText,
        roles: ['fleet_manager']
      },
      {
        name: '车辆管理',
        href: '/m/internal/vehicles',
        icon: Truck,
        roles: ['fleet_manager']
      },
      {
        name: '费用审核',
        href: '/m/internal/expense-review',
        icon: FileText,
        roles: ['fleet_manager']
      },
      // 司机菜单
      {
        name: '司机工作台',
        href: '/m/internal/my-expenses',
        icon: BarChart3,
        roles: ['driver']
      },
      {
        name: '我的派单',
        href: '/m/internal/my-dispatches',
        icon: FileText,
        roles: ['driver']
      },
      {
        name: '录入运单',
        href: '/m/internal/quick-entry',
        icon: Truck,
        roles: ['driver']
      },
      {
        name: '我的收入',
        href: '/m/internal/driver-salary',
        icon: DollarSign,
        roles: ['driver']
      },
      {
        name: '我的车辆',
        href: '/m/internal/my-vehicles',
        icon: Truck,
        roles: ['driver']
      },
      {
        name: '收入记录',
        href: '/m/internal/salary-records',
        icon: Calendar,
        roles: ['driver']
      }
    ]
  },
  {
    title: '财务管理',
    icon: Calculator,
    items: [
      {
        name: '运费对账',
        href: '/m/finance/reconciliation',
        icon: Calculator,
        roles: ['admin', 'finance', 'business', 'operator']
      },
      {
        name: '付款与开票',
        href: '/m/finance/payment-invoice',
        icon: Banknote,
        roles: ['admin', 'finance', 'operator']
      },
      {
        name: '财务开票',
        href: '/m/invoice-request-management',
        icon: FileText,
        roles: ['admin', 'finance']
      },
      {
        name: '财务付款',
        href: '/m/payment-requests-management',
        icon: Receipt,
        roles: ['admin', 'finance', 'operator']
      }
    ]
  },
  {
    title: '数据维护',
    icon: Database,
    items: [
      {
        name: '运单维护',
        href: '/m/data-maintenance/waybill',
        icon: Truck,
        roles: ['admin', 'operator']
      },
      {
        name: '运单维护（增强版）',
        href: '/m/data-maintenance/waybill-enhanced',
        icon: Truck,
        roles: ['admin', 'operator']
      }
    ]
  }
];

const settingsNavigation = [
  {
    name: '用户管理',
    href: '/m/settings/users',
    icon: Users,
    roles: ['admin']
  },
  {
    name: '权限配置',
    href: '/m/settings/permissions',
    icon: Shield,
    roles: ['admin']
  },
  {
    name: '集成权限管理',
    href: '/m/settings/integrated',
    icon: Shield,
    roles: ['admin']
  },
  {
    name: '操作日志',
    href: '/m/settings/audit-logs',
    icon: History,
    roles: ['admin']
  }
];

export function MobileLayout({ children, showBack, title }: MobileLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { hasRole, hasMenuAccess } = useUnifiedPermissions();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 自动判断是否显示返回按钮（非首页显示返回）
  const shouldShowBack = showBack !== undefined 
    ? showBack 
    : location.pathname !== '/m/' && location.pathname !== '/m';

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
    setIsMenuOpen(false);
  };

  const getUserInitials = (name?: string) => {
    if (!name) return 'U';
    const names = name.split(' ');
    return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // 过滤菜单分组
  const filteredMenuGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // 先检查角色
      const hasRoleAccess = hasRole(item.roles);
      if (!hasRoleAccess) return false;
      
      // 对于内部车辆管理菜单 (/m/internal/)，只检查角色，不检查数据库权限
      // 因为这些是新功能，可能还没在 menu_config 表中配置完全
      if (item.href.startsWith('/m/internal/')) {
        return true;
      }
      
      // 其他菜单需要检查数据库权限
      return hasMenuAccess(item.href);
    })
  })).filter(group => group.items.length > 0);

  const filteredSettingsNavigation = settingsNavigation.filter(item => 
    hasRole(item.roles) && hasMenuAccess(item.href)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* 移动端顶部导航栏 */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4">
          {/* 左侧：菜单按钮（始终显示） */}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-5 w-5" />
                <span className="sr-only">打开菜单</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle>物流管理系统</SheetTitle>
              </SheetHeader>
              
              <div className="flex flex-col h-full py-4">
                {/* 用户信息 */}
                <div className="flex items-center space-x-3 mb-6 p-3 rounded-lg bg-muted/50">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getUserInitials(user?.user_metadata?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user?.user_metadata?.full_name || '用户'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>

                {/* 主导航 */}
                <ScrollArea className="flex-1">
                  <div className="space-y-4">
                    {filteredMenuGroups.map((group) => (
                      <div key={group.title} className="space-y-2">
                        {/* 分组标题 */}
                        <div className="flex items-center space-x-2 px-3 py-2">
                          <group.icon className="h-4 w-4 text-muted-foreground" />
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {group.title}
                          </h3>
                        </div>
                        
                        {/* 分组菜单项 */}
                        <div className="space-y-1">
                          {group.items.map((item) => (
                            <NavLink
                              key={item.href}
                              to={item.href}
                              onClick={() => setIsMenuOpen(false)}
                              className={({ isActive }) =>
                                cn(
                                  'flex items-center space-x-3 rounded-lg px-3 py-2 text-sm transition-colors ml-4',
                                  isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                )
                              }
                            >
                              <item.icon className="h-4 w-4" />
                              <span>{item.name}</span>
                            </NavLink>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredSettingsNavigation.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-1">
                        <div className="px-3 py-2">
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            系统设置
                          </h3>
                        </div>
                        {filteredSettingsNavigation.map((item) => (
                          <NavLink
                            key={item.href}
                            to={item.href}
                            onClick={() => setIsMenuOpen(false)}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center space-x-3 rounded-lg px-3 py-2 text-sm transition-colors',
                                isActive
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                              )
                            }
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </NavLink>
                        ))}
                      </div>
                    </>
                  )}
                </ScrollArea>

                {/* 登出按钮 */}
                <div className="pt-4 border-t">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    退出登录
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* 中间：标题 */}
          <div className="flex-1 text-center">
            <h1 className="text-lg font-semibold">{title || '物流管理系统'}</h1>
          </div>

          {/* 右侧：返回按钮（子页面时显示） */}
          {shouldShowBack ? (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">返回</span>
            </Button>
          ) : (
            <div className="w-10" /> // 占位保持标题居中
          )}
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="container mx-auto px-4 py-4 max-w-full">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">加载中...</p>
            </div>
          </div>
        }>
          {children}
        </Suspense>
      </main>
    </div>
  );
}