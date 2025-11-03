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
    <Sidebar className={`${collapsed ? "w-16" : "w-72"} transition-all duration-300 border-r`}>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />
          {!collapsed && (
            <div>
              <h2 className="font-semibold text-lg">物流系统</h2>
              <p className="text-xs text-muted-foreground">中科物流跟踪系统</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        {menuGroups.map((group) => {
          const GroupIcon = getIcon(group.icon);
          const isOpen = openGroups.includes(group.title);

          return (
            <Collapsible
              key={group.key}
              open={isOpen}
              onOpenChange={() => toggleGroup(group.title)}
              className="mb-2"
            >
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="group/label flex items-center justify-between cursor-pointer hover:bg-accent rounded-md px-2 py-2 transition-colors">
                    <div className="flex items-center gap-2">
                      <GroupIcon className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span className="font-medium">{group.title}</span>}
                    </div>
                    {!collapsed && (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => {
                        const ItemIcon = getIcon(item.icon);
                        const active = isActive(item.url);

                        return (
                          <SidebarMenuItem key={item.key}>
                            <SidebarMenuButton
                              asChild
                              className={`${
                                active
                                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                  : "hover:bg-accent"
                              } transition-colors ${collapsed ? "justify-center" : ""}`}
                              tooltip={collapsed ? item.title : undefined}
                            >
                              <Link to={item.url || '#'} className="flex items-center gap-2">
                                <ItemIcon className="h-4 w-4 flex-shrink-0" />
                                {!collapsed && <span>{item.title}</span>}
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

