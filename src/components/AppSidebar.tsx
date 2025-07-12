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
  Plus
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

// 菜单配置
const menuItems = [
  {
    title: "数据概览",
    icon: BarChart3,
    items: [
      { title: "数量概览", url: "/dashboard/quantity", icon: PieChart },
      { title: "财务概览", url: "/dashboard/financial", icon: DollarSign },
      { title: "运输概览", url: "/", icon: Truck },
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
    ]
  },
  {
    title: "财务对账",
    icon: Calculator,
    items: [
      { title: "运费对账", url: "/finance/reconciliation", icon: Calculator },
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