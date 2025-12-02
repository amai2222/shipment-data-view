import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
  disabled?: boolean;
}

interface MobileBottomNavProps {
  items: NavItem[];
  className?: string;
}

export function MobileBottomNav({ items, className }: MobileBottomNavProps) {
  return (
    <nav 
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-white/98 backdrop-blur-md',
        'border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]',
        'safe-area-inset-bottom',
        className
      )}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <div className="flex items-center justify-around h-20 max-w-screen-xl mx-auto px-2">
        {items.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 h-full relative py-2',
                'transition-all duration-200',
                'active:scale-95',
                item.disabled && 'opacity-50 pointer-events-none',
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-500'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'relative p-2 rounded-xl transition-all duration-200',
                  isActive && 'bg-blue-50'
                )}>
                  <item.icon className={cn(
                    'h-6 w-6 transition-all duration-200',
                    isActive ? 'text-blue-600 scale-110' : 'text-gray-500'
                  )} />
                  {item.badge && item.badge > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1.5 text-xs flex items-center justify-center rounded-full shadow-md"
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </Badge>
                  )}
                </div>
                <span className={cn(
                  'text-xs mt-0.5 transition-all font-medium',
                  isActive ? 'text-blue-600 font-semibold' : 'text-gray-500'
                )}>
                  {item.label}
                </span>
                
                {/* 活跃指示器 - 优化设计 */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-10 h-1 bg-blue-600 rounded-full" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

// 带底部导航的页面容器
interface MobileBottomNavLayoutProps {
  children: React.ReactNode;
  navItems: NavItem[];
  className?: string;
}

export function MobileBottomNavLayout({
  children,
  navItems,
  className
}: MobileBottomNavLayoutProps) {
  return (
    <div className="flex flex-col h-screen">
      {/* 主内容区 */}
      <main className={cn('flex-1 overflow-auto pb-16', className)}>
        {children}
      </main>
      
      {/* 底部导航 */}
      <MobileBottomNav items={navItems} />
    </div>
  );
}

// 浮动操作按钮(FAB)
interface MobileFABProps {
  icon: LucideIcon;
  label?: string;
  onClick: () => void;
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left';
  variant?: 'default' | 'primary' | 'secondary';
  className?: string;
}

export function MobileFAB({
  icon: Icon,
  label,
  onClick,
  position = 'bottom-right',
  variant = 'primary',
  className
}: MobileFABProps) {
  const positionClasses = {
    'bottom-right': 'bottom-20 right-4',
    'bottom-center': 'bottom-20 left-1/2 -translate-x-1/2',
    'bottom-left': 'bottom-20 left-4'
  };

  const variantClasses = {
    default: 'bg-background text-foreground border shadow-lg',
    primary: 'bg-primary text-primary-foreground shadow-lg',
    secondary: 'bg-secondary text-secondary-foreground shadow-lg'
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed z-40',
        'flex items-center justify-center',
        'rounded-full',
        'transition-all duration-200',
        'active:scale-90',
        'hover:shadow-xl',
        label ? 'h-14 px-6 space-x-2' : 'h-14 w-14',
        positionClasses[position],
        variantClasses[variant],
        className
      )}
      style={{
        marginBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <Icon className="h-6 w-6" />
      {label && <span className="font-medium">{label}</span>}
    </button>
  );
}

