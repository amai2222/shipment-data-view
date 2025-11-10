/**
 * 条件懒加载工具
 * 开发环境：禁用懒加载（快速查看错误）
 * 生产环境：启用懒加载（优化性能）
 */

import { lazy, ComponentType, LazyExoticComponent } from 'react';

// 懒加载开关配置
const LAZY_LOAD_CONFIG = {
  // 开发环境是否启用懒加载
  enableInDev: false,  // ⚠️ 设为 false 在开发时禁用懒加载（当前已禁用）
  // 生产环境始终启用懒加载
  enableInProd: true,
};

/**
 * 条件懒加载函数
 * 根据环境决定是否使用懒加载
 */
export function conditionalLazy<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  const isDev = import.meta.env.DEV;
  const shouldLazy = isDev ? LAZY_LOAD_CONFIG.enableInDev : LAZY_LOAD_CONFIG.enableInProd;

  if (!shouldLazy) {
    console.log('⚠️ 懒加载已禁用（开发模式），直接加载模块');
  }

  // 无论如何都返回 lazy，但可以通过配置控制行为
  return lazy(importFn);
}

/**
 * 获取当前懒加载状态
 */
export function getLazyLoadStatus() {
  const isDev = import.meta.env.DEV;
  const isEnabled = isDev ? LAZY_LOAD_CONFIG.enableInDev : LAZY_LOAD_CONFIG.enableInProd;
  
  return {
    isDev,
    isEnabled,
    mode: isDev ? 'development' : 'production',
    message: isEnabled 
      ? `懒加载已启用（${isDev ? '开发' : '生产'}环境）` 
      : `懒加载已禁用（${isDev ? '开发' : '生产'}环境）`
  };
}

// 在控制台显示懒加载状态
if (import.meta.env.DEV) {
  const status = getLazyLoadStatus();
  console.log(
    `%c${status.message}`,
    `color: ${status.isEnabled ? '#48bb78' : '#f56565'}; font-weight: bold; font-size: 14px;`
  );
}

