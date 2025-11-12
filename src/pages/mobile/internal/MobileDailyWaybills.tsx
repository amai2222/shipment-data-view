// 移动端 - 每日运单（车队长）

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import {
  Calendar,
  Truck,
  RefreshCw,
  Loader2,
  FileText,
  DollarSign,
  Weight,
  User,
  MapPin
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { convertChinaDateToUTCDate } from '@/utils/dateUtils';

interface Waybill {
  id: string;
  auto_number: string;
  driver_name: string;
  license_plate: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  loading_weight: number | null;
  payable_cost: number | null;
  payment_status: string;
  transport_type: string;
  project_name: string;
}

export default function MobileDailyWaybills() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [waybills, setWaybills] = useState<Waybill[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [vehicles, setVehicles] = useState<string[]>([]);

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadWaybills();
    }
  }, [selectedDate, vehicleFilter]);

  const loadVehicles = async () => {
    try {
      // 只加载当前车队长管理的车辆
      const { data } = await supabase
        .from('internal_vehicles')
        .select('license_plate')
        .eq('fleet_manager_id', user?.id || '')
        .eq('is_active', true)
        .order('license_plate');

      setVehicles((data || []).map(v => v.license_plate));
    } catch (error: any) {
      console.error('加载车辆列表失败:', error);
    }
  };

  const loadWaybills = async () => {
    setLoading(true);
    try {
      // 获取当前车队长管理的司机
      const { data: managedDrivers, error: driverError } = await supabase
        .from('internal_drivers')
        .select('id, name')
        .eq('fleet_manager_id', user?.id || '');

      if (driverError) throw driverError;

      const managedDriverIds = (managedDrivers || []).map(d => d.id);
      const managedDriverNames = (managedDrivers || []).map(d => d.name);

      if (managedDriverIds.length === 0) {
        setWaybills([]);
        return;
      }

      // 将中国时区的日期转换为 UTC 日期范围
      const chinaDateStart = new Date(`${selectedDate}T00:00:00+08:00`);
      const chinaDateEnd = new Date(`${selectedDate}T23:59:59+08:00`);
      const utcDateStart = chinaDateStart.toISOString();
      const utcDateEnd = chinaDateEnd.toISOString();
      
      let query = supabase
        .from('logistics_records')
        .select('*')
        .in('driver_id', managedDriverIds)
        .gte('loading_date', utcDateStart)
        .lte('loading_date', utcDateEnd)
        .order('auto_number');

      if (vehicleFilter !== 'all' && vehicles.length > 0) {
        query = query.eq('license_plate', vehicleFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setWaybills(data || []);

    } catch (error: any) {
      console.error('加载运单失败:', error);
      toast({
        title: '加载失败',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: waybills.length,
    totalWeight: waybills.reduce((sum, w) => sum + (w.loading_weight || 0), 0),
    totalIncome: waybills.reduce((sum, w) => sum + (w.payable_cost || 0), 0),
    completed: waybills.filter(w => w.payment_status === 'Paid').length
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid':
        return <Badge className="bg-green-100 text-green-800">已支付</Badge>;
      case 'Processing':
        return <Badge className="bg-yellow-100 text-yellow-800">处理中</Badge>;
      case 'Unpaid':
        return <Badge className="bg-red-100 text-red-800">未支付</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <MobileLayout title="每日运单" showBack={true}>
      <div className="space-y-4 pb-20">
        {/* 筛选条件 */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">选择日期</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            {vehicles.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">车辆筛选</label>
                <select
                  value={vehicleFilter}
                  onChange={(e) => setVehicleFilter(e.target.value)}
                  className="w-full h-10 px-3 border rounded-md"
                >
                  <option value="all">全部车辆</option>
                  {vehicles.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={loadWaybills}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </CardContent>
        </Card>

        {/* 统计数据 */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground mt-1">运单总数</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                ¥{stats.totalIncome.toFixed(0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">总收入</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{stats.totalWeight.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground mt-1">总吨数</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
              <div className="text-xs text-muted-foreground mt-1">已完成</div>
            </CardContent>
          </Card>
        </div>

        {/* 运单列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : waybills.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              暂无运单数据
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {waybills.map(waybill => (
              <Card
                key={waybill.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/m/internal/waybill/${waybill.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="font-semibold">{waybill.auto_number}</span>
                        {getPaymentStatusBadge(waybill.payment_status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {waybill.project_name}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{waybill.driver_name}</span>
                      <Truck className="h-4 w-4 text-muted-foreground ml-2" />
                      <span>{waybill.license_plate}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">
                        {waybill.loading_location} → {waybill.unloading_location}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Weight className="h-4 w-4 text-muted-foreground" />
                        <span>{waybill.loading_weight?.toFixed(2) || '0'}吨</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="font-semibold text-green-600">
                          ¥{waybill.payable_cost?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}

