import React from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Loader2, RefreshCw, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobilePullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  enabled?: boolean;
  className?: string;
}

export function MobilePullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  enabled = true,
  className
}: MobilePullToRefreshProps) {
  const {
    containerRef,
    isPulling,
    isRefreshing,
    pullDistance,
    pullProgress
  } = usePullToRefresh({
    onRefresh,
    threshold,
    enabled
  });

  return (
    <div 
      ref={containerRef}
      className={cn('relative h-full overflow-auto', className)}
      data-scrollable
    >
      {/* 下拉刷新指示器 */}
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 ease-out"
        style={{
          height: isRefreshing ? '48px' : `${pullDistance}px`,
          opacity: pullDistance > 0 || isRefreshing ? 1 : 0,
          transform: `translateY(${isRefreshing ? 0 : -48}px)`
        }}
      >
        <div className="flex items-center space-x-2 text-muted-foreground">
          {isRefreshing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">刷新中...</span>
            </>
          ) : pullProgress >= 1 ? (
            <>
              <RefreshCw className="h-5 w-5" />
              <span className="text-sm">释放刷新</span>
            </>
          ) : (
            <>
              <ArrowDown 
                className="h-5 w-5 transition-transform"
                style={{
                  transform: `rotate(${pullProgress * 180}deg)`
                }}
              />
              <span className="text-sm">下拉刷新</span>
            </>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div 
        style={{
          transform: isRefreshing ? 'translateY(48px)' : `translateY(${pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 0.2s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
}

// 简化版下拉刷新(只显示加载状态)
export function SimplePullToRefresh({
  onRefresh,
  children,
  isRefreshing,
  className
}: {
  onRefresh: () => void;
  children: React.ReactNode;
  isRefreshing: boolean;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      {isRefreshing && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center h-12 bg-background/95 backdrop-blur-sm border-b">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">加载中...</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

