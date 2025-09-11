import React, { useEffect, useState } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useDashboardCache } from '@/hooks/useDashboardCache';

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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showTotalStats, setShowTotalStats] = useState(false);
  const { preloadAll, getCachedData } = useDashboardCache();

  // 预加载数据
  useEffect(() => {
    preloadAll();
  }, [preloadAll]);

  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['mobileHomeStats'],
    queryFn: async () => {
      // 优化：优先使用缓存数据，大幅提升性能
      const cachedTodayStats = getCachedData('get_today_stats', {});
      const cachedProjectStats = getCachedData('get_project_quick_stats', {});

      let todayData: any = {};
      let projectData: any = {};

      if (cachedTodayStats && cachedProjectStats) {
        // 使用缓存数据
        todayData = cachedTodayStats;
        projectData = cachedProjectStats;
      } else {
        // 缓存未命中，并行获取数据
        const [
          todayStats,
          projectStats
        ] = await Promise.all([
          supabase.rpc('get_today_stats'),
          supabase.rpc('get_project_quick_stats')
        ]);

        todayData = todayStats.data || {};
        projectData = projectStats.data || {};
      }

      return {
        totalRecords: todayData.todayRecords || 0,
        todayRecords: todayData.todayRecords || 0,
        totalWeight: todayData.todayWeight || 0,
        todayWeight: todayData.todayWeight || 0,
        totalCost: todayData.todayCost || 0,
        todayCost: todayData.todayCost || 0,
        activeProjects: projectData.activeProjects || 0,
        pendingPayments: projectData.pendingPayments || 0
      } as DashboardStats;
    },
    staleTime: 2 * 60 * 1000, // 缓存2分钟
    gcTime: 10 * 60 * 1000, // 垃圾回收10分钟
    refetchOnWindowFocus: false,
    retry: 1,
    networkMode: 'online'
  });

  // 懒加载总计数据
  const { data: totalStats, isLoading: totalStatsLoading } = useQuery({
    queryKey: ['mobileHomeTotalStats'],
    queryFn: async () => {
      // 优化：使用快速统计函数，查询最近30天数据
      const quickStats = await supabase.rpc('get_dashboard_quick_stats', {
        p_start_date: null, // 使用默认的最近30天
        p_end_date: null,
        p_project_id: null
      });

      const quickData: any = quickStats.data || {};
      const overview = quickData.overview || {};
      const totalQuantityByType = quickData.totalQuantityByType || {};

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="space-y-6 pb-6">
        {/* 美化后的欢迎区域 */}
        <Card className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white border-0 shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
          
          <CardContent className="relative p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                  欢迎回来
                </h2>
                <p className="text-blue-100 text-lg">
                  今日 {format(new Date(), 'MM月dd日')} • {stats?.todayRecords || 0} 条新记录
                </p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Truck className="h-8 w-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 美化后的今日统计 */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/60 rounded-lg">
              <Calendar className="h-5 w-5 text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">今日概览</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-300 hover:scale-105 border-0 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
              <CardContent className="relative p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-100">今日运输</p>
                    <p className="text-2xl font-bold">{stats?.todayRecords || 0}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                    <Truck className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all duration-300 hover:scale-105 border-0 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
              <CardContent className="relative p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-100">今日重量</p>
                    <p className="text-2xl font-bold">{formatWeight(stats.todayWeight)}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                    <Package className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden bg-gradient-to-br from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 transition-all duration-300 hover:scale-105 border-0 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
              <CardContent className="relative p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-100">今日费用</p>
                    <p className="text-lg font-bold">{formatCurrency(stats.todayCost)}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                    <Banknote className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden bg-gradient-to-br from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 transition-all duration-300 hover:scale-105 border-0 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
              <CardContent className="relative p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-100">活跃项目</p>
                    <p className="text-2xl font-bold">{stats?.activeProjects || 0}</p>
                  </div>
                  <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 美化后的快捷操作 */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/60 rounded-lg">
              <ArrowRight className="h-5 w-5 text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">快捷操作</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map((action) => (
              <Card 
                key={action.href}
                className="group cursor-pointer transition-all hover:scale-105 active:scale-95 bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl"
                onClick={() => navigate(action.href)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className={`p-4 rounded-2xl ${action.color} text-white group-hover:scale-110 transition-transform duration-200 shadow-lg`}>
                      <action.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{action.title}</p>
                      <p className="text-xs text-slate-600 mt-1">{action.description}</p>
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
    </div>
  );
}
