// PC端 - 车辆收支流水（参考操作日志布局）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { PageHeader } from '@/components/PageHeader';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Truck,
  RefreshCw,
  Download,
  Search
} from 'lucide-react';
import { format } from 'date-fns';

interface LedgerRecord {
  id: string;
  vehicle_id: string;
  vehicle_plate: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  month: string;
}

export default function VehicleLedger() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [fleetManagerFilter, setFleetManagerFilter] = useState('all');
  const [vehicles, setVehicles] = useState<{ id: string; license_plate: string }[]>([]);
  const [fleetManagers, setFleetManagers] = useState<{ id: string; full_name: string }[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    loadVehicles();
    loadFleetManagers();
  }, []);

  useEffect(() => {
    loadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle, selectedMonth, fleetManagerFilter]);

  const loadVehicles = async () => {
    const { data } = await supabase
      .from('internal_vehicles')
      .select('id, license_plate')
      .eq('is_active', true)
      .order('license_plate');
    setVehicles(data || []);
  };

  const loadFleetManagers = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'fleet_manager')
        .order('full_name');
      setFleetManagers(data || []);
    } catch (error) {
      console.error('加载车队队长列表失败:', error);
    }
  };

  const loadLedger = async () => {
    setLoading(true);
    try {
      const records: LedgerRecord[] = [];
      
      // ✅ 第一步：获取所有内部车辆的车牌号列表（如果选择了车队队长，只获取该车队长的车辆）
      const vehiclesQuery = supabase
        .from('internal_vehicles')
        .select('license_plate, fleet_manager_id')
        .eq('is_active', true);
      
      const { data: internalVehicles, error: vehiclesError } = await vehiclesQuery;
      
      if (vehiclesError) throw vehiclesError;
      
      // 如果选择了车队队长，需要进一步筛选车辆（通过车辆直接分配或通过司机关联）
      let internalLicensePlates: string[] = [];
      if (fleetManagerFilter !== 'all') {
        // 获取该车队长的车辆（直接分配）
        const directVehicles = (internalVehicles || []).filter(v => v.fleet_manager_id === fleetManagerFilter);
        internalLicensePlates = directVehicles.map(v => v.license_plate);
        
        // 获取该车队长的司机，然后获取这些司机的车辆
        const { data: fleetManagerDrivers } = await supabase
          .from('drivers')
          .select('id')
          .eq('driver_type', 'internal')
          .eq('fleet_manager_id', fleetManagerFilter);
        
        if (fleetManagerDrivers && fleetManagerDrivers.length > 0) {
          const driverIds = fleetManagerDrivers.map(d => d.id);
          const { data: driverVehicles } = await supabase
            .from('internal_driver_vehicle_relations')
            .select('vehicle:internal_vehicles(license_plate)')
            .in('driver_id', driverIds);
          
          const driverVehiclePlates = (driverVehicles || [])
            .map((dv: { vehicle?: { license_plate?: string } }) => dv.vehicle?.license_plate)
            .filter((plate: string | undefined): plate is string => !!plate);
          
          // 合并去重
          internalLicensePlates = [...new Set([...internalLicensePlates, ...driverVehiclePlates])];
        }
      } else {
        internalLicensePlates = (internalVehicles || []).map(v => v.license_plate);
      }
      
      if (internalLicensePlates.length === 0) {
        setRecords([]);
        setLoading(false);
        return;
      }
      
      // ✅ 第二步：获取所有内部司机的 driver_id 和姓名（如果选择了车队队长，只获取该车队长的司机）
      let driversQuery = supabase
        .from('drivers')
        .select('id, name')
        .eq('driver_type', 'internal');
      
      if (fleetManagerFilter !== 'all') {
        driversQuery = driversQuery.eq('fleet_manager_id', fleetManagerFilter);
      }
      
      const { data: internalDrivers, error: driversError } = await driversQuery;
      
      if (driversError) throw driversError;
      
      const internalDriverIds = (internalDrivers || []).map(d => d.id);
      const internalDriverNames = (internalDrivers || []).map(d => d.name);
      
      // ✅ 第三步：获取司机和车辆的关联关系（用于支出记录的车辆关联）
      const { data: driverVehicleRelations, error: relationsError } = await supabase
        .from('internal_driver_vehicle_relations')
        .select(`
          driver:internal_drivers(name),
          vehicle:internal_vehicles(license_plate)
        `)
        .or('valid_until.is.null,valid_until.gt.' + new Date().toISOString().split('T')[0]);
      
      if (relationsError) {
        console.warn('获取司机车辆关联失败:', relationsError);
      }
      
      // 构建司机姓名到车牌号的映射
      const driverNameToPlateMap: Record<string, string> = {};
      (driverVehicleRelations || []).forEach((rel: {
        driver?: { name?: string };
        vehicle?: { license_plate?: string };
      }) => {
        const driverName = rel.driver?.name;
        const licensePlate = rel.vehicle?.license_plate;
        if (driverName && licensePlate) {
          driverNameToPlateMap[driverName] = licensePlate;
        }
      });
      
      // ✅ 1. 查询运费收入（从logistics_records）- 只查询内部车辆的记录
      let incomeQuery = supabase
        .from('logistics_records')
        .select('id, auto_number, loading_date, payable_cost, project_name, license_plate, driver_id')
        .in('license_plate', internalLicensePlates)  // 只查询内部车辆
        .order('loading_date', { ascending: false })
        .limit(1000);
      
      // 如果选择了特定车辆，再过滤车牌号
      if (selectedVehicle !== 'all') {
        const selectedVehicleObj = vehicles.find(v => v.id === selectedVehicle);
        if (selectedVehicleObj) {
          incomeQuery = incomeQuery.eq('license_plate', selectedVehicleObj.license_plate);
        }
      }
      
      const { data: incomeData, error: incomeError } = await incomeQuery;
      
      if (incomeError) throw incomeError;
      
      // 处理收入数据
      (incomeData || []).forEach(item => {
        if (item.payable_cost && item.payable_cost > 0) {
          records.push({
            id: item.id,
            vehicle_id: item.license_plate || '',
            vehicle_plate: item.license_plate || '未知',
            date: item.loading_date,
            type: 'income',
            category: '运费收入',
            amount: item.payable_cost,
            description: `${item.project_name || ''} - ${item.auto_number || ''}`,
            month: item.loading_date.slice(0, 7) // YYYY-MM
          });
        }
      });
      
      // ✅ 2. 查询费用支出（从internal_driver_expense_applications）- 只查询内部司机的记录
      const expenseQuery = supabase
        .from('internal_driver_expense_applications')
        .select('id, expense_date, expense_type, amount, description, driver_name')
        .eq('status', 'approved')
        .in('driver_name', internalDriverNames)  // 只查询内部司机
        .order('expense_date', { ascending: false })
        .limit(1000);
      
      // 注意：月份过滤在客户端进行，以便支持更灵活的查询
      
      const { data: expenseData, error: expenseError } = await expenseQuery;
      
      if (expenseError) throw expenseError;
      
      // 费用类型映射
      const expenseTypeMap: Record<string, string> = {
        fuel: '加油费',
        parking: '停车费',
        toll: '过路费',
        maintenance: '维修费',
        fine: '罚款',
        meal: '餐费',
        accommodation: '住宿费',
        other: '其他'
      };
      
      // 处理支出数据
      (expenseData || []).forEach(item => {
        if (item.amount && item.amount > 0) {
          // 通过司机姓名找到对应的车辆车牌号
          const licensePlate = driverNameToPlateMap[item.driver_name || ''] || item.driver_name || '未知';
          
          // 如果选择了特定车辆，只添加该车辆的支出记录
          if (selectedVehicle !== 'all') {
            const selectedVehicleObj = vehicles.find(v => v.id === selectedVehicle);
            if (selectedVehicleObj && licensePlate !== selectedVehicleObj.license_plate) {
              return; // 跳过不属于选中车辆的支出记录
            }
          }
          
          records.push({
            id: item.id,
            vehicle_id: licensePlate,  // 使用车牌号作为 vehicle_id
            vehicle_plate: licensePlate,
            date: item.expense_date,
            type: 'expense',
            category: expenseTypeMap[item.expense_type] || item.expense_type,
            amount: item.amount,
            description: item.description || '',
            month: item.expense_date.slice(0, 7) // YYYY-MM
          });
        }
      });
      
      // 按日期排序
      records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setRecords(records);
    } catch (error) {
      console.error('加载流水失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载收支流水',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 过滤记录：如果选择了特定车辆，使用车牌号进行匹配
  const filteredRecords = selectedVehicle === 'all' 
    ? records.filter(r => r.month === selectedMonth)  // 只过滤月份
    : (() => {
        const selectedVehicleObj = vehicles.find(v => v.id === selectedVehicle);
        if (!selectedVehicleObj) return records.filter(r => r.month === selectedMonth);
        return records.filter(r => 
          r.vehicle_plate === selectedVehicleObj.license_plate && 
          r.month === selectedMonth
        );
      })();
  const stats = {
    totalIncome: filteredRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0),
    totalExpense: filteredRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0),
    balance: 0
  };
  stats.balance = stats.totalIncome - stats.totalExpense;

  const paginatedRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filteredRecords.length / pageSize);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="车辆收支流水"
        description="查看车辆的收入和支出明细流水账"
        icon={DollarSign}
        iconColor="text-green-600"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                收支查询
              </CardTitle>
              <CardDescription>
                收入 ¥{stats.totalIncome.toFixed(2)} | 支出 ¥{stats.totalExpense.toFixed(2)} | 余额 ¥{stats.balance.toFixed(2)}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadLedger} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>车队队长</Label>
              <Select value={fleetManagerFilter} onValueChange={setFleetManagerFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部车队长</SelectItem>
                  {fleetManagers.map(fm => (
                    <SelectItem key={fm.id} value={fm.id}>{fm.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>车辆</Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部车辆</SelectItem>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.license_plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>月份</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>流水明细</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">日期</TableHead>
                  <TableHead>车辆</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>说明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : paginatedRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      暂无流水记录
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRecords.map(record => (
                    <TableRow key={record.id} className="hover:bg-muted/50">
                      <TableCell className="text-sm">{format(new Date(record.date), 'MM-dd')}</TableCell>
                      <TableCell className="font-medium">{record.vehicle_plate}</TableCell>
                      <TableCell>
                        {record.type === 'income' ? (
                          <Badge className="bg-green-100 text-green-800">
                            <TrendingUp className="h-3 w-3 mr-1" />收入
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <TrendingDown className="h-3 w-3 mr-1" />支出
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{record.category}</TableCell>
                      <TableCell className={`text-right font-semibold ${record.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {record.type === 'income' ? '+' : '-'}¥{record.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {record.description}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && filteredRecords.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                共 {filteredRecords.length} 条流水
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一页</Button>
                <span className="text-sm flex items-center">第 {page} / {totalPages} 页</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>下一页</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
