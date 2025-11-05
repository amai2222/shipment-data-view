// PC端 - 车队信息维护
// 功能：司机分配给车队长、车队长分配项目线路

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import {
  Users,
  Truck,
  MapPin,
  Edit,
  Trash2,
  Plus,
  RefreshCw,
  UserPlus,
  Route as RouteIcon,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  phone: string;
  fleet_manager_id: string | null;
  fleet_manager_name: string | null;
  primary_vehicle: string | null;
}

interface FleetManager {
  id: string;
  full_name: string;
  email: string;
  driver_count: number;
}

interface DriverRoute {
  id: string;
  driver_id: string;
  driver_name: string;
  project_id: string;
  project_name: string;
  is_primary_route: boolean;
  loading_location_count: number;
  unloading_location_count: number;
}

interface Project {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
}

export default function FleetManagement() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fleetManagers, setFleetManagers] = useState<FleetManager[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [driverRoutes, setDriverRoutes] = useState<DriverRoute[]>([]);
  
  // 司机分配对话框
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [selectedFleetManager, setSelectedFleetManager] = useState('');
  
  // 线路配置对话框
  const [showRouteDialog, setShowRouteDialog] = useState(false);
  const [routeDriver, setRouteDriver] = useState('');
  const [routeProject, setRouteProject] = useState('');
  const [routeIsPrimary, setRouteIsPrimary] = useState(false);
  const [routeLoadingLocations, setRouteLoadingLocations] = useState<string[]>([]);
  const [routeUnloadingLocations, setRouteUnloadingLocations] = useState<string[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDrivers(),
        loadFleetManagers(),
        loadProjects(),
        loadLocations(),
        loadDriverRoutes()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadDrivers = async () => {
    const { data, error } = await supabase
      .from('internal_drivers')
      .select(`
        id,
        name,
        phone,
        fleet_manager_id,
        fleet_manager:profiles!fleet_manager_id(full_name)
      `)
      .order('name');
    
    if (error) throw error;
    
    const processedDrivers = (data || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      fleet_manager_id: d.fleet_manager_id,
      fleet_manager_name: d.fleet_manager?.full_name || null,
      primary_vehicle: null
    }));
    
    setDrivers(processedDrivers);
  };

  const loadFleetManagers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'fleet_manager')
      .order('full_name');
    
    if (error) throw error;
    
    // 统计每个车队长的司机数
    const managersWithCount = await Promise.all(
      (data || []).map(async (fm) => {
        const { count } = await supabase
          .from('internal_drivers')
          .select('*', { count: 'exact', head: true })
          .eq('fleet_manager_id', fm.id);
        
        return {
          id: fm.id,
          full_name: fm.full_name,
          email: fm.email,
          driver_count: count || 0
        };
      })
    );
    
    setFleetManagers(managersWithCount);
  };

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .order('name');
    
    if (error) throw error;
    setProjects(data || []);
  };

  const loadLocations = async () => {
    const { data, error } = await supabase
      .from('locations')
      .select('id, name')
      .order('name');
    
    if (error) throw error;
    setLocations(data || []);
  };

  const loadDriverRoutes = async () => {
    const { data, error } = await supabase
      .from('internal_driver_project_routes')
      .select(`
        id,
        driver_id,
        driver:internal_drivers(name),
        project_id,
        project:projects(name),
        is_primary_route,
        common_loading_location_ids,
        common_unloading_location_ids
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    const processedRoutes = (data || []).map((r: any) => ({
      id: r.id,
      driver_id: r.driver_id,
      driver_name: r.driver?.name || '',
      project_id: r.project_id,
      project_name: r.project?.name || '',
      is_primary_route: r.is_primary_route,
      loading_location_count: r.common_loading_location_ids?.length || 0,
      unloading_location_count: r.common_unloading_location_ids?.length || 0
    }));
    
    setDriverRoutes(processedRoutes);
  };

  // 分配司机给车队长
  const handleAssignDrivers = async () => {
    if (selectedDrivers.length === 0 || !selectedFleetManager) {
      toast({
        title: '请完整选择',
        description: '请选择司机和车队长',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('internal_drivers')
        .update({ fleet_manager_id: selectedFleetManager } as any)
        .in('id', selectedDrivers);

      if (error) throw error;

      toast({
        title: '分配成功',
        description: `已将${selectedDrivers.length}个司机分配给车队长`
      });

      setShowAssignDialog(false);
      setSelectedDrivers([]);
      setSelectedFleetManager('');
      loadAllData();
    } catch (error: any) {
      toast({
        title: '分配失败',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 保存司机线路配置
  const handleSaveRoute = async () => {
    if (!routeDriver || !routeProject) {
      toast({
        title: '请完整填写',
        description: '请选择司机和项目',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('internal_driver_project_routes')
        .insert([{
          driver_id: routeDriver,
          project_id: routeProject,
          is_primary_route: routeIsPrimary,
          common_loading_location_ids: routeLoadingLocations,
          common_unloading_location_ids: routeUnloadingLocations
        }] as any);

      if (error) throw error;

      toast({
        title: '配置成功',
        description: '司机项目线路已配置'
      });

      setShowRouteDialog(false);
      resetRouteForm();
      loadDriverRoutes();
    } catch (error: any) {
      toast({
        title: '配置失败',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetRouteForm = () => {
    setRouteDriver('');
    setRouteProject('');
    setRouteIsPrimary(false);
    setRouteLoadingLocations([]);
    setRouteUnloadingLocations([]);
  };

  // 删除线路配置
  const handleDeleteRoute = async (routeId: string) => {
    if (!confirm('确定删除此线路配置？')) return;

    try {
      const { error } = await supabase
        .from('internal_driver_project_routes')
        .delete()
        .eq('id', routeId);

      if (error) throw error;

      toast({
        title: '删除成功',
        description: '线路配置已删除'
      });

      loadDriverRoutes();
    } catch (error: any) {
      toast({
        title: '删除失败',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="车队信息维护"
        description="管理车队长和司机的关系，配置司机的项目线路"
        icon={Users}
        iconColor="text-blue-600"
      >
        <Button variant="outline" size="sm" onClick={loadAllData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </PageHeader>

      <Tabs defaultValue="assignment" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assignment">
            <UserPlus className="h-4 w-4 mr-2" />
            司机分配
          </TabsTrigger>
          <TabsTrigger value="routes">
            <RouteIcon className="h-4 w-4 mr-2" />
            线路配置
          </TabsTrigger>
        </TabsList>

        {/* 标签页1：司机分配 */}
        <TabsContent value="assignment" className="space-y-4">
          {/* 车队长概览 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {fleetManagers.map(fm => (
              <Card key={fm.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    {fm.full_name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">{fm.email}</div>
                    <Badge variant="secondary">
                      管理 {fm.driver_count} 个司机
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 司机列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>司机分配管理</span>
                <Button onClick={() => setShowAssignDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  批量分配
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedDrivers.length === drivers.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDrivers(drivers.map(d => d.id));
                          } else {
                            setSelectedDrivers([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>司机姓名</TableHead>
                    <TableHead>电话</TableHead>
                    <TableHead>主车</TableHead>
                    <TableHead>所属车队长</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        暂无司机数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    drivers.map(driver => (
                      <TableRow key={driver.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedDrivers.includes(driver.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedDrivers([...selectedDrivers, driver.id]);
                              } else {
                                setSelectedDrivers(selectedDrivers.filter(id => id !== driver.id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{driver.name}</TableCell>
                        <TableCell>{driver.phone}</TableCell>
                        <TableCell>{driver.primary_vehicle || '-'}</TableCell>
                        <TableCell>
                          {driver.fleet_manager_name ? (
                            <Badge>{driver.fleet_manager_name}</Badge>
                          ) : (
                            <Badge variant="outline">未分配</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedDrivers([driver.id]);
                              setShowAssignDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 标签页2：线路配置 */}
        <TabsContent value="routes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>司机项目线路配置</span>
                <Button onClick={() => setShowRouteDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  新增线路
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>司机</TableHead>
                    <TableHead>项目</TableHead>
                    <TableHead>主线路</TableHead>
                    <TableHead>装货地点数</TableHead>
                    <TableHead>卸货地点数</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driverRoutes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        暂无线路配置
                      </TableCell>
                    </TableRow>
                  ) : (
                    driverRoutes.map(route => (
                      <TableRow key={route.id}>
                        <TableCell className="font-medium">{route.driver_name}</TableCell>
                        <TableCell>{route.project_name}</TableCell>
                        <TableCell>
                          {route.is_primary_route ? (
                            <Badge className="bg-green-600">主线路</Badge>
                          ) : (
                            <Badge variant="outline">备用</Badge>
                          )}
                        </TableCell>
                        <TableCell>{route.loading_location_count} 个</TableCell>
                        <TableCell>{route.unloading_location_count} 个</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteRoute(route.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 司机分配对话框 */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分配司机给车队长</DialogTitle>
            <DialogDescription>
              选择车队长，将选中的司机分配给他管理
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>选中的司机（{selectedDrivers.length}人）</Label>
              <div className="p-3 bg-muted rounded">
                {selectedDrivers.map(id => {
                  const driver = drivers.find(d => d.id === id);
                  return driver ? (
                    <Badge key={id} className="mr-2">{driver.name}</Badge>
                  ) : null;
                })}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>分配给车队长</Label>
              <Select value={selectedFleetManager} onValueChange={setSelectedFleetManager}>
                <SelectTrigger>
                  <SelectValue placeholder="选择车队长" />
                </SelectTrigger>
                <SelectContent>
                  {fleetManagers.map(fm => (
                    <SelectItem key={fm.id} value={fm.id}>
                      {fm.full_name} - 当前管理 {fm.driver_count} 人
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              取消
            </Button>
            <Button onClick={handleAssignDrivers} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              确认分配
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 线路配置对话框 */}
      <Dialog open={showRouteDialog} onOpenChange={setShowRouteDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>配置司机项目线路</DialogTitle>
            <DialogDescription>
              为司机配置常跑的项目和常用地点，方便司机快速录入运单
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>选择司机</Label>
                <Select value={routeDriver} onValueChange={setRouteDriver}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择司机" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map(driver => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} - {driver.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>选择项目</Label>
                <Select value={routeProject} onValueChange={setRouteProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择项目" />
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

            <div className="flex items-center space-x-2">
              <Checkbox
                id="primary-route"
                checked={routeIsPrimary}
                onCheckedChange={(checked) => setRouteIsPrimary(checked as boolean)}
              />
              <Label htmlFor="primary-route">设为主线路（司机最常跑的）</Label>
            </div>

            <div className="grid gap-2">
              <Label>常用装货地点（可多选）</Label>
              <div className="max-h-48 overflow-y-auto border rounded p-3 space-y-2">
                {locations.map(loc => (
                  <div key={loc.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`load-${loc.id}`}
                      checked={routeLoadingLocations.includes(loc.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setRouteLoadingLocations([...routeLoadingLocations, loc.id]);
                        } else {
                          setRouteLoadingLocations(routeLoadingLocations.filter(id => id !== loc.id));
                        }
                      }}
                    />
                    <Label htmlFor={`load-${loc.id}`}>{loc.name}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>常用卸货地点（可多选）</Label>
              <div className="max-h-48 overflow-y-auto border rounded p-3 space-y-2">
                {locations.map(loc => (
                  <div key={loc.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`unload-${loc.id}`}
                      checked={routeUnloadingLocations.includes(loc.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setRouteUnloadingLocations([...routeUnloadingLocations, loc.id]);
                        } else {
                          setRouteUnloadingLocations(routeUnloadingLocations.filter(id => id !== loc.id));
                        }
                      }}
                    />
                    <Label htmlFor={`unload-${loc.id}`}>{loc.name}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRouteDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveRoute} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

