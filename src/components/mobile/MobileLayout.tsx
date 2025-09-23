import React, { useState } from 'react';
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
  Banknote
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePermissions } from '@/hooks/usePermissions';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { cn } from '@/lib/utils';

interface MobileLayoutProps {
  children: React.ReactNode;
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
        name: '财务概览',
        href: '/m/dashboard/financial',
        icon: DollarSign,
        roles: ['admin', 'finance', 'viewer']
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
        name: '合作伙伴',
        href: '/m/partners',
        icon: Truck,
        roles: ['admin', 'finance', 'business', 'viewer']
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
        name: '付款申请',
        href: '/m/payment-request',
        icon: CreditCard,
        roles: ['admin', 'finance']
      },
      {
        name: '开票申请',
        href: '/m/invoice-request',
        icon: FileText,
        roles: ['admin', 'finance', 'operator']
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
    title: '财务管理',
    icon: Calculator,
    items: [
      {
        name: '运费对账',
        href: '/m/finance/reconciliation',
        icon: Calculator,
        roles: ['admin', 'finance', 'business']
      },
      {
        name: '付款与开票',
        href: '/m/finance/payment-invoice',
        icon: Banknote,
        roles: ['admin', 'finance']
      },
      {
        name: '申请单管理',
        href: '/m/payment-requests-management',
        icon: Receipt,
        roles: ['admin', 'finance']
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

export function MobileLayout({ children }: MobileLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { hasPermission } = usePermissions();
  const { hasMenuAccess } = useMenuPermissions();
  const navigate = useNavigate();

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
    items: group.items.filter(item => 
      hasPermission(item.roles as any) && hasMenuAccess(item.href)
    )
  })).filter(group => group.items.length > 0);

  const filteredSettingsNavigation = settingsNavigation.filter(item => 
    hasPermission(item.roles as any) && hasMenuAccess(item.href)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* 移动端顶部导航栏 */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4">
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

          <div className="flex-1 text-center">
            <h1 className="text-lg font-semibold">物流管理系统</h1>
          </div>

          <div className="w-10" /> {/* 占位，保持标题居中 */}
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="container mx-auto px-4 py-4 max-w-full">
        {children}
      </main>
    </div>
  );
}