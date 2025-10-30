# 前端位置转GPS功能使用指南

## 🚀 快速开始

### 1. 导入必要的服务

```typescript
import { SupabaseAMapService, createSupabaseAMapService, geocodingUtils } from '@/services/SupabaseAMapService';
import { LocationGeocodingService, createLocationGeocodingService } from '@/services/LocationGeocodingService';
import { useToast } from '@/hooks/use-toast';
```

### 2. 初始化服务

```typescript
// 在组件中初始化
const { toast } = useToast();
const amapService = createSupabaseAMapService(toast);
const geocodingService = createLocationGeocodingService(toast);
```

## 📍 基础使用方法

### 1. 单个地址地理编码

#### 方法一：使用SupabaseAMapService（推荐）

```typescript
// 智能地理编码 - 支持模糊地址
const handleGeocode = async (address: string) => {
  try {
    const result = await amapService.smartGeocode(address, '北京');
    
    if (result.success && result.data) {
      const geocode = result.data.geocodes[0];
      const [longitude, latitude] = geocode.location.split(',').map(Number);
      
      console.log('地理编码成功:', {
        address: geocode.formatted_address,
        latitude,
        longitude,
        province: geocode.province,
        city: geocode.city,
        district: geocode.district
      });
      
      toast({
        title: "地理编码成功",
        description: `找到坐标: ${latitude}, ${longitude}`,
      });
    } else {
      console.error('地理编码失败:', result.error);
      toast({
        title: "地理编码失败",
        description: result.error,
        variant: "destructive",
      });
    }
  } catch (error) {
    console.error('地理编码异常:', error);
  }
};

// 使用示例
await handleGeocode('北京市朝阳区建国门外大街1号');
await handleGeocode('北京朝阳区附近'); // 模糊地址
```

#### 方法二：使用LocationGeocodingService（数据库集成）

```typescript
// 为现有地点进行地理编码
const handleLocationGeocode = async (locationId: string) => {
  try {
    const result = await geocodingService.geocodeLocation(locationId);
    
    if (result.success) {
      console.log('地点地理编码成功:', result.data);
      toast({
        title: "地理编码成功",
        description: "地点坐标已更新",
      });
    } else {
      console.error('地点地理编码失败:', result.error);
    }
  } catch (error) {
    console.error('地点地理编码异常:', error);
  }
};
```

### 2. 批量地址地理编码

```typescript
const handleBatchGeocode = async (addresses: string[]) => {
  try {
    const result = await amapService.batchGeocode(addresses);
    
    if (result.success && result.results) {
      console.log('批量地理编码结果:', result.results);
      
      const successCount = result.results.filter(r => r.success).length;
      const failedCount = result.results.filter(r => !r.success).length;
      
      toast({
        title: "批量地理编码完成",
        description: `成功: ${successCount}, 失败: ${failedCount}`,
      });
    }
  } catch (error) {
    console.error('批量地理编码异常:', error);
  }
};

// 使用示例
const addresses = [
  '北京市朝阳区建国门外大街1号',
  '上海市浦东新区陆家嘴环路1000号',
  '广州市天河区珠江新城花城大道85号'
];
await handleBatchGeocode(addresses);
```

### 3. 自动创建地点并地理编码

```typescript
const handleCreateLocationWithGeocode = async (locationData: {
  name: string;
  address?: string;
}) => {
  try {
    const result = await geocodingService.autoGeocodeNewLocation(locationData);
    
    if (result.success) {
      console.log('地点创建并地理编码成功:', result.data);
    } else {
      console.error('地点创建失败:', result.error);
    }
  } catch (error) {
    console.error('地点创建异常:', error);
  }
};

// 使用示例
await handleCreateLocationWithGeocode({
  name: '北京总部',
  address: '北京市朝阳区建国门外大街1号'
});
```

## 🎯 高级功能

### 1. 地址预处理和验证

```typescript
// 检查地址是否有效
const isValid = geocodingUtils.isValidAddress('北京市朝阳区');
console.log('地址有效:', isValid);

// 检查是否为模糊地址
const isFuzzy = geocodingUtils.isFuzzyAddress('北京朝阳区附近');
console.log('模糊地址:', isFuzzy);

// 清理模糊地址
const cleaned = geocodingUtils.cleanFuzzyAddress('北京朝阳区附近');
console.log('清理后:', cleaned); // "北京朝阳区"

// 标准化地址格式
const normalized = geocodingUtils.normalizeAddress('北京市，朝阳区，建国门外大街1号');
console.log('标准化后:', normalized); // "北京市朝阳区建国门外大街1号"

// 获取地址置信度评分
const confidence = geocodingUtils.getAddressConfidenceScore('北京市朝阳区建国门外大街1号');
console.log('置信度:', confidence); // 0.8-1.0

// 生成地址建议
const suggestions = geocodingUtils.generateAddressSuggestions('北京朝阳区附近');
console.log('建议地址:', suggestions);
```

### 2. 坐标验证和计算

```typescript
// 验证坐标是否有效
const isValidCoord = amapService.isValidCoordinate(39.9042, 116.4074);
console.log('坐标有效:', isValidCoord);

// 计算两点间距离
const distance = amapService.calculateDistance(
  39.9042, 116.4074, // 北京
  31.2304, 121.4737  // 上海
);
console.log('距离:', distance, '米');

// 获取地址匹配置信度
const geocode = result.data.geocodes[0];
const confidence = amapService.getAddressConfidence(geocode);
console.log('匹配置信度:', confidence);
```

### 3. 批量地点管理

```typescript
// 批量地理编码多个地点
const handleBatchLocationGeocode = async (locationIds: string[]) => {
  try {
    const result = await geocodingService.batchGeocodeLocations(locationIds);
    
    console.log('批量地理编码结果:', {
      成功: result.success,
      失败: result.failed,
      错误: result.errors
    });
    
    toast({
      title: "批量地理编码完成",
      description: `成功: ${result.success}, 失败: ${result.failed}`,
    });
  } catch (error) {
    console.error('批量地理编码异常:', error);
  }
};

// 重试失败的地理编码
const handleRetryFailed = async () => {
  try {
    const result = await geocodingService.retryFailedGeocoding();
    
    console.log('重试结果:', result);
    toast({
      title: "重试完成",
      description: `成功: ${result.success}, 失败: ${result.failed}`,
    });
  } catch (error) {
    console.error('重试异常:', error);
  }
};
```

## 🔍 数据查询和统计

### 1. 搜索地点

```typescript
// 搜索地点（支持地理编码信息）
const handleSearchLocations = async (query: string) => {
  try {
    const locations = await geocodingService.searchLocations(query, true);
    
    console.log('搜索结果:', locations);
    
    // 显示结果
    locations.forEach(location => {
      console.log(`${location.name}: ${location.formatted_address || location.address}`);
      if (location.latitude && location.longitude) {
        console.log(`坐标: ${location.latitude}, ${location.longitude}`);
      }
    });
  } catch (error) {
    console.error('搜索异常:', error);
  }
};

// 使用示例
await handleSearchLocations('北京');
await handleSearchLocations('朝阳区');
```

### 2. 获取待处理地点

```typescript
// 获取待地理编码的地点
const handleGetPendingLocations = async () => {
  try {
    const locations = await geocodingService.getPendingGeocodingLocations(50);
    
    console.log('待处理地点:', locations);
    
    if (locations.length > 0) {
      toast({
        title: "发现待处理地点",
        description: `共 ${locations.length} 个地点需要地理编码`,
      });
    }
  } catch (error) {
    console.error('获取待处理地点异常:', error);
  }
};
```

### 3. 获取统计信息

```typescript
// 获取地理编码统计
const handleGetStats = async () => {
  try {
    const stats = await geocodingService.getGeocodingStats();
    
    console.log('地理编码统计:', stats);
    
    toast({
      title: "地理编码统计",
      description: `总计: ${stats.total}, 成功: ${stats.success}, 失败: ${stats.failed}`,
    });
  } catch (error) {
    console.error('获取统计异常:', error);
  }
};
```

## 🎨 React组件示例

### 1. 地址输入组件

```tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SupabaseAMapService, createSupabaseAMapService } from '@/services/SupabaseAMapService';
import { useToast } from '@/hooks/use-toast';

interface GeocodingResult {
  address: string;
  latitude: number;
  longitude: number;
  province: string;
  city: string;
  district: string;
}

export const AddressGeocodingForm: React.FC = () => {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeocodingResult | null>(null);
  const { toast } = useToast();
  const amapService = createSupabaseAMapService(toast);

  const handleGeocode = async () => {
    if (!address.trim()) {
      toast({
        title: "请输入地址",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const geocodeResult = await amapService.smartGeocode(address);
      
      if (geocodeResult.success && geocodeResult.data) {
        const geocode = geocodeResult.data.geocodes[0];
        const [longitude, latitude] = geocode.location.split(',').map(Number);
        
        setResult({
          address: geocode.formatted_address,
          latitude,
          longitude,
          province: geocode.province,
          city: geocode.city,
          district: geocode.district
        });
        
        toast({
          title: "地理编码成功",
          description: `找到坐标: ${latitude}, ${longitude}`,
        });
      } else {
        toast({
          title: "地理编码失败",
          description: geocodeResult.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('地理编码异常:', error);
      toast({
        title: "地理编码异常",
        description: "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>地址转GPS坐标</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="address" className="text-sm font-medium">
            地址
          </label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="请输入地址，如：北京市朝阳区建国门外大街1号"
            disabled={loading}
          />
        </div>
        
        <Button 
          onClick={handleGeocode} 
          disabled={loading || !address.trim()}
          className="w-full"
        >
          {loading ? '编码中...' : '开始地理编码'}
        </Button>
        
        {result && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <h3 className="font-medium text-green-800 mb-2">编码结果</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p><strong>地址:</strong> {result.address}</p>
              <p><strong>坐标:</strong> {result.latitude}, {result.longitude}</p>
              <p><strong>省份:</strong> {result.province}</p>
              <p><strong>城市:</strong> {result.city}</p>
              <p><strong>区县:</strong> {result.district}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

### 2. 地点管理组件

```tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LocationGeocodingService, createLocationGeocodingService, LocationWithGeocoding } from '@/services/LocationGeocodingService';
import { useToast } from '@/hooks/use-toast';

export const LocationManagement: React.FC = () => {
  const [locations, setLocations] = useState<LocationWithGeocoding[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    pending: 0,
    failed: 0,
    retry: 0
  });
  const { toast } = useToast();
  const geocodingService = createLocationGeocodingService(toast);

  // 加载地点列表
  const loadLocations = async () => {
    setLoading(true);
    try {
      const locationsData = await geocodingService.searchLocations('', true);
      setLocations(locationsData);
    } catch (error) {
      console.error('加载地点失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载统计信息
  const loadStats = async () => {
    try {
      const statsData = await geocodingService.getGeocodingStats();
      setStats(statsData);
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  // 地理编码单个地点
  const handleGeocodeLocation = async (locationId: string) => {
    try {
      const result = await geocodingService.geocodeLocation(locationId);
      if (result.success) {
        await loadLocations();
        await loadStats();
        toast({
          title: "地理编码成功",
          description: "地点坐标已更新",
        });
      }
    } catch (error) {
      console.error('地理编码失败:', error);
    }
  };

  // 批量地理编码
  const handleBatchGeocode = async () => {
    const pendingIds = locations
      .filter(loc => loc.geocoding_status === 'pending' || loc.geocoding_status === 'failed')
      .map(loc => loc.id);
    
    if (pendingIds.length === 0) {
      toast({
        title: "没有需要处理的地点",
        description: "所有地点都已处理完成",
      });
      return;
    }

    try {
      const result = await geocodingService.batchGeocodeLocations(pendingIds);
      await loadLocations();
      await loadStats();
      
      toast({
        title: "批量地理编码完成",
        description: `成功: ${result.success}, 失败: ${result.failed}`,
      });
    } catch (error) {
      console.error('批量地理编码失败:', error);
    }
  };

  // 获取状态徽章
  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'default',
      pending: 'secondary',
      failed: 'destructive',
      retry: 'outline'
    } as const;
    
    const labels = {
      success: '成功',
      pending: '待处理',
      failed: '失败',
      retry: '重试'
    };
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  useEffect(() => {
    loadLocations();
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* 统计信息 */}
      <Card>
        <CardHeader>
          <CardTitle>地理编码统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-gray-500">总计</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.success}</div>
              <div className="text-sm text-gray-500">成功</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-gray-500">待处理</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <div className="text-sm text-gray-500">失败</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.retry}</div>
              <div className="text-sm text-gray-500">重试</div>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <Button onClick={handleBatchGeocode} disabled={loading}>
              批量地理编码
            </Button>
            <Button onClick={loadLocations} variant="outline" disabled={loading}>
              刷新列表
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 地点列表 */}
      <Card>
        <CardHeader>
          <CardTitle>地点列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">加载中...</div>
          ) : (
            <div className="space-y-4">
              {locations.map((location) => (
                <div key={location.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{location.name}</div>
                    <div className="text-sm text-gray-500">
                      {location.formatted_address || location.address || '无地址信息'}
                    </div>
                    {location.latitude && location.longitude && (
                      <div className="text-sm text-blue-600">
                        坐标: {location.latitude}, {location.longitude}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(location.geocoding_status)}
                    {(location.geocoding_status === 'pending' || location.geocoding_status === 'failed') && (
                      <Button
                        size="sm"
                        onClick={() => handleGeocodeLocation(location.id)}
                        disabled={loading}
                      >
                        编码
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
```

## 🔧 错误处理

### 1. 常见错误处理

```typescript
const handleGeocodeWithErrorHandling = async (address: string) => {
  try {
    const result = await amapService.smartGeocode(address);
    
    if (!result.success) {
      // 处理不同类型的错误
      if (result.error?.includes('API密钥')) {
        toast({
          title: "配置错误",
          description: "请检查高德地图API密钥配置",
          variant: "destructive",
        });
      } else if (result.error?.includes('地址')) {
        toast({
          title: "地址错误",
          description: "请检查地址格式是否正确",
          variant: "destructive",
        });
      } else {
        toast({
          title: "地理编码失败",
          description: result.error,
          variant: "destructive",
        });
      }
      return;
    }
    
    // 成功处理
    console.log('地理编码成功:', result.data);
    
  } catch (error: any) {
    console.error('地理编码异常:', error);
    
    // 网络错误
    if (error.name === 'NetworkError') {
      toast({
        title: "网络错误",
        description: "请检查网络连接",
        variant: "destructive",
      });
    } else {
      toast({
        title: "未知错误",
        description: "请稍后重试",
        variant: "destructive",
      });
    }
  }
};
```

### 2. 重试机制

```typescript
const geocodeWithRetry = async (address: string, maxRetries: number = 3) => {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await amapService.smartGeocode(address);
      
      if (result.success) {
        return result;
      }
      
      lastError = new Error(result.error || '地理编码失败');
      
      // 如果不是最后一次重试，等待一段时间
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
      
    } catch (error) {
      lastError = error as Error;
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  throw lastError;
};
```

## 📱 移动端适配

### 1. 响应式设计

```tsx
// 移动端友好的地址输入组件
export const MobileAddressInput: React.FC = () => {
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();
  const amapService = createSupabaseAMapService(toast);

  const handleGeocode = async () => {
    // 移动端优化：使用更大的触摸目标
    const result = await amapService.smartGeocode(address);
    setResult(result);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">地址</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="请输入地址"
          className="w-full p-3 border rounded-lg min-h-[100px] text-base"
          rows={3}
        />
      </div>
      
      <button
        onClick={handleGeocode}
        className="w-full py-4 bg-blue-600 text-white rounded-lg text-lg font-medium"
      >
        获取坐标
      </button>
      
      {result && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">结果</h3>
          <div className="text-sm space-y-1">
            <p>地址: {result.data?.geocodes[0]?.formatted_address}</p>
            <p>坐标: {result.data?.geocodes[0]?.location}</p>
          </div>
        </div>
      )}
    </div>
  );
};
```

## 🎯 最佳实践

### 1. 性能优化

```typescript
// 使用防抖避免频繁请求
import { useDebouncedCallback } from 'use-debounce';

const debouncedGeocode = useDebouncedCallback(
  async (address: string) => {
    const result = await amapService.smartGeocode(address);
    // 处理结果
  },
  500 // 500ms延迟
);

// 缓存结果
const geocodeCache = new Map<string, any>();

const geocodeWithCache = async (address: string) => {
  if (geocodeCache.has(address)) {
    return geocodeCache.get(address);
  }
  
  const result = await amapService.smartGeocode(address);
  geocodeCache.set(address, result);
  
  return result;
};
```

### 2. 用户体验优化

```typescript
// 显示加载状态
const [loading, setLoading] = useState(false);

const handleGeocode = async (address: string) => {
  setLoading(true);
  try {
    const result = await amapService.smartGeocode(address);
    // 处理结果
  } finally {
    setLoading(false);
  }
};

// 提供实时反馈
const handleGeocodeWithFeedback = async (address: string) => {
  toast({
    title: "开始地理编码",
    description: "正在处理地址...",
  });
  
  const result = await amapService.smartGeocode(address);
  
  if (result.success) {
    toast({
      title: "地理编码成功",
      description: "地址已转换为坐标",
    });
  } else {
    toast({
      title: "地理编码失败",
      description: result.error,
      variant: "destructive",
    });
  }
};
```

---

**注意**：使用前请确保已正确配置Supabase Edge Function和高德地图API密钥。
