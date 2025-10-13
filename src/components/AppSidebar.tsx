import { useState, useMemo } from "react";
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
  ChevronDown,
  ClipboardList,
  Settings,
  Weight,
  Shield,
  History
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
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
import { useSimplePermissions } from "@/hooks/useSimplePermissions";

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
    title: "合同管理",
    icon: FileText,
    items: [
      { title: "合同列表", url: "/contracts", icon: FileText },
    ]
  },
  {
    title: "信息维护",
    icon: Database,
    items: [
      { title: "项目管理", url: "/projects", icon: Package },
      { title: "司机管理", url: "/drivers", icon: Truck },
      { title: "地点管理", url: "/locations", icon: MapPin },
      { title: "地点管理（增强版）", url: "/locations-enhanced", icon: MapPin },
      { title: "合作方管理", url: "/partners", icon: Users },
    ]
  },
  {
    title: "业务管理",
    icon: FileText,
    items: [
      { title: "运单管理", url: "/business-entry", icon: Plus },
      { title: "磅单管理", url: "/scale-records", icon: Weight },
      { title: "开票申请", url: "/invoice-request", icon: FileText },
      { title: "付款申请", url: "/payment-request", icon: Banknote },
    ]
  },
  {
    title: "财务管理",
    icon: Calculator,
    items: [
      { title: "运费对账", url: "/finance/reconciliation", icon: Calculator },
      { title: "付款与开票", url: "/finance/payment-invoice", icon: Banknote },
      { title: "申请单管理", url: "/payment-requests-list", icon: ClipboardList },
    ]
  },
  {
    title: "数据维护",
    icon: Database,
    items: [
      { title: "运单维护", url: "/data-maintenance/waybill", icon: Truck },
      { title: "运单维护（增强版）", url: "/data-maintenance/waybill-enhanced", icon: Truck },
    ]
  },
  {
    title: "设置",
    icon: Settings,
    items: [
      { title: "用户管理", url: "/settings/users", icon: Users },
      { title: "权限配置", url: "/settings/permissions", icon: Shield },
      { title: "合同权限", url: "/settings/contract-permissions", icon: FileText },
      { title: "角色模板", url: "/settings/role-templates", icon: Settings },
      { title: "操作日志", url: "/settings/audit-logs", icon: History },
    ]
  }
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const { hasMenuAccess, isAdmin } = useSimplePermissions();

  // 优化：使用useMemo缓存菜单URL到权限键的映射
  const getMenuKey = useMemo(() => {
    const urlToKeyMap: Record<string, string> = {
      '/dashboard/transport': 'dashboard.transport',
      '/dashboard/financial': 'dashboard.financial',
      '/dashboard/project': 'dashboard.project',
      '/projects': 'maintenance.projects',
      '/drivers': 'maintenance.drivers',
      '/locations': 'maintenance.locations',
      '/partners': 'maintenance.partners',
      '/business-entry': 'business.entry',
      '/scale-records': 'business.scale',
      '/payment-request': 'business.payment_request',
      '/invoice-request': 'business.invoice_request',
      '/payment-requests-list': 'finance.payment_requests',
      '/contracts': 'contracts.list',
      '/finance/reconciliation': 'finance.reconciliation',
      '/finance/payment-invoice': 'finance.payment_invoice',
      '/data-maintenance/waybill': 'data_maintenance.waybill',
      '/data-maintenance/waybill-enhanced': 'data_maintenance.waybill',
      '/settings/users': 'settings.users',
      '/settings/permissions': 'settings.permissions',
      '/settings/contract-permissions': 'settings.contract_permissions',
      '/settings/role-templates': 'settings.role_templates',
      '/settings/integrated': 'settings.integrated',
      '/settings/audit-logs': 'settings.audit_logs',
    };
    
    return (url: string) => urlToKeyMap[url] || '';
  }, []);

  // 优化：使用useMemo缓存过滤后的菜单项，避免每次渲染都重新计算
  const filteredMenuItems = useMemo(() => {
    return menuItems.map(group => ({
      ...group,
      items: group.items.filter(item => {
        const menuKey = getMenuKey(item.url);
        return menuKey && hasMenuAccess(menuKey);
      })
    })).filter(group => {
      // 非管理员隐藏设置菜单
      if (group.title === "设置" && !isAdmin) {
        return false;
      }
      // 如果组内没有可访问的菜单项，隐藏整个组
      return group.items.length > 0;
    });
  }, [hasMenuAccess, isAdmin, getMenuKey]);

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
    <Sidebar className={`${collapsed ? "w-16" : "w-72"} transition-all duration-300 ease-in-out`} collapsible="icon">
      {/* Enhanced Header Section */}
      <SidebarHeader className="bg-gradient-primary text-white p-4 shadow-lg relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30"></div>
        
        <div className="relative flex items-center space-x-3">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg">
            <Truck className="h-7 w-7 text-white drop-shadow-sm" />
          </div>
          {!collapsed && (
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-white drop-shadow-sm">中科物流业务跟踪系统</h1>
              <p className="text-sm text-white/90 font-medium">高效管理 · 精准统计</p>
            </div>
          )}
        </div>
        
        {/* Decorative Bottom Border */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </SidebarHeader>

      <SidebarContent className="bg-gradient-to-b from-secondary/20 to-background p-2 space-y-1">
        {filteredMenuItems.map((group) => {
          const isGroupOpen = openGroups.includes(group.title);
          const hasActiveItem = group.items.some(item => isActive(item.url));

          return (
            <SidebarGroup key={group.title} className="space-y-1">
              <Collapsible open={isGroupOpen} onOpenChange={() => toggleGroup(group.title)}>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className={`group/label text-sm font-medium rounded-xl p-3 cursor-pointer flex items-center justify-between transition-all duration-200 border ${
                    hasActiveItem 
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg border-blue-500/30' 
                      : 'hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-50 hover:shadow-md border-transparent hover:border-gray-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg transition-colors ${hasActiveItem ? 'bg-white/25' : 'bg-blue-100/60'}`}>
                        <group.icon className={`h-4 w-4 ${hasActiveItem ? 'text-white' : 'text-blue-700'}`} />
                      </div>
                      {!collapsed && <span className="font-semibold">{group.title}</span>}
                    </div>
                    {!collapsed && (
                      <ChevronDown 
                        className={`h-4 w-4 transition-transform duration-200 ${isGroupOpen ? 'rotate-180' : ''}`} 
                      />
                    )}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                
                {!collapsed && (
                  <CollapsibleContent>
                    <SidebarGroupContent className="pl-2 space-y-1">
                      <SidebarMenu>
                        {group.items.map((item) => (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild>
                              <Link
                                to={item.url}
                                className={`flex items-center gap-3 rounded-lg p-3 text-sm transition-all duration-200 border ${
                                  isActive(item.url)
                                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md font-medium border-indigo-400/30"
                                    : "hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-sm hover:border-blue-200/50 border-transparent text-gray-700 hover:text-blue-700"
                                }`}
                              >
                                <div className={`p-1 rounded transition-colors ${
                                  isActive(item.url) ? 'bg-white/25' : 'bg-blue-100/80'
                                }`}>
                                  <item.icon className={`h-3.5 w-3.5 ${
                                    isActive(item.url) ? 'text-white' : 'text-blue-600'
                                  }`} />
                                </div>
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
