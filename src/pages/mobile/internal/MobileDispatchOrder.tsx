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

interface Location {
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
  const [loadingLocations, setLoadingLocations] = useState<Location[]>([]);
  const [unloadingLocations, setUnloadingLocations] = useState<Location[]>([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([]);
  const [recentOrders, setRecentOrders] = useState<DispatchOrder[]>([]);
  
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showSaveRouteDialog, setShowSaveRouteDialog] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  
  // 派单表单
  const [formData, setFormData] = useState({
    driver_id: undefined as string | undefined,
    project_id: undefined as string | undefined,
    loading_location_id: undefined as string | undefined,
    unloading_location_id: undefined as string | undefined,
    expected_loading_date: format(new Date(), 'yyyy-MM-dd'),
    expected_weight: '',
    remarks: ''
  });

  useEffect(() => {
    loadData();
    loadRecentOrders();
  }, []);

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

      // 加载项目（假设车队长有分配的项目）
      const { data: projectData } = await supabase
        .from('projects')
        .select('id, name')
        .eq('project_status', '进行中')
        .order('name');
      
      setProjects(projectData || []);

      // 加载地点
      const { data: locationData } = await supabase
        .from('locations')
        .select('id, name')
        .order('name');
      
      setLoadingLocations(locationData || []);
      setUnloadingLocations(locationData || []);

      // 加载常用线路
      const { data: routeData } = await supabase
        .from('fleet_manager_favorite_routes')
        .select('*')
        .eq('fleet_manager_id', userId)
        .order('use_count', { ascending: false })
        .limit(10);
      
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
      loading_location_id: route.loading_location_id,
      unloading_location_id: route.unloading_location_id
    }));
    
    toast({
      title: '已应用线路',
      description: `${route.route_name}`
    });
  };

  // 保存为常用线路
  const handleSaveRoute = async () => {
    if (!newRouteName || !formData.loading_location_id || !formData.unloading_location_id) {
      toast({
        title: '请完整填写',
        description: '请输入线路名称并选择装卸地点',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('save_favorite_route', {
        p_route_name: newRouteName,
        p_project_id: formData.project_id,
        p_loading_location_id: formData.loading_location_id,
        p_unloading_location_id: formData.unloading_location_id
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      toast({
        title: '保存成功',
        description: '常用线路已保存'
      });

      setShowSaveRouteDialog(false);
      setNewRouteName('');
      loadData(); // 刷新线路列表
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
    if (!formData.driver_id || !formData.project_id || 
        !formData.loading_location_id || !formData.unloading_location_id) {
      toast({
        title: '请完整填写',
        description: '请选择司机、项目和装卸地点',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_dispatch_order', {
        p_project_id: formData.project_id,
        p_driver_id: formData.driver_id,
        p_loading_location_id: formData.loading_location_id,
        p_unloading_location_id: formData.unloading_location_id,
        p_expected_loading_date: formData.expected_loading_date || null,
        p_expected_weight: formData.expected_weight ? parseFloat(formData.expected_weight) : null,
        p_remarks: formData.remarks || null
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      toast({
        title: '派单成功 ✅',
        description: `派单编号：${data.order_number}`
      });

      setShowNewDialog(false);
      resetForm();
      loadRecentOrders();
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
      loading_location_id: undefined,
      unloading_location_id: undefined,
      expected_loading_date: format(new Date(), 'yyyy-MM-dd'),
      expected_weight: '',
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
                <Select value={formData.project_id} onValueChange={(value) => setFormData(prev => ({ ...prev, project_id: value }))}>
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

              {/* 装货地点 */}
              <div className="grid gap-2">
                <Label>装货地点 *</Label>
                <Select value={formData.loading_location_id} onValueChange={(value) => setFormData(prev => ({ ...prev, loading_location_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择装货地点" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingLocations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 卸货地点 */}
              <div className="grid gap-2">
                <Label>卸货地点 *</Label>
                <Select value={formData.unloading_location_id} onValueChange={(value) => setFormData(prev => ({ ...prev, unloading_location_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择卸货地点" />
                  </SelectTrigger>
                  <SelectContent>
                    {unloadingLocations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                disabled={!formData.loading_location_id || !formData.unloading_location_id}
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
      </div>
    </MobileLayout>
  );
}

