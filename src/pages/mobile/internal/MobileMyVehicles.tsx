// 移动端 - 我的车辆主页面
// 包含：车辆资料、申请换车、车辆费用三个功能入口

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { DriverMobileLayout } from '@/components/mobile/DriverMobileLayout';
import {
  Truck,
  FileText,
  DollarSign,
  ArrowRight,
  Settings,
  Plus,
  Loader2
} from 'lucide-react';

interface Vehicle {
  vehicle_id: string;
  license_plate: string;
  vehicle_type: string;
  is_primary: boolean;
  relation_type: string;
}

export default function MobileMyVehicles() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [myVehicles, setMyVehicles] = useState<Vehicle[]>([]);

  // 加载我的车辆
  const loadMyVehicles = useCallback(async () => {
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
  }, [toast]);

  useEffect(() => {
    loadMyVehicles();
  }, [loadMyVehicles]);

  const primaryVehicle = myVehicles.find(v => v.is_primary);

  return (
    <DriverMobileLayout title="我的车辆">
      <div className="space-y-4 pb-24 px-1">
        {/* 加载状态 */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* 当前主车信息卡片 */}
        {!loading && primaryVehicle && (
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-blue-500 flex items-center justify-center shadow-md">
                    <Truck className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-xl">{primaryVehicle.license_plate}</h3>
                      <Badge variant="secondary" className="text-xs px-2 py-0.5">主车</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{primaryVehicle.vehicle_type}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 功能入口 */}
        {!loading && (
          <div className="grid grid-cols-1 gap-3">
            {/* 车辆资料 */}
            <Card 
              className="cursor-pointer active:scale-[0.98] transition-all shadow-sm hover:shadow-md border-2 hover:border-blue-300"
              onClick={() => navigate('/m/internal/vehicle-profile')}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base mb-1">车辆资料</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">查看和编辑车辆信息、里程维护</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>

            {/* 申请换车 */}
            <Card 
              className="cursor-pointer active:scale-[0.98] transition-all shadow-sm hover:shadow-md border-2 hover:border-orange-300"
              onClick={() => navigate('/m/internal/vehicle-change-application')}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Plus className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base mb-1">申请换车</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">提交换车申请，查看申请记录</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>

            {/* 车辆费用 */}
            <Card 
              className="cursor-pointer active:scale-[0.98] transition-all shadow-sm hover:shadow-md border-2 hover:border-green-300"
              onClick={() => navigate('/m/internal/vehicle-expenses')}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base mb-1">车辆费用</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">查看费用明细、冲销差额、收入统计</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 备用车辆列表 */}
        {!loading && myVehicles.filter(v => !v.is_primary).length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">备用车辆</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myVehicles.filter(v => !v.is_primary).map(vehicle => (
                <div 
                  key={vehicle.vehicle_id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium text-base">{vehicle.license_plate}</span>
                    <Badge variant="outline" className="text-xs">{vehicle.vehicle_type}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DriverMobileLayout>
  );
}
