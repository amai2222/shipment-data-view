/**
 * 安全的懒加载工具
 * 包装 React.lazy，自动处理资源加载失败和重试
 * 自动记录错误到数据库
 */

import { lazy, LazyExoticComponent, ComponentType } from 'react';
import { importWithRetry, createSafeLazyImport } from './resourceLoader';

/**
 * 创建安全的懒加载组件
 * 自动处理资源加载失败和重试
 * 自动记录错误到数据库
 */
export function safeLazy<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  // 包装导入函数，添加重试机制和错误记录
  const safeImportFn = createSafeLazyImport(importFn);
  
  return lazy(safeImportFn);
}

/**
 * 批量创建安全的懒加载组件
 */
export function safeLazyBatch<T extends Record<string, () => Promise<any>>>(
  imports: T
): { [K in keyof T]: LazyExoticComponent<any> } {
  const result: any = {};
  
  for (const key in imports) {
    if (imports.hasOwnProperty(key)) {
      result[key] = safeLazy(imports[key]);
    }
  }
  
  return result;
}

