import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MoreVertical, Search, Share2, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderAction {
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
}

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: HeaderAction[];
  searchable?: boolean;
  onSearch?: () => void;
  shareable?: boolean;
  onShare?: () => void;
  className?: string;
  transparent?: boolean;
  sticky?: boolean;
}

export function MobileHeader({
  title,
  subtitle,
  showBack = true,
  onBack,
  actions = [],
  searchable = false,
  onSearch,
  shareable = false,
  onShare,
  className,
  transparent = false,
  sticky = true
}: MobileHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header 
      className={cn(
        'z-40 w-full border-b',
        sticky && 'sticky top-0',
        transparent 
          ? 'bg-transparent' 
          : 'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)'
      }}
    >
      <div className="flex items-center h-14 px-4">
        {/* 左侧：返回按钮 */}
        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        {/* 中间：标题 */}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center space-x-1">
          {searchable && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSearch}
            >
              <Search className="h-5 w-5" />
            </Button>
          )}

          {shareable && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onShare}
            >
              <Share2 className="h-5 w-5" />
            </Button>
          )}

          {actions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {actions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <DropdownMenuItem key={index} onClick={action.onClick}>
                      {Icon && <Icon className="h-4 w-4 mr-2" />}
                      {action.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}

// 可滚动的头部(滚动时变小)
export function ScrollableMobileHeader({
  title,
  children,
  className
}: {
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-all duration-200',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        scrolled ? 'border-b shadow-sm' : '',
        className
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)'
      }}
    >
      <div
        className={cn(
          'px-4 transition-all duration-200',
          scrolled ? 'py-3' : 'py-6'
        )}
      >
        <h1
          className={cn(
            'font-bold transition-all duration-200',
            scrolled ? 'text-xl' : 'text-2xl'
          )}
        >
          {title}
        </h1>
        {children}
      </div>
    </header>
  );
}

