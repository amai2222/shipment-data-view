// PC端 - 车队长派单管理
// 功能：车队长创建运单任务并分配给司机

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { PageHeader } from '@/components/PageHeader';
import {
  Send,
  Truck,
  MapPin,
  Calendar,
  Package,
  Save,
  RefreshCw
} from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  phone: string;
  current_vehicle_plate: string | null;
}

interface Location {
  id: string;
  name: string;
}

interface FleetManager {
  id: string;
  full_name: string;
}

interface Project {
  id: string;
  name: string;
}

export default function TaskDispatch() {
  const { toast } = useToast();
  
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [fleetManagers, setFleetManagers] = useState<FleetManager[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [formData, setFormData] = useState({
    fleetManagerId: '',
    projectId: '',
    driverId: '',
    loadingLocationId: '',
    unloadingLocationId: '',
    loadingDate: new Date().toISOString().split('T')[0],
    estimatedWeight: '',
    cargoType: '',
    notes: ''
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 加载在职司机
      const { data: driverData } = await supabase
        .from('internal_drivers')
        .select(`
          id,
          name,
          phone,
          vehicle_relations:internal_driver_vehicle_relations!inner(
            vehicle:internal_vehicles(license_plate)
          )
        `)
        .eq('employment_status', 'active');

      const processedDrivers = (driverData || []).map((d: any) => ({
        ...d,
        current_vehicle_plate: d.vehicle_relations?.[0]?.vehicle?.license_plate || null
      }));

      setDrivers(processedDrivers);

      // 加载地点
      const { data: locationData } = await supabase
        .from('locations')
        .select('id, name')
        .order('name');

      setLocations(locationData || []);

      // 加载车队长列表
      const { data: fleetManagerData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'fleet_manager')
        .order('full_name');

      setFleetManagers(fleetManagerData || []);

    } catch (error: any) {
      toast({ title: '加载失败', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ✅ 根据车队长加载其负责的项目
  const loadProjectsByFleetManager = async (fleetManagerId: string) => {
    if (!fleetManagerId) {
      setProjects([]);
      return;
    }

    setLoadingProjects(true);
    try {
      // 查询该车队长负责的项目
      const { data: managedProjects } = await supabase
        .from('fleet_manager_projects')
        .select('project_id, project:projects(id, name)')
        .eq('fleet_manager_id', fleetManagerId);

      const projectList = (managedProjects || [])
        .map((mp: any) => mp.project)
        .filter((p: any) => p) // 过滤掉null
        .map((p: any) => ({
          id: p.id,
          name: p.name
        }));

      setProjects(projectList);

      // 如果只有一个项目，自动选择
      if (projectList.length === 1) {
        setFormData(prev => ({...prev, projectId: projectList[0].id}));
      } else {
        // 清空项目选择
        setFormData(prev => ({...prev, projectId: ''}));
      }
    } catch (error: any) {
      console.error('加载项目失败:', error);
      toast({ title: '加载项目失败', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingProjects(false);
    }
  };

  // ✅ 当车队长改变时，加载对应的项目
  useEffect(() => {
    if (formData.fleetManagerId) {
      loadProjectsByFleetManager(formData.fleetManagerId);
    } else {
      setProjects([]);
      setFormData(prev => ({...prev, projectId: ''}));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.fleetManagerId]);

  const handleDispatch = async () => {
    if (!formData.fleetManagerId || !formData.projectId || !formData.driverId || !formData.loadingLocationId || !formData.unloadingLocationId) {
      toast({ title: '请填写必填项', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const project = projects.find(p => p.id === formData.projectId);
      const driver = drivers.find(d => d.id === formData.driverId);
      const loadingLoc = locations.find(l => l.id === formData.loadingLocationId);
      const unloadingLoc = locations.find(l => l.id === formData.unloadingLocationId);

      // 创建运单任务（插入到logistics_records表）
      const { error } = await supabase
        .from('logistics_records')
        .insert({
          project_id: formData.projectId,
          project_name: project?.name || '',
          driver_id: formData.driverId,
          driver_name: driver?.name,
          driver_phone: driver?.phone,
          license_plate: driver?.current_vehicle_plate,
          loading_location: loadingLoc?.name,
          unloading_location: unloadingLoc?.name,
          loading_date: formData.loadingDate,
          loading_weight: formData.estimatedWeight ? parseFloat(formData.estimatedWeight) : null,
          cargo_type: formData.cargoType || null,
          remarks: formData.notes || null,
          transport_type: '内部派单',
          payment_status: 'Unpaid',
          invoice_status: 'Uninvoiced'
        });

      if (error) throw error;

      toast({
        title: '派单成功',
        description: `已向司机 ${driver?.name} 派发任务`
      });

      // 重置表单（保留车队长和项目）
      setFormData(prev => ({
        ...prev,
        driverId: '',
        loadingLocationId: '',
        unloadingLocationId: '',
        loadingDate: new Date().toISOString().split('T')[0],
        estimatedWeight: '',
        cargoType: '',
        notes: ''
      }));

    } catch (error: any) {
      toast({ title: '派单失败', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="任务派单"
        description="车队长派发运单任务给司机"
        icon={Send}
        iconColor="text-blue-600"
      />

      <Card>
        <CardHeader>
          <CardTitle>创建运单任务</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>选择车队长 <span className="text-red-500">*</span></Label>
                <Select 
                  value={formData.fleetManagerId} 
                  onValueChange={v => setFormData(prev => ({...prev, fleetManagerId: v, projectId: '', driverId: ''}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择车队长" />
                  </SelectTrigger>
                  <SelectContent>
                    {fleetManagers.map(fm => (
                      <SelectItem key={fm.id} value={fm.id}>
                        {fm.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>选择项目 <span className="text-red-500">*</span></Label>
                <Select 
                  value={formData.projectId} 
                  onValueChange={v => setFormData(prev => ({...prev, projectId: v}))}
                  disabled={!formData.fleetManagerId || loadingProjects}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingProjects ? "加载中..." : formData.fleetManagerId ? "选择项目" : "请先选择车队长"} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>选择司机 <span className="text-red-500">*</span></Label>
                <Select value={formData.driverId} onValueChange={v => setFormData(prev => ({...prev, driverId: v}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择司机" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map(driver => (
                      <SelectItem key={driver.id} value={driver.id}>
                        <div className="flex items-center gap-2">
                          <span>{driver.name}</span>
                          {driver.current_vehicle_plate && (
                            <span className="text-xs text-muted-foreground">
                              ({driver.current_vehicle_plate})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>装货日期 <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={formData.loadingDate}
                  onChange={e => setFormData(prev => ({...prev, loadingDate: e.target.value}))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>装货地点 <span className="text-red-500">*</span></Label>
                <Select value={formData.loadingLocationId} onValueChange={v => setFormData(prev => ({...prev, loadingLocationId: v}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择装货地点" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>卸货地点 <span className="text-red-500">*</span></Label>
                <Select value={formData.unloadingLocationId} onValueChange={v => setFormData(prev => ({...prev, unloadingLocationId: v}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择卸货地点" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>预计吨数</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.estimatedWeight}
                  onChange={e => setFormData(prev => ({...prev, estimatedWeight: e.target.value}))}
                  step="0.1"
                />
              </div>

              <div>
                <Label>货物类型</Label>
                <Input
                  placeholder="如：煤炭"
                  value={formData.cargoType}
                  onChange={e => setFormData(prev => ({...prev, cargoType: e.target.value}))}
                />
              </div>
            </div>

            <div>
              <Label>任务备注</Label>
              <Textarea
                placeholder="输入任务说明..."
                value={formData.notes}
                onChange={e => setFormData(prev => ({...prev, notes: e.target.value}))}
                rows={3}
              />
            </div>

            <Button
              onClick={handleDispatch}
              disabled={loading || !formData.fleetManagerId || !formData.projectId || !formData.driverId || !formData.loadingLocationId || !formData.unloadingLocationId}
              className="w-full"
            >
              {loading ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />派单中...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />确认派单</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

