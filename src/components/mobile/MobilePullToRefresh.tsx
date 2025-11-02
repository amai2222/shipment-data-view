// 移动端下拉刷新组件
import React, { useState, useRef, useEffect } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobilePullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number; // 触发刷新的距离阈值
  maxPullDistance?: number; // 最大下拉距离
  disabled?: boolean;
}

export function MobilePullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  maxPullDistance = 150,
  disabled = false
}: MobilePullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canPull, setCanPull] = useState(false);
  
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // 只有在容器顶部才允许下拉刷新
      if (container.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
        setCanPull(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!canPull || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      if (distance > 0 && container.scrollTop === 0) {
        // 阻止默认滚动
        e.preventDefault();
        
        // 计算下拉距离（应用阻尼效果）
        const dampedDistance = Math.min(
          distance * 0.5, // 阻尼系数
          maxPullDistance
        );
        setPullDistance(dampedDistance);
      }
    };

    const handleTouchEnd = async () => {
      if (!canPull || isRefreshing) return;

      setCanPull(false);

      // 如果下拉距离超过阈值，触发刷新
      if (pullDistance >= threshold) {
        setIsRefreshing(true);
        setPullDistance(threshold); // 保持在刷新状态的高度
        
        try {
          await onRefresh();
          
          // 触觉反馈
          if ('vibrate' in navigator) {
            navigator.vibrate(20);
          }
        } catch (error) {
          console.error('刷新失败:', error);
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        // 未达到阈值，回弹
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [canPull, isRefreshing, pullDistance, threshold, maxPullDistance, disabled, onRefresh]);

  // 计算刷新指示器的状态
  const progress = Math.min(pullDistance / threshold, 1);
  const shouldRefresh = pullDistance >= threshold;

  return (
    <div ref={containerRef} className="relative overflow-auto h-full">
      {/* 下拉刷新指示器 */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200",
          "bg-gradient-to-b from-background/95 to-background/80 backdrop-blur-sm z-50"
        )}
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 0 ? 1 : 0,
        }}
      >
        <div className="flex flex-col items-center gap-2 py-4">
          {isRefreshing ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">刷新中...</span>
            </>
          ) : (
            <>
              <RefreshCw
                className={cn(
                  "h-6 w-6 text-primary transition-transform duration-200",
                  shouldRefresh && "rotate-180"
                )}
                style={{
                  transform: `rotate(${progress * 180}deg)`
                }}
              />
              <span className="text-sm text-muted-foreground">
                {shouldRefresh ? '松开刷新' : '下拉刷新'}
              </span>
              {/* 进度指示器 */}
              <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div
        style={{
          transform: `translateY(${isRefreshing ? threshold : pullDistance}px)`,
          transition: canPull ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
}
