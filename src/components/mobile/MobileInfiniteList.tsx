import React from 'react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NoDataState, ErrorState } from './MobileEmptyState';

interface MobileInfiniteListProps<T> {
  items: T[];
  onLoadMore: () => Promise<void>;
  hasMore: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  emptyComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  loadingComponent?: React.ReactNode;
  threshold?: number;
  enabled?: boolean;
  className?: string;
  itemClassName?: string;
}

export function MobileInfiniteList<T>({
  items,
  onLoadMore,
  hasMore,
  isLoading = false,
  isError = false,
  onRetry,
  renderItem,
  keyExtractor,
  emptyComponent,
  errorComponent,
  loadingComponent,
  threshold = 200,
  enabled = true,
  className,
  itemClassName
}: MobileInfiniteListProps<T>) {
  const {
    containerRef,
    sentinelRef,
    isLoading: isLoadingMore
  } = useInfiniteScroll({
    onLoadMore,
    hasMore,
    threshold,
    enabled: enabled && !isLoading && !isError
  });

  // 错误状态
  if (isError && items.length === 0) {
    return errorComponent || <ErrorState onRetry={onRetry} />;
  }

  // 空状态
  if (!isLoading && items.length === 0) {
    return emptyComponent || <NoDataState />;
  }

  // 初始加载状态
  if (isLoading && items.length === 0) {
    return loadingComponent || (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn('h-full overflow-auto', className)}
      data-scrollable
    >
      {/* 列表项 */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={keyExtractor(item, index)} className={itemClassName}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>

      {/* 加载更多指示器 */}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center p-4">
          {isLoadingMore && (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">加载更多...</span>
            </div>
          )}
        </div>
      )}

      {/* 没有更多数据提示 */}
      {!hasMore && items.length > 0 && (
        <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
          没有更多数据了
        </div>
      )}
    </div>
  );
}

// 简化版无限列表(使用children模式)
export function SimpleInfiniteList({
  children,
  onLoadMore,
  hasMore,
  isLoading,
  className
}: {
  children: React.ReactNode;
  onLoadMore: () => Promise<void>;
  hasMore: boolean;
  isLoading?: boolean;
  className?: string;
}) {
  const {
    containerRef,
    sentinelRef,
    isLoading: isLoadingMore
  } = useInfiniteScroll({
    onLoadMore,
    hasMore,
    enabled: !isLoading
  });

  return (
    <div 
      ref={containerRef}
      className={cn('h-full overflow-auto', className)}
      data-scrollable
    >
      {children}
      
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center p-4">
          {isLoadingMore && (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
}

