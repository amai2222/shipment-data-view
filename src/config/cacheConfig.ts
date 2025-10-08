/**
 * 统一缓存配置
 * 根据代码优化建议报告 - 中优先级优化 2.2
 */

export const CACHE_CONFIG = {
  // 权限相关缓存
  PERMISSION_TTL: 5 * 60 * 1000, // 5分钟
  ROLE_TEMPLATE_TTL: 10 * 60 * 1000, // 10分钟
  USER_PROFILE_TTL: 3 * 60 * 1000, // 3分钟
  USER_PERMISSIONS_TTL: 5 * 60 * 1000, // 5分钟
  
  // 业务数据缓存
  DASHBOARD_DATA_TTL: 2 * 60 * 1000, // 2分钟
  LIST_DATA_TTL: 1 * 60 * 1000, // 1分钟
  DETAIL_DATA_TTL: 3 * 60 * 1000, // 3分钟
  
  // 项目数据缓存
  PROJECT_LIST_TTL: 5 * 60 * 1000, // 5分钟
  PROJECT_STATS_TTL: 2 * 60 * 1000, // 2分钟
  
  // 合同数据缓存
  CONTRACT_LIST_TTL: 5 * 60 * 1000, // 5分钟
  CONTRACT_DETAIL_TTL: 10 * 60 * 1000, // 10分钟
  
  // 移动端数据缓存
  MOBILE_HOME_TTL: 2 * 60 * 1000, // 2分钟
  MOBILE_LIST_TTL: 1 * 60 * 1000, // 1分钟
  
  // 静态数据缓存（变化很少的数据）
  STATIC_DATA_TTL: 30 * 60 * 1000, // 30分钟
  DRIVER_LIST_TTL: 10 * 60 * 1000, // 10分钟
  LOCATION_LIST_TTL: 10 * 60 * 1000, // 10分钟
  PARTNER_LIST_TTL: 10 * 60 * 1000, // 10分钟
  
  // React Query 默认配置
  DEFAULT_STALE_TIME: 5 * 60 * 1000, // 5分钟
  DEFAULT_CACHE_TIME: 10 * 60 * 1000, // 10分钟
  DEFAULT_RETRY: 1, // 重试1次
  DEFAULT_RETRY_DELAY: 1000, // 重试延迟1秒
};

/**
 * 根据数据类型获取缓存时间
 */
export function getCacheTTL(dataType: keyof typeof CACHE_CONFIG): number {
  return CACHE_CONFIG[dataType] || CACHE_CONFIG.DEFAULT_STALE_TIME;
}

/**
 * React Query 配置生成器
 */
export function createQueryConfig(
  dataType: keyof typeof CACHE_CONFIG,
  options?: {
    retry?: number;
    retryDelay?: number;
    refetchOnWindowFocus?: boolean;
  }
) {
  return {
    staleTime: getCacheTTL(dataType),
    cacheTime: CACHE_CONFIG.DEFAULT_CACHE_TIME,
    retry: options?.retry ?? CACHE_CONFIG.DEFAULT_RETRY,
    retryDelay: options?.retryDelay ?? CACHE_CONFIG.DEFAULT_RETRY_DELAY,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
  };
}

