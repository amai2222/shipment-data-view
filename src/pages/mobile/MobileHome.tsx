import { useEffect, useState } from 'react';
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
  Banknote,
  ArrowRight,
  FileText,
  Scale,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { convertChinaDateToUTCDate } from '@/utils/dateUtils';

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
    href: '/m/projects',
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showTotalStats, setShowTotalStats] = useState(false);

  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['mobileHomeStats'],
    queryFn: async () => {
      const today = new Date();
      // 将中国时区的今天转换为 UTC 日期范围
      const chinaTodayStr = format(today, 'yyyy-MM-dd');
      const chinaStartOfToday = new Date(`${chinaTodayStr}T00:00:00+08:00`);
      const chinaEndOfToday = new Date(`${chinaTodayStr}T23:59:59+08:00`);
      const utcStartOfToday = chinaStartOfToday.toISOString();
      const utcEndOfToday = chinaEndOfToday.toISOString();

      // 优化：使用更简单的查询，减少数据库负载
      const [
        todayQuery,
        activeProjectsCount,
        pendingPaymentsCount,
        // 使用与桌面端相同的RPC函数获取总记录数，确保数据一致性
        rpcAgg
      ] = await Promise.all([
        // 只查询今日数据，减少数据量
        supabase
          .from('logistics_records')
          .select('loading_weight, payable_cost', { count: 'estimated' })  // ✅ 估算模式，性能更好
          .gte('loading_date', utcStartOfToday)
          .lte('loading_date', utcEndOfToday),
        // 使用更高效的计数查询
        supabase
          .from('projects')
          .select('id', { count: 'estimated', head: true })  // ✅ 估算模式
          .eq('project_status', '进行中'),
        supabase
          .from('payment_requests')
          .select('id', { count: 'estimated', head: true })  // ✅ 估算模式
          .eq('status', 'Pending'),
        // 使用与桌面端相同的RPC函数，确保数据一致性
        // 使用与桌面端相同的默认日期范围（2025-01-01到现在）
        supabase.rpc('get_dashboard_stats_with_billing_types' as any, {
          p_start_date: '2025-01-01',
          p_end_date: new Date().toISOString().split('T')[0],
          p_project_id: null
        })
      ]);

      // 计算今日数据
      const todayData = (todayQuery as any).data as Array<{ loading_weight: number | null; payable_cost: number | null }> | null;
      const todayCount = (todayQuery as any).count as number | null;
      const todayWeight = (todayData || []).reduce((sum, r) => sum + (r.loading_weight || 0), 0);
      const todaysCost = (todayData || []).reduce((sum, r) => sum + (r.payable_cost || 0), 0);

      // 获取其他统计数据
      const activeProjects = (activeProjectsCount as any).count || 0;
      const pendingPayments = (pendingPaymentsCount as any).count || 0;
      
      // 从RPC函数获取总记录数，确保与桌面端一致
      const rpcData: any = (rpcAgg as any).data || {};
      const overview = rpcData.overview || {};
      const totalRecords = overview.totalRecords || 0;

      // 优化：使用简化的总计数据，避免复杂的RPC调用
      // 对于移动端，我们主要关注今日数据，总计数据可以稍后加载
      return {
        totalRecords,
        todayRecords: todayCount || 0,
        totalWeight: 0, // 暂时设为0，避免复杂查询
        todayWeight,
        totalCost: 0, // 暂时设为0，避免复杂查询
        todayCost: todaysCost,
        activeProjects,
        pendingPayments
      } as DashboardStats;
    },
    staleTime: 2 * 60 * 1000, // 减少缓存时间到2分钟
    gcTime: 10 * 60 * 1000, // 减少垃圾回收时间到10分钟
    refetchOnWindowFocus: false,
    retry: 1,
    // 添加网络状态优化
    networkMode: 'online'
  });

  // 懒加载总计数据
  const { data: totalStats, isLoading: totalStatsLoading } = useQuery({
    queryKey: ['mobileHomeTotalStats'],
    queryFn: async () => {
      // 使用与桌面端相同的默认日期范围（2025-01-01到现在）
      const rpcAgg = await supabase.rpc('get_dashboard_stats_with_billing_types' as any, {
        p_start_date: '2025-01-01',
        p_end_date: new Date().toISOString().split('T')[0],
        p_project_id: null
      });

      const rpcData: any = (rpcAgg as any).data || {};
      const overview = rpcData.overview || {};
      const totalQuantityByType = rpcData.totalQuantityByType || {};

      return {
        totalWeight: Number(totalQuantityByType?.['1'] || 0),
        totalCost: Number(overview.totalCost || 0)
      };
    },
    enabled: showTotalStats, // 只有在需要时才加载
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: "加载失败",
        description: "无法加载仪表板数据",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(value);
  };

  const formatWeight = (value: number) => {
    return `${value.toFixed(1)}吨`;
  };

  if (isLoading || !stats) {
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
            今日 {format(new Date(), 'MM月dd日')} • {stats?.todayRecords || 0} 条新记录
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
                  <p className="text-xl font-bold">{stats?.todayRecords || 0}</p>
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
                  <Banknote className="h-4 w-4 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">活跃项目</p>
                  <p className="text-xl font-bold">{stats?.activeProjects || 0}</p>
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">总体统计</h3>
          {!showTotalStats && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowTotalStats(true)}
              className="text-xs"
            >
              查看详情
            </Button>
          )}
        </div>
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

          {showTotalStats ? (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-full">
                        <Package className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">总运输重量</p>
                        {totalStatsLoading ? (
                          <div className="flex items-center space-x-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">加载中...</span>
                          </div>
                        ) : (
                          <p className="font-semibold">{formatWeight(totalStats?.totalWeight || 0)}</p>
                        )}
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
                        <Banknote className="h-4 w-4 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">总司机应收</p>
                        {totalStatsLoading ? (
                          <div className="flex items-center space-x-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">加载中...</span>
                          </div>
                        ) : (
                          <p className="font-semibold">{formatCurrency(totalStats?.totalCost || 0)}</p>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-dashed border-2 border-gray-200">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">点击"查看详情"加载更多统计信息</p>
              </CardContent>
            </Card>
          )}

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
