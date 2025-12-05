// 车辆轨迹查询页面
import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { Search, MapPin, Calendar, Truck, Route, Loader2, RefreshCw, Plus, Database, X, FileText } from 'lucide-react';
import { VehicleTrackingMap } from '@/components/VehicleTrackingMap';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface TrackingPoint {
  lat: number;
  lng: number;
  time: number;
  speed?: number;
  direction?: number;
  address?: string;
}

type TrackingData = TrackingPoint[] | {
  points?: TrackingPoint[];
  data?: TrackingPoint[];
  result?: TrackingPoint[];
  [key: string]: unknown;
};

export default function VehicleTracking() {
  const { toast } = useToast();
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [useVehicleId, setUseVehicleId] = useState(false);
  const [activeTab, setActiveTab] = useState('tracking'); // 标签页状态
  
  // 车辆同步相关状态
  const [syncLicensePlate, setSyncLicensePlate] = useState('');
  const [syncLoadWeight, setSyncLoadWeight] = useState('0');
  const [syncLoading, setSyncLoading] = useState(false);
  
  // 查询ID并同步相关状态
  const [syncIdLicensePlate, setSyncIdLicensePlate] = useState('');
  const [syncIdLoading, setSyncIdLoading] = useState(false);
  
  // 新增查询入库相关状态
  const [addAndSyncDialogOpen, setAddAndSyncDialogOpen] = useState(false);
  const [addAndSyncLicensePlate, setAddAndSyncLicensePlate] = useState('');
  const [addAndSyncLoadWeight, setAddAndSyncLoadWeight] = useState('0');
  const [addAndSyncLoading, setAddAndSyncLoading] = useState(false);
  
  // 批量输入相关状态
  const [batchInputDialogOpen, setBatchInputDialogOpen] = useState(false);
  const [batchInputText, setBatchInputText] = useState('');
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; results: Array<{ licensePlate: string; success: boolean; message: string }> } | null>(null);
  
  // Token 刷新相关状态
  const [refreshingToken, setRefreshingToken] = useState(false);
  const [tokenType, setTokenType] = useState<'add' | 'query'>('query');
  const [refreshingAllTokens, setRefreshingAllTokens] = useState(false);

  // 🔴 取消操作相关状态
  const abortControllerRef = useRef<AbortController | null>(null);
  const syncVehicleAbortControllerRef = useRef<AbortController | null>(null);
  const syncVehicleIdAbortControllerRef = useRef<AbortController | null>(null);
  const addAndSyncAbortControllerRef = useRef<AbortController | null>(null);

  // 根据车牌号查询车辆ID（如果有映射）
  const getVehicleIdByLicensePlate = async (plate: string): Promise<string | null> => {
    try {
      // 查询车辆轨迹ID映射表
      const { data, error } = await supabase
        .from('vehicle_tracking_id_mappings')
        .select('license_plate, external_tracking_id')
        .eq('license_plate', plate.trim())
        .maybeSingle(); // 使用 maybeSingle 而不是 single，避免404错误

      // 如果是404（未找到），这是正常的，返回null
      if (error) {
        // 404是正常的（记录不存在），其他错误才需要记录
        if (error.code !== 'PGRST116') {
          console.error('查询车辆ID失败:', error);
        }
        return null;
      }

      if (!data) {
        return null;
      }

      // 返回外部车辆ID
      return data.external_tracking_id || null;
    } catch (error) {
      console.error('查询车辆ID异常:', error);
      return null;
    }
  };

  // 同步车辆ID映射
  const handleSyncVehicleIds = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-vehicle-tracking-ids', {
        body: {
          deptId: '#16:5043' // 默认部门ID，可以根据需要调整
        }
      });

      if (error) {
        console.error('同步车辆ID错误详情:', {
          error,
          message: error.message,
          context: error.context,
          status: error.status
        });
        throw new Error(`同步失败: ${error.message}`);
      }

      // 检查响应数据（参考 Gemini 代码，直接返回数据）
      if (!data) {
        throw new Error('Edge Function 返回空数据');
      }

      // 如果返回了错误信息
      if (data.error) {
        console.error('Edge Function 返回错误:', data);
        throw new Error(data.error || '同步失败');
      }

      // 检查 success 字段（如果存在）
      if (data.success === false) {
        throw new Error(data.message || data.error || '同步失败');
      }

      // 使用新的响应格式（参考 Gemini 代码）
      const stats = data.stats || {};
      const totalRemote = stats.total_remote || 0;
      const syncedLocal = stats.synced_local || 0;
      const message = data.message || '同步完成';

      toast({
        title: "同步完成",
        description: `${message}：共 ${totalRemote} 辆车，成功同步 ${syncedLocal} 辆`,
        variant: "default"
      });

      // 如果有详细信息，记录日志
      if (data.details) {
        console.log('同步详细信息:', data.details);
        // 如果有错误信息，显示详细信息
        if (data.details.errors > 0 && data.details.error_messages && data.details.error_messages.length > 0) {
          console.warn('同步过程中的错误:', data.details.error_messages);
          // 可以选择显示详细的错误信息
          toast({
            title: "部分同步失败",
            description: `失败详情请查看控制台`,
            variant: "default"
          });
        }
      }
    } catch (error) {
      console.error('同步车辆ID失败:', error);
      toast({
        title: "同步失败",
        description: error instanceof Error ? error.message : '无法同步车辆ID',
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSearch = async () => {
    // 验证输入
    if (!useVehicleId && !licensePlate.trim()) {
      toast({
        title: "请输入车牌号",
        description: "请先输入要查询的车牌号",
        variant: "destructive"
      });
      return;
    }

    if (useVehicleId && !vehicleId.trim()) {
      toast({
        title: "请输入车辆ID",
        description: "请先输入要查询的车辆ID（格式：#26:10037）",
        variant: "destructive"
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: "请选择日期范围",
        description: "请选择开始日期和结束日期",
        variant: "destructive"
      });
      return;
    }

    // 验证日期范围
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      toast({
        title: "日期范围错误",
        description: "开始日期不能晚于结束日期",
        variant: "destructive"
      });
      return;
    }

    // 验证日期范围不能太大（最多查询30天）
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      toast({
        title: "日期范围过大",
        description: `查询时间范围不能超过30天，当前为${daysDiff}天。请缩小日期范围后重试。`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setTrackingData(null);

    try {
      let finalVehicleId = useVehicleId ? vehicleId.trim() : null;

      // 如果不是直接使用车辆ID，尝试通过车牌号查找
      if (!finalVehicleId && licensePlate.trim()) {
        const foundId = await getVehicleIdByLicensePlate(licensePlate);
        if (foundId) {
          finalVehicleId = foundId;
        } else {
          // 如果没有找到映射，提示用户需要输入车辆ID
          toast({
            title: "需要车辆ID",
            description: "未找到该车牌号对应的车辆ID，请切换到「车辆ID」模式并输入正确的车辆ID（格式：#26:10037）",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
      }

      if (!finalVehicleId) {
        throw new Error('无法获取车辆ID');
      }

      // 🔴 修复：使用中国时区（+08:00）将日期转换为时间戳（毫秒）
      // 确保时间戳计算正确，避免时区问题导致的时间戳异常
      const startTimeStr = `${startDate}T00:00:00+08:00`;
      const endTimeStr = `${endDate}T23:59:59+08:00`;
      const startTime = new Date(startTimeStr).getTime();
      const endTime = new Date(endTimeStr).getTime();

      // 验证时间戳有效性
      if (isNaN(startTime) || isNaN(endTime) || startTime < 0 || endTime < 0) {
        throw new Error(`时间戳转换失败：startTime=${startTime}, endTime=${endTime}。请检查日期格式是否正确。`);
      }

      // 再次验证时间范围（使用时间戳）
      if (endTime < startTime) {
        throw new Error('结束时间不能早于开始时间');
      }

      // 验证时间范围不能太大（使用时间戳验证，最多30天）
      const maxTimeRange = 30 * 24 * 60 * 60 * 1000; // 30天的毫秒数
      if (endTime - startTime > maxTimeRange) {
        throw new Error(`查询时间范围过大（超过30天），请缩小日期范围后重试。`);
      }

      console.log('时间戳转换结果:', {
        startDate,
        endDate,
        startTime,
        endTime,
        startTimeISO: new Date(startTime).toISOString(),
        endTimeISO: new Date(endTime).toISOString(),
        timeRangeDays: Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24))
      });

      // 🔴 创建 AbortController 用于取消请求
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // 调用Supabase Edge Function代理API
      // 使用原生 fetch 以支持 AbortController
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('缺少 Supabase 配置');
      }

      // 获取当前用户的 session token
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || '';

      const response = await fetch(`${supabaseUrl}/functions/v1/vehicle-tracking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken || supabaseAnonKey}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          vehicleId: finalVehicleId,
          field: useVehicleId ? 'id' : 'serialno',
          startTime: startTime,
          endTime: endTime
        }),
        signal: abortController.signal
      });

      // 检查是否被取消
      if (abortController.signal.aborted) {
        return;
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.error || errorBody.message || errorMessage;
        } catch (e) {
          // 如果响应不是 JSON，使用默认错误信息
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // 检查是否被取消
      if (abortController.signal.aborted) {
        return;
      }

      // 检查响应数据（参考 Gemini 代码，直接返回 API 数据，不包装 success）
      if (!data) {
        throw new Error('Edge Function 返回空数据');
      }

      // 如果返回了错误信息
      if (data.error) {
        console.error('Edge Function 返回错误:', data);
        throw new Error(data.error || data.message || '查询失败');
      }

      // 直接使用返回的数据（不再检查 success 字段）
      console.log('Edge Function 返回的数据:', data);
      console.log('数据类型:', typeof data, '是否为数组:', Array.isArray(data));
      
      // 如果数据是数组，直接设置；如果是对象，尝试提取数组
      if (Array.isArray(data)) {
        console.log(`返回数组，长度: ${data.length}`);
        setTrackingData(data);
      } else if (data && typeof data === 'object') {
        console.log('返回对象，键:', Object.keys(data));
        // 尝试提取数组字段
        const dataObj = data as Record<string, unknown>;
        if (Array.isArray(dataObj.result)) {
          console.log(`从 result 字段提取，长度: ${dataObj.result.length}`);
          setTrackingData(dataObj.result);
        } else if (Array.isArray(dataObj.data)) {
          console.log(`从 data 字段提取，长度: ${dataObj.data.length}`);
          setTrackingData(dataObj.data);
        } else {
          // 直接使用整个对象
          setTrackingData(data);
        }
      } else {
        console.error('返回数据格式不正确:', data);
        throw new Error('返回数据格式不正确');
      }
      
      toast({
        title: "查询成功",
        description: `已获取车辆轨迹数据`
      });
    } catch (error) {
      // 如果是取消操作，不显示错误提示
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('查询已取消');
        toast({
          title: "查询已取消",
          description: "已取消轨迹查询",
        });
        return;
      }
      
      console.error('查询车辆轨迹失败:', error);
      toast({
        title: "查询失败",
        description: error instanceof Error ? error.message : '无法查询车辆轨迹',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 🔴 取消查询函数
  const handleCancelSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  // 🔴 辅助函数：获取 Supabase 配置和认证信息
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

  // 同步车辆到轨迹查询库
  const handleSyncVehicle = async () => {
    if (!syncLicensePlate.trim()) {
      toast({
        title: "输入错误",
        description: "请输入车牌号",
        variant: "destructive"
      });
      return;
    }

    setSyncLoading(true);
    try {
      console.log('开始同步车辆:', { licensePlate: syncLicensePlate.trim(), loadWeight: syncLoadWeight.trim() || '0' });
      
      // 🔴 创建 AbortController 用于取消请求
      const abortController = new AbortController();
      syncVehicleAbortControllerRef.current = abortController;

      // 使用原生 fetch 以支持 AbortController
      const { supabaseUrl, supabaseAnonKey, authToken } = await getSupabaseConfig();

      const response = await fetch(`${supabaseUrl}/functions/v1/add-vehicle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken || supabaseAnonKey}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          licensePlate: syncLicensePlate.trim(),
          loadWeight: syncLoadWeight.trim() || '0'
        }),
        signal: abortController.signal
      });

      // 检查是否被取消
      if (abortController.signal.aborted) {
        return;
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

      const data = await response.json();
      console.log('Edge Function 响应:', data);

      // 检查是否被取消
      if (abortController.signal.aborted) {
        return;
      }

      // 检查响应数据
      if (!data) {
        throw new Error('Edge Function 返回空数据');
      }

      // 检查响应数据
      console.log('同步车辆响应数据:', data);
      
      // 🔴 处理成功情况
      if (data) {
        // 检查 success 字段（支持布尔值和字符串）
        // 🔴 重要：status === 'existed' 也表示成功（车辆已存在）
        const isSuccess = data.success === true || data.success === 'true' || 
                         data.status === 'existed' ||
                         (data.success === undefined && !data.error && !data.message?.includes('失败'));
        
        if (isSuccess) {
          // 根据状态显示不同的提示信息
          const statusMessage = data.status === 'existed' 
            ? (data.message || `车辆 ${syncLicensePlate} 已存在于轨迹查询库`)
            : (data.message || `车辆 ${syncLicensePlate} 已成功添加到轨迹查询库`);
          
          toast({
            title: data.status === 'existed' ? "车辆已存在" : "同步成功",
            description: statusMessage,
            variant: 'default'
          });
          // 清空表单
          setSyncLicensePlate('');
          setSyncLoadWeight('0');
          return; // 🔴 重要：成功时直接返回，避免继续执行
        }
        
        // 🔴 处理明确失败的情况
        if (data.success === false || data.error) {
          // 处理错误对象（可能是 { code, message } 格式）
          let errorMessage = data.message || '同步失败';
          if (data.error) {
            if (typeof data.error === 'string') {
              errorMessage = data.error;
            } else if (typeof data.error === 'object' && data.error.message) {
              errorMessage = data.error.message;
            } else if (typeof data.error === 'object' && data.error.code) {
              errorMessage = `${data.error.code}: ${data.error.message || '未知错误'}`;
            }
          }
          throw new Error(errorMessage);
        }
      }
      
      // 🔴 如果没有返回数据，但也没有错误，可能是成功但响应格式异常
      // 这种情况应该很少见，但为了健壮性，我们假设成功
      console.warn('响应数据格式异常，但可能已成功:', data);
      toast({
        title: "同步成功",
        description: `车辆 ${syncLicensePlate} 已成功添加到轨迹查询库`,
      });
      // 清空表单
      setSyncLicensePlate('');
      setSyncLoadWeight('0');
    } catch (error) {
      // 如果是取消操作，不显示错误提示
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('同步车辆已取消');
        toast({
          title: "操作已取消",
          description: "已取消同步车辆",
        });
        return;
      }
      
      console.error('同步车辆失败:', error);
      toast({
        title: "同步失败",
        description: error instanceof Error ? error.message : '未知错误，请稍后重试',
        variant: "destructive"
      });
    } finally {
      setSyncLoading(false);
      syncVehicleAbortControllerRef.current = null;
    }
  };

  // 🔴 取消同步车辆函数
  const handleCancelSyncVehicle = () => {
    if (syncVehicleAbortControllerRef.current) {
      syncVehicleAbortControllerRef.current.abort();
      syncVehicleAbortControllerRef.current = null;
      setSyncLoading(false);
    }
  };

  // 查询车辆ID并同步到数据库
  const handleSyncVehicleId = async () => {
    if (!syncIdLicensePlate.trim()) {
      toast({
        title: "输入错误",
        description: "请输入车牌号",
        variant: "destructive"
      });
      return;
    }

    setSyncIdLoading(true);
    try {
      // 🔴 创建 AbortController 用于取消请求
      const abortController = new AbortController();
      syncVehicleIdAbortControllerRef.current = abortController;

      // 使用原生 fetch 以支持 AbortController
      const { supabaseUrl, supabaseAnonKey, authToken } = await getSupabaseConfig();

      const requestUrl = `${supabaseUrl}/functions/v1/sync-vehicle`;
      const requestBody = {
        licensePlate: syncIdLicensePlate.trim(),
        onlySyncId: true // 只查询ID，不添加车辆
      };

      console.log('🔍 [查询并同步] 开始请求:', {
        url: requestUrl,
        licensePlate: requestBody.licensePlate,
        onlySyncId: requestBody.onlySyncId
      });

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken || supabaseAnonKey}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal
      });

      // 检查是否被取消
      if (abortController.signal.aborted) {
        console.log('⚠️ [查询并同步] 请求已被取消');
        return;
      }

      console.log('📥 [查询并同步] 响应状态:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorDetails = '';
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.message || errorBody.error || errorMessage;
          errorDetails = JSON.stringify(errorBody);
        } catch (e) {
          // 如果响应不是 JSON，尝试读取文本
          try {
            const errorText = await response.text();
            errorDetails = errorText;
          } catch (textError) {
            errorDetails = '无法读取错误详情';
          }
        }
        
        console.error('❌ [查询并同步] 请求失败:', {
          status: response.status,
          statusText: response.statusText,
          message: errorMessage,
          details: errorDetails
        });
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ [查询并同步] 响应数据:', data);

      // 检查是否被取消
      if (abortController.signal.aborted) {
        console.log('⚠️ [查询并同步] 响应处理时已被取消');
        return;
      }

      if (data?.success) {
        toast({
          title: "同步成功",
          description: data.message || `车辆 ${syncIdLicensePlate} 的 ID 已成功同步到数据库`,
        });
        // 清空表单
        setSyncIdLicensePlate('');
      } else {
        throw new Error(data?.message || '同步失败');
      }
    } catch (error) {
      // 如果是取消操作，不显示错误提示
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('ℹ️ [查询并同步] 操作已取消');
        toast({
          title: "操作已取消",
          description: "已取消查询ID并同步",
        });
        return;
      }
      
      // 详细错误日志
      console.error('❌ [查询并同步] 失败:', {
        error,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });

      // 根据错误类型提供更友好的错误信息
      let userMessage = '未知错误，请稍后重试';
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          userMessage = '网络连接失败，请检查网络连接或稍后重试';
        } else if (error.message.includes('timeout') || error.message.includes('aborted')) {
          userMessage = '请求超时，请稍后重试';
        } else {
          userMessage = error.message;
        }
      }

      toast({
        title: "同步失败",
        description: userMessage,
        variant: "destructive",
        duration: 10000 // 延长显示时间
      });
    } finally {
      setSyncIdLoading(false);
      syncVehicleIdAbortControllerRef.current = null;
    }
  };

  // 🔴 取消查询ID并同步函数
  const handleCancelSyncVehicleId = () => {
    if (syncVehicleIdAbortControllerRef.current) {
      syncVehicleIdAbortControllerRef.current.abort();
      syncVehicleIdAbortControllerRef.current = null;
      setSyncIdLoading(false);
    }
  };

  // 新增查询入库：先添加车辆到第三方，然后查询ID并同步到数据库
  const handleAddAndSync = async () => {
    if (!addAndSyncLicensePlate.trim()) {
      toast({
        title: "输入错误",
        description: "请输入车牌号",
        variant: "destructive"
      });
      return;
    }

    setAddAndSyncLoading(true);
    try {
      // 🔴 第一步：先查询本地数据库是否有该车牌号的记录
      const existingId = await getVehicleIdByLicensePlate(addAndSyncLicensePlate.trim());
      
      if (existingId) {
        // 如果已有记录，提示用户并跳过后续操作
        toast({
          title: "车辆已存在",
          description: `车辆 ${addAndSyncLicensePlate} 已在本地数据库中（ID: ${existingId}），无需重复添加。`,
          variant: "default"
        });
        setAddAndSyncLoading(false);
        // 清空表单并关闭对话框
        setAddAndSyncLicensePlate('');
        setAddAndSyncLoadWeight('0');
        setAddAndSyncDialogOpen(false);
        return;
      }

      // 🔴 创建 AbortController 用于取消请求
      const abortController = new AbortController();
      addAndSyncAbortControllerRef.current = abortController;

      // 🔴 合并后的单次调用：添加车辆并同步ID
      toast({
        title: "正在处理",
        description: `正在将车辆 ${addAndSyncLicensePlate} 添加到第三方平台并同步ID...`,
      });

      // 使用原生 fetch 以支持 AbortController
      const { supabaseUrl, supabaseAnonKey, authToken } = await getSupabaseConfig();

      const response = await fetch(`${supabaseUrl}/functions/v1/sync-vehicle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken || supabaseAnonKey}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          licensePlate: addAndSyncLicensePlate.trim(),
          loadWeight: addAndSyncLoadWeight.trim() || '0',
          syncId: true // 🔴 关键：启用ID同步
        }),
        signal: abortController.signal
      });

      // 检查是否被取消
      if (abortController.signal.aborted) {
        return;
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

      const result = await response.json();

      // 检查是否被取消
      if (abortController.signal.aborted) {
        return;
      }

      // 检查响应数据
      if (!result) {
        throw new Error('Edge Function 返回空数据');
      }

      if (!result?.success) {
        throw new Error(result?.message || '处理失败');
      }

      // 显示合并后的结果
      const addStatusMessage = result.addStatus === 'existed'
        ? `车辆 ${addAndSyncLicensePlate} 已存在于第三方平台。`
        : `车辆 ${addAndSyncLicensePlate} 已成功添加到第三方平台。`;
      
      const syncIdMessage = result.syncIdStatus === 'synced'
        ? `ID已成功同步到数据库（${result.data?.syncId?.externalId || '未知'}）。`
        : `但ID同步失败：${result.message?.split('；')[1] || '未知错误'}`;

      toast({
        title: result.success ? "操作完成" : "部分成功",
        description: `${addStatusMessage}${result.syncIdStatus === 'synced' ? syncIdMessage : syncIdMessage}`,
        variant: result.success ? 'default' : 'destructive'
      });

      // 清空表单并关闭对话框
      setAddAndSyncLicensePlate('');
      setAddAndSyncLoadWeight('0');
      setAddAndSyncDialogOpen(false);

    } catch (error) {
      // 如果是取消操作，不显示错误提示
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('新增查询入库已取消');
        toast({
          title: "操作已取消",
          description: "已取消添加车辆并同步ID",
        });
        return;
      }
      
      console.error('新增查询入库失败:', error);
      toast({
        title: "操作失败",
        description: error instanceof Error ? error.message : '未知错误，请稍后重试',
        variant: "destructive"
      });
    } finally {
      setAddAndSyncLoading(false);
      addAndSyncAbortControllerRef.current = null;
    }
  };

  // 🔴 取消添加并同步函数
  const handleCancelAddAndSync = () => {
    if (addAndSyncAbortControllerRef.current) {
      addAndSyncAbortControllerRef.current.abort();
      addAndSyncAbortControllerRef.current = null;
      setAddAndSyncLoading(false);
    }
  };

  // 🔴 解析批量输入的车牌号（支持空格、逗号、换行）
  const parseBatchLicensePlates = (text: string): string[] => {
    if (!text.trim()) return [];
    
    // 使用正则表达式分割：支持空格、逗号、换行、分号等
    const plates = text
      .split(/[\s,，\n\r;；]+/)
      .map(plate => plate.trim())
      .filter(plate => plate.length > 0);
    
    // 去重
    return Array.from(new Set(plates));
  };

  // 🔴 批量处理函数
  const handleBatchAddAndSync = async () => {
    if (!batchInputText.trim()) {
      toast({
        title: "输入错误",
        description: "请输入车牌号",
        variant: "destructive"
      });
      return;
    }

    // 解析车牌号
    const licensePlates = parseBatchLicensePlates(batchInputText);
    
    if (licensePlates.length === 0) {
      toast({
        title: "输入错误",
        description: "未找到有效的车牌号",
        variant: "destructive"
      });
      return;
    }

    // 🔴 第一步：并行批量查询本地数据库，过滤掉已存在的车牌号
    const platesToProcess: string[] = [];
    const existingPlates: Array<{ plate: string; id: string }> = [];

    console.log('🔍 [批量处理] 第一步：开始并行查询本地数据库，车牌号数量:', licensePlates.length);
    
    try {
      // 批量查询所有车牌号（一次性并行查询，避免多次请求）
      const { data: existingMappings, error: queryError } = await supabase
        .from('vehicle_tracking_id_mappings')
        .select('license_plate, external_tracking_id')
        .in('license_plate', licensePlates);

      if (queryError) {
        console.warn('⚠️ [批量处理] 批量查询本地数据库失败，将跳过检查:', queryError);
        // 如果批量查询失败，将所有车牌号都加入处理列表（不阻塞处理）
        platesToProcess.push(...licensePlates);
      } else {
        // 构建已存在的车牌号映射（使用 Map 提高查找效率）
        const existingMap = new Map<string, string>();
        if (existingMappings && Array.isArray(existingMappings)) {
          existingMappings.forEach((mapping: { license_plate: string; external_tracking_id: string }) => {
            existingMap.set(mapping.license_plate.trim(), mapping.external_tracking_id);
          });
        }

        // 分类车牌号：已存在 vs 待处理
        for (const plate of licensePlates) {
          const trimmedPlate = plate.trim();
          const existingId = existingMap.get(trimmedPlate);
          if (existingId) {
            existingPlates.push({ plate: trimmedPlate, id: existingId });
          } else {
            platesToProcess.push(trimmedPlate);
          }
        }
      }
    } catch (checkError) {
      console.error('❌ [批量处理] 检查本地数据库异常:', checkError);
      // 如果检查失败，将所有车牌号都加入处理列表（不阻塞处理）
      platesToProcess.push(...licensePlates);
    }

    console.log('✅ [批量处理] 第一步完成 - 本地数据库检查结果:', {
      总数: licensePlates.length,
      已存在: existingPlates.length,
      待处理: platesToProcess.length
    });

    // 如果有已存在的车牌号，显示提示
    if (existingPlates.length > 0) {
      toast({
        title: "部分车辆已存在",
        description: `以下 ${existingPlates.length} 个车辆已在本地数据库中，将跳过：${existingPlates.slice(0, 3).map(p => p.plate).join('、')}${existingPlates.length > 3 ? '...' : ''}`,
        variant: "default"
      });
    }

    // 🔴 第二步：只对本地没有的车牌进行后续操作
    if (platesToProcess.length === 0) {
      toast({
        title: "无需处理",
        description: "所有车辆已在本地数据库中",
        variant: "default"
      });
      setBatchProcessing(false);
      setBatchProgress(null);
      setBatchInputText('');
      setBatchInputDialogOpen(false);
      return;
    }

    // 开始处理：只处理本地没有的车牌
    setBatchProcessing(true);
    setBatchProgress({ current: 0, total: platesToProcess.length, results: [] });

    try {
      // 🔴 第二步：逐个处理车辆，实时显示进度（遇到错误记录日志并跳过）
      console.log('🚀 [批量处理] 第二步：开始逐个处理本地没有的车牌，数量:', platesToProcess.length);
      const { supabaseUrl, supabaseAnonKey, authToken } = await getSupabaseConfig();

      const results: Array<{
        licensePlate: string;
        success: boolean;
        message?: string;
        addStatus?: string;
        syncIdStatus?: string;
        error?: string;
      }> = [];

      // 逐个处理每个车辆
      for (let i = 0; i < platesToProcess.length; i++) {
        const plate = platesToProcess[i];
        const currentIndex = i + 1;
        const total = platesToProcess.length;

        // 更新进度
        setBatchProgress({
          current: currentIndex,
          total: total,
          results: [...results]
        });

        console.log(`📋 [批量处理] 处理进度: ${currentIndex}/${total} - 车牌号: ${plate}`);

        try {
          // 调用 process-vehicles-batch Edge Function（添加车辆并同步ID，优化版）
          const response = await fetch(`${supabaseUrl}/functions/v1/process-vehicles-batch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken || supabaseAnonKey}`,
              'apikey': supabaseAnonKey
            },
            body: JSON.stringify({
              licensePlate: plate.trim(),
              loadWeight: addAndSyncLoadWeight.trim() || '0',
              syncId: true // 启用ID同步
            })
          });

          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
              const errorBody = await response.json();
              errorMessage = errorBody.message || errorBody.error || errorMessage;
            } catch (e) {
              // 如果响应不是 JSON，使用默认错误信息
            }
            
            // 🔴 记录错误日志，但继续处理下一个
            console.error(`❌ [批量处理] [${currentIndex}/${total}] ${plate} - 处理失败:`, errorMessage);
            
            results.push({
              licensePlate: plate.trim(),
              success: false,
              addStatus: 'failed',
              syncIdStatus: 'skipped',
              message: errorMessage,
              error: errorMessage
            });
            
            continue; // 跳过当前项，继续处理下一个
          }

          const data = await response.json();

          // 新函数返回的是批量结果格式，取第一个结果
          if (data?.results && Array.isArray(data.results) && data.results.length > 0) {
            const result = data.results[0];
            if (result.success) {
              console.log(`✅ [批量处理] [${currentIndex}/${total}] ${plate} - 处理成功`);
              results.push({
                licensePlate: plate.trim(),
                success: true,
                addStatus: result.addStatus || 'created',
                syncIdStatus: result.syncIdStatus || 'synced',
                message: result.message || '处理成功'
              });
            } else {
              // 🔴 记录错误日志，但继续处理下一个
              const errorMessage = result.message || '处理失败';
              console.error(`❌ [批量处理] [${currentIndex}/${total}] ${plate} - 处理失败:`, errorMessage);
              
              results.push({
                licensePlate: plate.trim(),
                success: false,
                addStatus: result.addStatus || 'failed',
                syncIdStatus: result.syncIdStatus || 'skipped',
                message: errorMessage,
                error: errorMessage
              });
            }
          } else {
            // 🔴 记录错误日志，但继续处理下一个
            const errorMessage = data?.message || '处理失败：返回格式异常';
            console.error(`❌ [批量处理] [${currentIndex}/${total}] ${plate} - 处理失败:`, errorMessage);
            
            results.push({
              licensePlate: plate.trim(),
              success: false,
              addStatus: 'failed',
              syncIdStatus: 'skipped',
              message: errorMessage,
              error: errorMessage
            });
          }
        } catch (error) {
          // 🔴 遇到异常：记录日志，跳过当前项，继续执行下一个
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`❌ [批量处理] [${currentIndex}/${total}] ${plate} - 发生异常:`, {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
          });

          results.push({
            licensePlate: plate.trim(),
            success: false,
            addStatus: 'error',
            syncIdStatus: 'skipped',
            message: `处理异常: ${errorMessage}`,
            error: errorMessage
          });
        }
      }

      // 最终更新进度
      setBatchProgress({
        current: platesToProcess.length,
        total: platesToProcess.length,
        results: results
      });

      // 统计结果
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.length - successCount;

      console.log(`📊 [批量处理] 处理完成 - 总数: ${platesToProcess.length}, 成功: ${successCount}, 失败: ${failedCount}`);

      // 显示结果
      toast({
        title: failedCount === 0 ? "批量处理完成" : "批量处理部分完成",
        description: `共处理 ${platesToProcess.length} 个车辆，成功 ${successCount} 个，失败 ${failedCount} 个`,
        variant: failedCount === 0 ? 'default' : 'destructive',
        duration: 10000 // 延长显示时间
      });

      // 清空表单并关闭对话框
      setBatchInputText('');
      setBatchInputDialogOpen(false);
      setAddAndSyncDialogOpen(false);
      setAddAndSyncLicensePlate('');
      setAddAndSyncLoadWeight('0');

    } catch (error) {
      console.error('批量处理失败:', error);
      
      // 显示详细的错误信息
      let errorMessage = '未知错误，请稍后重试';
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('错误详情:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: "批量处理失败",
        description: errorMessage,
        variant: "destructive",
        duration: 10000 // 延长显示时间到10秒
      });
      
      // 错误时不关闭对话框，让用户看到错误信息
      // 不清空输入，方便用户修改后重试
    } finally {
      setBatchProcessing(false);
      // 延迟清除进度，让用户看到结果（如果有进度的话）
      if (batchProgress) {
        setTimeout(() => {
          setBatchProgress(null);
        }, 5000);
      }
    }
  };

  // 刷新 Token
  const handleRefreshToken = async (type: 'add' | 'query') => {
    setRefreshingToken(true);
    setTokenType(type);
    
    try {
      toast({
        title: "正在刷新 Token",
        description: `正在获取 ${type === 'add' ? '添加车辆' : '查询车辆'} Token...`,
      });

      const { data, error } = await supabase.functions.invoke('get-tracking-token', {
        body: { type }
      });

      if (error) {
        console.error('刷新 Token 失败:', error);
        throw new Error(error.message || '刷新 Token 失败');
      }

      if (!data?.success || !data?.token) {
        throw new Error(data?.error || data?.message || '获取 Token 失败');
      }

      toast({
        title: "Token 刷新成功",
        description: `已成功获取 ${type === 'add' ? '添加车辆' : '查询车辆'} Token 并保存到数据库缓存。Token 有效期：${data.expiresIn ? Math.floor(data.expiresIn / 60) : '未知'}分钟`,
      });

      // 将 Token 复制到剪贴板（如果浏览器支持）
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(data.token);
          toast({
            title: "Token 已复制",
            description: "Token 已复制到剪贴板",
          });
        } catch (e) {
          console.error('复制到剪贴板失败:', e);
        }
      }

    } catch (error) {
      console.error('刷新 Token 失败:', error);
      toast({
        title: "刷新 Token 失败",
        description: error instanceof Error ? error.message : '未知错误，请稍后重试',
        variant: "destructive"
      });
    } finally {
      setRefreshingToken(false);
    }
  };

  // 同时刷新所有 Token（添加和查询）
  const handleRefreshAllTokens = async () => {
    setRefreshingAllTokens(true);
    
    try {
      toast({
        title: "正在刷新所有 Token",
        description: "正在获取添加车辆和查询车辆的 Token...",
      });

      // 并行获取两种 Token
      const [addResult, queryResult] = await Promise.allSettled([
        supabase.functions.invoke('get-tracking-token', {
          body: { type: 'add' }
        }),
        supabase.functions.invoke('get-tracking-token', {
          body: { type: 'query' }
        })
      ]);

      const results: Array<{ type: string; success: boolean; message: string }> = [];

      // 处理添加车辆 Token
      if (addResult.status === 'fulfilled' && addResult.value.data?.success) {
        results.push({
          type: '添加车辆',
          success: true,
          message: `Token 已获取并保存到数据库（有效期：${addResult.value.data.expiresIn ? Math.floor(addResult.value.data.expiresIn / 60) : '未知'}分钟）`
        });
      } else {
        const error = addResult.status === 'fulfilled' 
          ? addResult.value.error?.message || addResult.value.data?.error || '获取失败'
          : addResult.reason?.message || '请求失败';
        results.push({
          type: '添加车辆',
          success: false,
          message: error
        });
      }

      // 处理查询车辆 Token
      if (queryResult.status === 'fulfilled' && queryResult.value.data?.success) {
        results.push({
          type: '查询车辆',
          success: true,
          message: `Token 已获取并保存到数据库（有效期：${queryResult.value.data.expiresIn ? Math.floor(queryResult.value.data.expiresIn / 60) : '未知'}分钟）`
        });
      } else {
        const error = queryResult.status === 'fulfilled'
          ? queryResult.value.error?.message || queryResult.value.data?.error || '获取失败'
          : queryResult.reason?.message || '请求失败';
        results.push({
          type: '查询车辆',
          success: false,
          message: error
        });
      }

      // 显示结果
      const successCount = results.filter(r => r.success).length;
      const allSuccess = successCount === 2;

      if (allSuccess) {
        toast({
          title: "所有 Token 刷新成功",
          description: "添加车辆和查询车辆的 Token 已成功获取并保存到数据库缓存",
        });
      } else if (successCount === 1) {
        const failed = results.find(r => !r.success);
        toast({
          title: "部分 Token 刷新成功",
          description: `${failed?.type} Token 刷新失败：${failed?.message}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Token 刷新失败",
          description: `添加车辆：${results[0].message}；查询车辆：${results[1].message}`,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('刷新所有 Token 失败:', error);
      toast({
        title: "刷新 Token 失败",
        description: error instanceof Error ? error.message : '未知错误，请稍后重试',
        variant: "destructive"
      });
    } finally {
      setRefreshingAllTokens(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tracking">
            <Route className="h-4 w-4 mr-2" />
            轨迹查询
          </TabsTrigger>
          <TabsTrigger value="sync">
            <Plus className="h-4 w-4 mr-2" />
            车辆进轨迹查询库
          </TabsTrigger>
        </TabsList>
        
        {/* Token 刷新按钮 */}
        <div className="flex gap-2 mb-4 items-center">
          <Button
            variant="default"
            size="sm"
            onClick={handleRefreshAllTokens}
            disabled={refreshingToken || refreshingAllTokens}
            className="text-xs"
          >
            {refreshingAllTokens ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                刷新中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-3 w-3" />
                刷新所有Token
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">|</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRefreshToken('add')}
            disabled={refreshingToken || refreshingAllTokens}
            className="text-xs"
          >
            {refreshingToken && tokenType === 'add' ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                刷新中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-3 w-3" />
                刷新添加Token
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRefreshToken('query')}
            disabled={refreshingToken || refreshingAllTokens}
            className="text-xs"
          >
            {refreshingToken && tokenType === 'query' ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                刷新中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-3 w-3" />
                刷新查询Token
              </>
            )}
          </Button>
        </div>

        {/* 轨迹查询标签页 */}
        <TabsContent value="tracking" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">车辆轨迹查询</h1>
          <p className="text-muted-foreground mt-2">
            根据车牌号和时间范围查询车辆的行驶轨迹
          </p>
        </div>
        <Button
          onClick={handleSyncVehicleIds}
          disabled={syncing}
          variant="outline"
          className="flex items-center gap-2"
        >
          {syncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              同步中...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              同步车辆ID
            </>
          )}
        </Button>
      </div>

      {/* 查询条件卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            查询条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 查询模式切换 */}
          <div className="mb-4 flex gap-2">
            <Button
              type="button"
              variant={!useVehicleId ? "default" : "outline"}
              size="sm"
              onClick={() => setUseVehicleId(false)}
            >
              车牌号查询
            </Button>
            <Button
              type="button"
              variant={useVehicleId ? "default" : "outline"}
              size="sm"
              onClick={() => setUseVehicleId(true)}
            >
              车辆ID查询
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {!useVehicleId ? (
              <div className="space-y-2">
                <Label htmlFor="licensePlate" className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  车牌号
                </Label>
                <Input
                  id="licensePlate"
                  placeholder="请输入车牌号"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  提示：如果未找到对应车辆ID，请使用"车辆ID查询"模式
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="vehicleId" className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  车辆ID
                </Label>
                <Input
                  id="vehicleId"
                  placeholder="请输入车辆ID（格式：#26:10037）"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  格式示例：#26:10037
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="startDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                开始日期
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                结束日期
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            {loading ? (
              <Button 
                onClick={handleCancelSearch} 
                variant="destructive"
                className="min-w-[120px]"
              >
                <X className="mr-2 h-4 w-4" />
                取消查询
              </Button>
            ) : (
              <Button 
                onClick={handleSearch} 
                className="min-w-[120px]"
              >
                <Search className="mr-2 h-4 w-4" />
                查询
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 轨迹显示区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            轨迹信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
                <p className="text-muted-foreground">正在查询轨迹数据...</p>
              </div>
            </div>
          ) : trackingData ? (
            <div className="space-y-4">
              {/* 地图显示 */}
              {(() => {
                console.log('📊 VehicleTracking 准备渲染 VehicleTrackingMap');
                console.log('📊 trackingData:', trackingData);
                console.log('📊 trackingData 类型:', typeof trackingData);
                console.log('📊 trackingData 是否为数组:', Array.isArray(trackingData));
                console.log('📊 loading:', loading);
                return null;
              })()}
              <VehicleTrackingMap 
                trackingData={trackingData} 
                licensePlate={useVehicleId ? undefined : licensePlate}
                loading={loading}
              />
              
              {/* 轨迹数据详情（可折叠） */}
              <details className="bg-gray-50 rounded-lg p-4">
                <summary className="font-semibold mb-2 cursor-pointer hover:text-blue-600">
                  查看原始数据
                </summary>
                <pre className="text-xs overflow-auto max-h-96 bg-white p-3 rounded border mt-2">
                  {JSON.stringify(trackingData, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>请输入查询条件并点击查询按钮</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* 车辆进轨迹查询库标签页 */}
        <TabsContent value="sync" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                添加车辆到轨迹查询库
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>说明：</strong>将车辆信息同步到 ZKZY 平台，使其可以在轨迹查询中使用。
                  车辆将被添加到轨迹查询库，包括车牌号和核定载质量等信息。
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="syncLicensePlate" className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    车牌号 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="syncLicensePlate"
                    placeholder="请输入车牌号（例如：冀EX9795）"
                    value={syncLicensePlate}
                    onChange={(e) => setSyncLicensePlate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSyncVehicle();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    格式示例：冀EX9795、京A12345
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="syncLoadWeight" className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    核定载质量（吨）
                  </Label>
                  <Input
                    id="syncLoadWeight"
                    type="number"
                    placeholder="请输入核定载质量（默认：0）"
                    value={syncLoadWeight}
                    onChange={(e) => setSyncLoadWeight(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-muted-foreground">
                    可选，默认为 0
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                {syncLoading ? (
                  <Button
                    onClick={handleCancelSyncVehicle}
                    variant="destructive"
                    className="min-w-[120px]"
                  >
                    <X className="mr-2 h-4 w-4" />
                    取消同步
                  </Button>
                ) : (
                  <Button
                    onClick={handleSyncVehicle}
                    disabled={!syncLicensePlate.trim()}
                    className="min-w-[120px]"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    添加车辆
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 查询ID并同步到数据库 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                查询ID并同步到数据库
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>说明：</strong>从第三方平台查询车辆ID，并将车牌号和ID同步到本地数据库（vehicles表）。
                  如果车辆已存在则更新，不存在则插入新记录。
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="syncIdLicensePlate" className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    车牌号 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="syncIdLicensePlate"
                    placeholder="请输入车牌号（例如：冀EX9795）"
                    value={syncIdLicensePlate}
                    onChange={(e) => setSyncIdLicensePlate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSyncVehicleId();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    格式示例：冀EX9795、京A12345
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                {syncIdLoading ? (
                  <Button
                    onClick={handleCancelSyncVehicleId}
                    variant="destructive"
                    className="min-w-[120px]"
                  >
                    <X className="mr-2 h-4 w-4" />
                    取消查询
                  </Button>
                ) : (
                  <Button
                    onClick={handleSyncVehicleId}
                    disabled={!syncIdLicensePlate.trim()}
                    className="min-w-[120px]"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    查询并同步
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 新增查询入库按钮 */}
          <Card>
            <CardContent className="pt-6">
              <Button
                onClick={() => setAddAndSyncDialogOpen(true)}
                className="w-full"
                size="lg"
              >
                <Database className="mr-2 h-5 w-5" />
                新增查询入库
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                一键完成：添加车辆到第三方平台 → 查询ID → 同步到数据库
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 新增查询入库对话框 */}
      <Dialog open={addAndSyncDialogOpen} onOpenChange={setAddAndSyncDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              新增查询入库
            </DialogTitle>
            <DialogDescription>
              自动完成以下步骤：
              <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                <li>将车辆添加到第三方平台（ZKZY）</li>
                <li>查询车辆的轨迹ID</li>
                <li>将车牌号和ID同步到本地数据库（vehicle_tracking_id_mappings表）</li>
              </ol>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="addAndSyncLicensePlate" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                车牌号 <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="addAndSyncLicensePlate"
                  placeholder="请输入车牌号（例如：冀EX9795）"
                  value={addAndSyncLicensePlate}
                  onChange={(e) => {
                    const value = e.target.value;
                    // 检测是否包含多个车牌号的分隔符（空格、逗号、换行等）
                    const separators = /[\s,，\n\r]+/;
                    if (separators.test(value)) {
                      // 如果包含分隔符，只保留第一个车牌号
                      const firstPlate = value.split(separators)[0].trim();
                      setAddAndSyncLicensePlate(firstPlate);
                      // 提示用户使用批量输入功能
                      toast({
                        title: "提示",
                        description: "检测到多个车牌号，已自动保留第一个。如需批量输入，请点击右侧批量输入按钮。",
                        duration: 3000,
                      });
                    } else {
                      setAddAndSyncLicensePlate(value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !addAndSyncLoading) {
                      handleAddAndSync();
                    }
                  }}
                  disabled={addAndSyncLoading}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setBatchInputDialogOpen(true)}
                  disabled={addAndSyncLoading}
                  title="批量输入"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                格式示例：冀EX9795、京A12345（仅支持单个车牌号，批量输入请点击右侧按钮）
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addAndSyncLoadWeight" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                核定载质量（吨）
              </Label>
              <Input
                id="addAndSyncLoadWeight"
                type="number"
                placeholder="请输入核定载质量（默认：0）"
                value={addAndSyncLoadWeight}
                onChange={(e) => setAddAndSyncLoadWeight(e.target.value)}
                min="0"
                step="0.01"
                disabled={addAndSyncLoading}
              />
              <p className="text-xs text-muted-foreground">
                可选，默认为 0
              </p>
            </div>
          </div>

          <DialogFooter>
            {addAndSyncLoading ? (
              <Button
                variant="destructive"
                onClick={handleCancelAddAndSync}
                className="w-full"
              >
                <X className="mr-2 h-4 w-4" />
                取消处理
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddAndSyncDialogOpen(false);
                    setAddAndSyncLicensePlate('');
                    setAddAndSyncLoadWeight('0');
                  }}
                >
                  关闭
                </Button>
                <Button
                  onClick={handleAddAndSync}
                  disabled={!addAndSyncLicensePlate.trim()}
                >
                  <Database className="mr-2 h-4 w-4" />
                  开始处理
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量输入对话框 */}
      <Dialog open={batchInputDialogOpen} onOpenChange={setBatchInputDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              批量输入车牌号
            </DialogTitle>
            <DialogDescription>
              支持使用空格、逗号或换行分隔多个车牌号
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batchInputText">
                车牌号列表 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="batchInputText"
                placeholder="请输入车牌号，支持以下格式：&#10;冀EX9795 京A12345 沪B67890&#10;或&#10;冀EX9795,京A12345,沪B67890&#10;或每行一个车牌号"
                value={batchInputText}
                onChange={(e) => setBatchInputText(e.target.value)}
                disabled={batchProcessing}
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                已输入 {parseBatchLicensePlates(batchInputText).length} 个车牌号
              </p>
            </div>

            {batchProgress && (
              <div className="space-y-2 border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center justify-between text-sm">
                  <span>处理进度</span>
                  <span>{batchProgress.current} / {batchProgress.total}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
                {batchProgress.results.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                    {batchProgress.results.map((result, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded ${
                          result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        <span className="font-medium">{result.licensePlate}:</span> {result.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            {batchProcessing ? (
              <Button
                variant="destructive"
                onClick={() => {
                  setBatchProcessing(false);
                  setBatchProgress(null);
                }}
                className="w-full"
              >
                <X className="mr-2 h-4 w-4" />
                停止处理
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBatchInputDialogOpen(false);
                    setBatchInputText('');
                    setBatchProgress(null);
                  }}
                >
                  关闭
                </Button>
                <Button
                  onClick={handleBatchAddAndSync}
                  disabled={!batchInputText.trim() || parseBatchLicensePlates(batchInputText).length === 0}
                >
                  <Database className="mr-2 h-4 w-4" />
                  批量开始处理 ({parseBatchLicensePlates(batchInputText).length})
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


