/**
 * 优化的callback和memo hooks
 * 根据代码优化建议报告 - 中优先级优化 2.1
 */

import { useCallback, useMemo, useRef, useEffect, DependencyList } from 'react';

/**
 * 稳定的回调函数，总是返回最新的值但引用不变
 * 解决useCallback依赖数组警告问题
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback((...args: any[]) => {
    return callbackRef.current(...args);
  }, []) as T;
}

/**
 * 深度对比的useMemo
 */
export function useDeepMemo<T>(
  factory: () => T,
  deps: DependencyList
): T {
  const ref = useRef<{ value: T; deps: DependencyList }>({
    value: factory(),
    deps
  });

  const hasChanged = deps.some((dep, i) => {
    return !Object.is(dep, ref.current.deps[i]);
  });

  if (hasChanged) {
    ref.current = {
      value: factory(),
      deps
    };
  }

  return ref.current.value;
}

/**
 * 防抖的useState
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 300
): [T, (value: T) => void, T] {
  const [value, setValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return [value, setValue, debouncedValue];
}

/**
 * 节流的useState
 */
export function useThrottledState<T>(
  initialValue: T,
  limit: number = 300
): [T, (value: T) => void, T] {
  const [value, setValue] = useState(initialValue);
  const [throttledValue, setThrottledValue] = useState(initialValue);
  const lastRun = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastRun = now - lastRun.current;

    if (timeSinceLastRun >= limit) {
      setThrottledValue(value);
      lastRun.current = now;
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value);
        lastRun.current = Date.now();
      }, limit - timeSinceLastRun);

      return () => clearTimeout(timer);
    }
  }, [value, limit]);

  return [value, setValue, throttledValue];
}

/**
 * 优化的useEffect，跳过首次渲染
 */
export function useUpdateEffect(
  effect: React.EffectCallback,
  deps?: DependencyList
) {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    return effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * 优化的数组状态管理
 */
export function useOptimizedArray<T>(initialArray: T[] = []) {
  const [array, setArray] = useState<T[]>(initialArray);

  const push = useCallback((item: T) => {
    setArray(prev => [...prev, item]);
  }, []);

  const remove = useCallback((index: number) => {
    setArray(prev => prev.filter((_, i) => i !== index));
  }, []);

  const update = useCallback((index: number, item: T) => {
    setArray(prev => prev.map((val, i) => i === index ? item : val));
  }, []);

  const clear = useCallback(() => {
    setArray([]);
  }, []);

  return { array, push, remove, update, clear, setArray };
}

// React import
import { useState } from 'react';

