/**
 * 可滑动的移动端卡片组件
 * 支持左右滑动显示操作按钮
 */

import { useRef, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { triggerHaptic } from '@/utils/mobile';

interface SwipeAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'success';
}

interface MobileSwipeableCardProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  onSwipe?: (direction: 'left' | 'right') => void;
  className?: string;
  disabled?: boolean;
}

export function MobileSwipeableCard({
  children,
  leftActions = [],
  rightActions = [],
  onSwipe,
  className,
  disabled = false
}: MobileSwipeableCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const maxLeftSwipe = leftActions.length * 80;
  const maxRightSwipe = rightActions.length * 80;

  useEffect(() => {
    if (!cardRef.current || disabled) return;

    const card = cardRef.current;

    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      currentX.current = offsetX;
      setIsDragging(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;

      const diff = e.touches[0].clientX - startX.current;
      let newOffset = currentX.current + diff;

      // 限制滑动范围
      if (leftActions.length === 0) {
        newOffset = Math.min(0, newOffset);
      }
      if (rightActions.length === 0) {
        newOffset = Math.max(0, newOffset);
      }

      newOffset = Math.max(-maxRightSwipe, Math.min(maxLeftSwipe, newOffset));
      setOffsetX(newOffset);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);

      // 判断是否触发滑动
      if (Math.abs(offsetX) > 40) {
        if (offsetX > 0) {
          setOffsetX(maxLeftSwipe);
          onSwipe?.('left');
          triggerHaptic('light');
        } else {
          setOffsetX(-maxRightSwipe);
          onSwipe?.('right');
          triggerHaptic('light');
        }
      } else {
        setOffsetX(0);
      }
    };

    card.addEventListener('touchstart', handleTouchStart, { passive: true });
    card.addEventListener('touchmove', handleTouchMove, { passive: true });
    card.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      card.removeEventListener('touchstart', handleTouchStart);
      card.removeEventListener('touchmove', handleTouchMove);
      card.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, offsetX, maxLeftSwipe, maxRightSwipe, disabled, leftActions.length, rightActions.length, onSwipe]);

  const getActionColor = (variant?: string) => {
    switch (variant) {
      case 'destructive':
        return 'bg-red-500 hover:bg-red-600 text-white';
      case 'success':
        return 'bg-green-500 hover:bg-green-600 text-white';
      default:
        return 'bg-blue-500 hover:bg-blue-600 text-white';
    }
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* 左侧操作按钮 */}
      {leftActions.length > 0 && (
        <div className="absolute left-0 top-0 bottom-0 flex items-center">
          {leftActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant="ghost"
                className={cn(
                  'h-full rounded-none w-20 flex-col',
                  getActionColor(action.variant)
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                  setOffsetX(0);
                  triggerHaptic('medium');
                }}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs">{action.label}</span>
              </Button>
            );
          })}
        </div>
      )}

      {/* 右侧操作按钮 */}
      {rightActions.length > 0 && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center">
          {rightActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant="ghost"
                className={cn(
                  'h-full rounded-none w-20 flex-col',
                  getActionColor(action.variant)
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                  setOffsetX(0);
                  triggerHaptic('medium');
                }}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs">{action.label}</span>
              </Button>
            );
          })}
        </div>
      )}

      {/* 卡片内容 */}
      <div
        ref={cardRef}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out'
        }}
      >
        <Card className="shadow-none border-0">
          <CardContent className="p-0">
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 简化版滑动删除卡片
export function SwipeToDeleteCard({
  children,
  onDelete,
  className
}: {
  children: React.ReactNode;
  onDelete: () => void;
  className?: string;
}) {
  return (
    <MobileSwipeableCard
      rightActions={[
        {
          icon: () => <span>🗑️</span>,
          label: '删除',
          onClick: onDelete,
          variant: 'destructive'
        } as any
      ]}
      className={className}
    >
      {children}
    </MobileSwipeableCard>
  );
}

