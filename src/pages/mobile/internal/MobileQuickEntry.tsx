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
import { limitAmountInput } from '@/utils/formatters';

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
  const [driverId, setDriverId] = useState<string | null>(null);
  
  // 地点管理
  const [projectLoadingLocations, setProjectLoadingLocations] = useState<any[]>([]);
  const [projectUnloadingLocations, setProjectUnloadingLocations] = useState<any[]>([]);
  const [showAddLocationDialog, setShowAddLocationDialog] = useState(false);
  const [addLocationName, setAddLocationName] = useState('');
  const [addLocationType, setAddLocationType] = useState<'loading' | 'unloading'>('loading');

  // 常用运单
  const [favoriteRoutes, setFavoriteRoutes] = useState<any[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>(''); // 当前选中的线路ID
  const [routeInputs, setRouteInputs] = useState<Record<string, { 
    loading_weight: string; 
    unloading_weight: string;
    loading_date: string;
    unloading_date: string;
  }>>({});
  const [submittingRouteId, setSubmittingRouteId] = useState<string | null>(null);

  useEffect(() => {
    loadMyInfo();
    loadRecentWaybills();
  }, []);

  // 当获取到车队长ID和司机ID后，加载常用线路
  useEffect(() => {
    if (fleetManagerId && driverId) {
      loadFavoriteRoutes();
    }
  }, [fleetManagerId, driverId]);

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
        const driver = driverData[0];
        setDriverInfo(driver);
        
        // 获取司机ID（优先使用id，如果没有则使用driver_id）
        const currentDriverId = driver.id || driver.driver_id;
        if (currentDriverId) {
          console.log('✅ 获取到司机ID:', currentDriverId);
          setDriverId(currentDriverId);
        } else {
          console.error('❌ 无法获取司机ID，数据:', driver);
        }
        
        // 获取车队长的ID
        const managerId = driver.fleet_manager_id;
        if (managerId) {
          console.log('✅ 获取到车队长ID:', managerId);
          setFleetManagerId(managerId);
          // 立即加载项目
          loadMyRoutes(managerId);
        } else {
          console.warn('⚠️ 司机未分配车队长，数据:', driver);
        }
      } else {
        console.error('❌ 未获取到司机数据');
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

  // 加载常用线路（只加载分配给当前司机的线路）
  const loadFavoriteRoutes = async () => {
    try {
      if (!fleetManagerId || !driverId) {
        console.log('⚠️ 没有车队长ID或司机ID，无法加载常用线路', { fleetManagerId, driverId });
        setFavoriteRoutes([]);
        return;
      }

      console.log('🔍 开始加载常用线路，车队长ID:', fleetManagerId, '司机ID:', driverId);

      // 1. 先查询分配给当前司机的线路ID
      const { data: assignedRoutes, error: assignedError } = await supabase
        .from('fleet_manager_favorite_route_drivers')
        .select('route_id')
        .eq('driver_id', driverId);

      if (assignedError) {
        console.error('❌ 查询分配的线路失败:', assignedError);
        console.error('错误详情:', {
          code: assignedError.code,
          message: assignedError.message,
          details: assignedError.details,
          hint: assignedError.hint
        });
        
        // 如果是权限错误，提示用户
        if (assignedError.code === '42501' || assignedError.message?.includes('permission')) {
          toast({
            title: '权限错误',
            description: '无法查询分配的线路，请确认数据库迁移已执行',
            variant: 'destructive'
          });
        }
        
        setFavoriteRoutes([]);
        return;
      }

      console.log('📋 查询到分配记录:', assignedRoutes?.length || 0, '条');

      if (!assignedRoutes || assignedRoutes.length === 0) {
        console.log('⚠️ 没有分配给当前司机的线路');
        console.log('💡 提示：请在PC端"车队配置"页面，选择车队长，进入"常跑线路"标签，点击"分配"按钮为该司机分配线路');
        setFavoriteRoutes([]);
        return;
      }

      const routeIds = assignedRoutes.map(ar => ar.route_id);
      console.log('📋 分配给当前司机的线路ID:', routeIds);

      // 2. 查询这些线路的详细信息
      // 注意：由于RLS策略，司机只能查看分配给自己的线路，所以不需要再过滤fleet_manager_id
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
          notes,
          fleet_manager_id,
          projects:project_id (
            id,
            name
          )
        `)
        .in('id', routeIds)
        .order('use_count', { ascending: false })
        .order('last_used_at', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('❌ 查询常用线路失败:', error);
        console.error('错误详情:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('✅ 加载到常用线路:', data?.length || 0, '条');
      if (data && data.length > 0) {
        console.log('📋 常用线路详情:', data);
        
        // 默认选择最近使用的线路（按 last_used_at 和 use_count 排序，第一个就是最近使用的）
        if (!selectedRouteId && data.length > 0) {
          const mostRecentRoute = data[0]; // 已经是按使用次数和最后使用时间排序的
          setSelectedRouteId(mostRecentRoute.id);
          console.log('✅ 默认选择最近使用的线路:', mostRecentRoute.route_name);
        }
      } else {
        console.log('⚠️ 没有找到常用线路，可能原因：');
        console.log('  1. 车队长ID:', fleetManagerId);
        console.log('  2. 司机ID:', driverId);
        console.log('  3. 线路ID列表:', routeIds);
        console.log('  4. 检查 fleet_manager_favorite_routes 表中是否有对应的线路数据');
        console.log('  5. 检查线路的 fleet_manager_id 是否匹配');
      }

      setFavoriteRoutes(data || []);
    } catch (error: any) {
      console.error('❌ 加载常用线路失败:', error);
      toast({
        title: '加载失败',
        description: error.message || '无法加载常用线路，请检查控制台',
        variant: 'destructive'
      });
      setFavoriteRoutes([]);
    }
  };

  // 提交常用运单
  const handleSubmitFavoriteRoute = async (routeId: string) => {
    const route = favoriteRoutes.find(r => r.id === routeId);
    if (!route) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD格式
    const inputs = routeInputs[routeId] || { 
      loading_weight: '', 
      unloading_weight: '',
      loading_date: today,
      unloading_date: today
    };
    
    // 验证装货数量（使用trim检查，确保不是空字符串或只有空格）
    const loadingWeightStr = inputs.loading_weight?.trim() || '';
    if (!loadingWeightStr || !route.project_id || !route.loading_location_id || !route.unloading_location_id) {
      toast({
        title: '信息不完整',
        description: '请填写装货数量',
        variant: 'destructive'
      });
      return;
    }

    setSubmittingRouteId(routeId);
    try {
      // 验证装货数量是否为有效数字
      const loadingWeight = parseFloat(loadingWeightStr);
      if (isNaN(loadingWeight) || loadingWeight <= 0) {
        toast({
          title: '信息不完整',
          description: '请输入有效的装货数量',
          variant: 'destructive'
        });
        setSubmittingRouteId(null);
        return;
      }

      // 处理卸货数量（可选）
      let unloadingWeight: number | null = null;
      if (inputs.unloading_weight && inputs.unloading_weight.trim() !== '') {
        const parsed = parseFloat(inputs.unloading_weight.trim());
        if (!isNaN(parsed) && parsed > 0) {
          unloadingWeight = parsed;
        }
      }

      // 处理日期（默认今天）
      const loadingDate = inputs.loading_date || today;
      const unloadingDate = inputs.unloading_date || today;

      const { data, error } = await supabase.rpc('driver_quick_create_waybill', {
        p_project_id: route.project_id,
        p_loading_location_id: route.loading_location_id,
        p_unloading_location_id: route.unloading_location_id,
        p_loading_weight: loadingWeight,
        p_unloading_weight: unloadingWeight,
        p_loading_date: loadingDate,
        p_unloading_date: unloadingDate,
        p_remarks: null
      });

      if (error) throw error;
      
      if (data.success) {
        toast({
          title: '创建成功',
          description: `运单 ${data.auto_number} 已创建`
        });
        
        // 清空该线路的输入（保留日期为今天）
        const today = new Date().toISOString().split('T')[0];
        setRouteInputs(prev => {
          const newInputs = { ...prev };
          newInputs[routeId] = {
            loading_weight: '',
            unloading_weight: '',
            loading_date: today,
            unloading_date: today
          };
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
      // 验证装货数量是否为有效数字
      const loadingWeight = parseFloat(formData.loading_weight);
      if (isNaN(loadingWeight) || loadingWeight <= 0) {
        toast({
          title: '信息不完整',
          description: '请输入有效的装货数量',
          variant: 'destructive'
        });
        setSubmitting(false);
        return;
      }

      // 处理卸货数量（可选）
      let unloadingWeight: number | null = null;
      if (formData.unloading_weight && formData.unloading_weight.trim() !== '') {
        const parsed = parseFloat(formData.unloading_weight);
        if (!isNaN(parsed) && parsed > 0) {
          unloadingWeight = parsed;
        }
      }

      const { data, error } = await supabase.rpc('driver_quick_create_waybill', {
        p_project_id: formData.project_id,
        p_loading_location_id: formData.loading_location_id,
        p_unloading_location_id: formData.unloading_location_id,
        p_loading_weight: loadingWeight,
        p_unloading_weight: unloadingWeight,
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
            <Tabs defaultValue="favorite" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-muted">
                <TabsTrigger value="favorite" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  常用运单
                </TabsTrigger>
                <TabsTrigger value="new" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  新增运单
                </TabsTrigger>
              </TabsList>

              {/* 常用运单标签页 */}
              <TabsContent value="favorite" className="space-y-4 mt-4">
                {favoriteRoutes.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>暂无常用线路</p>
                    <p className="text-xs mt-2">车队长配置常用线路后，将显示在这里</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 线路选择下拉框 */}
                    <div className="space-y-2">
                      <Label>选择常用线路 *</Label>
                      <Select 
                        value={selectedRouteId || undefined}
                        onValueChange={(value) => {
                          setSelectedRouteId(value);
                          // 切换线路时，初始化输入框（如果还没有）
                          const today = new Date().toISOString().split('T')[0];
                          setRouteInputs(prev => {
                            if (!prev[value]) {
                              return {
                                ...prev,
                                [value]: {
                                  loading_weight: '',
                                  unloading_weight: '',
                                  loading_date: today,
                                  unloading_date: today
                                }
                              };
                            }
                            return prev;
                          });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="选择常用线路" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-50">
                          {favoriteRoutes.map(route => (
                            <SelectItem key={route.id} value={route.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{route.route_name}</span>
                                {route.use_count > 0 && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    使用 {route.use_count} 次
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 选中线路的输入表单 */}
                    {selectedRouteId && (() => {
                      const route = favoriteRoutes.find(r => r.id === selectedRouteId);
                      if (!route) return null;
                      
                      const today = new Date().toISOString().split('T')[0];
                      const inputs = routeInputs[selectedRouteId] || { 
                        loading_weight: '', 
                        unloading_weight: '',
                        loading_date: today,
                        unloading_date: today
                      };
                      const isSubmitting = submittingRouteId === selectedRouteId;
                      
                      return (
                        <Card className="border">
                          <CardContent className="p-4 space-y-3">
                            {/* 线路信息 */}
                            <div className="space-y-2 pb-3 border-b">
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
                            <div className="space-y-3">
                              {/* 数量输入 */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">装货数量 *</Label>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={inputs.loading_weight}
                                    onChange={e => {
                                      const limited = limitAmountInput(e.target.value);
                                      setRouteInputs(prev => ({
                                        ...prev,
                                        [selectedRouteId]: {
                                          ...(prev[selectedRouteId] || { 
                                            loading_weight: '', 
                                            unloading_weight: '',
                                            loading_date: today,
                                            unloading_date: today
                                          }),
                                          loading_weight: limited
                                        }
                                      }));
                                    }}
                                    disabled={isSubmitting}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">卸货数量</Label>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="默认等于装货"
                                    value={inputs.unloading_weight}
                                    onChange={e => {
                                      const limited = limitAmountInput(e.target.value);
                                      setRouteInputs(prev => ({
                                        ...prev,
                                        [selectedRouteId]: {
                                          ...(prev[selectedRouteId] || { 
                                            loading_weight: '', 
                                            unloading_weight: '',
                                            loading_date: today,
                                            unloading_date: today
                                          }),
                                          unloading_weight: limited
                                        }
                                      }));
                                    }}
                                    disabled={isSubmitting}
                                  />
                                </div>
                              </div>
                              
                              {/* 日期输入 */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">装货日期 *</Label>
                                  <Input
                                    type="date"
                                    value={inputs.loading_date || today}
                                    onChange={e => {
                                      setRouteInputs(prev => ({
                                        ...prev,
                                        [selectedRouteId]: {
                                          ...(prev[selectedRouteId] || { 
                                            loading_weight: '', 
                                            unloading_weight: '',
                                            loading_date: today,
                                            unloading_date: today
                                          }),
                                          loading_date: e.target.value
                                        }
                                      }));
                                    }}
                                    disabled={isSubmitting}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">卸货日期 *</Label>
                                  <Input
                                    type="date"
                                    value={inputs.unloading_date || today}
                                    onChange={e => {
                                      setRouteInputs(prev => ({
                                        ...prev,
                                        [selectedRouteId]: {
                                          ...(prev[selectedRouteId] || { 
                                            loading_weight: '', 
                                            unloading_weight: '',
                                            loading_date: today,
                                            unloading_date: today
                                          }),
                                          unloading_date: e.target.value
                                        }
                                      }));
                                    }}
                                    disabled={isSubmitting}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* 提交按钮 */}
                            <Button
                              className="w-full"
                              size="sm"
                              onClick={() => handleSubmitFavoriteRoute(selectedRouteId)}
                              disabled={isSubmitting || !inputs.loading_weight?.trim()}
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
                    })()}
                  </div>
                )}
              </TabsContent>

              {/* 新增运单标签页 */}
              <TabsContent value="new" className="space-y-4 mt-4">
            {/* 项目选择 */}
            <div className="grid gap-2">
              <Label>运输项目 *</Label>
              <Select 
                value={formData.project_id || undefined} 
                onValueChange={value => setFormData(prev => ({ ...prev, project_id: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-50">
                  {myRoutes.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      暂无项目，请联系车队长配置
                    </div>
                  ) : (
                    myRoutes.map(route => (
                      <SelectItem key={route.project_id} value={route.project_id}>
                        {route.project_name}
                        {route.is_primary_route && <Badge className="ml-2 bg-blue-600 text-white text-xs">常跑</Badge>}
                      </SelectItem>
                    ))
                  )}
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
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (formData.project_id) {
                      setAddLocationType('loading');
                      setShowAddLocationDialog(true);
                    } else {
                      toast({
                        title: '提示',
                        description: '请先选择项目',
                        variant: 'destructive'
                      });
                    }
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  添加地点
                </Button>
              </Label>
              <Select 
                value={formData.loading_location_id || undefined} 
                onValueChange={value => setFormData(prev => ({ ...prev, loading_location_id: value }))}
                disabled={!formData.project_id}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={formData.project_id ? "选择装货地点" : "请先选择项目"} />
                </SelectTrigger>
                <SelectContent position="popper" className="z-50">
                  {projectLoadingLocations.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      暂无装货地点，请点击"添加地点"
                    </div>
                  ) : (
                    projectLoadingLocations.map((loc: any) => (
                      <SelectItem key={loc.location_id} value={loc.location_id}>
                        {loc.location_name}
                      </SelectItem>
                    ))
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
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (formData.project_id) {
                      setAddLocationType('unloading');
                      setShowAddLocationDialog(true);
                    } else {
                      toast({
                        title: '提示',
                        description: '请先选择项目',
                        variant: 'destructive'
                      });
                    }
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  添加地点
                </Button>
              </Label>
              <Select 
                value={formData.unloading_location_id || undefined} 
                onValueChange={value => setFormData(prev => ({ ...prev, unloading_location_id: value }))}
                disabled={!formData.project_id}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={formData.project_id ? "选择卸货地点" : "请先选择项目"} />
                </SelectTrigger>
                <SelectContent position="popper" className="z-50">
                  {projectUnloadingLocations.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      暂无卸货地点，请点击"添加地点"
                    </div>
                  ) : (
                    projectUnloadingLocations.map((loc: any) => (
                      <SelectItem key={loc.location_id} value={loc.location_id}>
                        {loc.location_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 装货数量 */}
            <div className="grid gap-2">
              <Label>装货数量 *</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={formData.loading_weight}
                onChange={e => {
                  const limited = limitAmountInput(e.target.value);
                  setFormData(prev => ({ ...prev, loading_weight: limited }));
                }}
              />
            </div>

            {/* 卸货数量（可选） */}
            <div className="grid gap-2">
              <Label>卸货数量（可选，默认等于装货）</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="默认等于装货数量"
                value={formData.unloading_weight}
                onChange={e => {
                  const limited = limitAmountInput(e.target.value);
                  setFormData(prev => ({ ...prev, unloading_weight: limited }));
                }}
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
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => navigate('/m/internal/my-waybills')}
              >
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

        {/* 常用线路提示信息 */}
        {favoriteRoutes.length === 0 && fleetManagerId && driverId && !loading && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4 text-sm text-blue-800">
              <p className="font-medium mb-2">ℹ️ 暂无常用线路</p>
              <p className="text-xs mb-2">车队长已配置常用线路，但尚未分配给您。</p>
              <p className="text-xs font-semibold">操作步骤：</p>
              <ol className="text-xs list-decimal list-inside space-y-1 mt-1">
                <li>车队长登录PC端</li>
                <li>进入"车队配置"页面</li>
                <li>选择对应的车队长</li>
                <li>进入"常跑线路"标签页</li>
                <li>点击线路的"分配"按钮（👥图标）</li>
                <li>选择您并保存</li>
              </ol>
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

