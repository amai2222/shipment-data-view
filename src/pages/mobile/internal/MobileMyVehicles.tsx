// 移动端 - 我的车辆和换车申请

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import {
  Truck,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Loader2,
  Info
} from 'lucide-react';
import { format } from 'date-fns';

interface Vehicle {
  vehicle_id: string;
  license_plate: string;
  vehicle_type: string;
  is_primary: boolean;
  relation_type: string;
}

interface VehicleChangeApp {
  id: string;
  application_number: string;
  current_vehicle: string | null;
  requested_vehicle: string;
  reason: string;
  status: string;
  review_comment: string | null;
  created_at: string;
}

export default function MobileMyVehicles() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [myVehicles, setMyVehicles] = useState<Vehicle[]>([]);
  const [changeApplications, setChangeApplications] = useState<VehicleChangeApp[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [changeReason, setChangeReason] = useState('');

  useEffect(() => {
    loadMyVehicles();
    loadChangeApplications();
    loadAvailableVehicles();
  }, []);

  // 加载我的车辆
  const loadMyVehicles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_my_vehicles');
      
      if (error) throw error;
      setMyVehicles(data || []);
    } catch (error) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载车辆信息',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 加载换车申请记录
  const loadChangeApplications = async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_vehicle_change_applications');
      
      if (error) throw error;
      setChangeApplications(data || []);
    } catch (error) {
      console.error('加载申请记录失败:', error);
    }
  };

  // 加载可换的车辆列表
  const loadAvailableVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('internal_vehicles')
        .select('id, license_plate, vehicle_type, vehicle_brand, vehicle_model, vehicle_status')
        .eq('is_active', true)
        .eq('vehicle_status', 'active');
      
      if (error) throw error;
      setAvailableVehicles(data || []);
    } catch (error) {
      console.error('加载车辆列表失败:', error);
    }
  };

  // 提交换车申请
  const handleSubmitChange = async () => {
    if (!selectedVehicle) {
      toast({
        title: '请选择车辆',
        description: '请选择要换的车辆',
        variant: 'destructive'
      });
      return;
    }

    if (!changeReason.trim()) {
      toast({
        title: '请填写原因',
        description: '请说明换车原因',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const primaryVehicle = myVehicles.find(v => v.is_primary);
      
      const { data, error } = await supabase.rpc('submit_vehicle_change_application', {
        p_current_vehicle_id: primaryVehicle?.vehicle_id || null,
        p_requested_vehicle_id: selectedVehicle,
        p_reason: changeReason,
        p_application_type: 'change'
      });

      if (error) throw error;
      
      if (data.success) {
        toast({
          title: '提交成功',
          description: '换车申请已提交，等待车队长审批'
        });
        
        setShowChangeDialog(false);
        setSelectedVehicle('');
        setChangeReason('');
        loadChangeApplications();
      } else {
        toast({
          title: '提交失败',
          description: data.error || '提交失败',
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
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: '待审批', color: 'bg-yellow-100 text-yellow-800', icon: Clock };
      case 'approved':
        return { label: '已通过', color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'rejected':
        return { label: '已驳回', color: 'bg-red-100 text-red-800', icon: XCircle };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800', icon: Info };
    }
  };

  const primaryVehicle = myVehicles.find(v => v.is_primary);
  const backupVehicles = myVehicles.filter(v => !v.is_primary);

  return (
    <MobileLayout>
      <div className="space-y-4 pb-20">
        {/* 当前主车 */}
        {primaryVehicle ? (
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                我的主车
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-blue-700">
                    {primaryVehicle.license_plate}
                  </div>
                  <Badge className="bg-blue-600 text-white">主车</Badge>
                </div>
                <div className="text-sm text-blue-600">
                  {primaryVehicle.vehicle_type || '厢式货车'}
                </div>
                <Button
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => setShowChangeDialog(true)}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  申请换车
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-2" />
              <p className="text-sm text-muted-foreground">暂未分配主车</p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => setShowChangeDialog(true)}
              >
                申请分配车辆
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 备用车列表 */}
        {backupVehicles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">备用车辆</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {backupVehicles.map(vehicle => (
                <div 
                  key={vehicle.vehicle_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="font-medium">{vehicle.license_plate}</div>
                    <div className="text-xs text-muted-foreground">
                      {vehicle.vehicle_type}
                    </div>
                  </div>
                  <Badge variant="outline">
                    {vehicle.relation_type === 'backup' ? '备用' : '临时'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 换车申请记录 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">换车申请记录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {changeApplications.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                暂无换车申请记录
              </div>
            ) : (
              changeApplications.map(app => {
                const statusConfig = getStatusConfig(app.status);
                const StatusIcon = statusConfig.icon;
                
                return (
                  <Card key={app.id}>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(app.created_at), 'MM-dd HH:mm')}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">
                            {app.current_vehicle || '无'}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {app.requested_vehicle}
                          </span>
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          原因：{app.reason}
                        </div>
                        
                        {app.review_comment && (
                          <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
                            审批意见：{app.review_comment}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* 换车申请对话框 */}
        <Dialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>申请换车</DialogTitle>
              <DialogDescription>
                选择要更换的车辆并说明原因
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>当前主车</Label>
                <div className="p-3 bg-gray-100 rounded text-center font-medium">
                  {primaryVehicle?.license_plate || '暂无'}
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label>申请换成</Label>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择车辆" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVehicles.map(vehicle => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.license_plate} - {vehicle.vehicle_type}
                        {vehicle.vehicle_brand && ` (${vehicle.vehicle_brand})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label>换车原因</Label>
                <Textarea
                  placeholder="请说明换车原因..."
                  value={changeReason}
                  onChange={e => setChangeReason(e.target.value)}
                  rows={4}
                />
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    换车申请需要车队长审批，审批通过后车辆关联将自动更新。
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowChangeDialog(false)}>
                取消
              </Button>
              <Button onClick={handleSubmitChange} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                提交申请
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
}

