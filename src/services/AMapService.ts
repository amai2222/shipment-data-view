/**
 * 高德地图API服务
 * 提供地理编码、逆地理编码等功能
 */

// 高德地图API配置
export interface AMapConfig {
  key: string;
  baseUrl: string;
  version: string;
}

// 地理编码请求参数
export interface GeocodingRequest {
  address: string;
  city?: string;
  output?: 'JSON' | 'XML';
  batch?: boolean; // 是否批量查询
  sig?: string; // 数字签名
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
  level: string; // 地址匹配的精确度级别
}

// 逆地理编码请求参数
export interface ReverseGeocodingRequest {
  location: string; // 格式：经度,纬度
  poitype?: string;
  radius?: number;
  extensions?: 'base' | 'all';
  batch?: boolean;
  roadlevel?: number;
}

// 逆地理编码响应数据
export interface ReverseGeocodingResponse {
  status: string;
  info: string;
  infocode: string;
  regeocode: {
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
    streetNumber: {
      street: string;
      number: string;
    };
    businessAreas: Array<{
      location: string;
      name: string;
      id: string;
    }>;
  };
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

export class AMapService {
  private config: AMapConfig;

  constructor(config: AMapConfig) {
    this.config = config;
  }

  /**
   * 地理编码 - 将地址转换为坐标
   * 支持模糊地址匹配
   */
  async geocode(request: GeocodingRequest): Promise<GeocodingResponse> {
    const params = new URLSearchParams({
      key: this.config.key,
      address: request.address,
      output: request.output || 'JSON',
      ...(request.city && { city: request.city }),
      ...(request.batch && { batch: request.batch.toString() }),
      ...(request.sig && { sig: request.sig })
    });

    const url = `${this.config.baseUrl}/geocode/geo?${params}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status !== '1') {
        throw new Error(`地理编码失败: ${data.info}`);
      }
      
      return data;
    } catch (error) {
      console.error('地理编码请求失败:', error);
      throw error;
    }
  }

  /**
   * 智能地理编码 - 处理模糊地址
   * 支持多种地址格式和模糊匹配
   */
  async smartGeocode(address: string, city?: string): Promise<GeocodingResponse> {
    // 预处理地址
    const processedAddress = this.preprocessAddress(address);
    
    // 尝试多种策略
    const strategies = [
      // 策略1: 直接编码
      () => this.geocode({ address: processedAddress, city }),
      
      // 策略2: 提取城市后编码
      () => {
        const extractedCity = this.extractCityFromAddress(processedAddress);
        return this.geocode({ 
          address: this.removeCityFromAddress(processedAddress), 
          city: extractedCity || city 
        });
      },
      
      // 策略3: 模糊匹配（去掉详细地址）
      () => {
        const simplifiedAddress = this.simplifyAddress(processedAddress);
        return this.geocode({ address: simplifiedAddress, city });
      },
      
      // 策略4: 只使用主要地名
      () => {
        const mainLocation = this.extractMainLocation(processedAddress);
        return this.geocode({ address: mainLocation, city });
      }
    ];

    let lastError: Error | null = null;
    
    for (const strategy of strategies) {
      try {
        const result = await strategy();
        
        // 检查结果质量
        if (this.isValidGeocodingResult(result)) {
          return result;
        }
      } catch (error) {
        lastError = error as Error;
        console.warn('地理编码策略失败:', error);
      }
    }
    
    throw lastError || new Error('所有地理编码策略都失败了');
  }

  /**
   * 逆地理编码 - 将坐标转换为地址
   */
  async reverseGeocode(request: ReverseGeocodingRequest): Promise<ReverseGeocodingResponse> {
    const params = new URLSearchParams({
      key: this.config.key,
      location: request.location,
      poitype: request.poitype || '',
      radius: request.radius?.toString() || '1000',
      extensions: request.extensions || 'base',
      batch: request.batch?.toString() || 'false',
      roadlevel: request.roadlevel?.toString() || '0'
    });

    const url = `${this.config.baseUrl}/geocode/regeo?${params}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status !== '1') {
        throw new Error(`逆地理编码失败: ${data.info}`);
      }
      
      return data;
    } catch (error) {
      console.error('逆地理编码请求失败:', error);
      throw error;
    }
  }

  /**
   * 批量地理编码
   */
  async batchGeocode(addresses: string[], city?: string): Promise<GeocodingResponse[]> {
    const promises = addresses.map(address => 
      this.geocode({ address, city })
    );
    
    try {
      return await Promise.all(promises);
    } catch (error) {
      console.error('批量地理编码失败:', error);
      throw error;
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
   * 解析逆地理编码结果为标准格式
   */
  parseReverseGeocodeResult(regeocode: ReverseGeocodingResponse['regeocode']): Partial<LocationGeocodingData> {
    return {
      formatted_address: regeocode.formatted_address,
      province: regeocode.province,
      city: regeocode.city,
      district: regeocode.district,
      township: regeocode.township,
      street: regeocode.streetNumber?.street,
      street_number: regeocode.streetNumber?.number,
      adcode: regeocode.adcode,
      citycode: regeocode.citycode,
      geocoding_status: 'success'
    };
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

  /**
   * 预处理地址 - 清理和标准化地址
   */
  private preprocessAddress(address: string): string {
    return address
      .replace(/\s+/g, '') // 去除空格
      .replace(/[，,]/g, '') // 去除逗号
      .replace(/[（）()]/g, '') // 去除括号
      .replace(/[、]/g, '') // 去除顿号
      .trim();
  }

  /**
   * 从地址中提取城市信息
   */
  private extractCityFromAddress(address: string): string | null {
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
    
    return null;
  }

  /**
   * 从地址中移除城市信息
   */
  private removeCityFromAddress(address: string): string {
    const cityPatterns = [
      /([^省]+省)?([^市]+市)/,
      /([^自治区]+自治区)?([^市]+市)/,
      /([^特别行政区]+特别行政区)/,
      /([^州]+州)/,
      /([^县]+县)/
    ];
    
    let result = address;
    for (const pattern of cityPatterns) {
      result = result.replace(pattern, '');
    }
    
    return result.trim();
  }

  /**
   * 简化地址 - 保留主要地理信息
   */
  private simplifyAddress(address: string): string {
    // 移除详细地址信息
    const patterns = [
      /\d+号/, // 门牌号
      /\d+弄/, // 弄号
      /\d+幢/, // 幢号
      /\d+单元/, // 单元
      /\d+室/, // 室号
      /[A-Z]\d+/, // 字母数字组合
      /\d+层/, // 楼层
      /地下\d+/, // 地下层
    ];
    
    let result = address;
    patterns.forEach(pattern => {
      result = result.replace(pattern, '');
    });
    
    return result.trim();
  }

  /**
   * 提取主要地点信息
   */
  private extractMainLocation(address: string): string {
    // 提取省市区信息
    const provinceMatch = address.match(/([^省]+省)/);
    const cityMatch = address.match(/([^市]+市)/);
    const districtMatch = address.match(/([^区县]+[区县])/);
    
    const parts = [];
    if (provinceMatch) parts.push(provinceMatch[1]);
    if (cityMatch) parts.push(cityMatch[1]);
    if (districtMatch) parts.push(districtMatch[1]);
    
    return parts.length > 0 ? parts.join('') : address;
  }

  /**
   * 验证地理编码结果质量
   */
  private isValidGeocodingResult(result: GeocodingResponse): boolean {
    if (!result.geocodes || result.geocodes.length === 0) {
      return false;
    }
    
    const geocode = result.geocodes[0];
    
    // 检查坐标是否有效
    if (!geocode.location) {
      return false;
    }
    
    const [longitude, latitude] = geocode.location.split(',').map(Number);
    if (!this.isValidCoordinate(latitude, longitude)) {
      return false;
    }
    
    // 检查地址级别（level字段表示精确度）
    const validLevels = ['国家', '省', '市', '区县', '乡镇', '街道', '门牌号'];
    if (geocode.level && !validLevels.includes(geocode.level)) {
      return false;
    }
    
    return true;
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
   * 模糊地址匹配 - 尝试多种地址变体
   */
  async fuzzyGeocode(address: string, city?: string): Promise<GeocodingResponse> {
    const addressVariants = this.generateAddressVariants(address);
    
    for (const variant of addressVariants) {
      try {
        const result = await this.geocode({ address: variant, city });
        if (this.isValidGeocodingResult(result)) {
          return result;
        }
      } catch (error) {
        console.warn(`地址变体 "${variant}" 编码失败:`, error);
      }
    }
    
    throw new Error('所有地址变体都编码失败');
  }

  /**
   * 生成地址变体
   */
  private generateAddressVariants(address: string): string[] {
    const variants = [address];
    
    // 添加常见变体
    const commonVariants = [
      address.replace(/省/g, ''),
      address.replace(/市/g, ''),
      address.replace(/区/g, ''),
      address.replace(/县/g, ''),
      address.replace(/镇/g, ''),
      address.replace(/街道/g, ''),
      address.replace(/路/g, ''),
      address.replace(/街/g, ''),
    ];
    
    variants.push(...commonVariants.filter(v => v !== address));
    
    // 去重
    return [...new Set(variants)];
  }
}

// 默认配置
export const defaultAMapConfig: AMapConfig = {
  key: process.env.REACT_APP_AMAP_KEY || '',
  baseUrl: 'https://restapi.amap.com/v3',
  version: 'v3'
};

// 创建默认实例
export const amapService = new AMapService(defaultAMapConfig);

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
      /附近/, /周围/, /一带/, /周边/, /附近/, /大概/, /大约/,
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
