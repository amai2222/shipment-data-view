// 移动端 - 车队长常用线路配置
// 功能：车队长维护常用线路，供司机在"常用运单"中使用

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Route,
  Plus,
  Trash2,
  Edit,
  MapPin,
  FolderKanban
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Project {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  address: string | null;
}

interface RouteConfig {
  id: string;
  route_name: string;
  project_id: string | null;
  project_name: string | null;
  loading_location: string;
  unloading_location: string;
  notes: string | null;
  use_count: number;
  last_used_at: string | null;
}

export default function MobileFleetManagerConfig() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [fleetManagerId, setFleetManagerId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  
  // 添加线路对话框
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRoute, setNewRoute] = useState({
    projectId: 'none',
    fromLocationId: '',
    toLocationId: '',
    notes: ''
  });
  const [addingRoute, setAddingRoute] = useState(false);

  // 加载当前用户信息
  useEffect(() => {
    loadMyInfo();
  }, []);

  // 当获取到车队长ID后，加载数据
  useEffect(() => {
    if (fleetManagerId) {
      loadData();
    }
  }, [fleetManagerId]);

  const loadMyInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setFleetManagerId(user.id);
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  };

  const loadData = async () => {
    if (!fleetManagerId) return;
    
    setLoading(true);
    try {
      // 1. 加载车队长管理的项目
      const { data: managedProjects, error: projectsError } = await supabase
        .from('fleet_manager_projects')
        .select('project_id, projects:project_id (id, name, project_status)')
        .eq('fleet_manager_id', fleetManagerId);
      
      // 过滤出状态为"进行中"的项目
      const activeProjects = (managedProjects || []).filter((mp: any) => 
        mp.projects && mp.projects.project_status === '进行中'
      );
      
      if (projectsError) {
        console.error('加载项目失败:', projectsError);
        toast({
          title: '加载失败',
          description: '无法加载项目列表',
          variant: 'destructive'
        });
        return;
      }

      const projectList: Project[] = [];
      const projectIds: string[] = [];
      
      if (activeProjects) {
        activeProjects.forEach((mp: any) => {
          if (mp.projects) {
            projectList.push({
              id: mp.projects.id,
              name: mp.projects.name
            });
            projectIds.push(mp.projects.id);
          }
        });
      }
      
      setProjects(projectList);

      // 2. 加载这些项目关联的地点
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
          
          setLocations(locationData || []);
        } else {
          setLocations([]);
        }
      } else {
        setLocations([]);
      }

      // 3. 加载常用线路
      const { data: favoriteRoutes } = await supabase
        .from('fleet_manager_favorite_routes')
        .select(`
          id,
          route_name,
          project_id,
          loading_location_id,
          unloading_location_id,
          loading_location,
          unloading_location,
          notes,
          use_count,
          last_used_at,
          projects:project_id (
            id,
            name
          )
        `)
        .eq('fleet_manager_id', fleetManagerId)
        .order('use_count', { ascending: false })
        .order('last_used_at', { ascending: false, nullsFirst: false });

      setRoutes((favoriteRoutes || []).map((r: any) => ({
        id: r.id,
        route_name: r.route_name,
        project_id: r.project_id,
        project_name: r.projects?.name || null,
        loading_location: r.loading_location,
        unloading_location: r.unloading_location,
        notes: r.notes || null,
        use_count: r.use_count || 0,
        last_used_at: r.last_used_at
      })));

    } catch (error: any) {
      console.error('加载数据失败:', error);
      toast({ 
        title: '加载失败', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddRoute = async () => {
    if (!fleetManagerId) {
      toast({ title: '未获取到车队长信息', variant: 'destructive' });
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
        p_project_id: (newRoute.projectId && newRoute.projectId !== 'none') ? newRoute.projectId : null,
        p_loading_location_id: newRoute.fromLocationId,
        p_unloading_location_id: newRoute.toLocationId,
        p_notes: newRoute.notes || null,
        p_fleet_manager_id: fleetManagerId
      });

      if (error) throw error;

      if (!data.success) {
        toast({ title: '添加失败', description: data.message, variant: 'destructive' });
        return;
      }

      toast({ title: '添加成功', description: `线路 ${routeName} 已添加` });
      setNewRoute({ projectId: 'none', fromLocationId: '', toLocationId: '', notes: '' });
      setShowAddDialog(false);
      await loadData();

    } catch (error: any) {
      console.error('添加线路失败:', error);
      toast({ 
        title: '添加失败', 
        description: error.message || '请检查控制台查看详细错误信息', 
        variant: 'destructive' 
      });
    } finally {
      setAddingRoute(false);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!confirm('确定要删除这条常用线路吗？')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('fleet_manager_favorite_routes')
        .delete()
        .eq('id', routeId)
        .eq('fleet_manager_id', fleetManagerId);

      if (error) throw error;

      toast({ title: '删除成功', description: '常用线路已删除' });
      await loadData();

    } catch (error: any) {
      console.error('删除线路失败:', error);
      toast({ 
        title: '删除失败', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  return (
    <MobileLayout>
      <div className="space-y-4 pb-6">
        {/* 页面标题 */}
        <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Route className="h-6 w-6" />
              常用线路配置
            </h2>
            <p className="text-sm text-blue-100 mt-1">配置常用线路，供司机快速录入运单</p>
          </CardContent>
        </Card>

        {/* 添加按钮 */}
        <Button 
          onClick={() => setShowAddDialog(true)}
          className="w-full h-14"
          size="lg"
        >
          <Plus className="h-5 w-5 mr-2" />
          添加常用线路
        </Button>

        {/* 线路列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Route className="h-4 w-4" />
              已配置线路 ({routes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                加载中...
              </div>
            ) : routes.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                暂无常用线路，点击上方按钮添加
              </div>
            ) : (
              <div className="space-y-3">
                {routes.map((route) => (
                  <Card key={route.id} className="border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-base">{route.route_name}</h3>
                            {route.project_name && (
                              <Badge variant="secondary" className="text-xs">
                                <FolderKanban className="h-3 w-3 mr-1" />
                                {route.project_name}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span>起点：{route.loading_location}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span>终点：{route.unloading_location}</span>
                            </div>
                            {route.notes && (
                              <div className="text-xs text-muted-foreground mt-1">
                                备注：{route.notes}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              使用 {route.use_count} 次
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRoute(route.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 添加线路对话框 */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>添加常用线路</DialogTitle>
              <DialogDescription>
                配置一条常用线路，司机可以在"常用运单"中快速使用
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Label>关联项目（可选）</Label>
                <Select
                  value={newRoute.projectId}
                  onValueChange={(value) => setNewRoute(prev => ({...prev, projectId: value}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择项目（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联项目</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>起点地点 *</Label>
                <Select
                  value={newRoute.fromLocationId}
                  onValueChange={(value) => setNewRoute(prev => ({...prev, fromLocationId: value}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择起点" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.length === 0 ? (
                      <SelectItem value="no-locations" disabled>暂无地点，请先配置项目</SelectItem>
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
                <Label>终点地点 *</Label>
                <Select
                  value={newRoute.toLocationId}
                  onValueChange={(value) => setNewRoute(prev => ({...prev, toLocationId: value}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择终点" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.length === 0 ? (
                      <SelectItem value="no-locations" disabled>暂无地点，请先配置项目</SelectItem>
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
                <Label>备注（可选）</Label>
                <Textarea
                  value={newRoute.notes}
                  onChange={(e) => setNewRoute(prev => ({...prev, notes: e.target.value}))}
                  placeholder="输入备注信息"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  setNewRoute({ projectId: 'none', fromLocationId: '', toLocationId: '', notes: '' });
                }}
              >
                取消
              </Button>
              <Button
                onClick={handleAddRoute}
                disabled={addingRoute || !newRoute.fromLocationId || !newRoute.toLocationId}
              >
                {addingRoute ? '添加中...' : '添加'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
}

