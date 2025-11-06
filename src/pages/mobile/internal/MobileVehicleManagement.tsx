// 移动端 - 车辆档案管理（车队长）

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import {
  Truck,
  Plus,
  Search,
  Edit,
  AlertTriangle,
  CheckCircle,
  Wrench,
  Calendar,
  User,
  Loader2
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
  current_mileage: number;
  driving_license_expire_date: string | null;
  insurance_expire_date: string | null;
  driver_name: string | null;
}

export default function MobileVehicleManagement() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('internal_vehicles')
        .select(`
          *,
          driver:internal_driver_vehicle_relations!inner(
            driver:internal_drivers(name)
          )
        `)
        .order('license_plate');
      
      if (error) throw error;
      
      // 处理关联数据
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
        return { label: '正常', color: 'bg-green-100 text-green-800', icon: CheckCircle };
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
    expiringCerts: vehicles.filter(v => 
      isExpiringSoon(v.driving_license_expire_date) || 
      isExpiringSoon(v.insurance_expire_date)
    ).length
  };

  return (
    <MobileLayout>
      <div className="space-y-4 pb-20">
        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-2">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
              <div className="text-xs text-blue-600 mt-1">总车辆</div>
            </CardContent>
          </Card>
          
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{stats.active}</div>
              <div className="text-xs text-green-600 mt-1">在用</div>
            </CardContent>
          </Card>
          
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-yellow-700">{stats.maintenance}</div>
              <div className="text-xs text-yellow-600 mt-1">维修</div>
            </CardContent>
          </Card>
          
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-red-700">{stats.expiringCerts}</div>
              <div className="text-xs text-red-600 mt-1">到期</div>
            </CardContent>
          </Card>
        </div>

        {/* 搜索和新增 */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索车牌、品牌、司机..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* 车辆列表 */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              暂无车辆数据
            </div>
          ) : (
            filteredVehicles.map(vehicle => {
              const statusConfig = getStatusConfig(vehicle.vehicle_status);
              const StatusIcon = statusConfig.icon;
              const hasExpiringCert = 
                isExpiringSoon(vehicle.driving_license_expire_date) || 
                isExpiringSoon(vehicle.insurance_expire_date);
              
              return (
                <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* 车牌和状态 */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xl font-bold">{vehicle.license_plate}</div>
                          <div className="text-sm text-muted-foreground">
                            {vehicle.vehicle_brand} {vehicle.vehicle_model}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {vehicle.vehicle_type} · {vehicle.load_capacity}吨
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                          {hasExpiringCert && (
                            <Badge className="bg-red-500 text-white text-xs">
                              ⚠️ 证件到期
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {/* 司机和里程 */}
                      <div className="flex items-center justify-between text-sm">
                        {vehicle.driver_name ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            {vehicle.driver_name}
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-xs">未分配司机</div>
                        )}
                        {vehicle.current_mileage && (
                          <div className="text-muted-foreground text-xs">
                            {(vehicle.current_mileage / 1000).toFixed(1)}万公里
                          </div>
                        )}
                      </div>
                      
                      {/* 证件到期提醒 */}
                      {hasExpiringCert && (
                        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                          <AlertTriangle className="h-3 w-3 inline mr-1" />
                          {isExpiringSoon(vehicle.driving_license_expire_date) && (
                            <span>行驶证将于 {format(new Date(vehicle.driving_license_expire_date!), 'MM-dd')} 到期</span>
                          )}
                          {isExpiringSoon(vehicle.insurance_expire_date) && (
                            <span className="ml-2">保险将于 {format(new Date(vehicle.insurance_expire_date!), 'MM-dd')} 到期</span>
                          )}
                        </div>
                      )}
                      
                      {/* 操作按钮 */}
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Edit className="h-3 w-3 mr-1" />
                          编辑
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          查看详情
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </MobileLayout>
  );
}

