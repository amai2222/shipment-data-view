/**
 * 统一日志管理系统
 * 根据环境变量控制日志输出，生产环境自动禁用调试日志
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  isDevelopment: boolean;
  enableDebug: boolean;
  enableInfo: boolean;
  enableWarn: boolean;
  enableError: boolean;
}

class Logger {
  private config: LoggerConfig;

  constructor() {
    // 根据环境变量配置日志级别
    const isDevelopment = import.meta.env.DEV;
    
    this.config = {
      isDevelopment,
      enableDebug: isDevelopment, // 仅开发环境启用
      enableInfo: true, // 所有环境启用
      enableWarn: true, // 所有环境启用
      enableError: true, // 所有环境启用
    };
  }

  /**
   * 调试日志 - 仅开发环境输出
   * 用于详细的调试信息
   */
  debug(...args: any[]): void {
    if (this.config.enableDebug) {
      console.log('%c[DEBUG]', 'color: #888; font-weight: bold', ...args);
    }
  }

  /**
   * 信息日志 - 所有环境输出
   * 用于一般性信息
   */
  info(...args: any[]): void {
    if (this.config.enableInfo) {
      console.info('%c[INFO]', 'color: #0066cc; font-weight: bold', ...args);
    }
  }

  /**
   * 警告日志 - 所有环境输出
   * 用于警告信息
   */
  warn(...args: any[]): void {
    if (this.config.enableWarn) {
      console.warn('%c[WARN]', 'color: #ff9900; font-weight: bold', ...args);
    }
  }

  /**
   * 错误日志 - 所有环境输出
   * 用于错误信息，应该被错误追踪系统捕获
   */
  error(...args: any[]): void {
    if (this.config.enableError) {
      console.error('%c[ERROR]', 'color: #cc0000; font-weight: bold', ...args);
      
      // 可以在这里集成错误追踪服务（如 Sentry）
      // this.sendToErrorTracking(args);
    }
  }

  /**
   * 性能日志 - 仅开发环境输出
   * 用于性能测量
   */
  performance(label: string, duration: number): void {
    if (this.config.enableDebug) {
      const color = duration < 100 ? '#00cc00' : duration < 500 ? '#ff9900' : '#cc0000';
      console.log(
        `%c[PERF] ${label}`,
        `color: ${color}; font-weight: bold`,
        `${duration.toFixed(2)}ms`
      );
    }
  }

  /**
   * 权限日志 - 仅开发环境输出
   * 用于权限检查调试
   */
  permission(type: string, key: string, hasAccess: boolean): void {
    if (this.config.enableDebug) {
      const color = hasAccess ? '#00cc00' : '#cc0000';
      const status = hasAccess ? '✓' : '✗';
      console.log(
        `%c[PERMISSION] ${status} ${type}:`,
        `color: ${color}; font-weight: bold`,
        key
      );
    }
  }

  /**
   * 数据库日志 - 仅开发环境输出
   * 用于数据库查询调试
   */
  db(operation: string, table: string, data?: any): void {
    if (this.config.enableDebug) {
      console.log(
        '%c[DB]',
        'color: #9900cc; font-weight: bold',
        operation,
        table,
        data
      );
    }
  }

  /**
   * API 请求日志 - 仅开发环境输出
   * 用于 API 请求调试
   */
  api(method: string, url: string, status?: number, duration?: number): void {
    if (this.config.enableDebug) {
      const statusColor = !status ? '#888' : status < 400 ? '#00cc00' : '#cc0000';
      console.log(
        '%c[API]',
        'color: #0099cc; font-weight: bold',
        method,
        url,
        `%c${status || 'pending'}`,
        `color: ${statusColor}`,
        duration ? `${duration.toFixed(2)}ms` : ''
      );
    }
  }

  /**
   * 组件生命周期日志 - 仅开发环境输出
   * 用于 React 组件调试
   */
  component(name: string, lifecycle: string, data?: any): void {
    if (this.config.enableDebug) {
      console.log(
        '%c[COMPONENT]',
        'color: #cc0099; font-weight: bold',
        name,
        lifecycle,
        data
      );
    }
  }

  /**
   * 分组日志开始
   */
  group(label: string): void {
    if (this.config.enableDebug) {
      console.group(`%c${label}`, 'font-weight: bold');
    }
  }

  /**
   * 分组日志结束
   */
  groupEnd(): void {
    if (this.config.enableDebug) {
      console.groupEnd();
    }
  }

  /**
   * 表格日志
   */
  table(data: any): void {
    if (this.config.enableDebug) {
      console.table(data);
    }
  }

  /**
   * 时间测量开始
   */
  time(label: string): void {
    if (this.config.enableDebug) {
      console.time(label);
    }
  }

  /**
   * 时间测量结束
   */
  timeEnd(label: string): void {
    if (this.config.enableDebug) {
      console.timeEnd(label);
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 私有方法：发送到错误追踪服务
   */
  private sendToErrorTracking(error: any): void {
    // 可以在这里集成 Sentry 或其他错误追踪服务
    // Example:
    // if (window.Sentry) {
    //   window.Sentry.captureException(error);
    // }
  }
}

// 导出单例
export const logger = new Logger();

// 导出便捷方法
export const measurePerformance = async <T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    logger.performance(label, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`${label} failed after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
};

// 导出同步版本
export const measurePerformanceSync = <T>(
  label: string,
  fn: () => T
): T => {
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    logger.performance(label, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`${label} failed after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
};

export default logger;

