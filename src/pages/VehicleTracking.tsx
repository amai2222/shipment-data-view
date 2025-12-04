// 车辆轨迹查询页面
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { Search, MapPin, Calendar, Truck, Route, Loader2, RefreshCw, Plus, Database } from 'lucide-react';
import { VehicleTrackingMap } from '@/components/VehicleTrackingMap';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

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

  // 根据车牌号查询车辆ID（如果有映射）
  const getVehicleIdByLicensePlate = async (plate: string): Promise<string | null> => {
    try {
      // 查询车辆轨迹ID映射表
      const { data, error } = await supabase
        .from('vehicle_tracking_id_mappings')
        .select('license_plate, external_tracking_id')
        .eq('license_plate', plate.trim())
        .single();

      if (error || !data) {
        return null;
      }

      // 返回外部车辆ID
      return data.external_tracking_id || null;
    } catch (error) {
      console.error('查询车辆ID失败:', error);
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

      // 调用Supabase Edge Function代理API
      // Edge Function 会根据 vehicleId 格式自动判断使用 'id' 还是 'serialno'
      const { data, error } = await supabase.functions.invoke('vehicle-tracking', {
        body: {
          vehicleId: finalVehicleId,
          // 可选：明确指定 field，如果不指定，Edge Function 会根据 vehicleId 格式自动判断
          field: useVehicleId ? 'id' : 'serialno',
          startTime: startTime,
          endTime: endTime
        }
      });

      if (error) {
        console.error('Edge Function 调用错误详情:', {
          error,
          message: error.message,
          context: error.context,
          status: error.status
        });
        
        // 尝试从 context 中获取更详细的错误信息
        let errorDetails = error.message || 'Edge Function returned a non-2xx status code';
        
        // 如果 context 是 Response 对象，尝试读取错误响应体
        if (error.context && error.context instanceof Response) {
          try {
            const errorBody = await error.context.clone().json();
            if (errorBody && errorBody.error) {
              errorDetails = errorBody.error;
              if (errorBody.details) {
                console.error('Edge Function 错误详情:', errorBody.details);
              }
            }
          } catch (e) {
            console.error('无法解析错误响应体:', e);
          }
        }
        
        throw new Error(`API调用失败: ${errorDetails}`);
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
      console.error('查询车辆轨迹失败:', error);
      toast({
        title: "查询失败",
        description: error instanceof Error ? error.message : '无法查询车辆轨迹',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
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
      const { data, error } = await supabase.functions.invoke('sync-vehicle', {
        body: {
          licensePlate: syncLicensePlate.trim(),
          loadWeight: syncLoadWeight.trim() || '0'
        }
      });

      // 🔴 改进错误处理：从 error 对象中提取响应体信息
      if (error) {
        console.error('调用 Edge Function 失败:', error);
        console.error('错误类型:', error.constructor.name);
        console.error('错误消息:', error.message);
        console.error('错误状态码:', (error as { status?: number }).status);
        console.error('错误详情 (context):', error.context);
        
        // 尝试从 error 对象中提取详细信息
        let errorMessage = error.message || '同步失败';
        
        // 方法1：尝试从 error.context.body 提取（字符串或对象）
        if (error.context?.body) {
          try {
            const errorBody = typeof error.context.body === 'string' 
              ? JSON.parse(error.context.body) 
              : error.context.body;
            errorMessage = errorBody.message || errorBody.error || errorBody.details || errorMessage;
            console.error('从 error.context.body 提取的错误信息:', errorMessage);
          } catch (e) {
            console.error('解析 error.context.body 失败:', e);
          }
        }
        
        // 方法2：如果 error.context 是 Response 对象，尝试读取
        if (error.context && typeof (error.context as Response).json === 'function') {
          try {
            const response = error.context as Response;
            const errorBody = await response.clone().json();
            errorMessage = errorBody.message || errorBody.error || errorBody.details || errorMessage;
            console.error('从 Response.json() 提取的错误信息:', errorMessage);
            console.error('完整错误响应体:', errorBody);
          } catch (e) {
            console.error('解析 Response.json() 失败:', e);
            // 如果 JSON 解析失败，尝试读取文本
            try {
              const response = error.context as Response;
              const text = await response.clone().text();
              console.error('错误响应文本:', text);
              if (text) {
                errorMessage = text;
              }
            } catch (textError) {
              console.error('读取错误响应文本失败:', textError);
            }
          }
        }
        
        // 方法3：检查 error 对象本身是否有额外的错误信息
        const errorAny = error as { message?: string; error?: string; details?: string };
        if (errorAny.error) {
          errorMessage = errorAny.error;
        } else if (errorAny.details) {
          errorMessage = errorAny.details;
        }
        
        throw new Error(errorMessage);
      }

      if (data?.success) {
        // 根据状态显示不同的提示信息
        const statusMessage = data.status === 'existed' 
          ? `车辆 ${syncLicensePlate} 已存在于轨迹查询库`
          : `车辆 ${syncLicensePlate} 已成功添加到轨迹查询库`;
        
        toast({
          title: data.status === 'existed' ? "车辆已存在" : "同步成功",
          description: statusMessage,
          variant: data.status === 'existed' ? 'default' : 'default'
        });
        // 清空表单
        setSyncLicensePlate('');
        setSyncLoadWeight('0');
      } else {
        throw new Error(data?.message || '同步失败');
      }
    } catch (error) {
      console.error('同步车辆失败:', error);
      toast({
        title: "同步失败",
        description: error instanceof Error ? error.message : '未知错误，请稍后重试',
        variant: "destructive"
      });
    } finally {
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
      // 🔴 使用合并后的 Edge Function，使用 onlySyncId 模式只查询ID（不添加车辆）
      const { data, error } = await supabase.functions.invoke('sync-vehicle', {
        body: {
          licensePlate: syncIdLicensePlate.trim(),
          onlySyncId: true // 只查询ID，不添加车辆
        }
      });

      // 🔴 改进错误处理：从 error 对象中提取响应体信息
      if (error) {
        console.error('调用 Edge Function 失败:', error);
        console.error('错误详情:', error.context);
        
        let errorMessage = error.message || '同步失败';
        if (error.context?.body) {
          try {
            const errorBody = typeof error.context.body === 'string' 
              ? JSON.parse(error.context.body) 
              : error.context.body;
            errorMessage = errorBody.message || errorBody.error || errorBody.details || errorMessage;
          } catch (e) {
            console.error('解析错误响应失败:', e);
          }
        } else if (error.context && typeof error.context.json === 'function') {
          try {
            const errorBody = await error.context.json();
            errorMessage = errorBody.message || errorBody.error || errorMessage;
          } catch (e) {
            // 如果无法解析响应体，使用默认错误信息
          }
        }
        throw new Error(errorMessage);
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
      console.error('查询ID并同步失败:', error);
      toast({
        title: "同步失败",
        description: error instanceof Error ? error.message : '未知错误，请稍后重试',
        variant: "destructive"
      });
    } finally {
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
      // 🔴 合并后的单次调用：添加车辆并同步ID
      toast({
        title: "正在处理",
        description: `正在将车辆 ${addAndSyncLicensePlate} 添加到第三方平台并同步ID...`,
      });

      const { data: result, error: resultError } = await supabase.functions.invoke('sync-vehicle', {
        body: {
          licensePlate: addAndSyncLicensePlate.trim(),
          loadWeight: addAndSyncLoadWeight.trim() || '0',
          syncId: true // 🔴 关键：启用ID同步
        }
      });

      // 🔴 改进错误处理：从 error 对象中提取响应体信息
      if (resultError) {
        console.error('调用 Edge Function 失败:', resultError);
        console.error('错误详情:', resultError.context);
        
        let errorMessage = resultError.message || '处理失败';
        if (resultError.context?.body) {
          try {
            const errorBody = typeof resultError.context.body === 'string' 
              ? JSON.parse(resultError.context.body) 
              : resultError.context.body;
            errorMessage = errorBody.message || errorBody.error || errorBody.details || errorMessage;
          } catch (e) {
            console.error('解析错误响应失败:', e);
          }
        } else if (resultError.context && typeof resultError.context.json === 'function') {
          try {
            const errorBody = await resultError.context.json();
            errorMessage = errorBody.message || errorBody.error || errorMessage;
          } catch (e) {
            // 如果无法解析响应体，使用默认错误信息
          }
        }
        throw new Error(errorMessage);
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
      console.error('新增查询入库失败:', error);
      toast({
        title: "操作失败",
        description: error instanceof Error ? error.message : '未知错误，请稍后重试',
        variant: "destructive"
      });
    } finally {
      setAddAndSyncLoading(false);
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
            <Button 
              onClick={handleSearch} 
              disabled={loading}
              className="min-w-[120px]"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  查询中...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  查询
                </>
              )}
            </Button>
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
                <Button
                  onClick={handleSyncVehicle}
                  disabled={syncLoading || !syncLicensePlate.trim()}
                  className="min-w-[120px]"
                >
                  {syncLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      同步中...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      添加车辆
                    </>
                  )}
                </Button>
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
                <Button
                  onClick={handleSyncVehicleId}
                  disabled={syncIdLoading || !syncIdLicensePlate.trim()}
                  className="min-w-[120px]"
                >
                  {syncIdLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      查询中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      查询并同步
                    </>
                  )}
                </Button>
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
              <Input
                id="addAndSyncLicensePlate"
                placeholder="请输入车牌号（例如：冀EX9795）"
                value={addAndSyncLicensePlate}
                onChange={(e) => setAddAndSyncLicensePlate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !addAndSyncLoading) {
                    handleAddAndSync();
                  }
                }}
                disabled={addAndSyncLoading}
              />
              <p className="text-xs text-muted-foreground">
                格式示例：冀EX9795、京A12345
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
            <Button
              variant="outline"
              onClick={() => {
                setAddAndSyncDialogOpen(false);
                setAddAndSyncLicensePlate('');
                setAddAndSyncLoadWeight('0');
              }}
              disabled={addAndSyncLoading}
            >
              取消
            </Button>
            <Button
              onClick={handleAddAndSync}
              disabled={addAndSyncLoading || !addAndSyncLicensePlate.trim()}
            >
              {addAndSyncLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  开始处理
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


