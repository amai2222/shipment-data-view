// PC端 - 车辆分配管理
// 功能：车队长分配车辆给司机，记录分配历史

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  X
} from 'lucide-react';
import { format } from 'date-fns';

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
  current_vehicle_plate: string | null;
}

interface AssignmentHistory {
  id: string;
  vehicle_plate: string;
  driver_name: string;
  assigned_at: string;
  unassigned_at: string | null;
  notes: string | null;
  is_active: boolean;
}

export default function VehicleAssignment() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [history, setHistory] = useState<AssignmentHistory[]>([]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
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
          driver:internal_driver_vehicle_relations(
            driver:internal_drivers(id, name)
          )
        `)
        .eq('is_active', true)
        .order('license_plate');

      const processedVehicles = (vehicleData || []).map((v: any) => ({
        ...v,
        current_driver_id: v.driver?.[0]?.driver?.id || null,
        current_driver_name: v.driver?.[0]?.driver?.name || null
      }));

      setVehicles(processedVehicles);

      // 加载司机列表
      const { data: driverData } = await supabase
        .from('internal_drivers')
        .select('*')
        .eq('employment_status', 'active')
        .order('name');

      setDrivers(driverData || []);

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
          assigned_at,
          unassigned_at,
          notes,
          is_active,
          vehicle:internal_vehicles(license_plate),
          driver:internal_drivers(name)
        `)
        .order('assigned_at', { ascending: false })
        .limit(50);

      const processedHistory = (data || []).map((h: any) => ({
        id: h.id,
        vehicle_plate: h.vehicle?.license_plate || '未知',
        driver_name: h.driver?.name || '未知',
        assigned_at: h.assigned_at,
        unassigned_at: h.unassigned_at,
        notes: h.notes,
        is_active: h.is_active
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
      // 如果车辆已有司机，先解除旧关联
      if (selectedVehicle.current_driver_id) {
        const { error: unassignError } = await supabase
          .from('internal_driver_vehicle_relations')
          .update({
            is_active: false,
            unassigned_at: new Date().toISOString()
          })
          .eq('vehicle_id', selectedVehicle.id)
          .eq('is_active', true);

        if (unassignError) throw unassignError;
      }

      // 创建新的分配关系
      const { error: assignError } = await supabase
        .from('internal_driver_vehicle_relations')
        .insert({
          vehicle_id: selectedVehicle.id,
          driver_id: selectedDriverId,
          assigned_at: new Date().toISOString(),
          is_active: true,
          notes: assignNotes || null
        });

      if (assignError) throw assignError;

      toast({
        title: '分配成功',
        description: `车辆 ${selectedVehicle.license_plate} 已分配给司机`
      });

      setShowAssignDialog(false);
      setSelectedVehicle(null);
      setSelectedDriverId('');
      setAssignNotes('');
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
          is_active: false,
          unassigned_at: new Date().toISOString()
        })
        .eq('vehicle_id', vehicle.id)
        .eq('is_active', true);

      if (error) throw error;

      toast({ title: '解除成功', description: '车辆分配已解除' });
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
        description="分配车辆给司机，管理车辆使用关系"
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
            <CardTitle className="text-sm">已分配</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {vehicles.filter(v => v.current_driver_id).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">未分配</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {vehicles.filter(v => !v.current_driver_id).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>车辆分配列表</CardTitle>
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

            <div>
              <Label>备注</Label>
              <Textarea
                placeholder="输入分配备注..."
                value={assignNotes}
                onChange={e => setAssignNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAssignDialog(false);
              setSelectedVehicle(null);
              setSelectedDriverId('');
              setAssignNotes('');
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
                  <TableHead>分配时间</TableHead>
                  <TableHead>解除时间</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono">{h.vehicle_plate}</TableCell>
                    <TableCell>{h.driver_name}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(h.assigned_at), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {h.unassigned_at ? format(new Date(h.unassigned_at), 'yyyy-MM-dd HH:mm') : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {h.notes || '-'}
                    </TableCell>
                    <TableCell>
                      {h.is_active ? (
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

