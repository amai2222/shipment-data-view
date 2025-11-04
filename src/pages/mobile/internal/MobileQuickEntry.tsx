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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
  ChevronRight
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

  useEffect(() => {
    loadMyInfo();
    loadMyRoutes();
    loadRecentWaybills();
  }, []);

  // 加载司机信息
  const loadMyInfo = async () => {
    try {
      // 获取司机档案
      const { data: driverData } = await supabase.rpc('get_my_driver_info');
      if (driverData && driverData.length > 0) {
        setDriverInfo(driverData[0]);
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

  // 加载我的项目线路
  const loadMyRoutes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_my_project_routes');
      
      if (error) throw error;
      setMyRoutes(data || []);
      
      // 自动选择主线路
      if (data && data.length > 0) {
        const primary = data.find((r: any) => r.is_primary_route);
        if (primary) {
          setFormData(prev => ({ ...prev, project_id: primary.project_id }));
        }
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

        {/* 快速录入表单 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-5 w-5" />
              新增运单
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

            {/* 装货地 */}
            <div className="grid gap-2">
              <Label>装货地 *</Label>
              <Select 
                value={formData.loading_location_id} 
                onValueChange={value => setFormData(prev => ({ ...prev, loading_location_id: value }))}
                disabled={!selectedRoute}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择装货地点" />
                </SelectTrigger>
                <SelectContent>
                  {selectedRoute?.common_loading_locations?.map((loc: any) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 卸货地 */}
            <div className="grid gap-2">
              <Label>卸货地 *</Label>
              <Select 
                value={formData.unloading_location_id} 
                onValueChange={value => setFormData(prev => ({ ...prev, unloading_location_id: value }))}
                disabled={!selectedRoute}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择卸货地点" />
                </SelectTrigger>
                <SelectContent>
                  {selectedRoute?.common_unloading_locations?.map((loc: any) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
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
      </div>
    </MobileLayout>
  );
}

