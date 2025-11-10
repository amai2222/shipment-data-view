import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    className?: string;
  };
  actions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'destructive';
  }>;
}

export function MobileCard({ 
  children, 
  className, 
  onClick, 
  onEdit, 
  onDelete, 
  onView,
  badge,
  actions 
}: MobileCardProps) {
  const hasActions = onEdit || onDelete || onView || (actions && actions.length > 0);

  return (
    <Card 
      className={cn(
        'hover:shadow-md transition-shadow',
        onClick && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            {children}
          </div>

          <div className="flex items-center gap-2 ml-3">
            {badge && (
              <Badge 
                variant={badge.variant || 'outline'} 
                className={cn('text-xs', badge.className)}
              >
                {badge.text}
              </Badge>
            )}

            {hasActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="更多操作"
                    title="更多操作"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onView && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); }}>
                      查看详情
                    </DropdownMenuItem>
                  )}
                  {onEdit && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                      编辑
                    </DropdownMenuItem>
                  )}
                  {actions?.map((action, index) => (
                    <DropdownMenuItem 
                      key={index}
                      onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                      className={action.variant === 'destructive' ? 'text-red-600' : ''}
                    >
                      {action.icon && <span className="mr-2">{action.icon}</span>}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                  {onDelete && (
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); onDelete(); }}
                      className="text-red-600"
                    >
                      删除
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 辅助组件：移动端信息行
interface MobileInfoRowProps {
  icon: React.ReactNode;
  label?: string;
  value: React.ReactNode;
  className?: string;
}

export function MobileInfoRow({ icon, label, value, className }: MobileInfoRowProps) {
  return (
    <div className={cn('flex items-center text-sm', className)}>
      <div className="text-muted-foreground mr-2 flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        {label && <span className="text-muted-foreground mr-1">{label}:</span>}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

// 辅助组件：移动端统计卡片
interface MobileStatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'orange';
  onClick?: () => void;
}

export function MobileStatCard({ title, value, icon, color, onClick }: MobileStatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
    red: 'bg-red-100 text-red-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all hover:scale-105 active:scale-95',
        onClick && 'hover:shadow-md'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
          <div className={cn('p-2 rounded-full', colorClasses[color])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}