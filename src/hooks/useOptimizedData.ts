import { useState, useCallback, useRef, useEffect } from 'react';

interface UseOptimizedDataOptions {
  debounceMs?: number;
  cacheKey?: string;
}

export function useOptimizedData<T>(
  fetchFunction: () => Promise<T>,
  dependencies: any[],
  options: UseOptimizedDataOptions = {}
) {
  const { debounceMs = 300, cacheKey } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());

  const fetchData = useCallback(async (force = false) => {
    // 检查缓存
    if (cacheKey && !force) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 30000) { // 30秒缓存
        setData(cached.data);
        return;
      }
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 清除之前的超时
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 设置防抖
    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const result = await fetchFunction();
        
        if (!controller.signal.aborted) {
          setData(result);
          
          // 更新缓存
          if (cacheKey) {
            cacheRef.current.set(cacheKey, {
              data: result,
              timestamp: Date.now()
            });
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err as Error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, debounceMs);
  }, [fetchFunction, debounceMs, cacheKey]);

  useEffect(() => {
    fetchData();
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, dependencies);

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  const clearCache = useCallback(() => {
    if (cacheKey) {
      cacheRef.current.delete(cacheKey);
    }
  }, [cacheKey]);

  return {
    data,
    loading,
    error,
    refresh,
    clearCache
  };
}