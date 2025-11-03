// 动态菜单侧边栏组件
// 从数据库读取菜单配置，替代硬编码的菜单结构

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
  ChevronDown,
  ClipboardList,
  Settings,
  Weight,
  Shield,
  History,
  TreePine,
  CheckCircle2,
  CreditCard,
  Menu,
  DollarSign,
  LucideIcon
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
import { useDynamicMenu } from "@/hooks/useDynamicMenu";
import { Skeleton } from "@/components/ui/skeleton";

// 图标映射
const iconMap: Record<string, LucideIcon> = {
  'BarChart3': BarChart3,
  'Database': Database,
  'FileText': FileText,
  'Calculator': Calculator,
  'PieChart': PieChart,
  'Banknote': Banknote,
  'Truck': Truck,
  'Package': Package,
  'MapPin': MapPin,
  'Users': Users,
  'Plus': Plus,
  'ClipboardList': ClipboardList,
  'Settings': Settings,
  'Weight': Weight,
  'Shield': Shield,
  'History': History,
  'TreePine': TreePine,
  'CheckCircle2': CheckCircle2,
  'CreditCard': CreditCard,
  'Menu': Menu,
  'DollarSign': DollarSign,
  'ChevronDown': ChevronDown
};

// 获取图标组件
const getIcon = (iconName?: string): LucideIcon => {
  if (!iconName) return FileText;
  return iconMap[iconName] || FileText;
};

export function AppSidebarDynamic() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const { loading, menuGroups } = useDynamicMenu();

  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    // 初始化时展开包含当前路由的分组
    const initialOpen: string[] = [];
    menuGroups.forEach(group => {
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

  const isActive = (path?: string) => path && currentPath === path;

  // 加载状态
  if (loading) {
    return (
      <Sidebar className={`${collapsed ? "w-16" : "w-72"} transition-all duration-300 border-r`}>
        <SidebarHeader className="border-b p-4">
          <Skeleton className="h-8 w-full" />
        </SidebarHeader>
        <SidebarContent className="px-3 py-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="mb-4">
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-10 w-full mb-1" />
              <Skeleton className="h-10 w-full mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar className={`${collapsed ? "w-16" : "w-64"} transition-all duration-300 border-r bg-slate-50`}>
      <SidebarHeader className="border-b bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Truck className="h-6 w-6 text-primary" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="font-bold text-lg text-slate-900">物流系统</h2>
              <p className="text-xs text-slate-500 mt-0.5">中科物流跟踪系统</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 bg-slate-50">
        {menuGroups.map((group) => {
          const GroupIcon = getIcon(group.icon);
          const isOpen = openGroups.includes(group.title);

          return (
            <Collapsible
              key={group.key}
              open={isOpen}
              onOpenChange={() => toggleGroup(group.title)}
              className="mb-1"
            >
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="group/label flex items-center justify-between cursor-pointer hover:bg-white/80 rounded-lg px-3 py-2.5 transition-all mb-1">
                    <div className="flex items-center gap-3">
                      <GroupIcon className="h-5 w-5 flex-shrink-0 text-slate-600" />
                      {!collapsed && (
                        <span className="font-semibold text-[15px] text-slate-700">
                          {group.title}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      <ChevronDown
                        className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="space-y-0.5">
                      {group.items.map((item) => {
                        const ItemIcon = getIcon(item.icon);
                        const active = isActive(item.url);

                        return (
                          <SidebarMenuItem key={item.key}>
                            <SidebarMenuButton
                              asChild
                              className={`
                                ${collapsed ? "justify-center h-11" : "h-11 px-3"}
                                ${
                                  active
                                    ? "bg-primary text-white hover:bg-primary/90 font-medium shadow-sm"
                                    : "hover:bg-white/70 text-slate-700 hover:text-slate-900"
                                } 
                                transition-all duration-200 rounded-lg
                              `}
                              tooltip={collapsed ? item.title : undefined}
                            >
                              <Link to={item.url || '#'} className="flex items-center gap-3 w-full">
                                <ItemIcon className={`h-5 w-5 flex-shrink-0 ${active ? '' : 'text-slate-500'}`} />
                                {!collapsed && (
                                  <span className="text-[14px] leading-tight">
                                    {item.title}
                                  </span>
                                )}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}

