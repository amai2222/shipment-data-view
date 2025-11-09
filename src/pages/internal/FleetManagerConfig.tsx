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
  User
} from 'lucide-react';

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
  distance: number | null;
  estimated_time: number | null;
  notes: string | null;
  use_count: number;
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
    from: '',
    to: '',
    distance: '',
    time: '',
    notes: ''
  });
  const [addingRoute, setAddingRoute] = useState(false);

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
        // 从fleet_manager_favorite_routes表加载该车队长的常用线路
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
          notes: null,
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

    if (!newRoute.from || !newRoute.to) {
      toast({ title: '请填写起点和终点', variant: 'destructive' });
      return;
    }

    setAddingRoute(true);
    try {
      const routeName = `${newRoute.from}→${newRoute.to}`;
      
      const { data, error } = await supabase.rpc('save_favorite_route', {
        p_route_name: routeName,
        p_project_id: null,
        p_loading_location_id: null,
        p_unloading_location_id: null
      });

      if (error) throw error;

      if (!data.success) {
        toast({ title: '添加失败', description: data.message, variant: 'destructive' });
        return;
      }

      toast({ title: '添加成功', description: `线路 ${routeName} 已添加` });
      setNewRoute({ from: '', to: '', distance: '', time: '', notes: '' });
      loadData();

    } catch (error: any) {
      toast({ title: '添加失败', description: error.message, variant: 'destructive' });
    } finally {
      setAddingRoute(false);
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
                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <Label>起点</Label>
                      <Input
                        placeholder="起点"
                        value={newRoute.from}
                        onChange={e => setNewRoute(prev => ({...prev, from: e.target.value}))}
                      />
                    </div>
                    <div>
                      <Label>终点</Label>
                      <Input
                        placeholder="终点"
                        value={newRoute.to}
                        onChange={e => setNewRoute(prev => ({...prev, to: e.target.value}))}
                      />
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
                    <div className="flex items-end">
                      <Button onClick={handleAddRoute} disabled={addingRoute || !selectedFleetManagerId}>
                        <Plus className="h-4 w-4 mr-2" />
                        添加
                      </Button>
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
                              <TableCell className="text-center">{route.use_count}</TableCell>
                              <TableCell className="text-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => {
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
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
    </div>
  );
}

