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

interface FleetManager {
  id: string;
  full_name: string;
}

interface Project {
  id: string;
  name: string;
}

interface FavoriteRoute {
  id: string;
  route_name: string;
  project_id: string;
  loading_location_id: string;
  unloading_location_id: string;
  loading_location: string;
  unloading_location: string;
  use_count: number;
}

export default function TaskDispatch() {
  const { toast } = useToast();
  
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fleetManagers, setFleetManagers] = useState<FleetManager[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [formData, setFormData] = useState({
    fleetManagerId: '',
    projectId: '',
    driverId: '',
    routeId: '',  // 线路ID
    loadingDate: new Date().toISOString().split('T')[0],
    estimatedWeight: '',
    currentCost: '0',  // 运费，默认0
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
      setFormData(prev => ({...prev, projectId: '', routeId: ''}));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.fleetManagerId]);

  // 当选择项目时，加载该项目的线路
  useEffect(() => {
    if (formData.projectId && formData.fleetManagerId) {
      loadRoutesByProject(formData.projectId, formData.fleetManagerId);
    } else {
      setFavoriteRoutes([]);
      setFormData(prev => ({...prev, routeId: ''}));
    }
  }, [formData.projectId, formData.fleetManagerId]);

  // 当选择线路时，自动填充项目（如果线路有项目ID）
  useEffect(() => {
    if (formData.routeId && favoriteRoutes.length > 0) {
      const selectedRoute = favoriteRoutes.find(r => r.id === formData.routeId);
      if (selectedRoute && selectedRoute.project_id && !formData.projectId) {
        setFormData(prev => ({ ...prev, projectId: selectedRoute.project_id }));
      }
    }
  }, [formData.routeId, favoriteRoutes]);

  // 加载指定项目的线路
  const loadRoutesByProject = async (projectId: string, fleetManagerId: string) => {
    try {
      const { data: routeData } = await supabase
        .from('fleet_manager_favorite_routes')
        .select('*')
        .eq('fleet_manager_id', fleetManagerId)
        .eq('project_id', projectId)
        .order('use_count', { ascending: false })
        .limit(50);
      
      setFavoriteRoutes(routeData || []);
    } catch (error: any) {
      console.error('加载线路失败:', error);
      toast({ title: '加载线路失败', description: error.message, variant: 'destructive' });
    }
  };

  const handleDispatch = async () => {
    if (!formData.fleetManagerId || !formData.projectId || !formData.driverId || !formData.routeId) {
      toast({ title: '请填写必填项', description: '请选择车队长、项目、司机和线路', variant: 'destructive' });
      return;
    }

    // 从选中的线路获取地点信息
    const selectedRoute = favoriteRoutes.find(r => r.id === formData.routeId);
    if (!selectedRoute || !selectedRoute.loading_location_id || !selectedRoute.unloading_location_id) {
      toast({ title: '线路信息不完整', description: '请重新选择线路', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // 使用 create_dispatch_order RPC函数创建派单
      const { data, error } = await supabase.rpc('create_dispatch_order', {
        p_project_id: formData.projectId,
        p_driver_id: formData.driverId,
        p_loading_location_id: selectedRoute.loading_location_id,
        p_unloading_location_id: selectedRoute.unloading_location_id,
        p_expected_loading_date: formData.loadingDate || null,
        p_expected_weight: formData.estimatedWeight ? parseFloat(formData.estimatedWeight) : null,
        p_current_cost: parseFloat(formData.currentCost) || 0,  // 传递运费
        p_remarks: formData.notes || null
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      // 更新线路使用次数
      await supabase
        .from('fleet_manager_favorite_routes')
        .update({ 
          use_count: (selectedRoute.use_count || 0) + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', formData.routeId);

      const driver = drivers.find(d => d.id === formData.driverId);
      toast({
        title: '派单成功 ✅',
        description: `派单编号：${data.order_number}，已向司机 ${driver?.name} 派发任务`
      });

      // 重置表单（保留车队长和项目）
      setFormData(prev => ({
        ...prev,
        driverId: '',
        routeId: '',
        loadingDate: new Date().toISOString().split('T')[0],
        estimatedWeight: '',
        currentCost: '0',
        cargoType: '',
        notes: ''
      }));

      // 重新加载线路列表（更新使用次数）
      if (formData.projectId && formData.fleetManagerId) {
        loadRoutesByProject(formData.projectId, formData.fleetManagerId);
      }

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
                <Label>选择线路 <span className="text-red-500">*</span></Label>
                <Select 
                  value={formData.routeId} 
                  onValueChange={v => setFormData(prev => ({...prev, routeId: v}))}
                  disabled={!formData.projectId || favoriteRoutes.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!formData.projectId ? "请先选择项目" : favoriteRoutes.length === 0 ? "该项目暂无线路" : "选择线路"} />
                  </SelectTrigger>
                  <SelectContent>
                    {favoriteRoutes.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        {formData.projectId ? '该项目暂无线路，请先添加线路' : '请先选择项目'}
                      </div>
                    ) : (
                      favoriteRoutes.map(route => (
                        <SelectItem key={route.id} value={route.id}>
                          {route.route_name} ({route.loading_location} → {route.unloading_location})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {formData.routeId && (() => {
                  const selectedRoute = favoriteRoutes.find(r => r.id === formData.routeId);
                  return selectedRoute ? (
                    <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded">
                      <div>装货地: {selectedRoute.loading_location}</div>
                      <div>卸货地: {selectedRoute.unloading_location}</div>
                    </div>
                  ) : null;
                })()}
              </div>

              <div>
                <Label>运费设置（元）</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="运费金额"
                  value={formData.currentCost}
                  onChange={e => setFormData(prev => ({...prev, currentCost: e.target.value}))}
                />
                <p className="text-xs text-muted-foreground mt-1">默认运费为0，可手动输入实际运费</p>
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
              disabled={loading || !formData.fleetManagerId || !formData.projectId || !formData.driverId || !formData.routeId}
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

