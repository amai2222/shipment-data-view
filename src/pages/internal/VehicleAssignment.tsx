// PC端 - 车辆分配管理
// 功能：分配车辆给司机和车队长，记录分配历史

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { PageHeader } from '@/components/PageHeader';
import {
  Truck,
  Users,
  Plus,
  RefreshCw,
  History,
  Link as LinkIcon,
  Unlink,
  Save,
  X,
  UserCog
} from 'lucide-react';
import { format } from 'date-fns';

interface Vehicle {
  id: string;
  license_plate: string;
  vehicle_type: string;
  vehicle_status: string;
  current_driver_id: string | null;
  current_driver_name: string | null;
  fleet_manager_id: string | null;
  fleet_manager_name: string | null;
}

interface FleetManager {
  id: string;
  full_name: string;
  email: string;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  employment_status: string;
  current_vehicle_id: string | null;
  current_vehicle_plate: string | null;
}

interface AssignmentHistory {
  id: string;
  vehicle_plate: string;
  driver_name: string;
  assigned_at: string;
  valid_from: string;
  valid_until: string | null;
}

export default function VehicleAssignment() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fleetManagers, setFleetManagers] = useState<FleetManager[]>([]);
  const [history, setHistory] = useState<AssignmentHistory[]>([]);
  const [activeTab, setActiveTab] = useState('driver');  // ✅ 默认显示司机分配标签页
  
  // 司机分配相关状态
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  
  // 车队长分配相关状态
  const [showFleetManagerDialog, setShowFleetManagerDialog] = useState(false);
  const [selectedVehicleForFleet, setSelectedVehicleForFleet] = useState<Vehicle | null>(null);
  const [selectedFleetManagerId, setSelectedFleetManagerId] = useState('');
  
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 加载车辆列表
      const { data: vehicleData } = await supabase
        .from('internal_vehicles')
        .select(`
          id,
          license_plate,
          vehicle_type,
          vehicle_status,
          fleet_manager_id,
          updated_at
        `)
        .order('updated_at', { ascending: false });  // ✅ 最近更新的在上面

      // 查询每辆车当前的司机分配和车队长
      const processedVehicles = await Promise.all((vehicleData || []).map(async (v: any) => {
        // 查询司机分配
        const { data: relation } = await supabase
          .from('internal_driver_vehicle_relations')
          .select('driver:internal_drivers(id, name)')
          .eq('vehicle_id', v.id)
          .is('valid_until', null)  // 当前有效的分配
          .order('valid_from', { ascending: false })
          .limit(1)
          .maybeSingle();  // ✅ 允许返回0条或1条
        
        // 查询车队长信息
        let fleetManagerName = null;
        if (v.fleet_manager_id) {
          const { data: manager } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', v.fleet_manager_id)
            .maybeSingle();
          fleetManagerName = manager?.full_name || null;
        }
        
        return {
          ...v,
          current_driver_id: relation?.driver?.id || null,
          current_driver_name: relation?.driver?.name || null,
          fleet_manager_name: fleetManagerName
        };
      }));

      // ✅ 排序：已分配的在上面，然后按更新时间降序
      const sortedVehicles = processedVehicles.sort((a, b) => {
        // 已分配的排在未分配的前面
        if (a.current_driver_id && !b.current_driver_id) return -1;
        if (!a.current_driver_id && b.current_driver_id) return 1;
        // 同类型按更新时间降序
        return 0;
      });
      
      setVehicles(sortedVehicles);

      // 加载司机列表
      const { data: driverData } = await supabase
        .from('internal_drivers')
        .select('*')
        .eq('employment_status', 'active')
        .order('name');

      setDrivers(driverData || []);

      // 加载车队长列表
      const { data: fleetManagerData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'fleet_manager')
        .eq('is_active', true)
        .order('full_name');
      
      setFleetManagers(fleetManagerData || []);

      // 加载分配历史
      loadHistory();

    } catch (error: any) {
      toast({ title: '加载失败', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const { data } = await supabase
        .from('internal_driver_vehicle_relations')
        .select(`
          id,
          valid_from,
          valid_until,
          vehicle:internal_vehicles(license_plate),
          driver:internal_drivers(name)
        `)
        .order('valid_from', { ascending: false })
        .limit(50);

      const processedHistory = (data || []).map((h: any) => ({
        id: h.id,
        vehicle_plate: h.vehicle?.license_plate || '未知',
        driver_name: h.driver?.name || '未知',
        assigned_at: h.valid_from,
        valid_from: h.valid_from,
        valid_until: h.valid_until
      }));

      setHistory(processedHistory);
    } catch (error: any) {
      console.error('加载历史失败:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedVehicle || !selectedDriverId) {
      toast({ title: '请选择车辆和司机', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // 如果车辆已有司机，先解除旧关联（设置结束日期）
      if (selectedVehicle.current_driver_id) {
        const { error: unassignError } = await supabase
          .from('internal_driver_vehicle_relations')
          .update({
            valid_until: new Date().toISOString().split('T')[0]  // 设置结束日期
          })
          .eq('vehicle_id', selectedVehicle.id)
          .is('valid_until', null);  // 只更新未结束的分配

        if (unassignError) throw unassignError;
      }

      // 创建新的分配关系
      const { error: assignError } = await supabase
        .from('internal_driver_vehicle_relations')
        .insert({
          vehicle_id: selectedVehicle.id,
          driver_id: selectedDriverId,
          valid_from: new Date().toISOString().split('T')[0],  // 开始日期
          valid_until: null  // NULL表示当前有效
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
      toast({ title: '分配失败', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (vehicle: Vehicle) => {
    if (!vehicle.current_driver_id) {
      toast({ title: '该车辆未分配司机', variant: 'destructive' });
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
          valid_until: new Date().toISOString().split('T')[0]  // 设置结束日期
        })
        .eq('vehicle_id', vehicle.id)
        .is('valid_until', null);  // 只更新当前有效的分配

      if (error) throw error;

      toast({ title: '解除成功', description: '车辆分配已解除' });
      loadData();

    } catch (error: any) {
      toast({ title: '解除失败', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ✅ 分配车辆给车队长
  const handleAssignFleetManager = async () => {
    if (!selectedVehicleForFleet || !selectedFleetManagerId) {
      toast({ title: '请选择车辆和车队长', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('internal_vehicles')
        .update({ fleet_manager_id: selectedFleetManagerId })
        .eq('id', selectedVehicleForFleet.id);

      if (error) throw error;

      toast({
        title: '分配成功',
        description: `车辆 ${selectedVehicleForFleet.license_plate} 已分配给车队长`
      });

      setShowFleetManagerDialog(false);
      setSelectedVehicleForFleet(null);
      setSelectedFleetManagerId('');
      loadData();

    } catch (error: any) {
      toast({ title: '分配失败', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ✅ 解除车辆与车队长的关联
  const handleUnassignFleetManager = async (vehicle: Vehicle) => {
    if (!vehicle.fleet_manager_id) {
      toast({ title: '该车辆未分配车队长', variant: 'destructive' });
      return;
    }

    const confirmed = window.confirm(
      `确定要解除车辆 ${vehicle.license_plate} 和车队长的分配吗？`
    );

    if (!confirmed) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('internal_vehicles')
        .update({ fleet_manager_id: null })
        .eq('id', vehicle.id);

      if (error) throw error;

      toast({ title: '解除成功', description: '车辆与车队长的分配已解除' });
      loadData();

    } catch (error: any) {
      toast({ title: '解除失败', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const availableDrivers = drivers.filter(d => !d.current_vehicle_id || d.id === selectedDriverId);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="车辆分配管理"
        description="分配车辆给司机和车队长，管理车辆使用关系"
        icon={Truck}
        iconColor="text-blue-600"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">车辆总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vehicles.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">已分配司机</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {vehicles.filter(v => v.current_driver_id).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">已分配车队长</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {vehicles.filter(v => v.fleet_manager_id).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ✅ 标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="driver">
            <Users className="h-4 w-4 mr-2" />
            分配司机
          </TabsTrigger>
          <TabsTrigger value="fleet_manager">
            <UserCog className="h-4 w-4 mr-2" />
            分配车队长
          </TabsTrigger>
        </TabsList>

        {/* ✅ 司机分配标签页 */}
        <TabsContent value="driver" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>车辆分配列表（司机）</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowHistoryDialog(true)}>
                    <History className="h-4 w-4 mr-2" />
                    分配历史
                  </Button>
                  <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    刷新
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>车牌号</TableHead>
                      <TableHead>车型</TableHead>
                      <TableHead>当前司机</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                          加载中...
                        </TableCell>
                      </TableRow>
                    ) : vehicles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          暂无车辆数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      vehicles.map(vehicle => (
                        <TableRow key={vehicle.id}>
                          <TableCell className="font-semibold font-mono">
                            {vehicle.license_plate}
                          </TableCell>
                          <TableCell>{vehicle.vehicle_type}</TableCell>
                          <TableCell>
                            {vehicle.current_driver_name ? (
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-green-600" />
                                <span>{vehicle.current_driver_name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">未分配</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {vehicle.current_driver_id ? (
                              <Badge className="bg-green-100 text-green-800">
                                已分配
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800">
                                待分配
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex gap-1 justify-center">
                              {vehicle.current_driver_id ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUnassign(vehicle)}
                                  disabled={saving}
                                  className="text-orange-600 hover:text-orange-700"
                                >
                                  <Unlink className="h-4 w-4 mr-1" />
                                  解除
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedVehicle(vehicle);
                                    setShowAssignDialog(true);
                                  }}
                                  disabled={saving}
                                >
                                  <LinkIcon className="h-4 w-4 mr-1" />
                                  分配
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ✅ 车队长分配标签页 */}
        <TabsContent value="fleet_manager" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>车辆分配列表（车队长）</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    刷新
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>车牌号</TableHead>
                      <TableHead>车型</TableHead>
                      <TableHead>当前车队长</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                          加载中...
                        </TableCell>
                      </TableRow>
                    ) : vehicles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          暂无车辆数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      vehicles.map(vehicle => (
                        <TableRow key={vehicle.id}>
                          <TableCell className="font-semibold font-mono">
                            {vehicle.license_plate}
                          </TableCell>
                          <TableCell>{vehicle.vehicle_type}</TableCell>
                          <TableCell>
                            {vehicle.fleet_manager_name ? (
                              <div className="flex items-center gap-2">
                                <UserCog className="h-4 w-4 text-blue-600" />
                                <span>{vehicle.fleet_manager_name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">未分配</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {vehicle.fleet_manager_id ? (
                              <Badge className="bg-blue-100 text-blue-800">
                                已分配
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800">
                                待分配
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex gap-1 justify-center">
                              {vehicle.fleet_manager_id ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUnassignFleetManager(vehicle)}
                                  disabled={saving}
                                  className="text-orange-600 hover:text-orange-700"
                                >
                                  <Unlink className="h-4 w-4 mr-1" />
                                  解除
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedVehicleForFleet(vehicle);
                                    setShowFleetManagerDialog(true);
                                  }}
                                  disabled={saving}
                                >
                                  <LinkIcon className="h-4 w-4 mr-1" />
                                  分配
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 分配对话框 */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              分配车辆
            </DialogTitle>
            <DialogDescription>
              车辆：{selectedVehicle?.license_plate}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>选择司机 <span className="text-red-500">*</span></Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择司机" />
                </SelectTrigger>
                <SelectContent>
                  {availableDrivers.map(driver => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name} - {driver.phone}
                      {driver.current_vehicle_plate && ` (当前: ${driver.current_vehicle_plate})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAssignDialog(false);
              setSelectedVehicle(null);
              setSelectedDriverId('');
            }}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleAssign} disabled={!selectedDriverId || saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              确认分配
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ 分配车队长对话框 */}
      <Dialog open={showFleetManagerDialog} onOpenChange={setShowFleetManagerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              分配车辆给车队长
            </DialogTitle>
            <DialogDescription>
              车辆：{selectedVehicleForFleet?.license_plate}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>选择车队长 <span className="text-red-500">*</span></Label>
              <Select value={selectedFleetManagerId} onValueChange={setSelectedFleetManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择车队长" />
                </SelectTrigger>
                <SelectContent>
                  {fleetManagers.map(manager => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name} - {manager.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowFleetManagerDialog(false);
              setSelectedVehicleForFleet(null);
              setSelectedFleetManagerId('');
            }}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleAssignFleetManager} disabled={!selectedFleetManagerId || saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              确认分配
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分配历史对话框 */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              分配历史记录
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>车牌号</TableHead>
                  <TableHead>司机</TableHead>
                  <TableHead>开始日期</TableHead>
                  <TableHead>结束日期</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono">{h.vehicle_plate}</TableCell>
                    <TableCell>{h.driver_name}</TableCell>
                    <TableCell className="text-sm">
                      {h.valid_from}
                    </TableCell>
                    <TableCell className="text-sm">
                      {h.valid_until || '-'}
                    </TableCell>
                    <TableCell>
                      {!h.valid_until || new Date(h.valid_until) > new Date() ? (
                        <Badge className="bg-green-100 text-green-800">使用中</Badge>
                      ) : (
                        <Badge variant="outline">已结束</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

