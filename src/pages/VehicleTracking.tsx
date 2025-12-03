// 车辆轨迹查询页面
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { Search, MapPin, Calendar, Truck, Route, Loader2, RefreshCw } from 'lucide-react';
import { VehicleTrackingMap } from '@/components/VehicleTrackingMap';

interface TrackingPoint {
  lat: number;
  lng: number;
  time: number;
  speed?: number;
  direction?: number;
  address?: string;
}

interface TrackingData {
  points?: TrackingPoint[];
  [key: string]: unknown;
}

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
        throw new Error(`同步失败: ${error.message}`);
      }

      if (!data || !data.success) {
        throw new Error(data?.error || '同步失败');
      }

      const { total, synced, errors, error_messages } = data;

      toast({
        title: "同步完成",
        description: `共处理 ${total} 条记录，成功同步 ${synced} 条，失败 ${errors} 条`,
        variant: errors > 0 ? "default" : "default"
      });

      // 如果有错误信息，显示详细信息
      if (errors > 0 && error_messages && error_messages.length > 0) {
        console.warn('同步过程中的错误:', error_messages);
        // 可以选择显示详细的错误信息
        toast({
          title: "部分同步失败",
          description: `失败详情请查看控制台`,
          variant: "default"
        });
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

      // 将日期转换为时间戳（毫秒）
      const startTime = new Date(startDate + 'T00:00:00').getTime();
      const endTime = new Date(endDate + 'T23:59:59').getTime();

      // 调用Supabase Edge Function代理API
      const { data, error } = await supabase.functions.invoke('vehicle-tracking', {
        body: {
          vehicleId: finalVehicleId,
          field: 'serialno',
          startTime: startTime,
          endTime: endTime
        }
      });

      if (error) {
        throw new Error(`API调用失败: ${error.message}`);
      }

      if (!data || !data.success) {
        throw new Error(data?.error || '查询失败');
      }

      setTrackingData(data.data);
      
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

  return (
    <div className="space-y-6 p-6">
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
    </div>
  );
}

