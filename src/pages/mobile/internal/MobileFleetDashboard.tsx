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
  Bell
} from 'lucide-react';

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
  
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 6,
    activeVehicles: 5,
    maintenanceVehicles: 1,
    totalDrivers: 5,
    activeDrivers: 4,
    pendingExpenses: 3,
    pendingVehicleChanges: 1,
    expiringCertificates: 2,
    thisMonthTrips: 45
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // TODO: 调用实际的统计函数
      // const { data, error } = await supabase.rpc('get_fleet_dashboard_stats');
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileLayout>
      <div className="space-y-4 pb-20">
        {/* 欢迎卡片 */}
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-1">车队管理</h2>
                <p className="text-blue-100 text-sm">
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
              onClick={() => navigate('/m/internal/income-input')}
            >
              <DollarSign className="h-6 w-6" />
              <span className="text-sm">收入录入</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => navigate('/m/internal/ledger')}
            >
              <Calendar className="h-6 w-6" />
              <span className="text-sm">收支流水</span>
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

