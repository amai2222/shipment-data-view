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
  Settings,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  MapPin,
  Route,
  FolderKanban
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
  from_location: string;
  to_location: string;
  distance: number | null;
  estimated_time: number | null;
  notes: string | null;
}

export default function FleetManagerConfig() {
  const { toast } = useToast();
  
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

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'projects') {
        // 加载所有项目
        const { data: allProjects } = await supabase
          .from('projects')
          .select('id, name')
          .order('name');

        // 加载当前车队长负责的项目
        const { data: managedProjects } = await supabase
          .from('fleet_manager_projects')
          .select('project_id')
          .eq('fleet_manager_id', (await supabase.auth.getUser()).data.user?.id);
        
        const managedProjectIds = new Set(
          (managedProjects || []).map(mp => mp.project_id)
        );

        setProjects((allProjects || []).map(p => ({
          ...p,
          is_managed: managedProjectIds.has(p.id)
        })));
      }

      if (activeTab === 'locations') {
        const { data } = await supabase
          .from('locations')
          .select('*')
          .order('name');

        setLocations((data || []).map(l => ({
          ...l,
          is_favorite: false  // TODO: 从fleet_manager_locations表查询
        })));
      }

      if (activeTab === 'routes') {
        // TODO: 从fleet_manager_routes表加载
        setRoutes([]);
      }

    } catch (error: any) {
      toast({ title: '加载失败', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async () => {
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
    // TODO: 实现收藏/取消收藏地点
    toast({ title: '功能开发中', description: '收藏功能即将上线' });
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="车队配置"
        description="车队长配置管理的项目、地点、线路"
        icon={Settings}
        iconColor="text-blue-600"
      />

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
          <Card>
            <CardHeader>
              <CardTitle>管理的项目</CardTitle>
            </CardHeader>
            <CardContent>
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
                    {projects.map(project => (
                      <TableRow key={project.id}>
                        <TableCell>
                          <Checkbox
                            checked={project.is_managed}
                            onCheckedChange={async (checked) => {
                              try {
                                if (checked) {
                                  // 分配项目
                                  const { data, error } = await supabase.rpc('assign_project_to_fleet_manager', {
                                    p_project_id: project.id
                                  });
                                  
                                  if (error) throw error;
                                  
                                  if (!data.success) {
                                    toast({ title: '分配失败', description: data.message, variant: 'destructive' });
                                    return;
                                  }
                                  
                                  toast({ title: '分配成功', description: `已负责项目：${project.name}` });
                                } else {
                                  // 取消分配
                                  const { data, error } = await supabase.rpc('unassign_project_from_fleet_manager', {
                                    p_project_id: project.id
                                  });
                                  
                                  if (error) throw error;
                                  
                                  if (!data.success) {
                                    toast({ title: '取消失败', description: data.message, variant: 'destructive' });
                                    return;
                                  }
                                  
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="space-y-4">
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
                  <Button onClick={handleAddLocation} disabled={addingLocation}>
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
                    {locations.map(loc => (
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routes" className="space-y-4">
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
                  <Button disabled={addingRoute}>
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
              <div className="text-center py-8 text-muted-foreground">
                暂无常跑线路配置
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

