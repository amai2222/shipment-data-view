// PC端 - 车队配置管理
// 功能：车队长维护负责的项目、地点、线路

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { PageHeader } from '@/components/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Settings,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  MapPin,
  Route,
  FolderKanban,
  User,
  Edit,
  Users
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

interface Project {
  id: string;
  name: string;
  is_managed: boolean;
}

interface Location {
  id: string;
  name: string;
  address: string | null;
  is_favorite: boolean;
}

interface RouteConfig {
  id: string;
  route_name: string;
  from_location: string;
  to_location: string;
  from_location_id: string;
  to_location_id: string;
  project_id: string | null;
  distance: number | null;
  estimated_time: number | null;
  notes: string | null;
  use_count: number;
}

interface Driver {
  id: string;
  name: string;
  phone: string | null;
}

interface FleetManager {
  id: string;
  full_name: string;
}

export default function FleetManagerConfig() {
  const { toast } = useToast();
  
  const [selectedFleetManagerId, setSelectedFleetManagerId] = useState<string>('');
  const [fleetManagers, setFleetManagers] = useState<FleetManager[]>([]);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [activeTab, setActiveTab] = useState('projects');

  // 新增地点表单
  const [newLocation, setNewLocation] = useState({ name: '', address: '' });
  const [addingLocation, setAddingLocation] = useState(false);

  // 新增线路表单
  const [newRoute, setNewRoute] = useState({
    fromLocationId: '', // 起点地点ID
    toLocationId: '',    // 终点地点ID
    distance: '',
    time: '',
    notes: ''
  });
  const [addingRoute, setAddingRoute] = useState(false);

  // 编辑线路
  const [editingRoute, setEditingRoute] = useState<RouteConfig | null>(null);
  const [editRouteForm, setEditRouteForm] = useState({
    fromLocationId: '',
    toLocationId: '',
    distance: '',
    time: '',
    notes: ''
  });
  const [savingRoute, setSavingRoute] = useState(false);

  // 分配线路给司机
  const [assigningRoute, setAssigningRoute] = useState<RouteConfig | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  // 加载车队长列表
  useEffect(() => {
    const loadFleetManagers = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'fleet_manager')
          .order('full_name');
        
        setFleetManagers(data || []);
      } catch (error: any) {
        console.error('加载车队长列表失败:', error);
      }
    };
    
    loadFleetManagers();
  }, []);

  useEffect(() => {
    if (selectedFleetManagerId) {
      loadData();
    } else {
      // 清空数据
      setProjects([]);
      setLocations([]);
      setRoutes([]);
    }
  }, [activeTab, selectedFleetManagerId]);

  const loadData = async () => {
    if (!selectedFleetManagerId) {
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'projects') {
        // 加载所有项目
        const { data: allProjects } = await supabase
          .from('projects')
          .select('id, name')
          .order('name');

        // 加载选择的车队长负责的项目
        const { data: managedProjects } = await supabase
          .from('fleet_manager_projects')
          .select('project_id')
          .eq('fleet_manager_id', selectedFleetManagerId);
        
        const managedProjectIds = new Set(
          (managedProjects || []).map(mp => mp.project_id)
        );

        setProjects((allProjects || []).map(p => ({
          ...p,
          is_managed: managedProjectIds.has(p.id)
        })));
      }

      if (activeTab === 'locations') {
        // 1. 获取当前车队长负责的所有项目ID
        const { data: managedProjects, error: projectsError } = await supabase
          .from('fleet_manager_projects')
          .select('project_id')
          .eq('fleet_manager_id', selectedFleetManagerId);

        if (projectsError) throw projectsError;

        const projectIds = (managedProjects || []).map(mp => mp.project_id);

        // 2. 如果车队长没有负责任何项目，则不加载任何地点
        if (projectIds.length === 0) {
          setLocations([]);
          return;
        }

        // 3. 通过 location_projects 中间表查询与这些项目关联的地点ID
        const { data: locationProjects, error: locationProjectsError } = await supabase
          .from('location_projects')
          .select('location_id')
          .in('project_id', projectIds);

        if (locationProjectsError) throw locationProjectsError;

        const locationIds = [...new Set((locationProjects || []).map(lp => lp.location_id))];

        // 4. 如果没有任何关联的地点，则不加载
        if (locationIds.length === 0) {
          setLocations([]);
          return;
        }

        // 5. 根据地点ID查询地点详情
        const { data: locationData, error: locationError } = await supabase
          .from('locations')
          .select('*')
          .in('id', locationIds)
          .order('name');

        if (locationError) throw locationError;

        // 6. 查询该车队长在常用线路中使用的地点（作为常用地点的参考）
        const { data: favoriteRoutes } = await supabase
          .from('fleet_manager_favorite_routes')
          .select('loading_location_id, unloading_location_id')
          .eq('fleet_manager_id', selectedFleetManagerId);

        const favoriteLocationIds = new Set<string>();
        (favoriteRoutes || []).forEach(route => {
          if (route.loading_location_id) favoriteLocationIds.add(route.loading_location_id);
          if (route.unloading_location_id) favoriteLocationIds.add(route.unloading_location_id);
        });

        setLocations((locationData || []).map(l => ({
          ...l,
          is_favorite: favoriteLocationIds.has(l.id)
        })));
      }

      if (activeTab === 'routes') {
        // 1. 先加载地点列表（用于下拉选择和显示）
        const { data: managedProjects } = await supabase
          .from('fleet_manager_projects')
          .select('project_id')
          .eq('fleet_manager_id', selectedFleetManagerId);

        const projectIds = (managedProjects || []).map(mp => mp.project_id);
        
        if (projectIds.length > 0) {
          const { data: locationProjects } = await supabase
            .from('location_projects')
            .select('location_id')
            .in('project_id', projectIds);

          const locationIds = [...new Set((locationProjects || []).map(lp => lp.location_id))];

          if (locationIds.length > 0) {
            const { data: locationData } = await supabase
              .from('locations')
              .select('*')
              .in('id', locationIds)
              .order('name');
            
            setLocations((locationData || []).map(l => ({
              id: l.id,
              name: l.name,
              address: l.address,
              is_favorite: false
            })));
          } else {
            setLocations([]);
          }
        } else {
          setLocations([]);
        }

        // 2. 从fleet_manager_favorite_routes表加载该车队长的常用线路
        const { data: favoriteRoutes } = await supabase
          .from('fleet_manager_favorite_routes')
          .select('*')
          .eq('fleet_manager_id', selectedFleetManagerId)
          .order('use_count', { ascending: false });

        setRoutes((favoriteRoutes || []).map((r: any) => ({
          id: r.id,
          route_name: r.route_name,
          from_location: r.loading_location,
          to_location: r.unloading_location,
          distance: null,
          estimated_time: null,
          notes: r.notes || null,
          use_count: r.use_count || 0
        })));
      }

    } catch (error: any) {
      toast({ title: '加载失败', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async () => {
    if (!selectedFleetManagerId) {
      toast({ title: '请先选择车队长', variant: 'destructive' });
      return;
    }

    if (!newLocation.name) {
      toast({ title: '请输入地点名称', variant: 'destructive' });
      return;
    }

    setAddingLocation(true);
    try {
      const { error } = await supabase
        .from('locations')
        .insert({
          name: newLocation.name,
          address: newLocation.address || null,
          project_id: null  // 通用地点
        });

      if (error) throw error;

      toast({ title: '添加成功', description: `地点 ${newLocation.name} 已添加` });
      setNewLocation({ name: '', address: '' });
      loadData();

    } catch (error: any) {
      toast({ title: '添加失败', description: error.message, variant: 'destructive' });
    } finally {
      setAddingLocation(false);
    }
  };

  const handleToggleFavorite = async (locationId: string) => {
    if (!selectedFleetManagerId) {
      toast({ title: '请先选择车队长', variant: 'destructive' });
      return;
    }
    // 地点收藏功能：通过常用线路间接实现
    // 如果地点在常用线路中使用，则视为常用地点
    toast({ title: '提示', description: '地点常用状态由其在常用线路中的使用情况决定' });
  };

  const handleAddRoute = async () => {
    if (!selectedFleetManagerId) {
      toast({ title: '请先选择车队长', variant: 'destructive' });
      return;
    }

    if (!newRoute.fromLocationId || !newRoute.toLocationId || 
        newRoute.fromLocationId === 'no-locations' || newRoute.toLocationId === 'no-locations') {
      toast({ title: '请选择起点和终点', variant: 'destructive' });
      return;
    }

    // 获取起点和终点的名称
    const fromLocation = locations.find(l => l.id === newRoute.fromLocationId);
    const toLocation = locations.find(l => l.id === newRoute.toLocationId);
    
    if (!fromLocation || !toLocation) {
      toast({ title: '地点信息错误', variant: 'destructive' });
      return;
    }

    setAddingRoute(true);
    try {
      const routeName = `${fromLocation.name}→${toLocation.name}`;
      
      const { data, error } = await supabase.rpc('save_favorite_route', {
        p_route_name: routeName,
        p_project_id: null,
        p_loading_location_id: newRoute.fromLocationId,
        p_unloading_location_id: newRoute.toLocationId,
        p_notes: newRoute.notes || null,
        p_fleet_manager_id: selectedFleetManagerId  // 传递选择的车队长ID
      });

      if (error) throw error;

      if (!data.success) {
        toast({ title: '添加失败', description: data.message, variant: 'destructive' });
        return;
      }

      toast({ title: '添加成功', description: `线路 ${routeName} 已添加` });
      setNewRoute({ fromLocationId: '', toLocationId: '', distance: '', time: '', notes: '' });
      
      // 强制刷新线路列表（确保 activeTab 是 'routes' 时才会加载）
      if (activeTab === 'routes') {
        await loadData();
      } else {
        // 如果不在 routes 标签页，切换到 routes 标签页并加载数据
        setActiveTab('routes');
        // 使用 setTimeout 确保标签页切换后再加载
        setTimeout(() => {
          loadData();
        }, 100);
      }

    } catch (error: any) {
      console.error('❌ 添加线路失败:', error);
      console.error('错误详情:', {
        routeName,
        fromLocationId: newRoute.fromLocationId,
        toLocationId: newRoute.toLocationId,
        selectedFleetManagerId,
        error: error.message,
        errorCode: error.code,
        errorDetails: error.details
      });
      toast({ 
        title: '添加失败', 
        description: error.message || '请检查控制台查看详细错误信息', 
        variant: 'destructive' 
      });
    } finally {
      setAddingRoute(false);
    }
  };

  // 打开编辑对话框
  const handleEditRoute = (route: RouteConfig) => {
    setEditingRoute(route);
    setEditRouteForm({
      fromLocationId: route.from_location_id,
      toLocationId: route.to_location_id,
      distance: route.distance?.toString() || '',
      time: route.estimated_time?.toString() || '',
      notes: route.notes || ''
    });
  };

  // 保存编辑的线路
  const handleSaveEditRoute = async () => {
    if (!selectedFleetManagerId || !editingRoute) {
      return;
    }

    if (!editRouteForm.fromLocationId || !editRouteForm.toLocationId || 
        editRouteForm.fromLocationId === 'no-locations' || editRouteForm.toLocationId === 'no-locations') {
      toast({ title: '请选择起点和终点', variant: 'destructive' });
      return;
    }

    // 获取起点和终点的名称
    const fromLocation = locations.find(l => l.id === editRouteForm.fromLocationId);
    const toLocation = locations.find(l => l.id === editRouteForm.toLocationId);
    
    if (!fromLocation || !toLocation) {
      toast({ title: '地点信息错误', variant: 'destructive' });
      return;
    }

    setSavingRoute(true);
    try {
      const routeName = `${fromLocation.name}→${toLocation.name}`;
      
      // 更新线路信息
      const { error: updateError } = await supabase
        .from('fleet_manager_favorite_routes')
        .update({
          route_name: routeName,
          loading_location_id: editRouteForm.fromLocationId,
          unloading_location_id: editRouteForm.toLocationId,
          loading_location: fromLocation.name,
          unloading_location: toLocation.name,
          notes: editRouteForm.notes || null
        })
        .eq('id', editingRoute.id)
        .eq('fleet_manager_id', selectedFleetManagerId);

      if (updateError) throw updateError;

      toast({ title: '保存成功', description: `线路 ${routeName} 已更新` });
      setEditingRoute(null);
      await loadData();

    } catch (error: any) {
      console.error('保存线路失败:', error);
      toast({ 
        title: '保存失败', 
        description: error.message || '请检查控制台查看详细错误信息', 
        variant: 'destructive' 
      });
    } finally {
      setSavingRoute(false);
    }
  };

  // 打开分配对话框
  const handleAssignRoute = async (route: RouteConfig) => {
    setAssigningRoute(route);
    setSelectedDriverIds([]);

    try {
      // 加载该车队长的所有司机
      const { data: driverData, error } = await supabase
        .from('internal_drivers')
        .select('id, name, phone')
        .eq('fleet_manager_id', selectedFleetManagerId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setDrivers(driverData || []);

      // 加载已分配的司机
      const { data: assignedDrivers } = await supabase
        .from('fleet_manager_favorite_route_drivers')
        .select('driver_id')
        .eq('route_id', route.id);

      if (assignedDrivers) {
        setSelectedDriverIds(assignedDrivers.map(ad => ad.driver_id));
      }

    } catch (error: any) {
      console.error('加载司机列表失败:', error);
      toast({ 
        title: '加载失败', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  // 保存分配
  const handleSaveAssignRoute = async () => {
    if (!assigningRoute) {
      return;
    }

    setAssigning(true);
    try {
      const { data, error } = await supabase.rpc('assign_route_to_drivers', {
        p_route_id: assigningRoute.id,
        p_driver_ids: selectedDriverIds.length > 0 ? selectedDriverIds : null
      });

      if (error) throw error;

      if (!data.success) {
        toast({ title: '分配失败', description: data.message, variant: 'destructive' });
        return;
      }

      toast({ title: '分配成功', description: data.message });
      setAssigningRoute(null);
      setSelectedDriverIds([]);

    } catch (error: any) {
      console.error('分配线路失败:', error);
      toast({ 
        title: '分配失败', 
        description: error.message || '请检查控制台查看详细错误信息', 
        variant: 'destructive' 
      });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="车队配置"
        description="车队长配置管理的项目、地点、线路"
        icon={Settings}
        iconColor="text-blue-600"
      />

      {/* 车队长选择器 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label className="flex items-center gap-2 whitespace-nowrap">
              <User className="h-4 w-4" />
              选择车队长
              <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={selectedFleetManagerId} 
              onValueChange={(value) => {
                setSelectedFleetManagerId(value);
                // 切换车队长时清空数据
                setProjects([]);
                setLocations([]);
                setRoutes([]);
              }}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="请选择车队长" />
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
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="projects">
            <FolderKanban className="h-4 w-4 mr-2" />
            负责项目
          </TabsTrigger>
          <TabsTrigger value="locations">
            <MapPin className="h-4 w-4 mr-2" />
            常用地点
          </TabsTrigger>
          <TabsTrigger value="routes">
            <Route className="h-4 w-4 mr-2" />
            常跑线路
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          {!selectedFleetManagerId ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                请先选择车队长
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>管理的项目</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">加载中...</div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>项目名称</TableHead>
                          <TableHead>状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projects.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                              暂无项目数据
                            </TableCell>
                          </TableRow>
                        ) : (
                          projects.map(project => (
                            <TableRow key={project.id}>
                              <TableCell>
                                <Checkbox
                                  checked={project.is_managed}
                                  onCheckedChange={async (checked) => {
                                    try {
                                      if (checked) {
                                        // 分配项目给选择的车队长
                                        const { error: insertError } = await supabase
                                          .from('fleet_manager_projects')
                                          .insert({
                                            fleet_manager_id: selectedFleetManagerId,
                                            project_id: project.id
                                          });
                                        
                                        if (insertError) throw insertError;
                                        
                                        toast({ title: '分配成功', description: `已负责项目：${project.name}` });
                                      } else {
                                        // 取消分配
                                        const { error: deleteError } = await supabase
                                          .from('fleet_manager_projects')
                                          .delete()
                                          .eq('fleet_manager_id', selectedFleetManagerId)
                                          .eq('project_id', project.id);
                                        
                                        if (deleteError) throw deleteError;
                                        
                                        toast({ title: '取消成功', description: `已取消负责项目：${project.name}` });
                                      }
                                      
                                      loadData();
                                    } catch (error: any) {
                                      toast({ title: '操作失败', description: error.message, variant: 'destructive' });
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-semibold">{project.name}</TableCell>
                              <TableCell>
                                {project.is_managed ? (
                                  <Badge className="bg-green-100 text-green-800">负责中</Badge>
                                ) : (
                                  <Badge variant="outline">未负责</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="locations" className="space-y-4">
          {!selectedFleetManagerId ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                请先选择车队长
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>添加常用地点</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>地点名称</Label>
                      <Input
                        placeholder="如：昆明仓库"
                        value={newLocation.name}
                        onChange={e => setNewLocation(prev => ({...prev, name: e.target.value}))}
                      />
                    </div>
                    <div>
                      <Label>详细地址</Label>
                      <Input
                        placeholder="可选"
                        value={newLocation.address}
                        onChange={e => setNewLocation(prev => ({...prev, address: e.target.value}))}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleAddLocation} disabled={addingLocation || !selectedFleetManagerId}>
                        <Plus className="h-4 w-4 mr-2" />
                        添加
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>地点列表</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">加载中...</div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>地点名称</TableHead>
                            <TableHead>地址</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead className="text-center">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {locations.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                暂无地点数据
                              </TableCell>
                            </TableRow>
                          ) : (
                            locations.map(loc => (
                              <TableRow key={loc.id}>
                                <TableCell className="font-semibold">{loc.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {loc.address || '-'}
                                </TableCell>
                                <TableCell>
                                  {loc.is_favorite ? (
                                    <Badge className="bg-blue-100 text-blue-800">常用</Badge>
                                  ) : (
                                    <Badge variant="outline">普通</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleToggleFavorite(loc.id)}
                                  >
                                    {loc.is_favorite ? '取消收藏' : '设为常用'}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="routes" className="space-y-4">
          {!selectedFleetManagerId ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                请先选择车队长
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>添加常跑线路</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label>起点</Label>
                        <Select
                          value={newRoute.fromLocationId}
                          onValueChange={(value) => setNewRoute(prev => ({...prev, fromLocationId: value}))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择起点" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.length === 0 ? (
                              <SelectItem value="no-locations" disabled>暂无地点，请先在"常用地点"中添加</SelectItem>
                            ) : (
                              locations.map(location => (
                                <SelectItem key={location.id} value={location.id}>
                                  {location.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>终点</Label>
                        <Select
                          value={newRoute.toLocationId}
                          onValueChange={(value) => setNewRoute(prev => ({...prev, toLocationId: value}))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择终点" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.length === 0 ? (
                              <SelectItem value="no-locations" disabled>暂无地点，请先在"常用地点"中添加</SelectItem>
                            ) : (
                              locations.map(location => (
                                <SelectItem key={location.id} value={location.id}>
                                  {location.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>距离(公里)</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={newRoute.distance}
                          onChange={e => setNewRoute(prev => ({...prev, distance: e.target.value}))}
                        />
                      </div>
                      <div>
                        <Label>预计时长(小时)</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={newRoute.time}
                          onChange={e => setNewRoute(prev => ({...prev, time: e.target.value}))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-4">
                      <div className="col-span-4">
                        <Label>备注</Label>
                        <Input
                          placeholder="输入备注信息（可选）"
                          value={newRoute.notes}
                          onChange={e => setNewRoute(prev => ({...prev, notes: e.target.value}))}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button onClick={handleAddRoute} disabled={addingRoute || !selectedFleetManagerId} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          添加
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>线路列表</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground">加载中...</div>
                  ) : routes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      暂无常跑线路配置
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>线路名称</TableHead>
                            <TableHead>起点</TableHead>
                            <TableHead>终点</TableHead>
                            <TableHead>备注</TableHead>
                            <TableHead className="text-center">使用次数</TableHead>
                            <TableHead className="text-center">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {routes.map(route => (
                            <TableRow key={route.id}>
                              <TableCell className="font-semibold">{route.route_name}</TableCell>
                              <TableCell>{route.from_location}</TableCell>
                              <TableCell>{route.to_location}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{route.notes || '-'}</TableCell>
                              <TableCell className="text-center">{route.use_count}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditRoute(route)}
                                    title="编辑"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleAssignRoute(route)}
                                    title="分配"
                                  >
                                    <Users className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={async () => {
                                      if (!confirm('确定要删除这条线路吗？')) {
                                        return;
                                      }
                                      try {
                                        const { error } = await supabase
                                          .from('fleet_manager_favorite_routes')
                                          .delete()
                                          .eq('id', route.id)
                                          .eq('fleet_manager_id', selectedFleetManagerId);
                                        
                                        if (error) throw error;
                                        
                                        toast({ title: '删除成功', description: '线路已删除' });
                                        loadData();
                                      } catch (error: any) {
                                        toast({ title: '删除失败', description: error.message, variant: 'destructive' });
                                      }
                                    }}
                                    title="删除"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* 编辑线路对话框 */}
      <Dialog open={!!editingRoute} onOpenChange={(open) => !open && setEditingRoute(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑线路</DialogTitle>
            <DialogDescription>
              修改线路的起点、终点和备注信息
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>起点</Label>
                <Select
                  value={editRouteForm.fromLocationId}
                  onValueChange={(value) => setEditRouteForm(prev => ({...prev, fromLocationId: value}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择起点" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.length === 0 ? (
                      <SelectItem value="no-locations" disabled>暂无地点</SelectItem>
                    ) : (
                      locations.map(location => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>终点</Label>
                <Select
                  value={editRouteForm.toLocationId}
                  onValueChange={(value) => setEditRouteForm(prev => ({...prev, toLocationId: value}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择终点" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.length === 0 ? (
                      <SelectItem value="no-locations" disabled>暂无地点</SelectItem>
                    ) : (
                      locations.map(location => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>距离(公里)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={editRouteForm.distance}
                  onChange={e => setEditRouteForm(prev => ({...prev, distance: e.target.value}))}
                />
              </div>
              <div>
                <Label>预计时长(小时)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={editRouteForm.time}
                  onChange={e => setEditRouteForm(prev => ({...prev, time: e.target.value}))}
                />
              </div>
            </div>
            <div>
              <Label>备注</Label>
              <Textarea
                placeholder="输入备注信息（可选）"
                value={editRouteForm.notes}
                onChange={e => setEditRouteForm(prev => ({...prev, notes: e.target.value}))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingRoute(null)}
            >
              取消
            </Button>
            <Button
              onClick={handleSaveEditRoute}
              disabled={savingRoute || !editRouteForm.fromLocationId || !editRouteForm.toLocationId}
            >
              {savingRoute ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分配线路给司机对话框 */}
      <Dialog open={!!assigningRoute} onOpenChange={(open) => !open && setAssigningRoute(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>分配线路给司机</DialogTitle>
            <DialogDescription>
              选择要分配该线路的司机（可多选）
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {assigningRoute && (
              <div className="p-3 bg-muted rounded-md">
                <div className="text-sm font-semibold">线路：{assigningRoute.route_name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {assigningRoute.from_location} → {assigningRoute.to_location}
                </div>
              </div>
            )}

            <div className="border rounded-md max-h-[400px] overflow-y-auto">
              {drivers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  暂无司机数据
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {drivers.map(driver => (
                    <div
                      key={driver.id}
                      className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                      onClick={() => {
                        setSelectedDriverIds(prev => {
                          if (prev.includes(driver.id)) {
                            return prev.filter(id => id !== driver.id);
                          } else {
                            return [...prev, driver.id];
                          }
                        });
                      }}
                    >
                      <Checkbox
                        checked={selectedDriverIds.includes(driver.id)}
                        onCheckedChange={(checked) => {
                          setSelectedDriverIds(prev => {
                            if (checked) {
                              return [...prev, driver.id];
                            } else {
                              return prev.filter(id => id !== driver.id);
                            }
                          });
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{driver.name}</div>
                        {driver.phone && (
                          <div className="text-sm text-muted-foreground">{driver.phone}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              已选择 {selectedDriverIds.length} 个司机
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssigningRoute(null);
                setSelectedDriverIds([]);
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleSaveAssignRoute}
              disabled={assigning}
            >
              {assigning ? '分配中...' : `分配 (${selectedDriverIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

