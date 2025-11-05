// PC端 - 车辆档案管理
// 功能：管理内部车辆档案、证件、维保记录

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import {
  Truck,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Wrench,
  RefreshCw,
  Download
} from 'lucide-react';
import { format } from 'date-fns';

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

  // 检查证件是否即将到期（30天内）
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

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="车辆档案管理"
        description="管理内部车辆档案、证件、维保记录"
        icon={Truck}
        iconColor="text-blue-600"
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadVehicles} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            新增车辆
          </Button>
        </div>
      </PageHeader>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总车辆</p>
                <p className="text-3xl font-bold mt-2">{stats.total}</p>
              </div>
              <Truck className="h-10 w-10 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">正常使用</p>
                <p className="text-3xl font-bold mt-2 text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="h-10 w-10 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">维修中</p>
                <p className="text-3xl font-bold mt-2 text-yellow-600">{stats.maintenance}</p>
              </div>
              <Wrench className="h-10 w-10 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">证件到期</p>
                <p className="text-3xl font-bold mt-2 text-red-600">{stats.expiring}</p>
              </div>
              <AlertTriangle className="h-10 w-10 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选和搜索 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索车牌号、品牌、司机..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <select
                className="w-full h-10 px-3 border rounded-md"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">全部状态</option>
                <option value="active">正常使用</option>
                <option value="maintenance">维修中</option>
                <option value="retired">已报废</option>
              </select>
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              高级筛选
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 车辆列表 */}
      <Card>
        <CardHeader>
          <CardTitle>车辆列表（{filteredVehicles.length}辆）</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>车牌号</TableHead>
                <TableHead>车辆编号</TableHead>
                <TableHead>品牌型号</TableHead>
                <TableHead>车型</TableHead>
                <TableHead>载重</TableHead>
                <TableHead>驾驶员</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>里程</TableHead>
                <TableHead>证件状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredVehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
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
                    <TableRow key={vehicle.id}>
                      <TableCell className="font-medium">{vehicle.license_plate}</TableCell>
                      <TableCell>{vehicle.vehicle_number || '-'}</TableCell>
                      <TableCell>
                        {vehicle.vehicle_brand} {vehicle.vehicle_model}
                        <div className="text-xs text-muted-foreground">{vehicle.manufacture_year}年</div>
                      </TableCell>
                      <TableCell>{vehicle.vehicle_type}</TableCell>
                      <TableCell>{vehicle.load_capacity}吨</TableCell>
                      <TableCell>{vehicle.driver_name || <span className="text-muted-foreground">未分配</span>}</TableCell>
                      <TableCell>
                        <Badge className={statusConfig.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {vehicle.current_mileage ? 
                          `${(vehicle.current_mileage / 10000).toFixed(1)}万公里` : 
                          '-'
                        }
                      </TableCell>
                      <TableCell>
                        {hasExpiringCert ? (
                          <Badge className="bg-red-500 text-white">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            即将到期
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            正常
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
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
        </CardContent>
      </Card>
    </div>
  );
}

