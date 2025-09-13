import { useState } from "react";
import { 
  BarChart3, 
  Database, 
  FileText, 
  Calculator,
  PieChart,
  Banknote,
  Truck,
  Package,
  MapPin,
  Users,
  Plus,
  RotateCcw,
  ChevronDown,
  ClipboardList,
  Settings,
  UserCog,
  Weight,
  Shield,
  History
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { forceReimportData } from "@/utils/importData";
import { useMenuPermissions } from "@/hooks/useMenuPermissions";
import { useAuth } from "@/contexts/AuthContext";

// 菜单配置
const menuItems = [
  {
    title: "数据看板",
    icon: BarChart3,
    items: [
      { title: "运输看板", url: "/dashboard/transport", icon: Truck },
      { title: "财务看板", url: "/dashboard/financial", icon: Banknote },
      { title: "项目看板", url: "/dashboard/project", icon: PieChart },
    ]
  },
  {
    title: "信息维护",
    icon: Database,
    items: [
      { title: "项目管理", url: "/projects", icon: Package },
      { title: "司机管理", url: "/drivers", icon: Truck },
      { title: "地点管理", url: "/locations", icon: MapPin },
      { title: "合作方管理", url: "/partners", icon: Users },
    ]
  },
  {
    title: "业务管理",
    icon: FileText,
    items: [
      { title: "运单管理", url: "/business-entry", icon: Plus },
      { title: "磅单管理", url: "/scale-records", icon: Weight },
      { title: "付款申请", url: "/payment-request", icon: Banknote },
      { title: "申请单管理", url: "/payment-requests-list", icon: ClipboardList },
    ]
  },
  {
    title: "合同管理",
    icon: FileText,
    items: [
      { title: "合同列表", url: "/contracts", icon: FileText },
    ]
  },
  {
    title: "财务对账",
    icon: Calculator,
    items: [
      { title: "运费对账", url: "/finance/reconciliation", icon: Calculator },
      { title: "付款与开票", url: "/finance/payment-invoice", icon: Banknote },
    ]
  },
  {
    title: "数据维护",
    icon: Database,
    items: [
      { title: "运单维护", url: "/data-maintenance/waybill", icon: Truck },
    ]
  },
  {
    title: "设置",
    icon: Settings,
    items: [
      { title: "用户管理", url: "/settings/users", icon: UserCog },
      { title: "权限管理", url: "/settings/permissions", icon: Settings },
      { title: "集成权限管理", url: "/settings/integrated", icon: Shield },
      { title: "操作日志", url: "/settings/audit-logs", icon: History },
    ]
  }
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const { hasMenuAccess } = useMenuPermissions();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // 添加调试日志
  console.log('AppSidebar - 当前用户是管理员:', isAdmin);

  // 根据权限过滤菜单项
  const filteredMenuItems = menuItems.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // 检查菜单权限 - 根据URL生成正确的菜单键
      let menuKey = '';
      if (item.url.startsWith('/dashboard/')) {
        menuKey = `dashboard.${item.url.split('/')[2]}`;
      } else if (item.url === '/projects') {
        menuKey = 'maintenance.projects';
      } else if (item.url === '/drivers') {
        menuKey = 'maintenance.drivers';
      } else if (item.url === '/locations') {
        menuKey = 'maintenance.locations';
      } else if (item.url === '/partners') {
        menuKey = 'maintenance.partners';
      } else if (item.url === '/business-entry') {
        menuKey = 'business.entry';
      } else if (item.url === '/scale-records') {
        menuKey = 'business.scale';
      } else if (item.url === '/payment-request') {
        menuKey = 'business.payment_request';
      } else if (item.url === '/payment-requests-list') {
        menuKey = 'business.payment_requests';
      } else if (item.url === '/contracts') {
        menuKey = 'contracts.list';
      } else if (item.url === '/finance/reconciliation') {
        menuKey = 'finance.reconciliation';
      } else if (item.url === '/finance/payment-invoice') {
        menuKey = 'finance.payment_invoice';
      } else if (item.url === '/data-maintenance/waybill') {
        menuKey = 'data_maintenance.waybill';
      } else if (item.url === '/settings/users') {
        menuKey = 'settings.users';
      } else if (item.url === '/settings/permissions') {
        menuKey = 'settings.permissions';
      } else if (item.url === '/settings/integrated') {
        menuKey = 'settings.integrated';
      } else if (item.url === '/settings/audit-logs') {
        menuKey = 'settings.audit_logs';
      }
      
      const hasAccess = hasMenuAccess(menuKey);
      console.log(`检查菜单权限: ${menuKey} - ${hasAccess} (用户角色: ${profile?.role})`);
      return hasAccess;
    })
  })).filter(group => {
    if (group.title === "设置" && !isAdmin) {
      console.log('隐藏设置菜单 - 非管理员用户');
      return false; // 非管理员隐藏设置菜单
    }
    // 如果组内没有可访问的菜单项，隐藏整个组
    return group.items.length > 0;
  });

  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    // 初始化时展开包含当前路由的分组
    const initialOpen: string[] = [];
    filteredMenuItems.forEach(group => {
      if (group.items.some(item => currentPath === item.url)) {
        initialOpen.push(group.title);
      }
    });
    return initialOpen;
  });

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups(prev => 
      prev.includes(groupTitle) 
        ? prev.filter(title => title !== groupTitle)
        : [...prev, groupTitle]
    );
  };

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
        {/* Header Section */}
        <SidebarHeader className="bg-gradient-primary text-white p-3 space-y-2">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
            <Truck className="h-6 w-6 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-base font-bold text-white">中科物流业务跟踪系统</h1>
              <p className="text-xs text-white/80">高效管理 · 精准统计</p>
            </div>
          )}
        </div>
        
      </SidebarHeader>

      <SidebarContent className="bg-gradient-to-b from-secondary to-background">
        {filteredMenuItems.map((group) => {
          const isGroupOpen = openGroups.includes(group.title);
          const hasActiveItem = group.items.some(item => isActive(item.url));

          return (
            <SidebarGroup key={group.title}>
              <Collapsible open={isGroupOpen} onOpenChange={() => toggleGroup(group.title)}>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="group/label text-sm font-medium hover:bg-gradient-primary hover:text-white rounded-lg p-3 cursor-pointer flex items-center justify-between transition-all shadow-sm">
                    <div className="flex items-center gap-2">
                      <group.icon className="h-5 w-5" />
                      {!collapsed && <span className="font-semibold">{group.title}</span>}
                    </div>
                    {!collapsed && (
                      <ChevronDown 
                        className={`h-4 w-4 transition-transform ${isGroupOpen ? 'rotate-180' : ''}`} 
                      />
                    )}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                
                {!collapsed && (
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.items.map((item) => (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild>
                              <Link
                                to={item.url}
                                className={`flex items-center gap-3 rounded-lg p-3 text-sm transition-all ${
                                  isActive(item.url)
                                    ? "bg-gradient-accent text-white shadow-primary font-medium"
                                    : "hover:bg-gradient-secondary hover:shadow-card"
                                }`}
                              >
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                )}
              </Collapsible>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
