// 性能监控工具
import { useEffect, createElement, ComponentType } from 'react';
// 用于检测和报告应用性能问题

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private observers: PerformanceObserver[] = [];
  private thresholds = {
    longTask: 50, // 50ms
    apiCall: 1000, // 1s
    renderTime: 16, // 16ms (60fps)
  };

  constructor() {
    this.setupObservers();
  }

  // 开始性能测量
  start(name: string, metadata?: Record<string, any>) {
    this.metrics.set(name, {
      name,
      startTime: performance.now(),
      metadata,
    });
  }

  // 结束性能测量
  end(name: string) {
    const metric = this.metrics.get(name);
    if (metric) {
      const endTime = performance.now();
      const duration = endTime - metric.startTime;
      
      metric.endTime = endTime;
      metric.duration = duration;

      this.checkThresholds(metric);
      this.logMetric(metric);
    }
  }

  // 测量异步函数性能
  async measure<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    this.start(name, metadata);
    try {
      const result = await fn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }

  // 测量同步函数性能
  measureSync<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    this.start(name, metadata);
    try {
      const result = fn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }

  // 设置性能阈值
  setThresholds(thresholds: Partial<typeof this.thresholds>) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  // 获取性能报告
  getReport() {
    const metrics = Array.from(this.metrics.values())
      .filter(m => m.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));

    const summary = {
      totalMetrics: metrics.length,
      averageDuration: metrics.reduce((sum, m) => sum + (m.duration || 0), 0) / metrics.length,
      slowestOperations: metrics.slice(0, 10),
      thresholdViolations: metrics.filter(m => this.isThresholdViolated(m)),
    };

    return { metrics, summary };
  }

  // 检查阈值违规
  private checkThresholds(metric: PerformanceMetric) {
    if (this.isThresholdViolated(metric)) {
      console.warn(`Performance threshold violation: ${metric.name} took ${metric.duration}ms`, metric);
    }
  }

  private isThresholdViolated(metric: PerformanceMetric): boolean {
    if (!metric.duration) return false;

    const { name, duration } = metric;
    
    if (name.includes('api') && duration > this.thresholds.apiCall) return true;
    if (name.includes('render') && duration > this.thresholds.renderTime) return true;
    if (duration > this.thresholds.longTask) return true;

    return false;
  }

  // 设置性能观察者
  private setupObservers() {
    // 观察长任务
    if ('PerformanceObserver' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > this.thresholds.longTask) {
            console.warn(`Long task detected: ${entry.duration}ms`, entry);
          }
        }
      });

      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        // Longtask API not supported
      }

      // 观察资源加载
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 500) { // 超过500ms的资源加载
            console.warn(`Slow resource loading: ${entry.name} took ${entry.duration}ms`);
          }
        }
      });

      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (e) {
        // Resource timing API not supported
      }
    }
  }

  private logMetric(metric: PerformanceMetric) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Performance: ${metric.name} - ${metric.duration}ms`, metric.metadata);
    }
  }

  // 清理观察者
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
  }
}

// 单例实例
export const performanceMonitor = new PerformanceMonitor();

// React HOC for component performance monitoring
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: ComponentType<P>,
  componentName?: string
) {
  return function PerformanceMonitoredComponent(props: P) {
    const name = componentName || WrappedComponent.displayName || WrappedComponent.name;
    
    useEffect(() => {
      performanceMonitor.start(`render-${name}`);
      return () => {
        performanceMonitor.end(`render-${name}`);
      };
    });

    return createElement(WrappedComponent, props);
  };
}

// 性能装饰器
export function performanceDecorator(name?: string) {
  return function <T extends (...args: any[]) => any>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;
    const metricName = name || `${target.constructor.name}.${propertyName}`;

    descriptor.value = function (...args: Parameters<T>) {
      return performanceMonitor.measureSync(metricName, () => method.apply(this, args));
    } as T;

    return descriptor;
  };
}