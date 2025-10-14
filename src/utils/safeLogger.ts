// 安全的 logger 工具，防止 logger.debug is not a function 错误
import { logger } from './logger';

// 创建安全的 logger 包装器
export const safeLogger = {
  debug: (...args: any[]) => {
    try {
      if (logger && typeof logger.debug === 'function') {
        logger.debug(...args);
      } else {
        console.debug('[SAFE]', ...args);
      }
    } catch (error) {
      console.warn('[SAFE LOGGER] Debug failed:', error);
    }
  },
  log: (...args: any[]) => {
    try {
      if (logger && typeof logger.log === 'function') {
        logger.log(...args);
      } else {
        console.log('[SAFE]', ...args);
      }
    } catch (error) {
      console.warn('[SAFE LOGGER] Log failed:', error);
    }
  },
  warn: (...args: any[]) => {
    try {
      if (logger && typeof logger.warn === 'function') {
        logger.warn(...args);
      } else {
        console.warn('[SAFE]', ...args);
      }
    } catch (error) {
      console.warn('[SAFE LOGGER] Warn failed:', error);
    }
  },
  error: (...args: any[]) => {
    try {
      if (logger && typeof logger.error === 'function') {
        logger.error(...args);
      } else {
        console.error('[SAFE]', ...args);
      }
    } catch (error) {
      console.warn('[SAFE LOGGER] Error failed:', error);
    }
  },
  info: (...args: any[]) => {
    try {
      if (logger && typeof logger.info === 'function') {
        logger.info(...args);
      } else {
        console.info('[SAFE]', ...args);
      }
    } catch (error) {
      console.warn('[SAFE LOGGER] Info failed:', error);
    }
  },
  permission: (type: string, key: string, hasAccess: boolean) => {
    try {
      if (logger && typeof logger.permission === 'function') {
        logger.permission(type, key, hasAccess);
      } else {
        console.log(`[SAFE PERMISSION] ${type}: ${key} = ${hasAccess}`);
      }
    } catch (error) {
      console.warn('[SAFE LOGGER] Permission failed:', error);
    }
  }
};

// 导出默认的安全 logger
export default safeLogger;
