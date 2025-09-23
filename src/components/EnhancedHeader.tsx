import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserMenu } from "./UserMenu";
import { ChevronRight, Home } from "lucide-react";

// 路由映射配置
const routeMap: Record<string, string> = {
  '/': '运输看板',
  '/dashboard/transport': '运输看板',
  '/dashboard/financial': '财务看板',
  '/dashboard/project': '项目看板',
  '/projects': '项目管理',
  '/drivers': '司机管理',
  '/locations': '地点管理',
  '/partners': '合作方管理',
  '/business-entry': '运单管理',
  '/scale-records': '磅单管理',
  '/payment-request': '付款申请',
  '/payment-requests-list': '申请单管理',
  '/contracts': '合同列表',
  '/finance/reconciliation': '运费对账',
  '/finance/payment-invoice': '付款与开票',
  '/data-maintenance/waybill': '运单维护',
  '/settings/users': '用户管理',
  '/settings/permissions': '权限配置',
  '/settings/contract-permissions': '合同权限',
  '/settings/role-templates': '角色模板',
  '/settings/audit-logs': '操作日志',
};

// 生成面包屑导航
const generateBreadcrumbs = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = [{ name: '首页', path: '/', icon: Home }];
  
  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const name = routeMap[currentPath] || segment;
    breadcrumbs.push({
      name,
      path: currentPath,
      icon: null
    });
  });
  
  return breadcrumbs;
};

export function EnhancedHeader() {
  const location = useLocation();
  const breadcrumbs = generateBreadcrumbs(location.pathname);

  return (
    <header className="h-16 flex items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 px-6 shadow-sm">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <SidebarTrigger className="hover:bg-secondary/80 transition-colors duration-200" />
        
        {/* 面包屑导航 */}
        <nav className="hidden md:flex items-center space-x-1 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path}>
              {index > 0 && (
                <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground/50" />
              )}
              <Link
                to={crumb.path}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-200 hover:bg-secondary/60 hover:text-foreground ${
                  index === breadcrumbs.length - 1 
                    ? 'text-foreground font-medium bg-secondary/40' 
                    : 'hover:text-foreground'
                }`}
              >
                {crumb.icon && <crumb.icon className="h-3.5 w-3.5" />}
                <span className="truncate max-w-32">{crumb.name}</span>
              </Link>
            </React.Fragment>
          ))}
        </nav>
        
        {/* 移动端简化标题 */}
        <div className="md:hidden flex items-center text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {breadcrumbs[breadcrumbs.length - 1]?.name || '中科物流业务跟踪系统'}
          </span>
        </div>
        
        {/* 桌面端系统信息 */}
        <div className="hidden lg:flex items-center text-xs text-muted-foreground ml-auto mr-4">
          <span className="font-medium">中科物流业务跟踪系统</span>
          <span className="mx-2">•</span>
          <span>桌面端管理界面</span>
        </div>
      </div>
      
      <UserMenu />
    </header>
  );
}
