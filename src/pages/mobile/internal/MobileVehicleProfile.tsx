// 移动端 - 车辆资料维护页面
// 功能：司机填写车辆资料和日常里程维护

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { DriverMobileLayout } from '@/components/mobile/DriverMobileLayout';
import {
  Truck,
  Gauge,
  Calendar,
  Edit,
  Save,
  ArrowLeft,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface VehicleInfo {
  id: string;
  license_plate: string;
  vehicle_type: string;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  current_mileage: number | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  maintenance_mileage: number | null;
  fuel_type: string | null;
  load_capacity: number | null;
}

interface MileageRecord {
  id: string;
  record_date: string;
  mileage: number;
  notes: string | null;
  created_at: string;
}

export default function MobileVehicleProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [mileageRecords, setMileageRecords] = useState<MileageRecord[]>([]);
  const [showMileageDialog, setShowMileageDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  // 里程维护表单
  const [mileageForm, setMileageForm] = useState({
    record_date: new Date().toISOString().split('T')[0],
    mileage: '',
    notes: ''
  });
  
  // 车辆资料编辑表单
  const [editForm, setEditForm] = useState({
    vehicle_brand: '',
    vehicle_model: '',
    fuel_type: '',
    load_capacity: ''
  });

  // 加载车辆信息
  const loadVehicleInfo = useCallback(async () => {
    setLoading(true);
    try {
      const { data: vehicles, error: vehiclesError } = await supabase.rpc('get_my_vehicles');
      
      if (vehiclesError) throw vehiclesError;
      
      const primaryVehicle = vehicles?.find((v: { is_primary: boolean }) => v.is_primary);
      if (!primaryVehicle) {
        toast({
          title: '未找到主车',
          description: '您还没有分配主车',
          variant: 'destructive'
        });
        return;
      }
      
      // 获取车辆详细信息
      const { data: vehicleData, error: vehicleError } = await supabase
        .from('internal_vehicles')
        .select('*')
        .eq('id', primaryVehicle.vehicle_id)
        .single();
      
      if (vehicleError) throw vehicleError;
      
      setVehicleInfo(vehicleData);
      setEditForm({
        vehicle_brand: vehicleData.vehicle_brand || '',
        vehicle_model: vehicleData.vehicle_model || '',
        fuel_type: vehicleData.fuel_type || '',
        load_capacity: vehicleData.load_capacity?.toString() || ''
      });
    } catch (error) {
      console.error('加载车辆信息失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载车辆信息',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 加载里程维护记录
  const loadMileageRecords = useCallback(async () => {
    if (!vehicleInfo?.id) return;
    
    try {
      // 从车辆月度汇总表或专门的里程记录表获取
      // 这里假设有 internal_vehicle_mileage_records 表，如果没有需要创建
      const { data, error } = await supabase
        .from('internal_vehicle_mileage_records')
        .select('*')
        .eq('vehicle_id', vehicleInfo.id)
        .order('record_date', { ascending: false })
        .limit(20);
      
      if (error && error.code !== 'PGRST116') {
        // PGRST116 表示表不存在，可以忽略
        console.warn('加载里程记录失败（表可能不存在）:', error);
      } else if (data) {
        setMileageRecords(data);
      }
    } catch (error) {
      console.warn('加载里程记录失败:', error);
    }
  }, [vehicleInfo?.id]);

  useEffect(() => {
    loadVehicleInfo();
  }, [loadVehicleInfo]);

  useEffect(() => {
    if (vehicleInfo) {
      loadMileageRecords();
    }
  }, [vehicleInfo, loadMileageRecords]);

  // 提交里程维护记录
  const handleSubmitMileage = async () => {
    if (!vehicleInfo?.id) return;
    
    if (!mileageForm.mileage || parseFloat(mileageForm.mileage) <= 0) {
      toast({
        title: '请输入有效里程',
        description: '里程必须大于0',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // 检查表是否存在，如果不存在则先创建
      // 这里先尝试插入，如果失败则提示需要创建表
      const { error } = await supabase
        .from('internal_vehicle_mileage_records')
        .insert({
          vehicle_id: vehicleInfo.id,
          record_date: mileageForm.record_date,
          mileage: parseFloat(mileageForm.mileage),
          notes: mileageForm.notes || null,
          driver_id: (await supabase.auth.getUser()).data.user?.id || null
        });
      
      if (error) {
        if (error.code === '42P01') {
          // 表不存在，需要创建
          toast({
            title: '功能暂未启用',
            description: '里程记录表尚未创建，请联系管理员',
            variant: 'destructive'
          });
          return;
        }
        throw error;
      }
      
      // 更新车辆当前里程
      await supabase
        .from('internal_vehicles')
        .update({ 
          current_mileage: parseFloat(mileageForm.mileage),
          updated_at: new Date().toISOString()
        })
        .eq('id', vehicleInfo.id);
      
      toast({
        title: '提交成功',
        description: '里程记录已保存'
      });
      
      setShowMileageDialog(false);
      setMileageForm({
        record_date: new Date().toISOString().split('T')[0],
        mileage: '',
        notes: ''
      });
      
      loadVehicleInfo();
      loadMileageRecords();
    } catch (error) {
      console.error('提交失败:', error);
      toast({
        title: '提交失败',
        description: '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 保存车辆资料编辑
  const handleSaveEdit = async () => {
    if (!vehicleInfo?.id) return;
    
    setLoading(true);
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };
      
      if (editForm.vehicle_brand) updateData.vehicle_brand = editForm.vehicle_brand;
      if (editForm.vehicle_model) updateData.vehicle_model = editForm.vehicle_model;
      if (editForm.fuel_type) updateData.fuel_type = editForm.fuel_type;
      if (editForm.load_capacity) updateData.load_capacity = parseFloat(editForm.load_capacity);
      
      const { error } = await supabase
        .from('internal_vehicles')
        .update(updateData)
        .eq('id', vehicleInfo.id);
      
      if (error) throw error;
      
      toast({
        title: '保存成功',
        description: '车辆资料已更新'
      });
      
      setShowEditDialog(false);
      loadVehicleInfo();
    } catch (error) {
      console.error('保存失败:', error);
      toast({
        title: '保存失败',
        description: '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !vehicleInfo) {
    return (
      <DriverMobileLayout title="车辆资料">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DriverMobileLayout>
    );
  }

  if (!vehicleInfo) {
    return (
      <DriverMobileLayout title="车辆资料">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">未找到车辆信息</p>
          </CardContent>
        </Card>
      </DriverMobileLayout>
    );
  }

  return (
    <DriverMobileLayout title="车辆资料">
      <div className="space-y-4 pb-24 px-1">
        {/* 车辆基本信息 */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">车辆信息</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3"
              onClick={() => setShowEditDialog(true)}
            >
              <Edit className="h-4 w-4 mr-1" />
              编辑
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">车牌号</Label>
                <p className="font-semibold text-base">{vehicleInfo.license_plate}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">车辆类型</Label>
                <p className="font-semibold text-base">{vehicleInfo.vehicle_type}</p>
              </div>
              {vehicleInfo.vehicle_brand && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">品牌</Label>
                  <p className="font-medium text-base">{vehicleInfo.vehicle_brand}</p>
                </div>
              )}
              {vehicleInfo.vehicle_model && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">型号</Label>
                  <p className="font-medium text-base">{vehicleInfo.vehicle_model}</p>
                </div>
              )}
              {vehicleInfo.fuel_type && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">燃料类型</Label>
                  <p className="font-medium text-base">{vehicleInfo.fuel_type}</p>
                </div>
              )}
              {vehicleInfo.load_capacity && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">载重量</Label>
                  <p className="font-medium text-base">{vehicleInfo.load_capacity} 吨</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 里程信息 */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">里程信息</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3"
              onClick={() => setShowMileageDialog(true)}
            >
              <Gauge className="h-4 w-4 mr-1" />
              记录里程
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">当前里程</Label>
                <p className="font-bold text-xl">
                  {vehicleInfo.current_mileage?.toLocaleString() || '未记录'} 公里
                </p>
              </div>
              {vehicleInfo.next_maintenance_date && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">下次保养日期</Label>
                  <p className="font-medium text-base">
                    {format(new Date(vehicleInfo.next_maintenance_date), 'yyyy-MM-dd', { locale: zhCN })}
                  </p>
                </div>
              )}
              {vehicleInfo.last_maintenance_date && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">上次保养日期</Label>
                  <p className="font-medium text-base">
                    {format(new Date(vehicleInfo.last_maintenance_date), 'yyyy-MM-dd', { locale: zhCN })}
                  </p>
                </div>
              )}
              {vehicleInfo.maintenance_mileage && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">保养里程间隔</Label>
                  <p className="font-medium text-base">{vehicleInfo.maintenance_mileage.toLocaleString()} 公里</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 里程维护记录 */}
        {mileageRecords.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">里程维护记录</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mileageRecords.map(record => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-base">
                        {format(new Date(record.record_date), 'yyyy-MM-dd', { locale: zhCN })}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      {record.mileage.toLocaleString()} 公里
                    </p>
                    {record.notes && (
                      <p className="text-xs text-muted-foreground">{record.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 里程记录对话框 */}
        <Dialog open={showMileageDialog} onOpenChange={setShowMileageDialog}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">记录里程</DialogTitle>
              <DialogDescription className="text-sm">
                记录当前车辆里程数
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-5 py-2">
              <div className="grid gap-2">
                <Label className="text-sm font-medium">记录日期</Label>
                <Input
                  type="date"
                  className="h-11 text-base"
                  value={mileageForm.record_date}
                  onChange={e => setMileageForm({ ...mileageForm, record_date: e.target.value })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label className="text-sm font-medium">当前里程（公里）</Label>
                <Input
                  type="number"
                  className="h-11 text-base"
                  placeholder="请输入里程数"
                  value={mileageForm.mileage}
                  onChange={e => setMileageForm({ ...mileageForm, mileage: e.target.value })}
                />
                {vehicleInfo.current_mileage && (
                  <p className="text-xs text-muted-foreground mt-1">
                    上次记录：{vehicleInfo.current_mileage.toLocaleString()} 公里
                  </p>
                )}
              </div>
              
              <div className="grid gap-2">
                <Label className="text-sm font-medium">备注（可选）</Label>
                <Textarea
                  className="text-base min-h-[100px]"
                  placeholder="如：保养后、维修后等"
                  value={mileageForm.notes}
                  onChange={e => setMileageForm({ ...mileageForm, notes: e.target.value })}
                  rows={4}
                />
              </div>
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                variant="outline" 
                className="h-11 flex-1" 
                onClick={() => setShowMileageDialog(false)}
              >
                取消
              </Button>
              <Button 
                className="h-11 flex-1" 
                onClick={handleSubmitMileage} 
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 编辑车辆资料对话框 */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>编辑车辆资料</DialogTitle>
              <DialogDescription>
                更新车辆基本信息
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>品牌</Label>
                <Input
                  placeholder="如：东风、解放"
                  value={editForm.vehicle_brand}
                  onChange={e => setEditForm({ ...editForm, vehicle_brand: e.target.value })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label>型号</Label>
                <Input
                  placeholder="车型型号"
                  value={editForm.vehicle_model}
                  onChange={e => setEditForm({ ...editForm, vehicle_model: e.target.value })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label>燃料类型</Label>
                <Input
                  placeholder="如：柴油、汽油、电动"
                  value={editForm.fuel_type}
                  onChange={e => setEditForm({ ...editForm, fuel_type: e.target.value })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label>载重量（吨）</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="核定载重量"
                  value={editForm.load_capacity}
                  onChange={e => setEditForm({ ...editForm, load_capacity: e.target.value })}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                取消
              </Button>
              <Button onClick={handleSaveEdit} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DriverMobileLayout>
  );
}

