// 车辆轨迹查询公共 Hook
import { useState, useRef } from 'react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { useVehicleSync } from './useVehicleSync';

interface VehicleTrackingOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

interface QueryTrajectoryParams {
  // 车牌号（可选，如果提供会先查询车辆ID）
  licensePlate?: string;
  // 车辆ID（可选，如果提供则直接使用）
  vehicleId?: string;
  // 开始时间（时间戳，毫秒）
  startTime: number;
  // 结束时间（时间戳，毫秒）
  endTime: number;
  // 查询字段类型：'id' 或 'serialno'（默认：'id'）
  field?: 'id' | 'serialno';
}

/**
 * 将UTC日期字符串转换为中国时区的时间戳
 * @param dateStr UTC日期字符串（如 "2025-01-15"）
 * @param isEndTime 是否为结束时间（如果是，设置为23:59:59，否则为00:00:00）
 * @returns 时间戳（毫秒）
 */
export function convertUtcDateToChinaTimestamp(dateStr: string, isEndTime: boolean = false): number {
  const date = new Date(dateStr);
  // 如果日期字符串不包含时间，假设是UTC 00:00:00，需要转换为中国时区
  const chinaTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const year = chinaTime.getFullYear();
  const month = String(chinaTime.getMonth() + 1).padStart(2, '0');
  const day = String(chinaTime.getDate()).padStart(2, '0');
  const timeStr = isEndTime ? 'T23:59:59+08:00' : 'T00:00:00+08:00';
  const timeStrFull = `${year}-${month}-${day}${timeStr}`;
  return new Date(timeStrFull).getTime();
}

/**
 * 将日期字符串转换为中国时区的时间戳（简化版本，直接使用日期字符串）
 * @param dateStr 日期字符串（如 "2025-01-15"）
 * @param isEndTime 是否为结束时间
 * @returns 时间戳（毫秒）
 */
export function convertDateToChinaTimestamp(dateStr: string, isEndTime: boolean = false): number {
  const timeStr = isEndTime ? 'T23:59:59+08:00' : 'T00:00:00+08:00';
  return new Date(`${dateStr}${timeStr}`).getTime();
}

export function useVehicleTracking(options?: VehicleTrackingOptions) {
  const [loading, setLoading] = useState(false);
  const [trackingData, setTrackingData] = useState<unknown>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const { getVehicleIdByLicensePlate } = useVehicleSync();

  // 获取 Supabase 配置和认证信息
  const getSupabaseConfig = async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('缺少 Supabase 配置');
    }

    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token || '';

    return { supabaseUrl, supabaseAnonKey, authToken };
  };

  // 查询轨迹
  const queryTrajectory = async (params: QueryTrajectoryParams): Promise<unknown> => {
    setLoading(true);
    setTrackingData(null);

    try {
      let finalVehicleId = params.vehicleId;

      // 如果没有提供车辆ID，尝试通过车牌号查找
      if (!finalVehicleId && params.licensePlate) {
        const foundId = await getVehicleIdByLicensePlate(params.licensePlate);
        if (!foundId) {
          throw new Error(`未找到车牌号 ${params.licensePlate} 对应的车辆ID，请先同步车辆ID`);
        }
        finalVehicleId = foundId;
      }

      if (!finalVehicleId) {
        throw new Error('缺少车辆ID或车牌号');
      }

      // 验证时间范围
      if (params.endTime < params.startTime) {
        throw new Error('结束时间不能早于开始时间');
      }

      // 验证时间范围不能太大（最多30天）
      const maxTimeRange = 30 * 24 * 60 * 60 * 1000; // 30天的毫秒数
      if (params.endTime - params.startTime > maxTimeRange) {
        throw new Error('查询时间范围过大（超过30天），请缩小日期范围后重试');
      }

      // 创建 AbortController
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // 调用 vehicle-tracking Edge Function
      const { supabaseUrl, supabaseAnonKey, authToken } = await getSupabaseConfig();

      const response = await fetch(`${supabaseUrl}/functions/v1/vehicle-tracking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken || supabaseAnonKey}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          vehicleId: finalVehicleId,
          field: params.field || 'id',
          startTime: params.startTime,
          endTime: params.endTime
        }),
        signal: abortController.signal
      });

      // 检查是否被取消
      if (abortController.signal.aborted) {
        throw new Error('查询已取消');
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.message || errorBody.error || errorMessage;
        } catch (e) {
          // 忽略JSON解析错误
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // 检查是否被取消
      if (abortController.signal.aborted) {
        throw new Error('查询已取消');
      }

      // 检查响应数据
      if (!data) {
        throw new Error('Edge Function 返回空数据');
      }

      // 如果返回了错误信息
      if (data.error) {
        throw new Error(data.error || data.message || '查询失败');
      }

      // 处理返回的数据
      let result: unknown;
      if (Array.isArray(data)) {
        result = data;
      } else if (data && typeof data === 'object') {
        const dataObj = data as Record<string, unknown>;
        if (Array.isArray(dataObj.result)) {
          result = dataObj.result;
        } else if (Array.isArray(dataObj.data)) {
          result = dataObj.data;
        } else {
          result = data;
        }
      } else {
        throw new Error('返回数据格式不正确');
      }

      setTrackingData(result);

      if (options?.onSuccess) {
        options.onSuccess(result);
      }

      return result;

    } catch (error) {
      // 如果是取消操作，不抛出错误
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('查询已取消');
      }

      if (options?.onError) {
        options.onError(error instanceof Error ? error : new Error(String(error)));
      }

      throw error;
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 带 Toast 提示的查询函数
  const queryTrajectoryWithToast = async (params: QueryTrajectoryParams) => {
    try {
      const data = await queryTrajectory(params);
      
      toast({
        title: "查询成功",
        description: `已获取 ${Array.isArray(data) ? data.length : 0} 个轨迹点`
      });

      return data;
    } catch (error) {
      // 如果是取消操作，显示取消提示
      if (error instanceof Error && error.message === '查询已取消') {
        toast({
          title: "查询已取消",
          description: "已取消轨迹查询",
        });
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : '无法查询车辆轨迹';
      toast({
        title: "查询失败",
        description: errorMessage,
        variant: "destructive"
      });

      throw error;
    }
  };

  // 取消查询
  const cancelQuery = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  return {
    loading,
    trackingData,
    queryTrajectory,
    queryTrajectoryWithToast,
    cancelQuery
  };
}

