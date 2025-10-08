/**
 * 性能监控和优化工具
 * 根据代码优化建议报告 - 工具和监控建议
 */

/**
 * 性能测量装饰器
 */
export function measurePerformance(name: string, fn: () => void | Promise<void>) {
  const start = performance.now();
  const result = fn();
  
  if (result instanceof Promise) {
    return result.finally(() => {
      const end = performance.now();
      if (import.meta.env.DEV) {
        console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
      }
    });
  } else {
    const end = performance.now();
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
    }
    return result;
  }
}

/**
 * 异步性能测量
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    return result;
  } finally {
    const end = performance.now();
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
    }
  }
}

/**
 * React组件渲染性能监控
 */
export function useRenderCount(componentName: string) {
  const renderCount = React.useRef(0);
  
  React.useEffect(() => {
    renderCount.current += 1;
    if (import.meta.env.DEV) {
      console.log(`[Render] ${componentName} 渲染次数: ${renderCount.current}`);
    }
  });
  
  return renderCount.current;
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 批量执行（控制并发数）
 */
export async function batchExecute<T, R>(
  items: T[],
  executor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  
  for (const item of items) {
    const promise = executor(item).then(result => {
      results.push(result);
    });
    
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }
  
  await Promise.all(executing);
  return results;
}

/**
 * 重试机制
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const { retries = 3, delay: delayMs = 1000, onRetry } = options;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;
      
      if (onRetry) {
        onRetry(error as Error, attempt + 1);
      }
      
      await delay(delayMs * Math.pow(2, attempt)); // 指数退避
    }
  }
  
  throw new Error('Retry failed');
}

/**
 * 缓存函数结果
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  getCacheKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = getCacheKey ? getCacheKey(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * 性能标记
 */
export class PerformanceMarker {
  private marks: Map<string, number> = new Map();
  
  mark(name: string) {
    this.marks.set(name, performance.now());
  }
  
  measure(name: string, startMark: string, endMark?: string) {
    const start = this.marks.get(startMark);
    const end = endMark ? this.marks.get(endMark) : performance.now();
    
    if (start === undefined) {
      console.warn(`起始标记 "${startMark}" 不存在`);
      return 0;
    }
    
    const duration = (end || performance.now()) - start;
    
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }
  
  clear() {
    this.marks.clear();
  }
}

// React import for useRenderCount
import React from 'react';

