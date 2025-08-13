// 性能优化Hook
// 提供缓存、防抖、虚拟化等性能优化功能

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// 1. API响应缓存Hook
export function useAPICache<T>(key: string, fetcher: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());
  const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  const fetchData = useCallback(async () => {
    const cached = cacheRef.current.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setData(cached.data);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      cacheRef.current.set(key, { data: result, timestamp: Date.now() });
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, CACHE_DURATION]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...deps]);

  const invalidateCache = useCallback(() => {
    cacheRef.current.delete(key);
  }, [key]);

  return { data, loading, error, refetch: fetchData, invalidateCache };
}

// 2. 防抖Hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// 3. 虚拟滚动Hook
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );

    return {
      startIndex,
      endIndex,
      items: items.slice(startIndex, endIndex),
      offsetY: startIndex * itemHeight,
      totalHeight: items.length * itemHeight,
    };
  }, [items, itemHeight, containerHeight, scrollTop]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return { visibleItems, handleScroll };
}

// 4. 批量操作Hook
export function useBatchOperations<T>(batchSize: number = 100) {
  const [queue, setQueue] = useState<T[]>([]);
  const [processing, setProcessing] = useState(false);

  const addToQueue = useCallback((items: T[]) => {
    setQueue(prev => [...prev, ...items]);
  }, []);

  const processBatch = useCallback(async (processor: (batch: T[]) => Promise<void>) => {
    if (queue.length === 0 || processing) return;

    setProcessing(true);
    try {
      while (queue.length > 0) {
        const batch = queue.slice(0, batchSize);
        setQueue(prev => prev.slice(batchSize));
        await processor(batch);
        
        // 让UI更新
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally {
      setProcessing(false);
    }
  }, [queue, batchSize, processing]);

  return { queue, processing, addToQueue, processBatch };
}

// 5. 内存优化Hook - 清理未使用的状态
export function useMemoryOptimization() {
  const cleanupFunctions = useRef<(() => void)[]>([]);

  const addCleanup = useCallback((fn: () => void) => {
    cleanupFunctions.current.push(fn);
  }, []);

  useEffect(() => {
    return () => {
      cleanupFunctions.current.forEach(fn => fn());
      cleanupFunctions.current = [];
    };
  }, []);

  return { addCleanup };
}

// 6. 智能重新渲染Hook
export function useSmartRerender<T>(value: T, compareFn?: (a: T, b: T) => boolean) {
  const ref = useRef<T>(value);
  const [, forceUpdate] = useState({});

  const updateValue = useCallback((newValue: T) => {
    const shouldUpdate = compareFn 
      ? !compareFn(ref.current, newValue)
      : ref.current !== newValue;

    if (shouldUpdate) {
      ref.current = newValue;
      forceUpdate({});
    }
  }, [compareFn]);

  return [ref.current, updateValue] as const;
}

// 7. 懒加载Hook
export function useLazyLoading<T>(
  loadFn: () => Promise<T>,
  shouldLoad: boolean
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (shouldLoad && !hasLoaded.current && !loading) {
      setLoading(true);
      loadFn()
        .then(result => {
          setData(result);
          hasLoaded.current = true;
        })
        .finally(() => setLoading(false));
    }
  }, [shouldLoad, loadFn, loading]);

  return { data, loading };
}