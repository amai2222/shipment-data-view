// PC端 - 每日运单查看（内部车辆）
// 功能：按日期查看内部车辆的运单记录

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { PageHeader } from '@/components/PageHeader';
import {
  Calendar,
  Search,
  RefreshCw,
  Truck,
  Download
} from 'lucide-react';
import { format } from 'date-fns';

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
}

export default function InternalDailyWaybills() {
  const { toast } = useToast();
  
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
      const { data } = await supabase
        .from('internal_vehicles')
        .select('license_plate')
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
      // 第一步：获取所有内部司机的 driver_id
      const { data: internalDrivers, error: driversError } = await supabase
        .from('drivers')
        .select('id')
        .eq('driver_type', 'internal');

      if (driversError) throw driversError;

      const internalDriverIds = (internalDrivers || []).map(d => d.id);

      if (internalDriverIds.length === 0) {
        setWaybills([]);
        return;
      }

      // 第二步：查询这些内部司机的运单
      // 注意：loading_date 是 timestamp with time zone，需要转换为 DATE 进行比较
      // 使用 gte 和 lt 来匹配当天的所有记录
      // 将中国时区的日期转换为 UTC 日期范围
      const chinaDateStart = new Date(`${selectedDate}T00:00:00+08:00`);
      const chinaDateEnd = new Date(`${selectedDate}T23:59:59+08:00`);
      const utcDateStart = chinaDateStart.toISOString();
      const utcDateEnd = chinaDateEnd.toISOString();
      
      let query = supabase
        .from('logistics_records')
        .select('*')
        .in('driver_id', internalDriverIds)  // 只显示内部司机的运单
        .gte('loading_date', utcDateStart)
        .lte('loading_date', utcDateEnd)
        .order('auto_number');

      // 如果选择了特定车辆，再过滤车牌号
      if (vehicleFilter !== 'all' && vehicles.length > 0) {
        query = query.eq('license_plate', vehicleFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setWaybills(data || []);

    } catch (error: any) {
      console.error('加载运单失败:', error);
      toast({ title: '加载失败', description: error.message, variant: 'destructive' });
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

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="每日运单"
        description="查看内部车辆的每日运单记录"
        icon={Calendar}
        iconColor="text-blue-600"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">运单总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">总吨数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWeight.toFixed(1)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">总收入</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ¥{stats.totalIncome.toFixed(0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">已完成</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>筛选条件</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadWaybills} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>日期</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>

            <div>
              <Label>车辆筛选</Label>
              <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部车辆</SelectItem>
                  {vehicles.map(plate => (
                    <SelectItem key={plate} value={plate}>
                      {plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>运单列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>运单号</TableHead>
                  <TableHead>司机</TableHead>
                  <TableHead>车牌</TableHead>
                  <TableHead>线路</TableHead>
                  <TableHead className="text-right">重量</TableHead>
                  <TableHead className="text-right">收入</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : waybills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      当天暂无运单记录
                    </TableCell>
                  </TableRow>
                ) : (
                  waybills.map(w => (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono">{w.auto_number}</TableCell>
                      <TableCell>{w.driver_name}</TableCell>
                      <TableCell className="font-mono">{w.license_plate}</TableCell>
                      <TableCell className="text-sm">
                        {w.loading_location} → {w.unloading_location}
                      </TableCell>
                      <TableCell className="text-right">
                        {w.loading_weight ? `${w.loading_weight}吨` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {w.payable_cost ? `¥${w.payable_cost.toFixed(0)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {w.payment_status === 'Paid' ? (
                          <Badge className="bg-green-100 text-green-800">已完成</Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800">进行中</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

