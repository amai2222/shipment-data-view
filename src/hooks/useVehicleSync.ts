// 车辆同步公共 Hook（添加车牌、查询车牌、写入本地数据表）
import { useState, useRef } from 'react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';

interface VehicleSyncResult {
  success: boolean;
  message: string;
  addStatus?: 'created' | 'existed';
  syncIdStatus?: 'synced' | 'failed';
  data?: {
    syncId?: {
      externalId?: string;
    };
  };
}

interface UseVehicleSyncOptions {
  onSuccess?: (result: VehicleSyncResult) => void;
  onError?: (error: Error) => void;
}

export function useVehicleSync(options?: UseVehicleSyncOptions) {
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

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

  // 根据车牌号查询车辆ID（如果有映射）
  const getVehicleIdByLicensePlate = async (plate: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('vehicle_tracking_id_mappings')
        .select('license_plate, external_tracking_id')
        .eq('license_plate', plate.trim())
        .maybeSingle();
      
      if (error) {
        console.error('查询车辆ID失败:', error);
        return null;
      }
      
      return data?.external_tracking_id || null;
    } catch (error) {
      console.error('查询车辆ID异常:', error);
      return null;
    }
  };

  // 同步车辆（添加到第三方平台并同步ID到本地数据库）
  const syncVehicle = async (licensePlate: string, loadWeight: string = '0'): Promise<VehicleSyncResult> => {
    if (!licensePlate.trim()) {
      throw new Error('请输入车牌号');
    }

    setLoading(true);
    try {
      // 第一步：先查询本地数据库是否有该车牌号的记录
      const existingId = await getVehicleIdByLicensePlate(licensePlate.trim());
      
      if (existingId) {
        const result: VehicleSyncResult = {
          success: true,
          message: `车辆 ${licensePlate} 已在本地数据库中（ID: ${existingId}），无需重复添加。`,
          addStatus: 'existed',
          syncIdStatus: 'synced'
        };
        return result;
      }

      // 第二步：创建 AbortController 用于取消请求
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // 第三步：调用 sync-vehicle Edge Function
      const { supabaseUrl, supabaseAnonKey, authToken } = await getSupabaseConfig();

      const response = await fetch(`${supabaseUrl}/functions/v1/sync-vehicle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken || supabaseAnonKey}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          licensePlate: licensePlate.trim(),
          loadWeight: loadWeight.trim() || '0',
          syncId: true // 启用ID同步
        }),
        signal: abortController.signal
      });

      // 检查是否被取消
      if (abortController.signal.aborted) {
        throw new Error('操作已取消');
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.message || errorBody.error || errorMessage;
        } catch (e) {
          // 如果响应不是 JSON，使用默认错误信息
        }
        throw new Error(errorMessage);
      }

      const result: VehicleSyncResult = await response.json();

      // 检查是否被取消
      if (abortController.signal.aborted) {
        throw new Error('操作已取消');
      }

      // 检查响应数据
      if (!result) {
        throw new Error('Edge Function 返回空数据');
      }

      if (!result.success) {
        throw new Error(result.message || '处理失败');
      }

      return result;

    } catch (error) {
      // 如果是取消操作，不抛出错误
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('操作已取消');
      }
      
      throw error;
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 取消同步
  const cancelSync = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  // 带 Toast 提示的同步函数
  const syncVehicleWithToast = async (licensePlate: string, loadWeight: string = '0') => {
    try {
      toast({
        title: "正在处理",
        description: `正在将车辆 ${licensePlate} 添加到第三方平台并同步ID...`,
      });

      const result = await syncVehicle(licensePlate, loadWeight);

      // 显示结果
      const addStatusMessage = result.addStatus === 'existed'
        ? `车辆 ${licensePlate} 已存在于第三方平台。`
        : `车辆 ${licensePlate} 已成功添加到第三方平台。`;
      
      const syncIdMessage = result.syncIdStatus === 'synced'
        ? `ID已成功同步到数据库（${result.data?.syncId?.externalId || '未知'}）。`
        : `但ID同步失败：${result.message?.split('；')[1] || '未知错误'}`;

      toast({
        title: result.success ? "操作完成" : "部分成功",
        description: `${addStatusMessage}${result.syncIdStatus === 'synced' ? syncIdMessage : syncIdMessage}`,
        variant: result.success ? 'default' : 'destructive'
      });

      if (options?.onSuccess) {
        options.onSuccess(result);
      }

      return result;
    } catch (error) {
      // 如果是取消操作，显示取消提示
      if (error instanceof Error && error.message === '操作已取消') {
        toast({
          title: "操作已取消",
          description: "已取消添加车辆并同步ID",
        });
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : '未知错误，请稍后重试';
      toast({
        title: "操作失败",
        description: errorMessage,
        variant: "destructive"
      });

      if (options?.onError) {
        options.onError(error instanceof Error ? error : new Error(errorMessage));
      }

      throw error;
    }
  };

  return {
    loading,
    syncVehicle,
    syncVehicleWithToast,
    cancelSync,
    getVehicleIdByLicensePlate
  };
}

