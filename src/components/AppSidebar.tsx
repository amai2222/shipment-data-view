import { useState } from "react";
import { 
  BarChart3, 
  Database, 
  FileText, 
  Calculator,
  PieChart,
  DollarSign,
  Truck,
  Package,
  MapPin,
  Users,
  Plus,
  RotateCcw,
  ChevronDown
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

// 菜单配置
const menuItems = [
  {
    title: "数据概览",
    icon: BarChart3,
    items: [
      { title: "运输概览", url: "/dashboard/transport", icon: Truck },
      { title: "财务概览", url: "/dashboard/financial", icon: DollarSign },
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
    title: "业务录入",
    icon: FileText,
    items: [
      { title: "运单录入", url: "/business-entry", icon: Plus },
      { title: "付款申请", url: "/payment-request", icon: DollarSign },
      { title: "申请单管理", url: "/payment-requests-list", icon: ClipboardList },
    ]
  },
  {
    title: "财务对账",
    icon: Calculator,
    items: [
      { title: "运费对账", url: "/finance/reconciliation", icon: Calculator },
      { title: "付款与开票", url: "/finance/payment-invoice", icon: DollarSign },
    ]
  }
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    // 初始化时展开包含当前路由的分组
    const initialOpen: string[] = [];
    menuItems.forEach(group => {
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
        {menuItems.map((group) => {
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
