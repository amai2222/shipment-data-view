// 移动端触摸优化 Hook
import { useEffect, useRef, useCallback } from 'react';

/**
 * 触摸反馈配置
 */
interface TouchFeedbackOptions {
  vibrate?: boolean; // 是否启用震动反馈
  hapticFeedback?: 'light' | 'medium' | 'heavy'; // 震动强度
  activeClass?: string; // 激活时的 CSS 类
  scale?: number; // 缩放比例
}

/**
 * 使用触摸反馈
 */
export const useTouchFeedback = (
  elementRef: React.RefObject<HTMLElement>,
  options: TouchFeedbackOptions = {}
) => {
  const {
    vibrate = true,
    hapticFeedback = 'light',
    activeClass = 'active',
    scale = 0.95
  } = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = () => {
      // 添加激活样式
      element.classList.add(activeClass);
      element.style.transform = `scale(${scale})`;
      element.style.transition = 'transform 0.1s ease';

      // 触觉反馈
      if (vibrate && 'vibrate' in navigator) {
        const vibrationPattern = {
          light: 10,
          medium: 20,
          heavy: 30
        };
        navigator.vibrate(vibrationPattern[hapticFeedback]);
      }
    };

    const handleTouchEnd = () => {
      // 移除激活样式
      element.classList.remove(activeClass);
      element.style.transform = 'scale(1)';
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [elementRef, activeClass, scale, vibrate, hapticFeedback]);
};

/**
 * 手势识别配置
 */
interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // 触发手势的最小距离（像素）
  restraint?: number; // 最大垂直/水平偏移量（像素）
  allowedTime?: number; // 最大滑动时间（毫秒）
}

/**
 * 使用滑动手势
 */
export const useSwipeGesture = (
  elementRef: React.RefObject<HTMLElement>,
  options: SwipeGestureOptions = {}
) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 100,
    restraint = 100,
    allowedTime = 500
  } = options;

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      touchStartX.current = touch.pageX;
      touchStartY.current = touch.pageY;
      touchStartTime.current = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const distX = touch.pageX - touchStartX.current;
      const distY = touch.pageY - touchStartY.current;
      const elapsedTime = Date.now() - touchStartTime.current;

      if (elapsedTime > allowedTime) return;

      // 水平滑动
      if (Math.abs(distX) >= threshold && Math.abs(distY) <= restraint) {
        if (distX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (distX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      }
      // 垂直滑动
      else if (Math.abs(distY) >= threshold && Math.abs(distX) <= restraint) {
        if (distY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (distY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [elementRef, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, restraint, allowedTime]);
};

/**
 * 长按手势
 */
export const useLongPress = (
  elementRef: React.RefObject<HTMLElement>,
  callback: () => void,
  delay = 500
) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = () => {
      timeoutRef.current = setTimeout(() => {
        callback();
        // 触觉反馈
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }, delay);
    };

    const handleTouchEnd = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    element.addEventListener('touchmove', handleTouchEnd, { passive: true });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
      element.removeEventListener('touchmove', handleTouchEnd);
    };
  }, [elementRef, callback, delay]);
};

/**
 * 防止页面滚动（适用于模态框等场景）
 */
export const usePreventScroll = (shouldPrevent: boolean) => {
  useEffect(() => {
    if (!shouldPrevent) return;

    const preventDefault = (e: TouchEvent) => {
      e.preventDefault();
    };

    document.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventDefault);
    };
  }, [shouldPrevent]);
};

/**
 * 触摸拖拽
 */
export const useTouchDrag = (
  elementRef: React.RefObject<HTMLElement>,
  onDrag?: (deltaX: number, deltaY: number) => void,
  onDragEnd?: () => void
) => {
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      isDragging.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;

      if (onDrag) {
        onDrag(deltaX, deltaY);
      }
    };

    const handleTouchEnd = () => {
      if (isDragging.current && onDragEnd) {
        onDragEnd();
      }
      isDragging.current = false;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [elementRef, onDrag, onDragEnd]);
};

