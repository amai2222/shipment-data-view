// 移动端 - 车队长工作台（首页）

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import {
  Truck,
  Users,
  FileText,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Calendar,
  Settings,
  Bell,
  User
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  totalVehicles: number;
  activeVehicles: number;
  maintenanceVehicles: number;
  totalDrivers: number;
  activeDrivers: number;
  pendingExpenses: number;
  pendingVehicleChanges: number;
  expiringCertificates: number;
  thisMonthTrips: number;
}

export default function MobileFleetDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    activeVehicles: 0,
    maintenanceVehicles: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    pendingExpenses: 0,
    pendingVehicleChanges: 0,
    expiringCertificates: 0,
    thisMonthTrips: 0
  });

  useEffect(() => {
    loadStats();
    
    // ✅ 预加载常用页面，避免首次点击时出现"刷新"
    setTimeout(() => {
      import('./MobileExpenseReview');
      import('./MobileVehicleManagement');
      import('./MobileDriverRouteConfig');
    }, 1000); // 页面加载1秒后开始预加载
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // ✅ 查询真实的统计数据
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const userId = (await supabase.auth.getUser()).data.user?.id;
      
      if (!userId) return;

      // ✅ 1. 获取车队长管理的司机
      const { data: managedDrivers, error: driverError } = await supabase
        .from('internal_drivers')
        .select('id, name, user_id')
        .eq('fleet_manager_id', userId);
      
      if (driverError) throw driverError;

      const managedDriverIds = (managedDrivers || []).map(d => d.id);
      const managedDriverNames = (managedDrivers || []).map(d => d.name);

      // ✅ 2. 通过司机获取车辆统计
      let vehicleData: any[] = [];
      if (managedDriverIds.length > 0) {
        const { data: vData, error: vError } = await supabase
          .from('internal_driver_vehicle_relations')
          .select('vehicle:internal_vehicles(id, vehicle_status)')
          .in('driver_id', managedDriverIds)
          .is('valid_until', null);  // 只查询当前有效的分配
        
        if (!vError) {
          vehicleData = (vData || []).map((r: any) => r.vehicle).filter((v: any) => v);
        }
      }

      // ✅ 3. 获取待审核的费用申请（只统计管理的司机的申请）
      const { count: expenseCount } = await supabase
        .from('internal_driver_expense_applications')
        .select('id', { count: 'estimated', head: true })
        .eq('status', 'pending')
        .in('driver_name', managedDriverNames.length > 0 ? managedDriverNames : ['无']);

      // ✅ 4. 获取待审核的换车申请
      const { count: changeCount } = await supabase
        .from('internal_driver_vehicle_change_applications')
        .select('id', { count: 'estimated', head: true })
        .eq('status', 'pending');

      // ✅ 5. 获取即将到期的证件（30天内，管理的车辆）
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + 30);
      const expireDateStr = expireDate.toISOString().split('T')[0];
      
      const vehicleIds = vehicleData.map((v: any) => v.id);
      let expireCertCount = 0;
      if (vehicleIds.length > 0) {
        const { count } = await supabase
          .from('internal_vehicles')
          .select('id', { count: 'estimated', head: true })
          .in('id', vehicleIds)
          .or(`driving_license_expire_date.lte.${expireDateStr},insurance_expire_date.lte.${expireDateStr}`);
        
        expireCertCount = count || 0;
      }

      // ✅ 6. 获取本月运单数（管理的司机的运单）
      let tripCount = 0;
      if (managedDriverNames.length > 0) {
        const { count } = await supabase
          .from('logistics_records')
          .select('id', { count: 'estimated', head: true })
          .in('driver_name', managedDriverNames)
          .gte('loading_date', `${currentMonth}-01`);
        
        tripCount = count || 0;
      }

      // 更新统计数据
      setStats({
        totalVehicles: vehicleData.length,
        activeVehicles: vehicleData.filter((v: any) => v.vehicle_status === 'active').length,
        maintenanceVehicles: vehicleData.filter((v: any) => v.vehicle_status === 'maintenance').length,
        totalDrivers: managedDrivers?.length || 0,
        activeDrivers: managedDrivers?.filter(d => d.user_id).length || 0,
        pendingExpenses: expenseCount || 0,
        pendingVehicleChanges: changeCount || 0,
        expiringCertificates: expireCertCount,
        thisMonthTrips: tripCount
      });
    } catch (error) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载统计数据',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileLayout>
      <div className="space-y-4 pb-20">
        {/* 欢迎卡片（带头像） */}
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-white">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-blue-700 text-white text-lg">
                  {profile?.full_name?.substring(0, 2) || profile?.username?.substring(0, 2).toUpperCase() || 'FM'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="text-sm opacity-90">车队长</div>
                <h2 className="text-2xl font-bold mt-1">
                  {profile?.full_name || profile?.username || '车队长'}
                </h2>
                <p className="text-blue-100 text-sm mt-1">
                  {new Date().toLocaleDateString('zh-CN', { 
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <Truck className="h-12 w-12 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* 待办事项 */}
        {(stats.pendingExpenses > 0 || stats.pendingVehicleChanges > 0 || stats.expiringCertificates > 0) && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-orange-800">
                <Bell className="h-5 w-5" />
                待办事项
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.pendingExpenses > 0 && (
                <Button
                  variant="ghost"
                  className="w-full justify-between h-auto py-3 hover:bg-orange-100"
                  onClick={() => navigate('/m/internal/expense-review')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">费用申请待审核</div>
                      <div className="text-sm text-muted-foreground">司机提交的费用申请</div>
                    </div>
                  </div>
                  <Badge className="bg-red-500 text-white text-lg px-3">
                    {stats.pendingExpenses}
                  </Badge>
                </Button>
              )}

              {stats.pendingVehicleChanges > 0 && (
                <Button
                  variant="ghost"
                  className="w-full justify-between h-auto py-3 hover:bg-orange-100"
                  onClick={() => navigate('/m/internal/vehicle-change-review')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">换车申请待审批</div>
                      <div className="text-sm text-muted-foreground">司机换车申请</div>
                    </div>
                  </div>
                  <Badge className="bg-blue-500 text-white text-lg px-3">
                    {stats.pendingVehicleChanges}
                  </Badge>
                </Button>
              )}

              {stats.expiringCertificates > 0 && (
                <Button
                  variant="ghost"
                  className="w-full justify-between h-auto py-3 hover:bg-orange-100"
                  onClick={() => navigate('/m/internal/certificate-alerts')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">证件即将到期</div>
                      <div className="text-sm text-muted-foreground">需要更新的证件</div>
                    </div>
                  </div>
                  <Badge className="bg-yellow-500 text-white text-lg px-3">
                    {stats.expiringCertificates}
                  </Badge>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* 车辆和司机概览 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4 text-center">
              <Truck className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <div className="text-2xl font-bold text-green-700">{stats.activeVehicles}</div>
              <div className="text-xs text-green-600 mt-1">在用车辆</div>
              {stats.maintenanceVehicles > 0 && (
                <div className="text-xs text-orange-600 mt-1">
                  {stats.maintenanceVehicles}辆维修中
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <div className="text-2xl font-bold text-blue-700">{stats.activeDrivers}</div>
              <div className="text-xs text-blue-600 mt-1">在职司机</div>
              <div className="text-xs text-muted-foreground mt-1">
                共{stats.totalDrivers}人
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 快捷功能 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">快捷功能</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => navigate('/m/internal/vehicles')}
            >
              <Truck className="h-6 w-6" />
              <span className="text-sm">车辆管理</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => navigate('/m/internal/expense-review')}
            >
              <FileText className="h-6 w-6" />
              <span className="text-sm">费用审核</span>
              {stats.pendingExpenses > 0 && (
                <Badge className="absolute top-2 right-2 bg-red-500">
                  {stats.pendingExpenses}
                </Badge>
              )}
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => navigate('/m/internal/driver-route-config')}
            >
              <Settings className="h-6 w-6" />
              <span className="text-sm">司机线路</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => navigate('/m/internal/vehicles')}
            >
              <Truck className="h-6 w-6" />
              <span className="text-sm">车辆管理</span>
            </Button>
          </CardContent>
        </Card>

        {/* 本月数据 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              本月数据
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{stats.thisMonthTrips}</div>
                <div className="text-xs text-muted-foreground mt-1">总车次</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">95%</div>
                <div className="text-xs text-muted-foreground mt-1">出勤率</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">12</div>
                <div className="text-xs text-muted-foreground mt-1">平均单车</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}

