import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Truck, 
  Package, 
  TrendingUp, 
  BarChart3,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  ArrowRight,
  FileText,
  Scale
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface DashboardStats {
  totalRecords: number;
  todayRecords: number;
  totalWeight: number;
  todayWeight: number;
  totalCost: number;
  todayCost: number;
  activeProjects: number;
  pendingPayments: number;
}

const quickActions = [
  {
    title: '业务录入',
    description: '录入新的运输单据',
    icon: FileText,
    href: '/m/business-entry',
    color: 'bg-blue-500'
  },
  {
    title: '磅单记录',
    description: '添加磅单记录',
    icon: Scale,
    href: '/m/scale-records',
    color: 'bg-green-500'
  },
  {
    title: '项目看板',
    description: '查看项目概览',
    icon: BarChart3,
    href: '/m/dashboard/project',
    color: 'bg-purple-500'
  },
  {
    title: '司机管理',
    description: '管理司机信息',
    icon: Users,
    href: '/m/drivers',
    color: 'bg-orange-500'
  }
];

export default function MobileHome() {
  const [stats, setStats] = useState<DashboardStats>({
    totalRecords: 0,
    todayRecords: 0,
    totalWeight: 0,
    todayWeight: 0,
    totalCost: 0,
    todayCost: 0,
    activeProjects: 0,
    pendingPayments: 0
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      // 获取运输记录统计
      const { data: allRecords, error: recordsError } = await supabase
        .from('logistics_records')
        .select('loading_weight, unloading_weight, current_cost, extra_cost, driver_payable_cost, loading_date');

      if (recordsError) throw recordsError;

      // 获取今日记录
      const { data: todayRecords, error: todayError } = await supabase
        .from('logistics_records')
        .select('loading_weight, unloading_weight, current_cost, extra_cost, driver_payable_cost')
        .gte('loading_date', startOfToday.toISOString())
        .lte('loading_date', endOfToday.toISOString());

      if (todayError) throw todayError;

      // 获取活跃项目数
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .eq('project_status', '进行中');

      if (projectsError) throw projectsError;

      // 获取待处理付款申请
      const { data: pendingPayments, error: paymentsError } = await supabase
        .from('payment_requests')
        .select('id')
        .eq('status', 'Pending');

      if (paymentsError) throw paymentsError;

      // 计算统计数据
      const totalWeight = allRecords?.reduce((sum, record) => sum + (record.loading_weight || 0), 0) || 0;
      const todayWeight = todayRecords?.reduce((sum, record) => sum + (record.loading_weight || 0), 0) || 0;
      const totalCost = allRecords?.reduce((sum, record) => sum + (record.driver_payable_cost || 0), 0) || 0;
      const todaysCost = todayRecords?.reduce((sum, record) => sum + (record.driver_payable_cost || 0), 0) || 0;

      setStats({
        totalRecords: allRecords?.length || 0,
        todayRecords: todayRecords?.length || 0,
        totalWeight,
        todayWeight,
        totalCost,
        todayCost: todaysCost,
        activeProjects: projects?.length || 0,
        pendingPayments: pendingPayments?.length || 0
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "加载失败",
        description: "无法加载仪表板数据",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(value);
  };

  const formatWeight = (value: number) => {
    return `${value.toFixed(1)}吨`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* 欢迎区域 */}
      <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <CardContent className="p-6">
          <h2 className="text-xl font-bold mb-2">欢迎回来</h2>
          <p className="text-blue-100">
            今日 {format(new Date(), 'MM月dd日')} • {stats.todayRecords} 条新记录
          </p>
        </CardContent>
      </Card>

      {/* 今日统计 */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          今日概览
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日运输</p>
                  <p className="text-xl font-bold">{stats.todayRecords}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-full">
                  <Truck className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日重量</p>
                  <p className="text-xl font-bold">{formatWeight(stats.todayWeight)}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <Package className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日费用</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.todayCost)}</p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-full">
                  <DollarSign className="h-4 w-4 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">活跃项目</p>
                  <p className="text-xl font-bold">{stats.activeProjects}</p>
                </div>
                <div className="p-2 bg-purple-100 rounded-full">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 快捷操作 */}
      <div>
        <h3 className="text-lg font-semibold mb-3">快捷操作</h3>
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <Card 
              key={action.href}
              className="cursor-pointer transition-all hover:scale-105 active:scale-95"
              onClick={() => navigate(action.href)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className={`p-3 rounded-full ${action.color} text-white`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{action.title}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 总体统计 */}
      <div>
        <h3 className="text-lg font-semibold mb-3">总体统计</h3>
        <div className="space-y-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <Truck className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">总运输记录</p>
                    <p className="font-semibold">{stats.totalRecords} 条</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <Package className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">总运输重量</p>
                    <p className="font-semibold">{formatWeight(stats.totalWeight)}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-100 rounded-full">
                    <DollarSign className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">总应付费用</p>
                    <p className="font-semibold">{formatCurrency(stats.totalCost)}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          {stats.pendingPayments > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-100 rounded-full">
                      <TrendingUp className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">待处理付款</p>
                      <p className="font-semibold text-orange-700">{stats.pendingPayments} 个申请</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                    待处理
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 底部间距 */}
      <div className="h-4"></div>
    </div>
  );
}