// 移动端 - 车队长派单页面

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Send,
  Plus,
  Star,
  MapPin,
  Calendar,
  Weight,
  Truck,
  Loader2,
  Save,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface Driver {
  id: string;
  name: string;
  phone: string;
  license_plate?: string;
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

interface Location {
  id: string;
  name: string;
}

interface DispatchOrder {
  id: string;
  order_number: string;
  driver_name: string;
  project_name: string;
  loading_location: string;
  unloading_location: string;
  status: string;
  created_at: string;
}

export default function MobileDispatchOrder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);  // 地点列表
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([]);
  const [recentOrders, setRecentOrders] = useState<DispatchOrder[]>([]);
  
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showSaveRouteDialog, setShowSaveRouteDialog] = useState(false);
  const [showAddRouteDialog, setShowAddRouteDialog] = useState(false);  // 添加新线路对话框
  const [newRouteName, setNewRouteName] = useState('');
  
  // 添加新线路表单（改为输入地点名称，和司机端一致）
  const [newRouteLoadingLocation, setNewRouteLoadingLocation] = useState('');
  const [newRouteUnloadingLocation, setNewRouteUnloadingLocation] = useState('');
  
  // 派单表单
  const [formData, setFormData] = useState({
    driver_id: undefined as string | undefined,
    project_id: undefined as string | undefined,
    route_id: undefined as string | undefined,  // 线路ID
    expected_loading_date: format(new Date(), 'yyyy-MM-dd'),
    expected_weight: '',
    current_cost: '0',  // 运费，默认0
    remarks: ''
  });

  useEffect(() => {
    loadData();
    loadRecentOrders();
  }, []);

  // 当选择项目时，加载该项目的线路
  useEffect(() => {
    if (formData.project_id) {
      loadRoutesByProject(formData.project_id);
    } else {
      // 如果没有选择项目，显示所有线路
      loadAllRoutes();
    }
  }, [formData.project_id]);

  // 当选择线路时，自动填充项目（如果线路有项目ID）
  useEffect(() => {
    if (formData.route_id && favoriteRoutes.length > 0) {
      const selectedRoute = favoriteRoutes.find(r => r.id === formData.route_id);
      if (selectedRoute && selectedRoute.project_id && !formData.project_id) {
        setFormData(prev => ({ ...prev, project_id: selectedRoute.project_id }));
      }
    }
  }, [formData.route_id, favoriteRoutes]);

  // 加载指定项目的线路
  const loadRoutesByProject = async (projectId: string) => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;

      const { data: routeData } = await supabase
        .from('fleet_manager_favorite_routes')
        .select('*')
        .eq('fleet_manager_id', userId)
        .eq('project_id', projectId)
        .order('use_count', { ascending: false })
        .limit(20);
      
      setFavoriteRoutes(routeData || []);
    } catch (error) {
      console.error('加载线路失败:', error);
    }
  };

  // 加载所有线路
  const loadAllRoutes = async () => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;

      const { data: routeData } = await supabase
        .from('fleet_manager_favorite_routes')
        .select('*')
        .eq('fleet_manager_id', userId)
        .order('use_count', { ascending: false })
        .limit(20);
      
      setFavoriteRoutes(routeData || []);
    } catch (error) {
      console.error('加载线路失败:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;

      // 加载管理的司机
      const { data: driverData } = await supabase
        .from('internal_drivers')
        .select('id, name, phone')
        .eq('fleet_manager_id', userId)
        .order('name');
      
      setDrivers(driverData || []);

      // 加载分配给该车队长的项目
      const { data: managedProjects, error: projectsError } = await supabase
        .from('fleet_manager_projects')
        .select('project_id, projects:project_id (id, name, project_status)')
        .eq('fleet_manager_id', userId);
      
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
      } else {
        const projectList: Project[] = [];
        if (activeProjects) {
          activeProjects.forEach((mp: any) => {
            if (mp.projects) {
              projectList.push({
                id: mp.projects.id,
                name: mp.projects.name
              });
            }
          });
        }
        setProjects(projectList);
      }

      // 加载地点列表（用于添加新线路）
      const { data: locationData } = await supabase
        .from('locations')
        .select('id, name')
        .order('name');
      
      setLocations(locationData || []);

      // 加载常用线路（不按项目过滤，显示所有）
      const { data: routeData } = await supabase
        .from('fleet_manager_favorite_routes')
        .select('*')
        .eq('fleet_manager_id', userId)
        .order('use_count', { ascending: false })
        .limit(20);
      
      setFavoriteRoutes(routeData || []);

    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentOrders = async () => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { data } = await supabase
        .from('dispatch_orders')
        .select(`
          id,
          order_number,
          status,
          loading_location,
          unloading_location,
          created_at,
          driver:internal_drivers(name),
          project:projects(name)
        `)
        .eq('fleet_manager_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      const processedData = (data || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        driver_name: order.driver?.name || '未知',
        project_name: order.project?.name || '未知',
        loading_location: order.loading_location,
        unloading_location: order.unloading_location,
        status: order.status,
        created_at: order.created_at
      }));
      
      setRecentOrders(processedData);
    } catch (error) {
      console.error('加载派单记录失败:', error);
    }
  };

  // 使用常用线路
  const useFavoriteRoute = (route: FavoriteRoute) => {
    setFormData(prev => ({
      ...prev,
      project_id: route.project_id,
      route_id: route.id
    }));
    
    toast({
      title: '已应用线路',
      description: `${route.route_name}`
    });
  };

  // 添加新线路（和司机端逻辑一致）
  const handleAddRoute = async () => {
    if (!newRouteLoadingLocation.trim()) {
      toast({
        title: '请输入装货地',
        variant: 'destructive'
      });
      return;
    }

    if (!newRouteUnloadingLocation.trim()) {
      toast({
        title: '请输入卸货地',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.project_id) {
      toast({
        title: '请先选择项目',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('fleet_manager_add_route', {
        p_loading_location_name: newRouteLoadingLocation.trim(),
        p_unloading_location_name: newRouteUnloadingLocation.trim(),
        p_project_id: formData.project_id
      });

      if (error) throw error;
      
      if (data.success) {
        toast({
          title: '添加成功',
          description: `线路"${data.route_name}"已添加并设为常用线路`
        });

        // 刷新常用线路列表
        if (formData.project_id) {
          await loadRoutesByProject(formData.project_id);
          
          // 自动选中新添加的线路
          const userId = (await supabase.auth.getUser()).data.user?.id;
          if (userId) {
            const { data: updatedRoutes } = await supabase
              .from('fleet_manager_favorite_routes')
              .select('id')
              .eq('fleet_manager_id', userId)
              .eq('loading_location_id', data.loading_location_id)
              .eq('unloading_location_id', data.unloading_location_id)
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (updatedRoutes && updatedRoutes.length > 0) {
              setFormData(prev => ({ 
                ...prev, 
                route_id: updatedRoutes[0].id
              }));
            }
          }
        } else {
          await loadAllRoutes();
        }

        setShowAddRouteDialog(false);
        setNewRouteLoadingLocation('');
        setNewRouteUnloadingLocation('');
      } else {
        toast({
          title: '添加失败',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('添加线路失败:', error);
      toast({
        title: '添加失败',
        description: '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 保存为常用线路
  const handleSaveRoute = async () => {
    if (!newRouteName || !formData.route_id) {
      toast({
        title: '请完整填写',
        description: '请输入线路名称并选择线路',
        variant: 'destructive'
      });
      return;
    }

    // 从选中的线路获取地点信息
    const selectedRoute = favoriteRoutes.find(r => r.id === formData.route_id);
    if (!selectedRoute || !selectedRoute.loading_location_id || !selectedRoute.unloading_location_id) {
      toast({
        title: '线路信息不完整',
        description: '请重新选择线路',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('save_favorite_route', {
        p_route_name: newRouteName,
        p_project_id: formData.project_id,
        p_loading_location_id: selectedRoute.loading_location_id,
        p_unloading_location_id: selectedRoute.unloading_location_id
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      toast({
        title: '保存成功',
        description: '常用线路已保存'
      });

      setShowSaveRouteDialog(false);
      setNewRouteName('');
      // 重新加载线路列表
      if (formData.project_id) {
        loadRoutesByProject(formData.project_id);
      } else {
        loadAllRoutes();
      }
    } catch (error: any) {
      toast({
        title: '保存失败',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // 提交派单
  const handleSubmit = async () => {
    if (!formData.driver_id || !formData.project_id || !formData.route_id) {
      toast({
        title: '请完整填写',
        description: '请选择司机、项目和线路',
        variant: 'destructive'
      });
      return;
    }

    // 从选中的线路获取地点信息
    const selectedRoute = favoriteRoutes.find(r => r.id === formData.route_id);
    if (!selectedRoute || !selectedRoute.loading_location_id || !selectedRoute.unloading_location_id) {
      toast({
        title: '线路信息不完整',
        description: '请重新选择线路',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_dispatch_order', {
        p_project_id: formData.project_id,
        p_driver_id: formData.driver_id,
        p_loading_location_id: selectedRoute.loading_location_id,
        p_unloading_location_id: selectedRoute.unloading_location_id,
        p_expected_loading_date: formData.expected_loading_date || null,
        p_expected_weight: formData.expected_weight ? parseFloat(formData.expected_weight) : null,
        p_current_cost: parseFloat(formData.current_cost) || 0,  // 传递运费
        p_remarks: formData.remarks || null
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
        .eq('id', formData.route_id);

      toast({
        title: '派单成功 ✅',
        description: `派单编号：${data.order_number}`
      });

      setShowNewDialog(false);
      resetForm();
      loadRecentOrders();
      // 重新加载线路列表（更新使用次数）
      if (formData.project_id) {
        loadRoutesByProject(formData.project_id);
      } else {
        loadAllRoutes();
      }
    } catch (error: any) {
      toast({
        title: '派单失败',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      driver_id: undefined,
      project_id: undefined,
      route_id: undefined,
      expected_loading_date: format(new Date(), 'yyyy-MM-dd'),
      expected_weight: '',
      current_cost: '0',
      remarks: ''
    });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      pending: { label: '待接单', className: 'bg-yellow-100 text-yellow-800' },
      accepted: { label: '已接单', className: 'bg-blue-100 text-blue-800' },
      completed: { label: '已完成', className: 'bg-green-100 text-green-800' },
      rejected: { label: '已拒绝', className: 'bg-red-100 text-red-800' },
      cancelled: { label: '已取消', className: 'bg-gray-100 text-gray-800' }
    };
    const cfg = config[status] || config.pending;
    return <Badge className={cfg.className}>{cfg.label}</Badge>;
  };

  return (
    <MobileLayout title="派单管理">
      <div className="space-y-4 pb-20">
        {/* 顶部操作 */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">派单管理</h2>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            新建派单
          </Button>
        </div>

        {/* 常用线路快捷选择 */}
        {favoriteRoutes.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                常用线路
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {favoriteRoutes.slice(0, 3).map(route => (
                  <Button
                    key={route.id}
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-3"
                    onClick={() => {
                      useFavoriteRoute(route);
                      setShowNewDialog(true);
                    }}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{route.route_name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {route.loading_location} → {route.unloading_location}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        使用 {route.use_count} 次
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 最近派单记录 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">最近派单</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                暂无派单记录
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map(order => (
                  <Card key={order.id} className="border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-sm">{order.order_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), 'MM-dd HH:mm')}
                          </div>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Truck className="h-3 w-3" />
                          司机：{order.driver_name}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {order.loading_location} → {order.unloading_location}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 新建派单对话框 */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新建派单</DialogTitle>
              <DialogDescription>
                创建派单并推送给司机
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* 选择司机 */}
              <div className="grid gap-2">
                <Label>选择司机 *</Label>
                <Select value={formData.driver_id} onValueChange={(value) => setFormData(prev => ({ ...prev, driver_id: value }))}>
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

              {/* 选择项目 */}
              <div className="grid gap-2">
                <Label>选择项目 *</Label>
                <Select value={formData.project_id} onValueChange={(value) => setFormData(prev => ({ ...prev, project_id: value, route_id: undefined }))}>
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

              {/* 选择线路 */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>选择线路 *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (!formData.project_id) {
                        toast({
                          title: '请先选择项目',
                          description: '添加线路前需要先选择项目',
                          variant: 'destructive'
                        });
                        return;
                      }
                      setShowAddRouteDialog(true);
                    }}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    添加新线路
                  </Button>
                </div>
                <Select 
                  value={formData.route_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, route_id: value }))}
                  disabled={!formData.project_id && favoriteRoutes.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.project_id ? "选择线路" : "请先选择项目"} />
                  </SelectTrigger>
                  <SelectContent>
                    {favoriteRoutes.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        {formData.project_id ? '该项目暂无线路，请点击"添加新线路"' : '请先选择项目'}
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
                {formData.route_id && (() => {
                  const selectedRoute = favoriteRoutes.find(r => r.id === formData.route_id);
                  return selectedRoute ? (
                    <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                      <div>装货地: {selectedRoute.loading_location}</div>
                      <div>卸货地: {selectedRoute.unloading_location}</div>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* 运费设置 */}
              <div className="grid gap-2">
                <Label>运费设置（元）</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="运费金额"
                  value={formData.current_cost}
                  onChange={(e) => setFormData(prev => ({ ...prev, current_cost: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">默认运费为0，可手动输入实际运费</p>
              </div>

              {/* 预期装货日期 */}
              <div className="grid gap-2">
                <Label>预期装货日期</Label>
                <Input
                  type="date"
                  value={formData.expected_loading_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expected_loading_date: e.target.value }))}
                />
              </div>

              {/* 预期重量 */}
              <div className="grid gap-2">
                <Label>预期重量（吨）</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="预计重量"
                  value={formData.expected_weight}
                  onChange={(e) => setFormData(prev => ({ ...prev, expected_weight: e.target.value }))}
                />
              </div>

              {/* 备注 */}
              <div className="grid gap-2">
                <Label>备注说明</Label>
                <Textarea
                  placeholder="输入备注信息..."
                  value={formData.remarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowSaveRouteDialog(true)}
                disabled={!formData.route_id}
              >
                <Star className="h-4 w-4 mr-1" />
                保存线路
              </Button>
              <Button onClick={() => setShowNewDialog(false)} variant="outline">
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                派单
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 保存线路对话框 */}
        <Dialog open={showSaveRouteDialog} onOpenChange={setShowSaveRouteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>保存为常用线路</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>线路名称</Label>
                <Input
                  placeholder="如：昆明→大理"
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaveRouteDialog(false)}>
                取消
              </Button>
              <Button onClick={handleSaveRoute}>
                <Save className="h-4 w-4 mr-1" />
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 添加新线路对话框（和司机端逻辑一致） */}
        <Dialog open={showAddRouteDialog} onOpenChange={setShowAddRouteDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>添加线路</DialogTitle>
              <DialogDescription>
                输入装货地和卸货地，系统将自动添加到地点库、关联项目并设为常用线路
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>装货地 *</Label>
                <Input
                  placeholder="输入装货地点名称..."
                  value={newRouteLoadingLocation}
                  onChange={e => setNewRouteLoadingLocation(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="grid gap-2">
                <Label>卸货地 *</Label>
                <Input
                  placeholder="输入卸货地点名称..."
                  value={newRouteUnloadingLocation}
                  onChange={e => setNewRouteUnloadingLocation(e.target.value)}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">自动处理</p>
                    <ul className="text-xs mt-1 text-blue-600 list-disc list-inside space-y-0.5">
                      <li>装货地和卸货地将自动添加到地点库</li>
                      <li>自动关联到当前项目</li>
                      <li>该线路将设为您的常用线路</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowAddRouteDialog(false);
                setNewRouteLoadingLocation('');
                setNewRouteUnloadingLocation('');
              }}>
                取消
              </Button>
              <Button onClick={handleAddRoute} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    添加中...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    确认添加
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

