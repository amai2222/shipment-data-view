// 移动端 - 车辆分配管理（车队长）

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import {
  Truck,
  User,
  Link as LinkIcon,
  Unlink,
  RefreshCw,
  Loader2,
  Save,
  X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Vehicle {
  id: string;
  license_plate: string;
  vehicle_type: string;
  vehicle_status: string;
  current_driver_id: string | null;
  current_driver_name: string | null;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  employment_status: string;
  current_vehicle_id: string | null;
}

export default function MobileVehicleAssignment() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [saving, setSaving] = useState(false);

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
          .select('driver:internal_drivers(id, name)')
          .eq('vehicle_id', v.id)
          .is('valid_until', null)
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...v,
          current_driver_id: relation?.driver?.id || null,
          current_driver_name: relation?.driver?.name || null
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
          .select('vehicle:internal_vehicles(id)')
          .eq('driver_id', d.id)
          .is('valid_until', null)
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...d,
          current_vehicle_id: relation?.vehicle?.id || null
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

  const handleOpenAssignDialog = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setSelectedDriverId('');
    setShowAssignDialog(true);
  };

  const handleAssign = async () => {
    if (!selectedVehicle || !selectedDriverId) {
      toast({
        title: '请选择司机',
        description: '请选择要分配的司机',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      // 如果车辆已有司机，先解除旧关联
      if (selectedVehicle.current_driver_id) {
        const { error: unassignError } = await supabase
          .from('internal_driver_vehicle_relations')
          .update({
            valid_until: new Date().toISOString().split('T')[0]
          })
          .eq('vehicle_id', selectedVehicle.id)
          .is('valid_until', null);

        if (unassignError) throw unassignError;
      }

      // 创建新的分配关系
      const { error: assignError } = await supabase
        .from('internal_driver_vehicle_relations')
        .insert({
          vehicle_id: selectedVehicle.id,
          driver_id: selectedDriverId,
          valid_from: new Date().toISOString().split('T')[0],
          valid_until: null,
          is_primary: true
        });

      if (assignError) throw assignError;

      toast({
        title: '分配成功',
        description: `车辆 ${selectedVehicle.license_plate} 已分配给司机`
      });

      setShowAssignDialog(false);
      setSelectedVehicle(null);
      setSelectedDriverId('');
      loadData();
    } catch (error: any) {
      console.error('分配失败:', error);
      toast({
        title: '分配失败',
        description: error.message || '无法完成分配',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (vehicle: Vehicle) => {
    if (!vehicle.current_driver_id) {
      toast({
        title: '该车辆未分配司机',
        variant: 'destructive'
      });
      return;
    }

    const confirmed = window.confirm(
      `确定要解除车辆 ${vehicle.license_plate} 和司机 ${vehicle.current_driver_name} 的分配吗？`
    );

    if (!confirmed) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('internal_driver_vehicle_relations')
        .update({
          valid_until: new Date().toISOString().split('T')[0]
        })
        .eq('vehicle_id', vehicle.id)
        .is('valid_until', null);

      if (error) throw error;

      toast({
        title: '解除成功',
        description: '车辆分配已解除'
      });
      loadData();
    } catch (error: any) {
      console.error('解除失败:', error);
      toast({
        title: '解除失败',
        description: error.message || '无法完成解除',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const availableDrivers = drivers.filter(d => 
    !d.current_vehicle_id || d.id === selectedDriverId
  );

  const stats = {
    total: vehicles.length,
    assigned: vehicles.filter(v => v.current_driver_id).length,
    unassigned: vehicles.filter(v => !v.current_driver_id).length
  };

  return (
    <MobileLayout title="车辆分配" showBack={true}>
      <div className="space-y-4 pb-20">
        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
              <div className="text-xs text-blue-600 mt-1">总车辆</div>
            </CardContent>
          </Card>
          
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{stats.assigned}</div>
              <div className="text-xs text-green-600 mt-1">已分配</div>
            </CardContent>
          </Card>
          
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-yellow-700">{stats.unassigned}</div>
              <div className="text-xs text-yellow-600 mt-1">待分配</div>
            </CardContent>
          </Card>
        </div>

        {/* 刷新按钮 */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {/* 车辆列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : vehicles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              暂无车辆数据
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {vehicles.map(vehicle => (
              <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* 车牌和状态 */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xl font-bold">{vehicle.license_plate}</div>
                        <div className="text-sm text-muted-foreground">
                          {vehicle.vehicle_type}
                        </div>
                      </div>
                      {vehicle.current_driver_id ? (
                        <Badge className="bg-green-100 text-green-800">已分配</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">待分配</Badge>
                      )}
                    </div>

                    {/* 司机信息 */}
                    {vehicle.current_driver_name ? (
                      <div className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                        <User className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-sm">{vehicle.current_driver_name}</span>
                        <LinkIcon className="h-4 w-4 text-green-600 ml-auto" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200 text-sm text-muted-foreground">
                        <Unlink className="h-4 w-4" />
                        <span>未分配司机</span>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex gap-2 pt-2 border-t">
                      {vehicle.current_driver_id ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleUnassign(vehicle)}
                          disabled={saving}
                        >
                          <Unlink className="h-3 w-3 mr-1" />
                          解除分配
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleOpenAssignDialog(vehicle)}
                        >
                          <LinkIcon className="h-3 w-3 mr-1" />
                          分配司机
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleOpenAssignDialog(vehicle)}
                      >
                        {vehicle.current_driver_id ? '重新分配' : '分配'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 分配对话框 */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>分配司机</DialogTitle>
              <DialogDescription>
                为车辆 {selectedVehicle?.license_plate} 选择司机
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">选择司机</label>
                <Select
                  value={selectedDriverId}
                  onValueChange={setSelectedDriverId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择司机" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDrivers.map(driver => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} ({driver.phone})
                        {driver.current_vehicle_id && driver.id !== selectedDriverId && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (已有车辆)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAssignDialog(false)}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-2" />
                取消
              </Button>
              <Button
                onClick={handleAssign}
                disabled={saving || !selectedDriverId}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    保存
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
}

