/**
 * 移动端优化列表组件
 * 集成下拉刷新、无限滚动、虚拟列表等功能
 */

import React, { useCallback, useRef } from 'react';
import { FixedSizeList as VirtualList, ListChildComponentProps } from 'react-window';
// import AutoSizer from 'react-virtualized-auto-sizer';
import { MobilePullToRefresh } from './MobilePullToRefresh';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { MobileSkeletonLoader } from './MobileSkeletonLoader';
import { NoDataState, ErrorState } from './MobileEmptyState';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileOptimizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  onRefresh?: () => Promise<void>;
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
  isLoading?: boolean;
  isRefreshing?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  itemHeight?: number;
  useVirtualList?: boolean;
  enablePullToRefresh?: boolean;
  enableInfiniteScroll?: boolean;
  className?: string;
  itemClassName?: string;
  skeletonType?: 'card' | 'list' | 'detail' | 'table' | 'dashboard';
}

export function MobileOptimizedList<T>({
  items,
  renderItem,
  keyExtractor,
  onRefresh,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  isRefreshing = false,
  isError = false,
  onRetry,
  emptyComponent,
  errorComponent,
  itemHeight = 100,
  useVirtualList = false,
  enablePullToRefresh = true,
  enableInfiniteScroll = true,
  className,
  itemClassName,
  skeletonType = 'card'
}: MobileOptimizedListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const {
    sentinelRef,
    isLoading: isLoadingMore
  } = useInfiniteScroll({
    onLoadMore: onLoadMore || (async () => {}),
    hasMore,
    enabled: enableInfiniteScroll && !isLoading && !isError && !!onLoadMore
  });

  // 虚拟列表渲染函数
  const VirtualRow = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const item = items[index];
      return (
        <div style={style} className={itemClassName}>
          {renderItem(item, index)}
        </div>
      );
    },
    [items, renderItem, itemClassName]
  );

  // 错误状态
  if (isError && items.length === 0) {
    return errorComponent || <ErrorState onRetry={onRetry} />;
  }

  // 空状态
  if (!isLoading && items.length === 0) {
    return emptyComponent || <NoDataState onRefresh={onRefresh} />;
  }

  // 初始加载状态
  if (isLoading && items.length === 0) {
    return <MobileSkeletonLoader count={5} type={skeletonType} className="p-4" />;
  }

  const ListContent = () => {
    if (useVirtualList && items.length > 20) {
      // 使用虚拟列表
      return (
        <div className="h-[calc(100vh-200px)]">
          <VirtualList
            height={600}
            width="100%"
            itemCount={items.length}
            itemSize={itemHeight}
            overscanCount={3}
          >
            {VirtualRow}
          </VirtualList>
        </div>
      );
    }

    // 普通列表
    return (
      <div className={cn('space-y-3', className)}>
        {items.map((item, index) => (
          <div key={keyExtractor(item, index)} className={itemClassName}>
            {renderItem(item, index)}
          </div>
        ))}

        {/* 加载更多指示器 */}
        {enableInfiniteScroll && hasMore && (
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
  };

  if (enablePullToRefresh && onRefresh) {
    return (
      <MobilePullToRefresh
        onRefresh={onRefresh}
        enabled={!isRefreshing}
        className={className}
      >
        <ListContent />
      </MobilePullToRefresh>
    );
  }

  return <ListContent />;
}

// 简化版优化列表
export function SimpleMobileOptimizedList<T>({
  items,
  renderItem,
  keyExtractor,
  onRefresh,
  isRefreshing = false,
  className
}: Pick<MobileOptimizedListProps<T>, 'items' | 'renderItem' | 'keyExtractor' | 'onRefresh' | 'isRefreshing' | 'className'>) {
  if (items.length === 0) {
    return <NoDataState onRefresh={onRefresh} />;
  }

  const content = (
    <div className={cn('space-y-3', className)}>
      {items.map((item, index) => (
        <div key={keyExtractor(item, index)}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );

  if (onRefresh) {
    return (
      <MobilePullToRefresh onRefresh={onRefresh} enabled={!isRefreshing}>
        {content}
      </MobilePullToRefresh>
    );
  }

  return content;
}

