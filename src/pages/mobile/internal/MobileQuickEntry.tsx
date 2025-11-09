// 移动端 - 司机快速录入运单

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import {
  Truck,
  MapPin,
  Package,
  Calendar,
  User,
  Phone,
  Loader2,
  CheckCircle,
  ChevronRight,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';

interface ProjectRoute {
  project_id: string;
  project_name: string;
  is_primary_route: boolean;
  common_loading_locations: any[];
  common_unloading_locations: any[];
}

interface Waybill {
  id: string;
  auto_number: string;
  project_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  loading_weight: number;
  payment_status: string;
  created_at: string;
}

export default function MobileQuickEntry() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // 司机的项目线路
  const [myRoutes, setMyRoutes] = useState<ProjectRoute[]>([]);
  const [recentWaybills, setRecentWaybills] = useState<Waybill[]>([]);
  
  // 表单数据
  const [formData, setFormData] = useState({
    project_id: '',
    loading_location_id: '',
    unloading_location_id: '',
    loading_weight: '',
    unloading_weight: '',
    remarks: ''
  });
  
  // 司机信息（自动填充）
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [myVehicle, setMyVehicle] = useState<any>(null);
  const [fleetManagerId, setFleetManagerId] = useState<string | null>(null);
  
  // 地点管理
  const [projectLoadingLocations, setProjectLoadingLocations] = useState<any[]>([]);
  const [projectUnloadingLocations, setProjectUnloadingLocations] = useState<any[]>([]);
  const [showAddLocationDialog, setShowAddLocationDialog] = useState(false);
  const [addLocationName, setAddLocationName] = useState('');
  const [addLocationType, setAddLocationType] = useState<'loading' | 'unloading'>('loading');

  // 常用运单
  const [favoriteRoutes, setFavoriteRoutes] = useState<any[]>([]);
  const [routeInputs, setRouteInputs] = useState<Record<string, { loading_weight: string; unloading_weight: string }>>({});
  const [submittingRouteId, setSubmittingRouteId] = useState<string | null>(null);

  useEffect(() => {
    loadMyInfo();
    loadRecentWaybills();
  }, []);

  // 当获取到车队长ID后，加载常用线路
  useEffect(() => {
    if (fleetManagerId) {
      loadFavoriteRoutes();
    }
  }, [fleetManagerId]);

  // 当获取到车队长ID后，加载项目（如果还没有加载）
  useEffect(() => {
    if (fleetManagerId && myRoutes.length === 0) {
      loadMyRoutes(fleetManagerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fleetManagerId]);

  // 当选择项目后，加载该项目的地点
  useEffect(() => {
    if (formData.project_id && fleetManagerId) {
      loadProjectLocations(formData.project_id);
    }
  }, [formData.project_id, fleetManagerId]);

  // 加载司机信息
  const loadMyInfo = async () => {
    try {
      // 获取司机档案
      const { data: driverData } = await supabase.rpc('get_my_driver_info');
      if (driverData && driverData.length > 0) {
        setDriverInfo(driverData[0]);
        // 获取车队长的ID
        const managerId = driverData[0].fleet_manager_id;
        if (managerId) {
          setFleetManagerId(managerId);
          // 立即加载项目
          loadMyRoutes(managerId);
        }
      }
      
      // 获取主车
      const { data: vehicleData } = await supabase.rpc('get_my_vehicles');
      if (vehicleData && vehicleData.length > 0) {
        const primary = vehicleData.find((v: any) => v.is_primary);
        setMyVehicle(primary || vehicleData[0]);
      }
    } catch (error) {
      console.error('加载信息失败:', error);
    }
  };

  // 加载我的项目线路（只加载所属车队长的项目）
  const loadMyRoutes = async (managerId?: string | null) => {
    setLoading(true);
    try {
      const currentFleetManagerId = managerId || fleetManagerId;

      // 如果还是没有车队长ID，提示用户
      if (!currentFleetManagerId) {
        toast({
          title: '提示',
          description: '您尚未分配车队长，请联系管理员',
          variant: 'destructive'
        });
        setMyRoutes([]);
        setLoading(false);
        return;
      }

      // 获取车队长负责的项目
      const { data: projectsData, error: projectsError } = await supabase
        .from('fleet_manager_projects')
        .select(`
          project_id,
          projects:project_id (
            id,
            name,
            project_status
          )
        `)
        .eq('fleet_manager_id', currentFleetManagerId);

      if (projectsError) throw projectsError;

      // 转换为项目线路格式
      const routes: ProjectRoute[] = (projectsData || [])
        .filter((item: any) => item.projects && item.projects.project_status === '进行中')
        .map((item: any) => ({
          project_id: item.project_id,
          project_name: item.projects.name,
          is_primary_route: false, // 可以根据需要设置主线路
          common_loading_locations: [],
          common_unloading_locations: []
        }));

      setMyRoutes(routes);
      
      // 自动选择第一个项目
      if (routes.length > 0) {
        setFormData(prev => ({ ...prev, project_id: routes[0].project_id }));
      }
    } catch (error) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载项目线路',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 加载最近运单
  const loadRecentWaybills = async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_waybills', {
        p_days: 7,
        p_limit: 5
      });
      
      if (error) throw error;
      setRecentWaybills(data || []);
    } catch (error) {
      console.error('加载运单失败:', error);
    }
  };

  // 加载项目的地点列表（只加载车队长常用线路中的地点）
  const loadProjectLocations = async (projectId: string) => {
    try {
      if (!fleetManagerId) {
        setProjectLoadingLocations([]);
        setProjectUnloadingLocations([]);
        return;
      }

      // 1. 获取该车队长在常用线路中使用的地点ID
      const { data: favoriteRoutes, error: routesError } = await supabase
        .from('fleet_manager_favorite_routes')
        .select('loading_location_id, unloading_location_id')
        .eq('fleet_manager_id', fleetManagerId);

      if (routesError) throw routesError;

      // 收集所有使用的地点ID
      const locationIds = new Set<string>();
      (favoriteRoutes || []).forEach((route: any) => {
        if (route.loading_location_id) locationIds.add(route.loading_location_id);
        if (route.unloading_location_id) locationIds.add(route.unloading_location_id);
      });

      if (locationIds.size === 0) {
        setProjectLoadingLocations([]);
        setProjectUnloadingLocations([]);
        return;
      }

      // 2. 获取这些地点的详细信息，并过滤出与当前项目关联的地点
      const { data: locationProjects, error: locationProjectsError } = await supabase
        .from('location_projects')
        .select('location_id')
        .eq('project_id', projectId)
        .in('location_id', Array.from(locationIds));

      if (locationProjectsError) throw locationProjectsError;

      const projectLocationIds = new Set((locationProjects || []).map((lp: any) => lp.location_id));
      const filteredLocationIds = Array.from(locationIds).filter(id => projectLocationIds.has(id));

      if (filteredLocationIds.length === 0) {
        setProjectLoadingLocations([]);
        setProjectUnloadingLocations([]);
        return;
      }

      // 3. 获取地点详情
      const { data: locations, error: locationsError } = await supabase
        .from('locations')
        .select('id, name')
        .in('id', filteredLocationIds);

      if (locationsError) throw locationsError;

      // 4. 根据常用线路中的使用情况分类装货地和卸货地
      const loadingLocationIds = new Set(
        (favoriteRoutes || [])
          .map((r: any) => r.loading_location_id)
          .filter(Boolean)
      );
      const unloadingLocationIds = new Set(
        (favoriteRoutes || [])
          .map((r: any) => r.unloading_location_id)
          .filter(Boolean)
      );

      const loadingLocs = (locations || [])
        .filter((loc: any) => loadingLocationIds.has(loc.id))
        .map((loc: any) => ({
          location_id: loc.id,
          location_name: loc.name
        }));

      const unloadingLocs = (locations || [])
        .filter((loc: any) => unloadingLocationIds.has(loc.id))
        .map((loc: any) => ({
          location_id: loc.id,
          location_name: loc.name
        }));

      setProjectLoadingLocations(loadingLocs);
      setProjectUnloadingLocations(unloadingLocs);
    } catch (error) {
      console.error('加载地点失败:', error);
      setProjectLoadingLocations([]);
      setProjectUnloadingLocations([]);
    }
  };

  // 快速添加地点
  const handleAddLocation = async () => {
    if (!addLocationName.trim()) {
      toast({
        title: '请输入地点名称',
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

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('driver_add_location', {
        p_location_name: addLocationName.trim(),
        p_project_id: formData.project_id,
        p_location_type: addLocationType
      });

      if (error) throw error;
      
      if (data.success) {
        toast({
          title: '添加成功',
          description: `地点"${addLocationName}"已添加`
        });

        // 刷新地点列表
        loadProjectLocations(formData.project_id);

        // 自动选中新添加的地点
        if (addLocationType === 'loading') {
          setFormData(prev => ({ ...prev, loading_location_id: data.location_id }));
        } else {
          setFormData(prev => ({ ...prev, unloading_location_id: data.location_id }));
        }

        setShowAddLocationDialog(false);
        setAddLocationName('');
      } else {
        toast({
          title: '添加失败',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('添加地点失败:', error);
      toast({
        title: '添加失败',
        description: '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 加载常用线路
  const loadFavoriteRoutes = async () => {
    try {
      if (!fleetManagerId) return;

      const { data, error } = await supabase
        .from('fleet_manager_favorite_routes')
        .select(`
          id,
          route_name,
          project_id,
          loading_location_id,
          unloading_location_id,
          loading_location,
          unloading_location,
          use_count,
          last_used_at,
          projects:project_id (
            id,
            name
          )
        `)
        .eq('fleet_manager_id', fleetManagerId)
        .not('project_id', 'is', null)  // 只加载有项目关联的线路
        .order('use_count', { ascending: false })
        .order('last_used_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      setFavoriteRoutes(data || []);
    } catch (error) {
      console.error('加载常用线路失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载常用线路',
        variant: 'destructive'
      });
    }
  };

  // 提交常用运单
  const handleSubmitFavoriteRoute = async (routeId: string) => {
    const route = favoriteRoutes.find(r => r.id === routeId);
    if (!route) return;

    const inputs = routeInputs[routeId] || { loading_weight: '', unloading_weight: '' };
    
    if (!inputs.loading_weight || !route.project_id || !route.loading_location_id || !route.unloading_location_id) {
      toast({
        title: '信息不完整',
        description: '请填写装货数量',
        variant: 'destructive'
      });
      return;
    }

    setSubmittingRouteId(routeId);
    try {
      const { data, error } = await supabase.rpc('driver_quick_create_waybill', {
        p_project_id: route.project_id,
        p_loading_location_id: route.loading_location_id,
        p_unloading_location_id: route.unloading_location_id,
        p_loading_weight: parseFloat(inputs.loading_weight),
        p_unloading_weight: inputs.unloading_weight ? parseFloat(inputs.unloading_weight) : null,
        p_remarks: null
      });

      if (error) throw error;
      
      if (data.success) {
        toast({
          title: '创建成功',
          description: `运单 ${data.auto_number} 已创建`
        });
        
        // 清空该线路的输入
        setRouteInputs(prev => {
          const newInputs = { ...prev };
          delete newInputs[routeId];
          return newInputs;
        });
        
        // 更新使用次数
        await supabase
          .from('fleet_manager_favorite_routes')
          .update({ 
            use_count: (route.use_count || 0) + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', routeId);
        
        // 重新加载常用线路（更新排序）
        loadFavoriteRoutes();
        
        // 刷新最近运单
        loadRecentWaybills();
      } else {
        toast({
          title: '创建失败',
          description: data.error || '创建运单失败',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('提交失败:', error);
      toast({
        title: '提交失败',
        description: '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setSubmittingRouteId(null);
    }
  };

  // 提交运单
  const handleSubmit = async () => {
    if (!formData.project_id || !formData.loading_location_id || !formData.unloading_location_id || !formData.loading_weight) {
      toast({
        title: '信息不完整',
        description: '请填写所有必填项',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('driver_quick_create_waybill', {
        p_project_id: formData.project_id,
        p_loading_location_id: formData.loading_location_id,
        p_unloading_location_id: formData.unloading_location_id,
        p_loading_weight: parseFloat(formData.loading_weight),
        p_unloading_weight: formData.unloading_weight ? parseFloat(formData.unloading_weight) : null,
        p_remarks: formData.remarks || null
      });

      if (error) throw error;
      
      if (data.success) {
        toast({
          title: '创建成功',
          description: `运单 ${data.auto_number} 已创建`
        });
        
        // 重置表单
        setFormData({
          project_id: formData.project_id, // 保留项目选择
          loading_location_id: '',
          unloading_location_id: '',
          loading_weight: '',
          unloading_weight: '',
          remarks: ''
        });
        
        loadRecentWaybills();
      } else {
        toast({
          title: '创建失败',
          description: data.error || '创建运单失败',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('提交失败:', error);
      toast({
        title: '提交失败',
        description: '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedRoute = myRoutes.find(r => r.project_id === formData.project_id);

  return (
    <MobileLayout>
      <div className="space-y-4 pb-20">
        {/* 司机和车辆信息卡片 */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="text-xs text-blue-600">司机</div>
                  <div className="font-medium">{driverInfo?.name || '加载中...'}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="text-xs text-blue-600">主车</div>
                  <div className="font-medium">{myVehicle?.license_plate || '未分配'}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 运单录入 - 标签页 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-5 w-5" />
              新增运单
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="new" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="new">新增运单</TabsTrigger>
                <TabsTrigger value="favorite">常用运单</TabsTrigger>
              </TabsList>

              {/* 新增运单标签页 */}
              <TabsContent value="new" className="space-y-4 mt-4">
            {/* 项目选择 */}
            <div className="grid gap-2">
              <Label>运输项目 *</Label>
              <Select value={formData.project_id} onValueChange={value => setFormData(prev => ({ ...prev, project_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {myRoutes.map(route => (
                    <SelectItem key={route.project_id} value={route.project_id}>
                      {route.project_name}
                      {route.is_primary_route && <Badge className="ml-2 bg-blue-600 text-white text-xs">常跑</Badge>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 装货地 - 支持快速添加 */}
            <div className="grid gap-2">
              <Label className="flex items-center justify-between">
                <span>装货地 *</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => {
                    setAddLocationType('loading');
                    setShowAddLocationDialog(true);
                  }}
                  disabled={!formData.project_id}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  添加地点
                </Button>
              </Label>
              <Select 
                value={formData.loading_location_id} 
                onValueChange={value => setFormData(prev => ({ ...prev, loading_location_id: value }))}
                disabled={!formData.project_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.project_id ? "选择装货地点" : "请先选择项目"} />
                </SelectTrigger>
                <SelectContent>
                  {projectLoadingLocations.map((loc: any) => (
                    <SelectItem key={loc.location_id} value={loc.location_id}>
                      {loc.location_name}
                    </SelectItem>
                  ))}
                  {projectLoadingLocations.length === 0 && (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      暂无装货地点，请点击"添加地点"
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 卸货地 - 支持快速添加 */}
            <div className="grid gap-2">
              <Label className="flex items-center justify-between">
                <span>卸货地 *</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => {
                    setAddLocationType('unloading');
                    setShowAddLocationDialog(true);
                  }}
                  disabled={!formData.project_id}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  添加地点
                </Button>
              </Label>
              <Select 
                value={formData.unloading_location_id} 
                onValueChange={value => setFormData(prev => ({ ...prev, unloading_location_id: value }))}
                disabled={!formData.project_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.project_id ? "选择卸货地点" : "请先选择项目"} />
                </SelectTrigger>
                <SelectContent>
                  {projectUnloadingLocations.map((loc: any) => (
                    <SelectItem key={loc.location_id} value={loc.location_id}>
                      {loc.location_name}
                    </SelectItem>
                  ))}
                  {projectUnloadingLocations.length === 0 && (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      暂无卸货地点，请点击"添加地点"
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 装货数量 */}
            <div className="grid gap-2">
              <Label>装货数量 *</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={formData.loading_weight}
                onChange={e => setFormData(prev => ({ ...prev, loading_weight: e.target.value }))}
                step="0.01"
              />
            </div>

            {/* 卸货数量（可选） */}
            <div className="grid gap-2">
              <Label>卸货数量（可选，默认等于装货）</Label>
              <Input
                type="number"
                placeholder="默认等于装货数量"
                value={formData.unloading_weight}
                onChange={e => setFormData(prev => ({ ...prev, unloading_weight: e.target.value }))}
                step="0.01"
              />
            </div>

            {/* 备注 */}
            <div className="grid gap-2">
              <Label>备注</Label>
              <Textarea
                placeholder="输入备注信息..."
                value={formData.remarks}
                onChange={e => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                rows={2}
              />
            </div>

            {/* 提交按钮 */}
            <Button 
              className="w-full h-12"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  提交中...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  提交运单
                </>
              )}
            </Button>
              </TabsContent>

              {/* 常用运单标签页 */}
              <TabsContent value="favorite" className="space-y-4 mt-4">
                {favoriteRoutes.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>暂无常用线路</p>
                    <p className="text-xs mt-2">车队长配置常用线路后，将显示在这里</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {favoriteRoutes.map((route) => {
                      const inputs = routeInputs[route.id] || { loading_weight: '', unloading_weight: '' };
                      const isSubmitting = submittingRouteId === route.id;
                      
                      return (
                        <Card key={route.id} className="border">
                          <CardContent className="p-4 space-y-3">
                            {/* 线路信息 */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-sm">{route.route_name}</div>
                                {route.use_count > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    使用 {route.use_count} 次
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-green-600">装货：</span>
                                  <span>{route.loading_location}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-red-600">卸货：</span>
                                  <span>{route.unloading_location}</span>
                                </div>
                                {route.projects && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-blue-600">项目：</span>
                                    <span>{route.projects.name}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 输入框 */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">装货数量 *</Label>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  value={inputs.loading_weight}
                                  onChange={e => setRouteInputs(prev => ({
                                    ...prev,
                                    [route.id]: {
                                      ...(prev[route.id] || { loading_weight: '', unloading_weight: '' }),
                                      loading_weight: e.target.value
                                    }
                                  }))}
                                  step="0.01"
                                  disabled={isSubmitting}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">卸货数量</Label>
                                <Input
                                  type="number"
                                  placeholder="默认等于装货"
                                  value={inputs.unloading_weight}
                                  onChange={e => setRouteInputs(prev => ({
                                    ...prev,
                                    [route.id]: {
                                      ...(prev[route.id] || { loading_weight: '', unloading_weight: '' }),
                                      unloading_weight: e.target.value
                                    }
                                  }))}
                                  step="0.01"
                                  disabled={isSubmitting}
                                />
                              </div>
                            </div>

                            {/* 提交按钮 */}
                            <Button
                              className="w-full"
                              size="sm"
                              onClick={() => handleSubmitFavoriteRoute(route.id)}
                              disabled={isSubmitting || !inputs.loading_weight}
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  提交中...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  记录运单
                                </>
                              )}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* 最近运单记录 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                最近7天运单
              </span>
              <Button size="sm" variant="ghost" onClick={() => {}}>
                查看全部
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentWaybills.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                暂无运单记录
              </div>
            ) : (
              recentWaybills.map(waybill => (
                <Card key={waybill.id} className="border">
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{waybill.auto_number}</div>
                        <Badge variant={waybill.payment_status === 'Paid' ? 'default' : 'secondary'} className="text-xs">
                          {waybill.payment_status === 'Paid' ? '已付款' : '待付款'}
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {waybill.loading_location} → {waybill.unloading_location}
                        </div>
                        <div className="flex items-center justify-between">
                          <span>装货：{waybill.loading_weight}吨</span>
                          <span>{format(new Date(waybill.loading_date), 'MM-dd')}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* 提示信息 */}
        {myRoutes.length === 0 && !loading && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4 text-sm text-orange-800">
              <p className="font-medium mb-2">⚠️ 暂未配置项目线路</p>
              <p className="text-xs">请联系车队长为您配置常跑的项目和线路，配置后即可快速录入运单。</p>
            </CardContent>
          </Card>
        )}

        {/* 快速添加地点对话框 */}
        <Dialog open={showAddLocationDialog} onOpenChange={setShowAddLocationDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>添加地点</DialogTitle>
              <DialogDescription>
                添加{addLocationType === 'loading' ? '装货' : '卸货'}地点，并自动关联到项目
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>地点名称</Label>
                <Input
                  placeholder="输入地点名称..."
                  value={addLocationName}
                  onChange={e => setAddLocationName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">自动关联到项目</p>
                    <p className="text-xs mt-1 text-blue-600">
                      添加后，该地点将自动关联到当前项目，其他司机录单时也能使用
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddLocationDialog(false)}>
                取消
              </Button>
              <Button onClick={handleAddLocation} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                确认添加
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
}

