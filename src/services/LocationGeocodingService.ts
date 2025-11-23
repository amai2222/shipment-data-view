/**
 * 地址管理地理编码集成服务
 * 集成高德地图API，自动处理地址的地理编码
 */

import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { SupabaseAMapService, LocationGeocodingData, geocodingUtils } from './SupabaseAMapService';
import { useToast } from '@/hooks/use-toast';

export interface LocationWithGeocoding {
  id: string;
  name: string;
  nickname?: string;
  projectIds?: string[]; // 关联的项目ID数组
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
  geocoding_updated_at?: string;
  geocoding_error?: string;
  createdAt: string;
}

export interface GeocodingResult {
  success: boolean;
  data?: LocationWithGeocoding;
  error?: string;
}

export interface BatchGeocodingResult {
  success: number;
  failed: number;
  errors: Array<{
    location_id: string;
    error: string;
  }>;
}

export class LocationGeocodingService {
  private amapService: SupabaseAMapService;
  private toast: ReturnType<typeof useToast>['toast'];

  constructor(amapService: SupabaseAMapService, toast: ReturnType<typeof useToast>['toast']) {
    this.amapService = amapService;
    this.toast = toast;
  }

  /**
   * 为单个地点进行地理编码
   */
  async geocodeLocation(locationId: string, address?: string): Promise<GeocodingResult> {
    try {
      // 获取地点信息
      const { data: location, error: fetchError } = await supabase
        .from('locations')
        .select('*')
        .eq('id', locationId)
        .single();

      if (fetchError) {
        throw new Error(`获取地点信息失败: ${fetchError.message}`);
      }

      // 确定要编码的地址
      const addressToGeocode = address || location.name;
      
      if (!geocodingUtils.isValidAddress(addressToGeocode)) {
        throw new Error('地址信息不完整');
      }

      // 更新状态为处理中
      await this.updateGeocodingStatus(locationId, 'retry');

      // 执行地理编码
      const geocodingResult = await this.amapService.smartGeocode(
        geocodingUtils.formatAddressForGeocoding(addressToGeocode),
        geocodingUtils.extractCityFromAddress(addressToGeocode)
      );

      if (!geocodingResult.success || !geocodingResult.data || geocodingResult.data.geocodes.length === 0) {
        throw new Error(geocodingResult.error || '未找到匹配的地理编码结果');
      }

      // 解析结果
      const geocode = geocodingResult.data.geocodes[0];
      const geocodingData = this.amapService.parseGeocodeResult(geocode);

      // 更新数据库
      const { data: updatedLocation, error: updateError } = await supabase
        .from('locations')
        .update({
          ...geocodingData,
          geocoding_status: 'success',
          geocoding_updated_at: new Date().toISOString(),
          geocoding_error: null
        })
        .eq('id', locationId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`更新地理编码信息失败: ${updateError.message}`);
      }

      return {
        success: true,
        data: updatedLocation as LocationWithGeocoding
      };

    } catch (error: unknown) {
      console.error('地理编码失败:', error);
      
      // 更新失败状态
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      await this.updateGeocodingStatus(locationId, 'failed', errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 批量地理编码
   */
  async batchGeocodeLocations(locationIds: string[]): Promise<BatchGeocodingResult> {
    const results: BatchGeocodingResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    // 并发处理，但限制并发数量
    const batchSize = 5;
    for (let i = 0; i < locationIds.length; i += batchSize) {
      const batch = locationIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (locationId) => {
        const result = await this.geocodeLocation(locationId);
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            location_id: locationId,
            error: result.error || '未知错误'
          });
        }
      });

      await Promise.all(batchPromises);
    }

    return results;
  }

  /**
   * 自动地理编码新添加的地点
   */
  async autoGeocodeNewLocation(locationData: {
    name: string;
    address?: string;
    projectIds?: string[];
  }): Promise<GeocodingResult> {
    try {
      // 创建地点（地理编码基于 address 字段）
      const { data: newLocation, error: createError } = await supabase
        .from('locations')
        .insert({
          name: locationData.name,
          address: locationData.address, // 地理编码基于 address 字段
          geocoding_status: 'pending'
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`创建地点失败: ${createError.message}`);
      }

      // 自动进行地理编码
      const geocodingResult = await this.geocodeLocation(newLocation.id, locationData.address);

      if (geocodingResult.success) {
        this.toast({
          title: "地点创建成功",
          description: "地点已创建并自动完成地理编码",
        });
      } else {
        this.toast({
          title: "地点创建成功",
          description: "地点已创建，但地理编码失败，可稍后手动重试",
          variant: "destructive",
        });
      }

      return geocodingResult;

    } catch (error: unknown) {
      console.error('自动地理编码失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取待地理编码的地点列表
   */
  async getPendingGeocodingLocations(limit: number = 50): Promise<LocationWithGeocoding[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_locations_for_geocoding', { p_limit: limit });

      if (error) {
        throw new Error(`获取待地理编码地点失败: ${error.message}`);
      }

      return data || [];
    } catch (error: unknown) {
      console.error('获取待地理编码地点失败:', error);
      return [];
    }
  }

  /**
   * 搜索地点（支持地理编码信息）
   */
  async searchLocations(
    query: string = '', 
    includeCoordinates: boolean = true
  ): Promise<LocationWithGeocoding[]> {
    try {
      const { data, error } = await supabase
        .rpc('search_locations_with_geocoding', { 
          p_query: query,
          p_include_coordinates: includeCoordinates 
        });

      if (error) {
        throw new Error(`搜索地点失败: ${error.message}`);
      }

      return data || [];
    } catch (error: unknown) {
      console.error('搜索地点失败:', error);
      return [];
    }
  }

  /**
   * 更新地理编码状态
   */
  private async updateGeocodingStatus(
    locationId: string, 
    status: 'pending' | 'success' | 'failed' | 'retry',
    error?: string
  ): Promise<void> {
    try {
      await supabase
        .from('locations')
        .update({
          geocoding_status: status,
          geocoding_updated_at: new Date().toISOString(),
          geocoding_error: error || null
        })
        .eq('id', locationId);
    } catch (error) {
      console.error('更新地理编码状态失败:', error);
    }
  }

  /**
   * 批量更新地理编码信息
   */
  async batchUpdateGeocodingData(locations: LocationGeocodingData[]): Promise<BatchGeocodingResult> {
    try {
      const { data, error } = await supabase
        .rpc('batch_update_location_geocoding', { 
          p_locations: JSON.stringify(locations) 
        });

      if (error) {
        throw new Error(`批量更新地理编码失败: ${error.message}`);
      }

      return data;
    } catch (error: unknown) {
      console.error('批量更新地理编码失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      return {
        success: 0,
        failed: locations.length,
        errors: locations.map(loc => ({
          location_id: loc.id,
          error: errorMessage
        }))
      };
    }
  }

  /**
   * 重试失败的地理编码
   */
  async retryFailedGeocoding(): Promise<BatchGeocodingResult> {
    try {
      // 获取失败的地点
      const { data: failedLocations, error: fetchError } = await supabase
        .from('locations')
        .select('id, name, address')
        .eq('geocoding_status', 'failed')
        .limit(100);

      if (fetchError) {
        throw new Error(`获取失败地点失败: ${fetchError.message}`);
      }

      if (!failedLocations || failedLocations.length === 0) {
        return { success: 0, failed: 0, errors: [] };
      }

      // 批量重试
      const locationIds = failedLocations.map(loc => loc.id);
      return await this.batchGeocodeLocations(locationIds);

    } catch (error: unknown) {
      console.error('重试失败的地理编码失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      return {
        success: 0,
        failed: 0,
        errors: [{ location_id: '', error: errorMessage }]
      };
    }
  }

  /**
   * 获取地理编码统计信息
   */
  async getGeocodingStats(): Promise<{
    total: number;
    success: number;
    pending: number;
    failed: number;
    retry: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('geocoding_status');

      if (error) {
        throw new Error(`获取统计信息失败: ${error.message}`);
      }

      const stats = {
        total: data.length,
        success: 0,
        pending: 0,
        failed: 0,
        retry: 0
      };

      data.forEach(location => {
        switch (location.geocoding_status) {
          case 'success':
            stats.success++;
            break;
          case 'pending':
            stats.pending++;
            break;
          case 'failed':
            stats.failed++;
            break;
          case 'retry':
            stats.retry++;
            break;
        }
      });

      return stats;
    } catch (error: unknown) {
      console.error('获取地理编码统计失败:', error);
      return {
        total: 0,
        success: 0,
        pending: 0,
        failed: 0,
        retry: 0
      };
    }
  }
}

// 创建默认实例
export const createLocationGeocodingService = (toast: ReturnType<typeof useToast>['toast']) => {
  return new LocationGeocodingService(
    new SupabaseAMapService(toast),
    toast
  );
};
