// PC端 - 车辆档案管理（桌面完整版）
// 布局风格：参考运单管理，完整Table布局

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
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
import {
  Truck,
  Plus,
  Edit,
  Search,
  Filter,
  FileText,
  AlertTriangle,
  CheckCircle,
  Wrench,
  RefreshCw,
  Download
} from 'lucide-react';

interface Vehicle {
  id: string;
  license_plate: string;
  vehicle_number: string;
  vehicle_type: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_status: string;
  load_capacity: number;
  manufacture_year: number;
  current_mileage: number;
  driving_license_expire_date: string | null;
  insurance_expire_date: string | null;
  annual_inspection_date: string | null;
  driver_name: string | null;
}

export default function VehicleManagement() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadVehicles();
  }, [statusFilter]);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('internal_vehicles')
        .select(`
          *,
          driver:internal_driver_vehicle_relations(
            driver:internal_drivers(name)
          )
        `)
        .order('license_plate');

      if (statusFilter !== 'all') {
        query = query.eq('vehicle_status', statusFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      const processedData = (data || []).map((v: any) => ({
        ...v,
        driver_name: v.driver?.[0]?.driver?.name || null
      }));
      
      setVehicles(processedData);
    } catch (error) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载车辆数据',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return { label: '正常使用', color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'maintenance':
        return { label: '维修中', color: 'bg-yellow-100 text-yellow-800', icon: Wrench };
      case 'retired':
        return { label: '已报废', color: 'bg-gray-100 text-gray-800', icon: AlertTriangle };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800', icon: Truck };
    }
  };

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const daysLeft = Math.floor((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= 30;
  };

  const filteredVehicles = vehicles.filter(v =>
    v.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.vehicle_brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.driver_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: vehicles.length,
    active: vehicles.filter(v => v.vehicle_status === 'active').length,
    maintenance: vehicles.filter(v => v.vehicle_status === 'maintenance').length,
    expiring: vehicles.filter(v => 
      isExpiringSoon(v.driving_license_expire_date) || 
      isExpiringSoon(v.insurance_expire_date) ||
      isExpiringSoon(v.annual_inspection_date)
    ).length
  };

  if (loading && vehicles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">加载车辆数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶部操作栏 */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold">车辆档案管理</h1>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-muted-foreground">总车辆</span>
                <span className="font-semibold">{stats.total}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-muted-foreground">在用</span>
                <span className="font-semibold text-green-600">{stats.active}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-muted-foreground">维修</span>
                <span className="font-semibold text-yellow-600">{stats.maintenance}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-muted-foreground">证件到期</span>
                <span className="font-semibold text-red-600">{stats.expiring}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadVehicles} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              新增车辆
            </Button>
          </div>
        </div>
      </div>

      {/* 筛选和搜索栏 */}
      <div className="border-b bg-card px-6 py-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索车牌号、品牌、司机..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </div>
          <select
            className="h-9 px-3 border rounded-md bg-background text-sm min-w-[140px]"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">全部状态</option>
            <option value="active">正常使用</option>
            <option value="maintenance">维修中</option>
            <option value="retired">已报废</option>
          </select>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            筛选
          </Button>
        </div>
      </div>

      {/* 主内容区 - 表格 */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[120px]">车牌号</TableHead>
                <TableHead>车辆编号</TableHead>
                <TableHead>品牌型号</TableHead>
                <TableHead>车型</TableHead>
                <TableHead className="text-center">载重</TableHead>
                <TableHead>驾驶员</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">里程</TableHead>
                <TableHead className="text-center">证件状态</TableHead>
                <TableHead className="text-center w-[140px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    暂无车辆数据
                  </TableCell>
                </TableRow>
              ) : (
                filteredVehicles.map(vehicle => {
                  const statusConfig = getStatusConfig(vehicle.vehicle_status);
                  const StatusIcon = statusConfig.icon;
                  const hasExpiringCert = 
                    isExpiringSoon(vehicle.driving_license_expire_date) || 
                    isExpiringSoon(vehicle.insurance_expire_date) ||
                    isExpiringSoon(vehicle.annual_inspection_date);
                  
                  return (
                    <TableRow key={vehicle.id} className="hover:bg-muted/50">
                      <TableCell className="font-semibold">{vehicle.license_plate}</TableCell>
                      <TableCell className="text-muted-foreground">{vehicle.vehicle_number || '-'}</TableCell>
                      <TableCell>
                        <div>{vehicle.vehicle_brand} {vehicle.vehicle_model}</div>
                        <div className="text-xs text-muted-foreground">{vehicle.manufacture_year}年</div>
                      </TableCell>
                      <TableCell>{vehicle.vehicle_type}</TableCell>
                      <TableCell className="text-center font-medium">{vehicle.load_capacity}吨</TableCell>
                      <TableCell>
                        {vehicle.driver_name || <span className="text-muted-foreground text-sm">未分配</span>}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {vehicle.current_mileage ? 
                          <span className="text-sm">{(vehicle.current_mileage / 10000).toFixed(1)}万公里</span> : 
                          '-'
                        }
                      </TableCell>
                      <TableCell className="text-center">
                        {hasExpiringCert ? (
                          <Badge className="bg-red-100 text-red-700 border-red-300">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            即将到期
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            正常
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 底部分页 */}
      <div className="border-t bg-card px-6 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            共 {filteredVehicles.length} 辆车辆
          </div>
        </div>
      </div>
    </div>
  );
}
