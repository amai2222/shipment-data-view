// 性能配置文件
// 统一管理所有性能相关的配置和优化策略

interface PerformanceConfig {
  // 缓存配置
  cache: {
    defaultTTL: number;
    maxCacheSize: number;
    apiCacheDuration: number;
    staticCacheDuration: number;
  };
  
  // 防抖配置
  debounce: {
    searchDelay: number;
    filterDelay: number;
    resizeDelay: number;
  };
  
  // 虚拟化配置
  virtualization: {
    itemHeight: number;
    overscanCount: number;
    threshold: number; // 超过多少条目启用虚拟化
  };
  
  // 批处理配置
  batching: {
    batchSize: number;
    batchDelay: number;
  };
  
  // 内存管理配置
  memory: {
    thresholdMB: number;
    checkIntervalMs: number;
    cleanupOnHidden: boolean;
  };
  
  // 性能监控配置
  monitoring: {
    enabled: boolean;
    longTaskThreshold: number;
    apiCallThreshold: number;
    renderTimeThreshold: number;
  };
  
  // 懒加载配置
  lazyLoading: {
    imageThreshold: number;
    componentThreshold: number;
  };
}

// 默认配置
export const defaultPerformanceConfig: PerformanceConfig = {
  cache: {
    defaultTTL: 5 * 60 * 1000, // 5分钟
    maxCacheSize: 1000,
    apiCacheDuration: 10 * 60 * 1000, // 10分钟
    staticCacheDuration: 60 * 60 * 1000, // 1小时
  },
  
  debounce: {
    searchDelay: 300,
    filterDelay: 500,
    resizeDelay: 250,
  },
  
  virtualization: {
    itemHeight: 50,
    overscanCount: 5,
    threshold: 100, // 超过100条启用虚拟化
  },
  
  batching: {
    batchSize: 50,
    batchDelay: 100,
  },
  
  memory: {
    thresholdMB: 100,
    checkIntervalMs: 30000, // 30秒
    cleanupOnHidden: true,
  },
  
  monitoring: {
    enabled: process.env.NODE_ENV === 'development',
    longTaskThreshold: 50, // 50ms
    apiCallThreshold: 1000, // 1秒
    renderTimeThreshold: 16, // 16ms (60fps)
  },
  
  lazyLoading: {
    imageThreshold: 100, // 100px from viewport
    componentThreshold: 200, // 200px from viewport
  },
};

// 生产环境优化配置
export const productionPerformanceConfig: Partial<PerformanceConfig> = {
  cache: {
    defaultTTL: 10 * 60 * 1000, // 10分钟
    maxCacheSize: 2000,
    apiCacheDuration: 30 * 60 * 1000, // 30分钟
    staticCacheDuration: 24 * 60 * 60 * 1000, // 24小时
  },
  
  debounce: {
    searchDelay: 500,
    filterDelay: 800,
    resizeDelay: 300,
  },
  
  virtualization: {
    itemHeight: 50,
    overscanCount: 3,
    threshold: 50, // 生产环境更积极地使用虚拟化
  },
  
  memory: {
    thresholdMB: 150,
    checkIntervalMs: 60000, // 1分钟
    cleanupOnHidden: true,
  },
  
  monitoring: {
    enabled: false, // 生产环境关闭详细监控
    longTaskThreshold: 50,
    apiCallThreshold: 1000,
    renderTimeThreshold: 16,
  },
};

// 配置管理器
class PerformanceConfigManager {
  private config: PerformanceConfig;
  
  constructor() {
    // 根据环境选择配置
    this.config = {
      ...defaultPerformanceConfig,
      ...(process.env.NODE_ENV === 'production' ? productionPerformanceConfig : {}),
    };
    
    // 从localStorage读取用户自定义配置
    this.loadUserConfig();
  }
  
  // 获取配置
  get<K extends keyof PerformanceConfig>(section: K): PerformanceConfig[K] {
    return this.config[section];
  }
  
  // 更新配置
  update<K extends keyof PerformanceConfig>(
    section: K, 
    updates: Partial<PerformanceConfig[K]>
  ) {
    this.config[section] = { ...this.config[section], ...updates };
    this.saveUserConfig();
  }
  
  // 获取完整配置
  getAll(): PerformanceConfig {
    return { ...this.config };
  }
  
  // 重置为默认配置
  reset() {
    this.config = { ...defaultPerformanceConfig };
    this.saveUserConfig();
  }
  
  // 保存用户配置到localStorage
  private saveUserConfig() {
    try {
      localStorage.setItem('performance-config', JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save performance config:', error);
    }
  }
  
  // 从localStorage加载用户配置
  private loadUserConfig() {
    try {
      const saved = localStorage.getItem('performance-config');
      if (saved) {
        const userConfig = JSON.parse(saved);
        this.config = { ...this.config, ...userConfig };
      }
    } catch (error) {
      console.warn('Failed to load user performance config:', error);
    }
  }
  
  // 获取特定场景的优化建议
  getOptimizationSuggestions(metrics: {
    recordCount: number;
    memoryUsage: number;
    apiResponseTime: number;
  }) {
    const suggestions: string[] = [];
    
    if (metrics.recordCount > this.config.virtualization.threshold) {
      suggestions.push('建议启用虚拟化表格以提高渲染性能');
    }
    
    if (metrics.memoryUsage > this.config.memory.thresholdMB) {
      suggestions.push('内存使用过高，建议清理缓存或减少数据加载量');
    }
    
    if (metrics.apiResponseTime > this.config.monitoring.apiCallThreshold) {
      suggestions.push('API响应时间过长，建议优化查询或启用分页');
    }
    
    return suggestions;
  }
}

// 全局配置实例
export const performanceConfig = new PerformanceConfigManager();

// 预设配置
export const presets = {
  // 低性能设备配置
  lowEnd: {
    cache: { maxCacheSize: 500, defaultTTL: 2 * 60 * 1000 },
    virtualization: { threshold: 50, overscanCount: 2 },
    debounce: { searchDelay: 800, filterDelay: 1000 },
  },
  
  // 高性能设备配置
  highEnd: {
    cache: { maxCacheSize: 5000, defaultTTL: 15 * 60 * 1000 },
    virtualization: { threshold: 200, overscanCount: 10 },
    debounce: { searchDelay: 100, filterDelay: 200 },
  },
  
  // 移动设备配置
  mobile: {
    virtualization: { threshold: 30, itemHeight: 60 },
    memory: { thresholdMB: 50, checkIntervalMs: 15000 },
    debounce: { searchDelay: 600, filterDelay: 800 },
  },
};

// 应用预设配置
export function applyPreset(presetName: keyof typeof presets) {
  const preset = presets[presetName];
  Object.entries(preset).forEach(([section, config]) => {
    performanceConfig.update(section as keyof PerformanceConfig, config);
  });
}

// 自动检测设备性能并应用合适的预设
export function autoOptimize() {
  // 检测设备性能指标
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const memoryInfo = (performance as any).memory;
  const connectionSpeed = (navigator as any).connection?.effectiveType;
  
  if (isMobile) {
    applyPreset('mobile');
  } else if (memoryInfo && memoryInfo.jsHeapSizeLimit < 1000 * 1024 * 1024) { // < 1GB
    applyPreset('lowEnd');
  } else if (connectionSpeed === '4g' && !isMobile) {
    applyPreset('highEnd');
  }
  
  console.log('Performance optimization applied based on device capabilities');
}

// 在应用启动时自动优化
if (typeof window !== 'undefined') {
  // 延迟执行以避免阻塞初始渲染
  setTimeout(autoOptimize, 1000);
}