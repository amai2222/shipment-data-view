// 内存优化工具
import { useEffect, useMemo } from 'react';
// 提供内存管理、垃圾回收、缓存清理等功能

class MemoryOptimizer {
  private memoryThreshold = 100 * 1024 * 1024; // 100MB
  private checkInterval = 30000; // 30秒
  private intervalId: NodeJS.Timeout | null = null;
  private observers: (() => void)[] = [];

  constructor() {
    this.startMonitoring();
  }

  // 开始内存监控
  startMonitoring() {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);
  }

  // 停止内存监控
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // 检查内存使用情况
  private checkMemoryUsage() {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const usedMemory = memInfo.usedJSHeapSize;
      
      if (usedMemory > this.memoryThreshold) {
        console.warn(`High memory usage detected: ${(usedMemory / 1024 / 1024).toFixed(2)}MB`);
        this.triggerCleanup();
      }
    }
  }

  // 触发清理
  private triggerCleanup() {
    this.observers.forEach(observer => {
      try {
        observer();
      } catch (error) {
        console.error('Memory cleanup error:', error);
      }
    });

    // 建议垃圾回收
    this.suggestGarbageCollection();
  }

  // 建议垃圾回收
  private suggestGarbageCollection() {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }

  // 注册清理观察者
  addCleanupObserver(observer: () => void) {
    this.observers.push(observer);
  }

  // 移除清理观察者
  removeCleanupObserver(observer: () => void) {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  // 获取内存信息
  getMemoryInfo() {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      return {
        used: memInfo.usedJSHeapSize,
        total: memInfo.totalJSHeapSize,
        limit: memInfo.jsHeapSizeLimit,
        usedMB: (memInfo.usedJSHeapSize / 1024 / 1024).toFixed(2),
        totalMB: (memInfo.totalJSHeapSize / 1024 / 1024).toFixed(2),
        limitMB: (memInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2),
      };
    }
    return null;
  }

  // 设置内存阈值
  setMemoryThreshold(bytes: number) {
    this.memoryThreshold = bytes;
  }

  // 设置检查间隔
  setCheckInterval(ms: number) {
    this.checkInterval = ms;
    if (this.intervalId) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }
}

// 单例实例
export const memoryOptimizer = new MemoryOptimizer();

// React Hook for memory optimization
export function useMemoryOptimization(cleanupFn?: () => void) {
  useEffect(() => {
    if (cleanupFn) {
      memoryOptimizer.addCleanupObserver(cleanupFn);
    }

    return () => {
      if (cleanupFn) {
        memoryOptimizer.removeCleanupObserver(cleanupFn);
      }
    };
  }, [cleanupFn]);

  const memoryInfo = useMemo(() => {
    return memoryOptimizer.getMemoryInfo();
  }, []);

  return { memoryInfo };
}

// 缓存管理类
export class CacheManager {
  private static instance: CacheManager;
  private caches: Map<string, Map<string, { data: any; timestamp: number; ttl: number }>> = new Map();
  private maxCacheSize = 1000; // 每个缓存最大条目数
  private defaultTTL = 5 * 60 * 1000; // 5分钟

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  // 设置缓存
  set(namespace: string, key: string, data: any, ttl?: number) {
    if (!this.caches.has(namespace)) {
      this.caches.set(namespace, new Map());
    }

    const cache = this.caches.get(namespace)!;
    
    // 检查缓存大小
    if (cache.size >= this.maxCacheSize) {
      this.evictOldest(namespace);
    }

    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  // 获取缓存
  get(namespace: string, key: string): any | null {
    const cache = this.caches.get(namespace);
    if (!cache) return null;

    const item = cache.get(key);
    if (!item) return null;

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      cache.delete(key);
      return null;
    }

    return item.data;
  }

  // 删除缓存
  delete(namespace: string, key?: string) {
    if (!key) {
      this.caches.delete(namespace);
      return;
    }

    const cache = this.caches.get(namespace);
    if (cache) {
      cache.delete(key);
    }
  }

  // 清理过期缓存
  cleanup() {
    const now = Date.now();
    
    for (const [namespace, cache] of this.caches) {
      for (const [key, item] of cache) {
        if (now - item.timestamp > item.ttl) {
          cache.delete(key);
        }
      }
      
      // 如果缓存为空，删除命名空间
      if (cache.size === 0) {
        this.caches.delete(namespace);
      }
    }
  }

  // 淘汰最旧的缓存项
  private evictOldest(namespace: string) {
    const cache = this.caches.get(namespace);
    if (!cache) return;

    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, item] of cache) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  // 获取缓存统计
  getStats() {
    let totalItems = 0;
    let totalSize = 0;

    for (const [namespace, cache] of this.caches) {
      totalItems += cache.size;
      
      // 估算大小（简单实现）
      for (const [, item] of cache) {
        totalSize += JSON.stringify(item.data).length;
      }
    }

    return {
      namespaces: this.caches.size,
      totalItems,
      estimatedSizeBytes: totalSize,
      estimatedSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    };
  }

  // 设置最大缓存大小
  setMaxCacheSize(size: number) {
    this.maxCacheSize = size;
  }

  // 设置默认TTL
  setDefaultTTL(ttl: number) {
    this.defaultTTL = ttl;
  }
}

// 全局缓存实例
export const globalCache = CacheManager.getInstance();

// 自动清理定时器
setInterval(() => {
  globalCache.cleanup();
}, 60000); // 每分钟清理一次

// 监听页面可见性变化，在页面隐藏时清理缓存
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    globalCache.cleanup();
    
    // 建议垃圾回收
    if ('gc' in window && typeof (window as any).gc === 'function') {
      setTimeout(() => {
        (window as any).gc();
      }, 1000);
    }
  }
});