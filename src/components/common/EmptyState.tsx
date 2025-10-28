// 空状态组件
// 用于显示无数据、无搜索结果等状态

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title = '暂无数据',
  description,
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
      {Icon && (
        <Icon className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
      )}
      <h3 className="text-lg font-medium text-foreground mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}

