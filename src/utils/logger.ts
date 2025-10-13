// 生产环境日志配置
const isDevelopment = import.meta.env.DEV;

// 安全的日志函数
const safeLog = (fn: (...args: any[]) => void, ...args: any[]) => {
  try {
    fn(...args);
  } catch (error) {
    // 静默处理日志错误
  }
};

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      safeLog(console.log, ...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDevelopment) {
      safeLog(console.warn, ...args);
    }
  },
  error: (...args: any[]) => {
    // 错误日志始终显示
    safeLog(console.error, ...args);
  },
  info: (...args: any[]) => {
    if (isDevelopment) {
      safeLog(console.info, ...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDevelopment) {
      safeLog(console.debug, ...args);
    }
  },
  permission: (...args: any[]) => {
    if (isDevelopment) {
      safeLog(console.log, '[PERMISSION]', ...args);
    }
  }
};

// 替换全局 console（可选）
if (!isDevelopment) {
  // 在生产环境中静默大部分日志
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  // 保留 console.error 用于错误处理
}