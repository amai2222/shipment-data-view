/**
 * 移动端触摸优化组件
 * 提供更好的触摸反馈和交互体验
 */

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/utils/mobile';

interface MobileTouchableProps {
  children: React.ReactNode;
  onClick?: () => void;
  onLongPress?: () => void;
  onDoubleClick?: () => void;
  className?: string;
  activeClassName?: string;
  disabled?: boolean;
  hapticFeedback?: boolean;
  longPressDuration?: number;
  rippleEffect?: boolean;
}

export function MobileTouchable({
  children,
  onClick,
  onLongPress,
  onDoubleClick,
  className,
  activeClassName = 'opacity-70 scale-95',
  disabled = false,
  hapticFeedback = true,
  longPressDuration = 500,
  rippleEffect = true
}: MobileTouchableProps) {
  const [isActive, setIsActive] = useState(false);
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastClickTime = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;

    setIsActive(true);

    // 长按检测
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        if (hapticFeedback) triggerHaptic('medium');
        onLongPress();
        setIsActive(false);
      }, longPressDuration);
    }

    // 涟漪效果
    if (rippleEffect && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const y = e.touches[0].clientY - rect.top;
      const id = Date.now();
      
      setRipples(prev => [...prev, { x, y, id }]);
      
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== id));
      }, 600);
    }
  };

  const handleTouchEnd = () => {
    if (disabled) return;

    setIsActive(false);
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = () => {
    if (disabled) return;

    // 双击检测
    const now = Date.now();
    if (onDoubleClick && now - lastClickTime.current < 300) {
      if (hapticFeedback) triggerHaptic('light');
      onDoubleClick();
      lastClickTime.current = 0;
      return;
    }

    lastClickTime.current = now;

    // 单击
    if (onClick) {
      if (hapticFeedback) triggerHaptic('light');
      onClick();
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative cursor-pointer select-none transition-all duration-150 overflow-hidden',
        isActive && activeClassName,
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      {children}

      {/* 涟漪效果 */}
      {rippleEffect && ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute bg-white/30 rounded-full pointer-events-none animate-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 0,
            height: 0,
            animation: 'ripple 0.6s ease-out'
          }}
        />
      ))}
    </div>
  );
}

// 移动端按钮增强组件
export function MobileButton({
  children,
  onClick,
  variant = 'default',
  size = 'default',
  className,
  disabled = false
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  disabled?: boolean;
}) {
  const variantClasses = {
    default: 'bg-background text-foreground border shadow-sm hover:bg-accent',
    primary: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90'
  };

  const sizeClasses = {
    sm: 'h-10 px-4 text-sm',
    default: 'h-12 px-6 text-base',
    lg: 'h-14 px-8 text-lg'
  };

  return (
    <MobileTouchable
      onClick={onClick}
      disabled={disabled}
      activeClassName="scale-95"
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'active:scale-95',
        variantClasses[variant],
        sizeClasses[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {children}
    </MobileTouchable>
  );
}

// 移动端卡片增强组件
export function MobileTouchableCard({
  children,
  onClick,
  className
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <MobileTouchable
      onClick={onClick}
      activeClassName="scale-98 shadow-lg"
      className={cn(
        'block rounded-lg border bg-card text-card-foreground shadow-sm',
        'transition-all duration-200',
        className
      )}
    >
      {children}
    </MobileTouchable>
  );
}

