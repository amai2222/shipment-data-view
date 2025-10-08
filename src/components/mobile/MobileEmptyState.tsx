import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon, FileText, Search, AlertCircle, Inbox, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  type?: 'default' | 'search' | 'error' | 'offline';
  className?: string;
}

const iconMap = {
  default: Inbox,
  search: Search,
  error: AlertCircle,
  offline: WifiOff
};

export function MobileEmptyState({ 
  icon,
  title, 
  description,
  action,
  type = 'default',
  className
}: MobileEmptyStateProps) {
  const Icon = icon || iconMap[type];
  
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="flex flex-col items-center justify-center p-8 text-center">
        <Icon className={cn(
          'h-16 w-16 mb-4 opacity-50',
          type === 'error' && 'text-red-500',
          type === 'offline' && 'text-orange-500',
          type === 'search' && 'text-blue-500'
        )} />
        
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        
        {description && (
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            {description}
          </p>
        )}
        
        {action && (
          <Button onClick={action.onClick} variant="outline">
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// 预设的空状态组件
export function NoDataState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <MobileEmptyState
      title="暂无数据"
      description="当前没有可显示的数据"
      action={onRefresh ? {
        label: '刷新',
        onClick: onRefresh
      } : undefined}
    />
  );
}

export function SearchEmptyState({ keyword }: { keyword?: string }) {
  return (
    <MobileEmptyState
      type="search"
      title="未找到结果"
      description={keyword ? `没有找到与"${keyword}"相关的内容` : '请尝试使用其他关键词搜索'}
    />
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <MobileEmptyState
      type="error"
      title="加载失败"
      description="数据加载时出现错误，请稍后重试"
      action={onRetry ? {
        label: '重试',
        onClick: onRetry
      } : undefined}
    />
  );
}

export function OfflineState() {
  return (
    <MobileEmptyState
      type="offline"
      title="网络未连接"
      description="请检查您的网络连接后重试"
    />
  );
}

