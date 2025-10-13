/**
 * Supabase高德地图地理编码服务
 * 通过Supabase Edge Functions安全调用高德地图API
 */

import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// 地理编码请求参数
export interface GeocodingRequest {
  address: string;
  city?: string;
  batch?: boolean;
}

// 地理编码响应数据
export interface GeocodingResponse {
  status: string;
  info: string;
  infocode: string;
  count: string;
  geocodes: Geocode[];
}

// 地理编码结果
export interface Geocode {
  formatted_address: string;
  country: string;
  province: string;
  city: string;
  district: string;
  township: string;
  neighborhood: {
    name: string;
    type: string;
  };
  building: {
    name: string;
    type: string;
  };
  adcode: string;
  citycode: string;
  street: string;
  number: string;
  location: string;
  level: string;
}

// 地点信息（用于数据库存储）
export interface LocationGeocodingData {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  formatted_address?: string;
  province?: string;
  city?: string;
  district?: string;
  township?: string;
  street?: string;
  street_number?: string;
  adcode?: string;
  citycode?: string;
  geocoding_status: 'pending' | 'success' | 'failed' | 'retry';
  geocoding_error?: string;
}

export interface GeocodingResult {
  success: boolean;
  data?: GeocodingResponse;
  error?: string;
}

export interface BatchGeocodingResult {
  success: boolean;
  results?: Array<{
    address: string;
    success: boolean;
    data?: GeocodingResponse;
    error?: string;
  }>;
  error?: string;
}

export class SupabaseAMapService {
  private toast: ReturnType<typeof useToast>['toast'];

  constructor(toast: ReturnType<typeof useToast>['toast']) {
    this.toast = toast;
  }

  /**
   * 地理编码 - 将地址转换为坐标
   */
  async geocode(request: GeocodingRequest): Promise<GeocodingResult> {
    try {
      const { data, error } = await supabase.functions.invoke('amap-geocoding', {
        body: {
          action: 'geocode',
          data: request
        }
      });

      if (error) {
        throw new Error(`地理编码请求失败: ${error.message}`);
      }

      return data;
    } catch (error: any) {
      console.error('地理编码请求失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 智能地理编码 - 处理模糊地址
   */
  async smartGeocode(address: string, city?: string): Promise<GeocodingResult> {
    try {
      const { data, error } = await supabase.functions.invoke('amap-geocoding', {
        body: {
          action: 'smart_geocode',
          data: { address, city }
        }
      });

      if (error) {
        console.error('Edge Function 错误详情:', error);
        throw new Error(`智能地理编码请求失败: ${error.message}`);
      }

      if (!data.success) {
        console.error('地理编码业务错误:', data);
        throw new Error(data.error || '地理编码失败');
      }

      return data;
    } catch (error: any) {
      console.error('智能地理编码请求失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 批量地理编码
   */
  async batchGeocode(addresses: string[]): Promise<BatchGeocodingResult> {
    try {
      const { data, error } = await supabase.functions.invoke('amap-geocoding', {
        body: {
          action: 'batch_geocode',
          data: addresses
        }
      });

      if (error) {
        throw new Error(`批量地理编码请求失败: ${error.message}`);
      }

      return data;
    } catch (error: any) {
      console.error('批量地理编码请求失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 更新地点地理编码信息
   */
  async updateLocationGeocoding(locationData: LocationGeocodingData): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('amap-geocoding', {
        body: {
          action: 'update_location_geocoding',
          data: locationData
        }
      });

      if (error) {
        throw new Error(`更新地理编码信息失败: ${error.message}`);
      }

      return data;
    } catch (error: any) {
      console.error('更新地理编码信息失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 批量更新地点地理编码信息
   */
  async batchUpdateLocationGeocoding(locations: LocationGeocodingData[]): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('amap-geocoding', {
        body: {
          action: 'batch_update_geocoding',
          data: locations
        }
      });

      if (error) {
        throw new Error(`批量更新地理编码信息失败: ${error.message}`);
      }

      return data;
    } catch (error: any) {
      console.error('批量更新地理编码信息失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 解析地理编码结果为标准格式
   */
  parseGeocodeResult(geocode: Geocode): Partial<LocationGeocodingData> {
    const [longitude, latitude] = geocode.location.split(',').map(Number);
    
    return {
      address: geocode.formatted_address,
      latitude,
      longitude,
      formatted_address: geocode.formatted_address,
      province: geocode.province,
      city: geocode.city,
      district: geocode.district,
      township: geocode.township,
      street: geocode.street,
      street_number: geocode.number,
      adcode: geocode.adcode,
      citycode: geocode.citycode,
      geocoding_status: 'success'
    };
  }

  /**
   * 获取地址匹配的置信度
   */
  getAddressConfidence(geocode: Geocode): number {
    const levelScores: { [key: string]: number } = {
      '国家': 0.1,
      '省': 0.2,
      '市': 0.4,
      '区县': 0.6,
      '乡镇': 0.8,
      '街道': 0.9,
      '门牌号': 1.0
    };
    
    return levelScores[geocode.level] || 0.5;
  }

  /**
   * 验证坐标是否有效
   */
  isValidCoordinate(latitude: number, longitude: number): boolean {
    return (
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180 &&
      !isNaN(latitude) && !isNaN(longitude)
    );
  }

  /**
   * 计算两点间距离（米）
   */
  calculateDistance(
    lat1: number, 
    lon1: number, 
    lat2: number, 
    lon2: number
  ): number {
    const R = 6371000; // 地球半径（米）
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

// 创建默认实例
export const createSupabaseAMapService = (toast: ReturnType<typeof useToast>['toast']) => {
  return new SupabaseAMapService(toast);
};

// 工具函数
export const geocodingUtils = {
  /**
   * 格式化地址用于地理编码
   */
  formatAddressForGeocoding(address: string): string {
    return address
      .replace(/\s+/g, '')
      .replace(/[，,]/g, '')
      .trim();
  },

  /**
   * 检查地址是否包含必要信息
   */
  isValidAddress(address: string): boolean {
    return address && address.trim().length >= 2;
  },

  /**
   * 检查是否为模糊地址
   */
  isFuzzyAddress(address: string): boolean {
    const fuzzyPatterns = [
      /附近/, /周围/, /一带/, /周边/, /大概/, /大约/,
      /左右/, /边上/, /旁边/, /附近/, /区域/, /地段/
    ];
    
    return fuzzyPatterns.some(pattern => pattern.test(address));
  },

  /**
   * 提取城市信息
   */
  extractCityFromAddress(address: string): string | undefined {
    const cityPatterns = [
      /([^省]+省)?([^市]+市)/,
      /([^自治区]+自治区)?([^市]+市)/,
      /([^特别行政区]+特别行政区)/,
      /([^州]+州)/,
      /([^县]+县)/
    ];
    
    for (const pattern of cityPatterns) {
      const match = address.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    return undefined;
  },

  /**
   * 清理模糊地址 - 移除模糊词汇
   */
  cleanFuzzyAddress(address: string): string {
    const fuzzyWords = [
      '附近', '周围', '一带', '周边', '大概', '大约',
      '左右', '边上', '旁边', '区域', '地段', '附近'
    ];
    
    let cleaned = address;
    fuzzyWords.forEach(word => {
      cleaned = cleaned.replace(new RegExp(word, 'g'), '');
    });
    
    return cleaned.trim();
  },

  /**
   * 标准化地址格式
   */
  normalizeAddress(address: string): string {
    return address
      .replace(/\s+/g, '') // 去除空格
      .replace(/[，,]/g, '') // 去除逗号
      .replace(/[（）()]/g, '') // 去除括号
      .replace(/[、]/g, '') // 去除顿号
      .replace(/[。.]/g, '') // 去除句号
      .trim();
  },

  /**
   * 获取地址的置信度评分
   */
  getAddressConfidenceScore(address: string): number {
    let score = 0;
    
    // 包含省市区信息加分
    if (/省/.test(address)) score += 0.3;
    if (/市/.test(address)) score += 0.3;
    if (/[区县]/.test(address)) score += 0.2;
    if (/[镇乡]/.test(address)) score += 0.1;
    if (/[街道]/.test(address)) score += 0.1;
    
    // 包含详细地址加分
    if (/\d+号/.test(address)) score += 0.2;
    if (/[路街巷]/.test(address)) score += 0.1;
    
    // 模糊词汇减分
    if (this.isFuzzyAddress(address)) score -= 0.3;
    
    return Math.max(0, Math.min(1, score));
  },

  /**
   * 生成地址建议
   */
  generateAddressSuggestions(address: string): string[] {
    const suggestions = [address];
    
    // 如果包含模糊词汇，生成清理版本
    if (this.isFuzzyAddress(address)) {
      suggestions.push(this.cleanFuzzyAddress(address));
    }
    
    // 生成简化版本
    const simplified = address
      .replace(/\d+号/g, '')
      .replace(/\d+弄/g, '')
      .replace(/\d+幢/g, '')
      .replace(/\d+单元/g, '')
      .replace(/\d+室/g, '')
      .trim();
    
    if (simplified !== address) {
      suggestions.push(simplified);
    }
    
    // 去重
    return [...new Set(suggestions)];
  }
};
