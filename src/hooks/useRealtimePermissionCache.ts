// 实时权限缓存 Hook - 确保权限变更立即生效
// 文件: src/hooks/useRealtimePermissionCache.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMemoryLeakFix } from './useMemoryLeakFix';

interface RealtimePermissionCacheOptions {
  ttl?: number; // 缓存生存时间（毫秒）
  enableRealtime?: boolean; // 是否启用实时更新
  invalidateOnChange?: boolean; // 变更时是否立即失效缓存
}

export function useRealtimePermissionCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: RealtimePermissionCacheOptions = {}
) {
  const {
    ttl = 2 * 60 * 1000, // 默认2分钟（比普通缓存更短）
    enableRealtime = true,
    invalidateOnChange = true
  } = options;

  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  const { addChannel, addCleanup } = useMemoryLeakFix();

  // 检查缓存是否有效
  const isCacheValid = useCallback((timestamp: number): boolean => {
    return (Date.now() - timestamp) < ttl;
  }, [ttl]);

  // 获取缓存数据
  const getCachedData = useCallback((): T | null => {
    const item = cacheRef.current.get(key);
    if (!item) return null;

    if (isCacheValid(item.timestamp)) {
      return item.data;
    }

    // 缓存过期，删除
    cacheRef.current.delete(key);
    return null;
  }, [key, isCacheValid]);

  // 获取数据
  const fetchData = useCallback(async (force = false) => {
    if (!force) {
      const cachedData = getCachedData();
      if (cachedData) {
        setData(cachedData);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      const now = Date.now();

      // 更新缓存
      cacheRef.current.set(key, {
        data: result,
        timestamp: now
      });

      setData(result);
      setLastUpdate(now);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, getCachedData]);

  // 使缓存失效
  const invalidate = useCallback(() => {
    cacheRef.current.delete(key);
    setData(null);
  }, [key]);

  // 刷新数据
  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // 设置实时订阅
  useEffect(() => {
    if (!enableRealtime) return;

    // 订阅权限相关表的变更
    const permissionTables = [
      'user_permissions',
      'role_permission_templates', 
      'profiles',
      'contract_permissions',
      'contract_owner_permissions',
      'contract_category_permission_templates'
    ];

    const channels = permissionTables.map(tableName => {
      const channel = supabase
        .channel(`${tableName}_permission_changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tableName
          },
          (payload) => {
            console.log(`权限表 ${tableName} 发生变更:`, payload);
            
            if (invalidateOnChange) {
              // 立即使缓存失效
              invalidate();
              // 重新获取数据
              fetchData(true);
            }
          }
        )
        .subscribe();

      addChannel(channel);
      return channel;
    });

    // 订阅权限变更广播
    const broadcastChannel = supabase
      .channel('permission_cache_invalidation')
      .on('broadcast', { event: 'invalidate_permission_cache' }, (payload) => {
        console.log('收到权限缓存失效广播:', payload);
        if (payload.key === key || payload.key === 'all') {
          invalidate();
          fetchData(true);
        }
      })
      .subscribe();

    addChannel(broadcastChannel);

    // 初始加载
    fetchData();

    // 清理函数
    return () => {
      channels.forEach(channel => {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          console.warn('清理权限订阅失败:', error);
        }
      });
      
      try {
        supabase.removeChannel(broadcastChannel);
      } catch (error) {
        console.warn('清理广播订阅失败:', error);
      }
    };
  }, [enableRealtime, invalidateOnChange, invalidate, fetchData, addChannel, key]);

  return {
    data,
    loading,
    error,
    refresh,
    invalidate,
    lastUpdate,
    isStale: data ? !isCacheValid(lastUpdate) : false
  };
}

// 权限变更通知服务
export class PermissionChangeNotifier {
  private static instance: PermissionChangeNotifier;
  private subscribers: Map<string, (() => void)[]> = new Map();

  static getInstance(): PermissionChangeNotifier {
    if (!PermissionChangeNotifier.instance) {
      PermissionChangeNotifier.instance = new PermissionChangeNotifier();
    }
    return PermissionChangeNotifier.instance;
  }

  // 订阅权限变更
  subscribe(key: string, callback: () => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, []);
    }
    
    this.subscribers.get(key)!.push(callback);

    // 返回取消订阅函数
    return () => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  // 通知权限变更
  notify(key: string): void {
    const callbacks = this.subscribers.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('权限变更通知失败:', error);
        }
      });
    }
  }

  // 通知所有订阅者
  notifyAll(): void {
    this.subscribers.forEach((callbacks, key) => {
      callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('权限变更通知失败:', error);
        }
      });
    });
  }

  // 发送广播通知
  async broadcastInvalidation(key: string = 'all'): Promise<void> {
    try {
      await supabase.channel('permission_cache_invalidation').send({
        type: 'broadcast',
        event: 'invalidate_permission_cache',
        payload: { key, timestamp: Date.now() }
      });
    } catch (error) {
      console.error('发送权限缓存失效广播失败:', error);
    }
  }
}

// 权限变更 Hook
export function usePermissionChangeNotification(key: string) {
  const notifier = PermissionChangeNotifier.getInstance();
  const [changeCount, setChangeCount] = useState(0);

  useEffect(() => {
    const unsubscribe = notifier.subscribe(key, () => {
      setChangeCount(prev => prev + 1);
    });

    return unsubscribe;
  }, [key, notifier]);

  const notifyChange = useCallback(() => {
    notifier.notify(key);
  }, [key, notifier]);

  const broadcastChange = useCallback(async () => {
    await notifier.broadcastInvalidation(key);
  }, [key, notifier]);

  return {
    changeCount,
    notifyChange,
    broadcastChange
  };
}

// 优化的权限数据 Hook - 结合实时更新和智能缓存
export function useOptimizedPermissionData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: RealtimePermissionCacheOptions = {}
) {
  const {
    data,
    loading,
    error,
    refresh,
    invalidate,
    lastUpdate,
    isStale
  } = useRealtimePermissionCache(key, fetcher, options);

  const { changeCount, notifyChange, broadcastChange } = usePermissionChangeNotification(key);

  // 当权限变更时，自动刷新数据
  useEffect(() => {
    if (changeCount > 0) {
      refresh();
    }
  }, [changeCount, refresh]);

  return {
    data,
    loading,
    error,
    refresh,
    invalidate,
    lastUpdate,
    isStale,
    changeCount,
    notifyChange,
    broadcastChange
  };
}
