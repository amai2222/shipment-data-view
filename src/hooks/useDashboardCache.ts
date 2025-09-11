import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// 缓存接口
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

// 内存缓存
class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();

  set<T>(key: string, data: T, expiresIn: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > item.expiresIn) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }

  // 清理过期缓存
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.expiresIn) {
        this.cache.delete(key);
      }
    }
  }
}

const cache = new MemoryCache();

// 定期清理过期缓存
setInterval(() => {
  cache.cleanup();
}, 60 * 1000); // 每分钟清理一次

// 缓存键生成器
const getCacheKey = (functionName: string, params: any): string => {
  return `${functionName}_${JSON.stringify(params)}`;
};

// 首页数据缓存 Hook
export function useDashboardCache() {
  const [isPreloading, setIsPreloading] = useState(false);

  // 预加载今日数据
  const preloadTodayStats = useCallback(async () => {
    const cacheKey = getCacheKey('get_today_stats', {});
    const cached = cache.get(cacheKey);
    
    if (cached) return cached;

    try {
      const { data, error } = await supabase.rpc('get_today_stats');
      if (error) throw error;
      
      cache.set(cacheKey, data, 2 * 60 * 1000); // 缓存2分钟
      return data;
    } catch (error) {
      console.error('预加载今日数据失败:', error);
      return null;
    }
  }, []);

  // 预加载项目统计
  const preloadProjectStats = useCallback(async () => {
    const cacheKey = getCacheKey('get_project_quick_stats', {});
    const cached = cache.get(cacheKey);
    
    if (cached) return cached;

    try {
      const { data, error } = await supabase.rpc('get_project_quick_stats');
      if (error) throw error;
      
      cache.set(cacheKey, data, 5 * 60 * 1000); // 缓存5分钟
      return data;
    } catch (error) {
      console.error('预加载项目统计失败:', error);
      return null;
    }
  }, []);

  // 预加载快速统计数据
  const preloadQuickStats = useCallback(async (params: {
    p_start_date?: string | null;
    p_end_date?: string | null;
    p_project_id?: string | null;
  }) => {
    const cacheKey = getCacheKey('get_dashboard_quick_stats', params);
    const cached = cache.get(cacheKey);
    
    if (cached) return cached;

    try {
      const { data, error } = await supabase.rpc('get_dashboard_quick_stats', params);
      if (error) throw error;
      
      cache.set(cacheKey, data, 3 * 60 * 1000); // 缓存3分钟
      return data;
    } catch (error) {
      console.error('预加载快速统计失败:', error);
      return null;
    }
  }, []);

  // 批量预加载
  const preloadAll = useCallback(async () => {
    setIsPreloading(true);
    try {
      await Promise.all([
        preloadTodayStats(),
        preloadProjectStats(),
        preloadQuickStats({ p_start_date: null, p_end_date: null, p_project_id: null })
      ]);
    } catch (error) {
      console.error('批量预加载失败:', error);
    } finally {
      setIsPreloading(false);
    }
  }, [preloadTodayStats, preloadProjectStats, preloadQuickStats]);

  // 获取缓存数据
  const getCachedData = useCallback(<T>(functionName: string, params: any): T | null => {
    const cacheKey = getCacheKey(functionName, params);
    return cache.get<T>(cacheKey);
  }, []);

  // 设置缓存数据
  const setCachedData = useCallback(<T>(functionName: string, params: any, data: T, expiresIn?: number): void => {
    const cacheKey = getCacheKey(functionName, params);
    cache.set(cacheKey, data, expiresIn);
  }, []);

  // 清除缓存
  const clearCache = useCallback(() => {
    cache.clear();
  }, []);

  return {
    preloadTodayStats,
    preloadProjectStats,
    preloadQuickStats,
    preloadAll,
    getCachedData,
    setCachedData,
    clearCache,
    isPreloading
  };
}

// 带缓存的 RPC 调用 Hook
export function useCachedRPC<T>(
  functionName: string,
  params: any,
  options: {
    enabled?: boolean;
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
  } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const {
    enabled = true,
    staleTime = 5 * 60 * 1000,
    refetchOnWindowFocus = false
  } = options;

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    const cacheKey = getCacheKey(functionName, params);
    const cached = cache.get<T>(cacheKey);

    if (cached && !forceRefresh) {
      setData(cached);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: rpcError } = await supabase.rpc(functionName, params);
      if (rpcError) throw rpcError;

      cache.set(cacheKey, result, staleTime);
      setData(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error(`RPC调用失败 ${functionName}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [functionName, params, enabled, staleTime]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 窗口焦点时重新获取数据
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      fetchData(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchData, refetchOnWindowFocus]);

  return {
    data,
    isLoading,
    error,
    refetch: () => fetchData(true)
  };
}
