// 移动端 - 车队长工作台（首页）- 货拉拉风格设计

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
  User,
  Calculator,
  ChevronRight,
  RefreshCw,
  Menu,
  Package,
  ClipboardList,
  Wallet,
  BarChart3,
  MapPin,
  Shield
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

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

interface DriverBalance {
  driver_id: string;
  driver_name: string;
  balance: number;
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
  
  // ✅ 司机余额相关状态
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [driverBalances, setDriverBalances] = useState<DriverBalance[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);

  useEffect(() => {
    loadStats();
    loadDriverBalances();
    
    // ✅ 预加载常用页面，避免首次点击时出现"刷新"
    setTimeout(() => {
      import('./MobileDispatchOrder');       // 派单管理（优先）
      import('./MobileExpenseReview');       // 费用审核
      import('./MobileVehicleManagement');   // 车辆管理
      import('./MobileDriverRouteConfig');   // 司机线路
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

      // ✅ 4. 获取待审核的换车申请（只统计管理的司机的申请）
      let changeCount = 0;
      if (managedDriverIds.length > 0) {
        const { count, error: changeError } = await supabase
          .from('internal_vehicle_change_applications')
          .select('id', { count: 'estimated', head: true })
          .eq('status', 'pending')
          .in('driver_id', managedDriverIds);
        
        if (changeError) {
          console.error('获取换车申请失败:', changeError);
        } else {
          changeCount = count || 0;
        }
      }

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
        pendingVehicleChanges: changeCount,
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

  // ✅ 加载所属司机的冲销余额
  const loadDriverBalances = async () => {
    setLoadingBalances(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;

      // 调用 RPC 函数获取所有司机余额
      const { data, error } = await supabase.rpc('get_driver_balances_by_fleet_manager');
      
      if (error) throw error;
      
      // 过滤出当前车队长管理的司机
      const myDrivers = (data || []).filter((item: any) => 
        item.fleet_manager_id === userId
      );
      
      // 计算总余额
      const total = myDrivers.reduce((sum: number, item: DriverBalance) => 
        sum + (item.balance || 0), 0
      );
      
      setDriverBalances(myDrivers);
      setTotalBalance(total);
    } catch (error: any) {
      console.error('加载司机余额失败:', error);
      // 不显示错误提示，避免干扰用户体验
    } finally {
      setLoadingBalances(false);
    }
  };

  // 功能分组配置（货拉拉风格 - 可折叠卡片）
  const functionGroups = [
    {
      title: '车辆管理',
      icon: Truck,
      color: 'from-blue-500 to-blue-600',
      items: [
        { name: '添加车辆', icon: Truck, path: '/m/internal/add-vehicle', badge: null },
        { name: '车辆档案', icon: FileText, path: '/m/internal/vehicles', badge: null },
        { name: '车辆司机明细', icon: ClipboardList, path: '/m/internal/vehicle-driver-detail', badge: null },
        { name: '车辆分配', icon: User, path: '/m/internal/vehicle-assignment', badge: null },
      ]
    },
    {
      title: '司机管理',
      icon: Users,
      color: 'from-green-500 to-green-600',
      items: [
        { name: '添加司机', icon: Users, path: '/m/internal/add-driver', badge: null },
        { name: '司机档案', icon: FileText, path: '/m/internal/drivers', badge: null },
        { name: '司机线路', icon: MapPin, path: '/m/internal/driver-route-config', badge: null },
      ]
    },
    {
      title: '运单管理',
      icon: Package,
      color: 'from-orange-500 to-orange-600',
      items: [
        { name: '每日运单', icon: Calendar, path: '/m/internal/daily-waybills', badge: null },
        { name: '派单管理', icon: ClipboardList, path: '/m/internal/dispatch-order', badge: null },
      ]
    },
    {
      title: '财务管理',
      icon: Wallet,
      color: 'from-purple-500 to-purple-600',
      items: [
        { name: '费用审核', icon: FileText, path: '/m/internal/expense-review', badge: stats.pendingExpenses > 0 ? stats.pendingExpenses : null },
        { name: '司机冲销', icon: Calculator, path: '/m/internal/expense-writeoff', badge: null },
      ]
    }
  ];

  // 折叠状态管理
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  // 切换折叠状态
  const toggleGroup = (index: number) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <MobileLayout showBack={false}>
      <div className="space-y-4 pb-20 bg-gray-50 min-h-screen">
        {/* 欢迎卡片（货拉拉风格 - 蓝色渐变） */}
        <Card className="bg-gradient-to-br from-[#1890FF] to-[#096DD9] text-white border-0 shadow-lg rounded-2xl mx-4 mt-4">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-4 border-white shadow-md">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-white/20 text-white text-lg font-bold">
                  {profile?.full_name?.substring(0, 2) || profile?.username?.substring(0, 2).toUpperCase() || 'FM'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="text-sm opacity-90 mb-1">车队长</div>
                <h2 className="text-2xl font-bold">
                  {profile?.full_name || profile?.username || '车队长'}
                </h2>
                <p className="text-white/80 text-sm mt-1">
                  {new Date().toLocaleDateString('zh-CN', { 
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <Truck className="h-14 w-14 opacity-30" />
            </div>
          </CardContent>
        </Card>

        {/* 数据统计卡片（货拉拉风格） */}
        <div className="grid grid-cols-2 gap-3 px-4">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-sm rounded-xl">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-100 flex items-center justify-center">
                <Truck className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-green-700">{stats.activeVehicles}</div>
              <div className="text-sm text-green-600 mt-1 font-medium">在用车辆</div>
              {stats.maintenanceVehicles > 0 && (
                <div className="text-xs text-orange-600 mt-1">
                  {stats.maintenanceVehicles}辆维修中
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 shadow-sm rounded-xl">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-blue-700">{stats.activeDrivers}</div>
              <div className="text-sm text-blue-600 mt-1 font-medium">在职司机</div>
              <div className="text-xs text-gray-500 mt-1">
                共{stats.totalDrivers}人
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 待办事项（货拉拉风格） */}
        {(stats.pendingExpenses > 0 || stats.pendingVehicleChanges > 0 || stats.expiringCertificates > 0) && (
          <Card className="mx-4 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-orange-800">
                <Bell className="h-5 w-5" />
                待办事项
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {stats.pendingExpenses > 0 && (
                <Button
                  variant="ghost"
                  className="w-full justify-between h-auto py-3 hover:bg-orange-100 rounded-lg"
                  onClick={() => navigate('/m/internal/expense-review')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm">费用申请待审核</div>
                      <div className="text-xs text-muted-foreground">司机提交的费用申请</div>
                    </div>
                  </div>
                  <Badge className="bg-red-500 text-white text-sm px-2.5 py-0.5">
                    {stats.pendingExpenses}
                  </Badge>
                </Button>
              )}

              {stats.pendingVehicleChanges > 0 && (
                <Button
                  variant="ghost"
                  className="w-full justify-between h-auto py-3 hover:bg-orange-100 rounded-lg"
                  onClick={() => navigate('/m/internal/vehicle-change-review')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm">换车申请待审批</div>
                      <div className="text-xs text-muted-foreground">司机换车申请</div>
                    </div>
                  </div>
                  <Badge className="bg-blue-500 text-white text-sm px-2.5 py-0.5">
                    {stats.pendingVehicleChanges}
                  </Badge>
                </Button>
              )}

              {stats.expiringCertificates > 0 && (
                <Button
                  variant="ghost"
                  className="w-full justify-between h-auto py-3 hover:bg-orange-100 rounded-lg"
                  onClick={() => navigate('/m/internal/certificate-alerts')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm">证件即将到期</div>
                      <div className="text-xs text-muted-foreground">需要更新的证件</div>
                    </div>
                  </div>
                  <Badge className="bg-yellow-500 text-white text-sm px-2.5 py-0.5">
                    {stats.expiringCertificates}
                  </Badge>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* 功能分组（货拉拉风格 - 可折叠卡片，横向一排） */}
        <div className="px-4 space-y-3">
          {/* 4个大卡片横向一排 */}
          <div className="grid grid-cols-4 gap-3">
            {functionGroups.map((group, groupIndex) => {
              const isExpanded = expandedGroups.has(groupIndex);
              return (
                <Card key={groupIndex} className="shadow-md rounded-xl border-0 bg-white overflow-visible hover:shadow-lg transition-shadow relative">
                  {/* 卡片标题（可点击展开/折叠） */}
                  <button
                    onClick={() => toggleGroup(groupIndex)}
                    className="w-full text-left"
                    aria-label={`${isExpanded ? '折叠' : '展开'}${group.title}`}
                  >
                    <CardHeader className="pb-3 pt-3 px-2 hover:bg-gray-50/50 transition-colors active:bg-gray-100">
                      <CardTitle className="text-xs flex flex-col items-center gap-2 text-gray-800">
                        <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md", group.color)}>
                          <group.icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex flex-col items-center gap-1 w-full">
                          <span className="font-bold text-xs text-center leading-tight">{group.title}</span>
                          {group.items.some(item => item.badge && item.badge > 0) && (
                            <Badge className="bg-red-500 text-white text-[10px] h-4 px-1 font-semibold">
                              {group.items.find(item => item.badge && item.badge > 0)?.badge}
                            </Badge>
                          )}
                        </div>
                        <ChevronRight 
                          className={cn(
                            "h-3 w-3 text-gray-400 transition-transform duration-300 mt-1",
                            isExpanded && "rotate-90"
                          )} 
                        />
                      </CardTitle>
                    </CardHeader>
                  </button>
                </Card>
              );
            })}
          </div>
          
          {/* 展开的内容（显示在下方，全宽） */}
          {expandedGroups.size > 0 && (
            <div className="w-full">
              {functionGroups.map((group, groupIndex) => {
                const isExpanded = expandedGroups.has(groupIndex);
                if (!isExpanded) return null;
                
                return (
                  <Card key={groupIndex} className="shadow-lg rounded-xl border-0 bg-white animate-in slide-in-from-top-2 duration-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center", group.color)}>
                          <group.icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold text-base text-gray-800">{group.title}</span>
                        {group.items.some(item => item.badge && item.badge > 0) && (
                          <Badge className="bg-red-500 text-white text-xs h-5 px-2 font-semibold">
                            {group.items.find(item => item.badge && item.badge > 0)?.badge}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {group.items.map((item, itemIndex) => {
                          const IconComponent = item.icon;
                          return (
                            <Button
                              key={itemIndex}
                              variant="outline"
                              className={cn(
                                "h-20 flex flex-col items-center justify-center gap-2 relative",
                                "hover:bg-gray-50 active:scale-95 transition-all",
                                "border-gray-200 rounded-xl"
                              )}
                              onClick={() => {
                                navigate(item.path);
                                toggleGroup(groupIndex); // 点击后自动折叠
                              }}
                            >
                              <div className={cn("w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center", group.color)}>
                                <IconComponent className="h-5 w-5 text-white" />
                              </div>
                              <span className="text-xs font-medium text-gray-700">{item.name}</span>
                              {item.badge && item.badge > 0 && (
                                <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs h-5 w-5 p-0 flex items-center justify-center rounded-full">
                                  {item.badge}
                                </Badge>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* 司机冲销余额（货拉拉风格） */}
        <Card className="mx-4 shadow-sm rounded-xl border-0 bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-gray-800">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <Calculator className="h-4 w-4 text-white" />
                </div>
                司机冲销余额
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadDriverBalances}
                disabled={loadingBalances}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${loadingBalances ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingBalances ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                加载中...
              </div>
            ) : driverBalances.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                暂无司机余额数据
              </div>
            ) : (
              <div className="space-y-3">
                {/* 总余额统计 */}
                <div className="bg-gradient-to-r from-[#1890FF] to-[#096DD9] rounded-xl p-4 text-white shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm opacity-90">总余额</span>
                    <span className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-white' : 'text-red-200'}`}>
                      {totalBalance >= 0 ? '+' : ''}¥{totalBalance.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* 司机余额列表 */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {driverBalances.map(driver => (
                    <div
                      key={driver.driver_id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-800">{driver.driver_name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {driver.balance >= 0 ? '有结余' : '待补报销'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-lg ${driver.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {driver.balance >= 0 ? '+' : ''}¥{driver.balance.toFixed(2)}
                        </div>
                        <Badge 
                          className={`mt-1 text-xs ${driver.balance >= 0 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}
                        >
                          {driver.balance >= 0 ? '有结余' : '待补报销'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 本月数据（货拉拉风格） */}
        <Card className="mx-4 shadow-sm rounded-xl border-0 bg-white mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-gray-800">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              本月数据
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-[#1890FF]">{stats.thisMonthTrips}</div>
                <div className="text-xs text-gray-600 mt-1">总车次</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">95%</div>
                <div className="text-xs text-gray-600 mt-1">出勤率</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">12</div>
                <div className="text-xs text-gray-600 mt-1">平均单车</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}

