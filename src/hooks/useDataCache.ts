// 文件路径: src/hooks/useDataCache.ts
// 描述: 数据缓存钩子，提供智能缓存和性能优化

import { useState, useEffect, useRef, useCallback } from 'react';

interface CacheOptions {
  ttl?: number; // 缓存时间（毫秒）
  maxSize?: number; // 最大缓存数量
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

class DataCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5分钟
  private maxSize = 100;

  set<T>(key: string, data: T, ttl?: number): void {
    // 清理过期缓存
    this.cleanup();
    
    // 如果超过最大大小，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      key
    });
  }

  get<T>(key: string, ttl?: number): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const maxAge = ttl || this.defaultTTL;
    if (Date.now() - entry.timestamp > maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string, ttl?: number): boolean {
    return this.get(key, ttl) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.defaultTTL) {
        this.cache.delete(key);
      }
    }
  }
}

// 全局缓存实例
const globalCache = new DataCache();

export function useDataCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { ttl = 5 * 60 * 1000, maxSize = 100 } = options;
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);

  const loadData = useCallback(async (force = false) => {
    // 防止重复请求
    if (loadingRef.current && !force) return;

    // 先检查缓存
    if (!force) {
      const cached = globalCache.get<T>(key, ttl);
      if (cached) {
        setData(cached);
        setError(null);
        return cached;
      }
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      
      // 检查请求是否被取消
      if (abortControllerRef.current?.signal.aborted) {
        return null;
      }

      globalCache.set(key, result, ttl);
      setData(result);
      return result;
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        return null;
      }
      
      const error = err as Error;
      setError(error);
      throw error;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [key, fetcher, ttl]);

  const refresh = useCallback(() => {
    return loadData(true);
  }, [loadData]);

  const clearCache = useCallback(() => {
    globalCache.delete(key);
  }, [key]);

  useEffect(() => {
    loadData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadData]);

  return {
    data,
    loading,
    error,
    refresh,
    clearCache,
    invalidate: clearCache
  };
}

export { globalCache };