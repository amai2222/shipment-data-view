// 移动端 - 车辆司机明细（车队长）

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
  Truck,
  User,
  Search,
  Link as LinkIcon,
  Unlink,
  RefreshCw,
  Loader2,
  Phone,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface Vehicle {
  id: string;
  license_plate: string;
  vehicle_type: string;
  vehicle_status: string;
  current_driver_id: string | null;
  current_driver_name: string | null;
  current_driver_phone: string | null;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  employment_status: string;
  current_vehicle_id: string | null;
  current_vehicle_plate: string | null;
}

export default function MobileVehicleDriverDetail() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'vehicles' | 'drivers'>('vehicles');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 加载车辆列表（只显示当前车队长管理的）
      const { data: vehicleData, error: vehicleError } = await supabase
        .from('internal_vehicles')
        .select(`
          id,
          license_plate,
          vehicle_type,
          vehicle_status,
          fleet_manager_id
        `)
        .eq('fleet_manager_id', user?.id || '')
        .order('license_plate');

      if (vehicleError) throw vehicleError;

      // 查询每辆车的司机分配
      const processedVehicles = await Promise.all((vehicleData || []).map(async (v: any) => {
        const { data: relation } = await supabase
          .from('internal_driver_vehicle_relations')
          .select('driver:internal_drivers(id, name, phone)')
          .eq('vehicle_id', v.id)
          .is('valid_until', null)
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...v,
          current_driver_id: relation?.driver?.id || null,
          current_driver_name: relation?.driver?.name || null,
          current_driver_phone: relation?.driver?.phone || null
        };
      }));

      setVehicles(processedVehicles);

      // 加载司机列表（只显示当前车队长管理的）
      const { data: driverData, error: driverError } = await supabase
        .from('internal_drivers')
        .select('id, name, phone, employment_status, fleet_manager_id')
        .eq('fleet_manager_id', user?.id || '')
        .eq('employment_status', 'active')
        .order('name');

      if (driverError) throw driverError;

      // 查询每个司机的车辆分配
      const processedDrivers = await Promise.all((driverData || []).map(async (d: any) => {
        const { data: relation } = await supabase
          .from('internal_driver_vehicle_relations')
          .select('vehicle:internal_vehicles(id, license_plate)')
          .eq('driver_id', d.id)
          .is('valid_until', null)
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...d,
          current_vehicle_id: relation?.vehicle?.id || null,
          current_vehicle_plate: relation?.vehicle?.license_plate || null
        };
      }));

      setDrivers(processedDrivers);
    } catch (error: any) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: error.message || '无法加载数据',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = vehicles.filter(v =>
    v.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.current_driver_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDrivers = drivers.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone.includes(searchTerm) ||
    d.current_vehicle_plate?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">正常</Badge>;
      case 'maintenance':
        return <Badge className="bg-yellow-100 text-yellow-800">维修中</Badge>;
      case 'retired':
        return <Badge className="bg-gray-100 text-gray-800">已报废</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <MobileLayout title="车辆司机明细" showBack={true}>
      <div className="space-y-4 pb-20">
        {/* 搜索栏 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索车牌号、司机姓名..."
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 标签页切换 */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'vehicles' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setActiveTab('vehicles')}
          >
            <Truck className="h-4 w-4 mr-2" />
            车辆 ({filteredVehicles.length})
          </Button>
          <Button
            variant={activeTab === 'drivers' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setActiveTab('drivers')}
          >
            <User className="h-4 w-4 mr-2" />
            司机 ({filteredDrivers.length})
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : activeTab === 'vehicles' ? (
          /* 车辆列表 */
          <div className="space-y-3">
            {filteredVehicles.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  暂无车辆数据
                </CardContent>
              </Card>
            ) : (
              filteredVehicles.map(vehicle => (
                <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Truck className="h-5 w-5 text-primary" />
                          <span className="font-semibold text-lg">{vehicle.license_plate}</span>
                          {getStatusBadge(vehicle.vehicle_status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {vehicle.vehicle_type}
                        </div>
                      </div>
                    </div>

                    {vehicle.current_driver_name ? (
                      <div className="mt-3 pt-3 border-t flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{vehicle.current_driver_name}</div>
                          {vehicle.current_driver_phone && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3" />
                              {vehicle.current_driver_phone}
                            </div>
                          )}
                        </div>
                        <LinkIcon className="h-4 w-4 text-green-600" />
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t text-sm text-muted-foreground flex items-center gap-2">
                        <Unlink className="h-4 w-4" />
                        未分配司机
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          /* 司机列表 */
          <div className="space-y-3">
            {filteredDrivers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  暂无司机数据
                </CardContent>
              </Card>
            ) : (
              filteredDrivers.map(driver => (
                <Card key={driver.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-5 w-5 text-primary" />
                          <span className="font-semibold text-lg">{driver.name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {driver.phone}
                        </div>
                      </div>
                    </div>

                    {driver.current_vehicle_plate ? (
                      <div className="mt-3 pt-3 border-t flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{driver.current_vehicle_plate}</div>
                        </div>
                        <LinkIcon className="h-4 w-4 text-green-600" />
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t text-sm text-muted-foreground flex items-center gap-2">
                        <Unlink className="h-4 w-4" />
                        未分配车辆
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}

