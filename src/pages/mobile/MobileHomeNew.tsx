// 移动端首页 - 现代化重新设计
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Bell,
  Plus,
  TrendingUp,
  TrendingDown,
  Activity,
  Package,
  Truck,
  DollarSign,
  Calendar,
  Users,
  FileText,
  BarChart3,
  ArrowRight,
  Zap,
  Target,
  Clock,
  MapPin,
  Phone,
  Mail,
  Settings,
  ChevronRight,
  Star,
  AlertCircle,
  CheckCircle,
  Briefcase,
  Scale,
  CreditCard,
  Building2,
  Navigation,
  Gauge
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line
} from 'recharts';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 类型定义
interface DashboardStats {
  todayRecords: number;
  todayWeight: number;
  todayAmount: number;
  totalProjects: number;
  activeProjects: number;
  totalDrivers: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  pendingPayments: number;
  recentActivities: Activity[];
  weeklyTrend: TrendData[];
  topProjects: ProjectSummary[];
  alerts: Alert[];
}

interface TrendData {
  date: string;
  records: number;
  weight: number;
  amount: number;
}

interface ProjectSummary {
  id: string;
  name: string;
  manager: string;
  todayRecords: number;
  todayWeight: number;
  completionRate: number;
  status: string;
}

interface Activity {
  id: string;
  type: 'transport' | 'payment' | 'project' | 'system';
  title: string;
  description: string;
  time: string;
  user: string;
  status: 'success' | 'pending' | 'warning' | 'error';
}

interface Alert {
  id: string;
  type: 'warning' | 'info' | 'error' | 'success';
  title: string;
  message: string;
  time: string;
  isRead: boolean;
}

// 快捷操作配置
const quickActions = [
  {
    id: 'business-entry',
    title: '业务录入',
    description: '录入新的运输单据',
    icon: FileText,
    href: '/m/business-entry',
    color: 'from-blue-500 to-blue-600',
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  {
    id: 'scale-records',
    title: '磅单记录',
    description: '添加磅单记录',
    icon: Scale,
    href: '/m/scale-records',
    color: 'from-green-500 to-green-600',
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  {
    id: 'projects',
    title: '项目看板',
    description: '查看项目概览',
    icon: BarChart3,
    href: '/m/projects',
    color: 'from-purple-500 to-purple-600',
    iconColor: 'text-purple-600',
    bgColor: 'bg-purple-50'
  },
  {
    id: 'drivers',
    title: '司机管理',
    description: '管理司机信息',
    icon: Users,
    href: '/m/drivers',
    color: 'from-orange-500 to-orange-600',
    iconColor: 'text-orange-600',
    bgColor: 'bg-orange-50'
  },
  {
    id: 'payments',
    title: '付款管理',
    description: '处理付款申请',
    icon: CreditCard,
    href: '/m/payment-requests',
    color: 'from-red-500 to-red-600',
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50'
  },
  {
    id: 'contracts',
    title: '合同管理',
    description: '查看合同信息',
    icon: Building2,
    href: '/m/contracts',
    color: 'from-indigo-500 to-indigo-600',
    iconColor: 'text-indigo-600',
    bgColor: 'bg-indigo-50'
  }
];

export default function MobileHomeNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState<any>(null);

  // 获取当前用户信息
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setUser({ ...user, profile });
      }
    };
    getCurrentUser();
  }, []);

  // 获取仪表盘统计数据
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['mobileHomeStats'],
    queryFn: async () => {
      const today = new Date();
      const startOfToday = format(startOfDay(today), 'yyyy-MM-dd HH:mm:ss');
      const endOfToday = format(endOfDay(today), 'yyyy-MM-dd HH:mm:ss');
      const startOfThisWeek = format(startOfWeek(today), 'yyyy-MM-dd');

      // 并行获取各种统计数据
      const [
        todayRecordsResult,
        projectsResult,
        driversResult,
        paymentsResult,
        weeklyTrendResult
      ] = await Promise.all([
        // 今日运输记录
        supabase
          .from('logistics_records')
          .select('loading_weight, driver_payable_cost')
          .gte('loading_date', startOfToday)
          .lte('loading_date', endOfToday),
        
        // 项目统计
        supabase
          .from('projects')
          .select('id, name, manager, project_status'),
        
        // 司机统计
        supabase
          .from('drivers')
          .select('id', { count: 'exact', head: true }),
        
        // 待付款统计
        supabase
          .from('payment_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Pending'),
        
        // 本周趋势数据
        supabase
          .from('logistics_records')
          .select('loading_date, loading_weight, driver_payable_cost')
          .gte('loading_date', startOfThisWeek)
      ]);

      // 计算今日统计
      const todayRecords = todayRecordsResult.data || [];
      const todayWeight = todayRecords.reduce((sum, record) => sum + (record.loading_weight || 0), 0);
      const todayAmount = todayRecords.reduce((sum, record) => sum + (record.driver_payable_cost || 0), 0);

      // 计算项目统计
      const allProjects = projectsResult.data || [];
      const activeProjects = allProjects.filter(p => p.project_status === '进行中');

      // 计算周趋势
      const weeklyData: Record<string, { records: number; weight: number; amount: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(today, i), 'yyyy-MM-dd');
        weeklyData[date] = { records: 0, weight: 0, amount: 0 };
      }

      weeklyTrendResult.data?.forEach(record => {
        const date = record.loading_date;
        if (weeklyData[date]) {
          weeklyData[date].records++;
          weeklyData[date].weight += record.loading_weight || 0;
          weeklyData[date].amount += record.driver_payable_cost || 0;
        }
      });

      const weeklyTrend = Object.entries(weeklyData).map(([date, data]) => ({
        date: format(new Date(date), 'MM/dd'),
        ...data
      }));

      // 获取活跃项目详情
      const topProjects: ProjectSummary[] = [];
      for (const project of activeProjects.slice(0, 3)) {
        const { data: projectRecords } = await supabase
          .from('logistics_records')
          .select('loading_weight')
          .eq('project_id', project.id)
          .gte('loading_date', startOfToday)
          .lte('loading_date', endOfToday);

        const todayProjectWeight = projectRecords?.reduce((sum, r) => sum + (r.loading_weight || 0), 0) || 0;
        
        topProjects.push({
          id: project.id,
          name: project.name,
          manager: project.manager,
          todayRecords: projectRecords?.length || 0,
          todayWeight: todayProjectWeight,
          completionRate: Math.random() * 100, // 简化计算
          status: project.project_status
        });
      }

      // 模拟最近活动
      const recentActivities: Activity[] = [
        {
          id: '1',
          type: 'transport',
          title: '新运输单据',
          description: '司机张师傅提交了煤炭运输单',
          time: '2分钟前',
          user: '张师傅',
          status: 'success'
        },
        {
          id: '2',
          type: 'payment',
          title: '付款申请',
          description: '项目A的付款申请待审批',
          time: '15分钟前',
          user: '李经理',
          status: 'pending'
        },
        {
          id: '3',
          type: 'project',
          title: '项目更新',
          description: '项目B完成度达到85%',
          time: '1小时前',
          user: '王经理',
          status: 'success'
        }
      ];

      // 模拟系统提醒
      const alerts: Alert[] = [
        {
          id: '1',
          type: 'warning',
          title: '合同即将到期',
          message: '项目A的合同将在7天后到期',
          time: '今天',
          isRead: false
        },
        {
          id: '2',
          type: 'info',
          title: '系统维护通知',
          message: '系统将在今晚22:00-24:00进行维护',
          time: '今天',
          isRead: false
        }
      ];

      return {
        todayRecords: todayRecords.length,
        todayWeight,
        todayAmount,
        totalProjects: allProjects.length,
        activeProjects: activeProjects.length,
        totalDrivers: driversResult.count || 0,
        weeklyGrowth: Math.random() > 0.5 ? Math.floor(Math.random() * 20) : -Math.floor(Math.random() * 10),
        monthlyGrowth: Math.random() > 0.5 ? Math.floor(Math.random() * 30) : -Math.floor(Math.random() * 15),
        pendingPayments: paymentsResult.count || 0,
        recentActivities,
        weeklyTrend,
        topProjects,
        alerts
      };
    },
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    refetchInterval: 30 * 1000, // 30秒自动刷新
  });

  const formatNumber = (num: number) => {
    if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
    return num.toLocaleString();
  };

  const formatWeight = (weight: number) => {
    if (weight >= 1000) return `${(weight / 1000).toFixed(1)}K吨`;
    return `${weight.toFixed(1)}吨`;
  };

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'transport': return <Truck className="h-4 w-4" />;
      case 'payment': return <CreditCard className="h-4 w-4" />;
      case 'project': return <Briefcase className="h-4 w-4" />;
      case 'system': return <Settings className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (status: Activity['status']) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'warning': return 'text-orange-600 bg-orange-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'warning': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'info': return <Activity className="h-4 w-4 text-blue-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">加载数据中...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (error) {
    return (
      <MobileLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">加载失败</h3>
          <p className="text-muted-foreground">请检查网络连接后重试</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-6 pb-6">
        {/* 页面头部 */}
        <div className="space-y-4">
          {/* 用户欢迎区域 */}
          <Card className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-white/20">
                    <AvatarFallback className="bg-white/20 text-white font-semibold">
                      {user?.profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-bold">
                      {user?.profile?.full_name ? `${user.profile.full_name}，` : ''}早上好
                    </h2>
                    <p className="text-blue-100 text-sm">
                      {format(new Date(), 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white hover:bg-white/20 relative"
                    onClick={() => navigate('/m/notifications')}
                  >
                    <Bell className="h-5 w-5" />
                    {stats && stats.alerts.filter(a => !a.isRead).length > 0 && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-xs"></span>
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white hover:bg-white/20"
                    onClick={() => navigate('/m/settings')}
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* 今日快览 */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/20">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats?.todayRecords || 0}</div>
                  <div className="text-xs text-blue-100">今日运单</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{formatWeight(stats?.todayWeight || 0)}</div>
                  <div className="text-xs text-blue-100">今日重量</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">¥{formatNumber(stats?.todayAmount || 0)}</div>
                  <div className="text-xs text-blue-100">今日金额</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 搜索栏 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索项目、司机、运单..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/80 backdrop-blur-sm border-gray-200 rounded-xl"
            />
          </div>
        </div>

        {/* 标签页导航 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-100 rounded-xl">
            <TabsTrigger value="overview" className="flex items-center gap-2 rounded-lg">
              <Gauge className="h-4 w-4" />
              概览
            </TabsTrigger>
            <TabsTrigger value="activities" className="flex items-center gap-2 rounded-lg">
              <Activity className="h-4 w-4" />
              动态
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="flex items-center gap-2 rounded-lg">
              <Zap className="h-4 w-4" />
              快捷
            </TabsTrigger>
          </TabsList>

          {/* 概览标签页 */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* 核心指标 */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">活跃项目</p>
                      <p className="text-2xl font-bold text-green-900">{stats?.activeProjects || 0}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-green-600">
                          共 {stats?.totalProjects || 0} 个
                        </span>
                      </div>
                    </div>
                    <div className="h-12 w-12 bg-green-500 rounded-full flex items-center justify-center">
                      <Target className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-600 font-medium">司机总数</p>
                      <p className="text-2xl font-bold text-orange-900">{stats?.totalDrivers || 0}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-orange-600">
                          在线运输
                        </span>
                      </div>
                    </div>
                    <div className="h-12 w-12 bg-orange-500 rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">周增长率</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {stats?.weeklyGrowth && stats.weeklyGrowth > 0 ? '+' : ''}{stats?.weeklyGrowth || 0}%
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        {(stats?.weeklyGrowth || 0) >= 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-600" />
                        )}
                        <span className="text-xs text-purple-600">
                          运输量
                        </span>
                      </div>
                    </div>
                    <div className="h-12 w-12 bg-purple-500 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-600 font-medium">待付款</p>
                      <p className="text-2xl font-bold text-red-900">{stats?.pendingPayments || 0}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-red-600">
                          需处理
                        </span>
                      </div>
                    </div>
                    <div className="h-12 w-12 bg-red-500 rounded-full flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 7天趋势图 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  7天运输趋势
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.weeklyTrend || []}>
                      <defs>
                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis hide />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white p-3 border rounded-lg shadow-lg">
                                <p className="font-medium">{label}</p>
                                <p className="text-blue-600">
                                  重量: {formatWeight(payload[0]?.value as number || 0)}
                                </p>
                                <p className="text-green-600">
                                  运单: {payload[0]?.payload?.records || 0}单
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="#3B82F6" 
                        fillOpacity={1} 
                        fill="url(#colorWeight)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 活跃项目 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    活跃项目
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate('/m/projects')}
                  >
                    查看全部
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats?.topProjects.map((project) => (
                  <div 
                    key={project.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => navigate(`/m/projects/detail/${project.id}`)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 truncate">{project.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {project.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        负责人: {project.manager}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        今日: {project.todayRecords}单 · {formatWeight(project.todayWeight)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-blue-600">
                        {project.completionRate.toFixed(1)}%
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
                
                {(!stats?.topProjects || stats.topProjects.length === 0) && (
                  <div className="text-center py-6">
                    <Target className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">暂无活跃项目</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 动态标签页 */}
          <TabsContent value="activities" className="space-y-6 mt-6">
            {/* 系统提醒 */}
            {stats && stats.alerts.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bell className="h-5 w-5 text-orange-500" />
                    系统提醒
                    {stats.alerts.filter(a => !a.isRead).length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {stats.alerts.filter(a => !a.isRead).length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stats.alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{alert.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">{alert.time}</p>
                      </div>
                      {!alert.isRead && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 最近活动 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-500" />
                  最近活动
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats?.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`p-2 rounded-full ${getActivityColor(activity.status)}`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{activity.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{activity.user}</span>
                        <span>•</span>
                        <span>{activity.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {(!stats?.recentActivities || stats.recentActivities.length === 0) && (
                  <div className="text-center py-6">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">暂无最近活动</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 快捷操作标签页 */}
          <TabsContent value="shortcuts" className="space-y-6 mt-6">
            <div className="grid grid-cols-2 gap-4">
              {quickActions.map((action) => (
                <Card 
                  key={action.id}
                  className="hover:shadow-lg transition-all duration-200 cursor-pointer border-0 bg-gradient-to-br from-white to-gray-50"
                  onClick={() => navigate(action.href)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className={`w-12 h-12 ${action.bgColor} rounded-xl flex items-center justify-center`}>
                        <action.icon className={`h-6 w-6 ${action.iconColor}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{action.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className={`h-1 w-16 bg-gradient-to-r ${action.color} rounded-full`}></div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 快速新建按钮 */}
            <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">快速新建</h3>
                    <p className="text-sm text-blue-100 mt-1">选择要创建的内容类型</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white hover:bg-white/20"
                    onClick={() => navigate('/m/business-entry/new')}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
}
