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
        {menuGroups.map((group) => {
          const GroupIcon = getIcon(group.icon);
          const isOpen = openGroups.includes(group.title);

          const hasActiveItem = group.items.some(item => isActive(item.url));

          return (
            <SidebarGroup key={group.key} className="space-y-1">
              <Collapsible open={isOpen} onOpenChange={() => toggleGroup(group.title)}>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className={`group/label text-sm font-medium rounded-xl p-3 cursor-pointer flex items-center justify-between transition-all duration-200 border ${
                    hasActiveItem 
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg border-blue-500/30' 
                      : 'hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-50 hover:shadow-md border-transparent hover:border-gray-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg transition-colors ${hasActiveItem ? 'bg-white/25' : 'bg-blue-100/60'}`}>
                        <GroupIcon className={`h-4 w-4 ${hasActiveItem ? 'text-white' : 'text-blue-700'}`} />
                      </div>
                      {!collapsed && <span className="font-semibold">{group.title}</span>}
                    </div>
                    {!collapsed && (
                      <ChevronDown 
                        className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
                      />
                    )}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>

                {!collapsed && (
                  <CollapsibleContent>
                    <SidebarGroupContent className="pl-2 space-y-1">
                      <SidebarMenu>
                        {group.items.map((item) => {
                          const ItemIcon = getIcon(item.icon);
                          const active = isActive(item.url);

                          return (
                            <SidebarMenuItem key={item.key}>
                              <SidebarMenuButton asChild>
                                <Link
                                  to={item.url || '#'}
                                  className={`flex items-center gap-3 rounded-lg p-3 text-sm transition-all duration-200 border ${
                                    active
                                      ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md font-medium border-indigo-400/30"
                                      : "hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-sm hover:border-blue-200/50 border-transparent text-gray-700 hover:text-blue-700"
                                  }`}
                                >
                                  <div className={`p-1 rounded transition-colors ${
                                    active ? 'bg-white/25' : 'bg-blue-100/80'
                                  }`}>
                                    <ItemIcon className={`h-3.5 w-3.5 ${
                                      active ? 'text-white' : 'text-blue-600'
                                    }`} />
                                  </div>
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
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

