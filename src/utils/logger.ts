// 生产环境日志配置
const isDevelopment = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // 错误日志始终显示
    console.error(...args);
  },
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
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