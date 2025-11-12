// 移动端项目详情页面 - 现代化设计
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  Phone,
  Package,
  Truck,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  PieChart,
  Users,
  FileText,
  Edit,
  Share,
  MoreVertical,
  Navigation,
  Zap
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { convertChinaDateToUTCDate } from '@/utils/dateUtils';

// 类型定义
interface Project {
  id: string;
  name: string;
  manager: string;
  finance_manager?: string;
  start_date: string;
  end_date: string;
  project_status: string;
  loading_address: string;
  unloading_address: string;
  cargo_type: string;
  planned_total_tons?: number;
  auto_code?: string;
}

interface ProjectStats {
  totalRecords: number;
  totalWeight: number;
  totalAmount: number;
  completionRate: number;
  activeDrivers: number;
  averageWeight: number;
  todayStats: {
    records: number;
    weight: number;
    amount: number;
  };
  weeklyTrend: Array<{
    date: string;
    records: number;
    weight: number;
    amount: number;
  }>;
  topDrivers: Array<{
    name: string;
    records: number;
    weight: number;
    amount: number;
  }>;
  monthlyData: Array<{
    month: string;
    records: number;
    weight: number;
  }>;
}

const statusConfig = {
  '进行中': { color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', label: '进行中', icon: Activity },
  '已完成': { color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50', label: '已完成', icon: CheckCircle },
  '暂停': { color: 'bg-yellow-500', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50', label: '暂停', icon: Clock },
  '已取消': { color: 'bg-gray-500', textColor: 'text-gray-700', bgColor: 'bg-gray-50', label: '已取消', icon: AlertTriangle }
};

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function MobileProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  // 获取项目基本信息
  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ['mobileProjectDetail', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('项目ID不存在');
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // 获取项目统计数据
  const { data: stats, isLoading: statsLoading } = useQuery<ProjectStats>({
    queryKey: ['mobileProjectStats', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('项目ID不存在');

      // 获取所有运输记录
      const { data: records } = await supabase
        .from('logistics_records')
        .select('*')
        .eq('project_id', projectId)
        .order('loading_date', { ascending: false });

      // 获取今日数据（将中国时区的今天转换为 UTC 日期）
      const today = new Date();
      const utcToday = convertChinaDateToUTCDate(today);
      const { data: todayRecords } = await supabase
        .from('logistics_records')
        .select('*')
        .eq('project_id', projectId)
        .gte('loading_date', utcToday);

      // 计算基础统计
      const totalRecords = records?.length || 0;
      const totalWeight = records?.reduce((sum, r) => sum + (r.loading_weight || 0), 0) || 0;
      const totalAmount = records?.reduce((sum, r) => sum + (r.payable_cost || 0), 0) || 0;
      const completionRate = project?.planned_total_tons ? 
        Math.min((totalWeight / project.planned_total_tons) * 100, 100) : 0;
      const activeDrivers = new Set(records?.map(r => r.driver_name)).size;
      const averageWeight = totalRecords > 0 ? totalWeight / totalRecords : 0;

      // 今日统计
      const todayStats = {
        records: todayRecords?.length || 0,
        weight: todayRecords?.reduce((sum, r) => sum + (r.loading_weight || 0), 0) || 0,
        amount: todayRecords?.reduce((sum, r) => sum + (r.payable_cost || 0), 0) || 0,
      };

      // 7天趋势数据
      const weeklyTrend = [];
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const dayRecords = records?.filter(r => r.loading_date === date) || [];
        weeklyTrend.push({
          date: format(subDays(new Date(), i), 'MM/dd'),
          records: dayRecords.length,
          weight: dayRecords.reduce((sum, r) => sum + (r.loading_weight || 0), 0),
          amount: dayRecords.reduce((sum, r) => sum + (r.payable_cost || 0), 0),
        });
      }

      // 司机排行
      const driverStats = new Map();
      records?.forEach(record => {
        const name = record.driver_name;
        if (!driverStats.has(name)) {
          driverStats.set(name, { records: 0, weight: 0, amount: 0 });
        }
        const stats = driverStats.get(name);
        stats.records++;
        stats.weight += record.loading_weight || 0;
        stats.amount += record.payable_cost || 0;
      });

      const topDrivers = Array.from(driverStats.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5);

      // 月度数据（最近6个月）
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = format(subDays(new Date(), i * 30), 'yyyy-MM');
        const monthRecords = records?.filter(r => r.loading_date?.startsWith(monthStart)) || [];
        monthlyData.push({
          month: format(subDays(new Date(), i * 30), 'MM月'),
          records: monthRecords.length,
          weight: monthRecords.reduce((sum, r) => sum + (r.loading_weight || 0), 0),
        });
      }

      return {
        totalRecords,
        totalWeight,
        totalAmount,
        completionRate,
        activeDrivers,
        averageWeight,
        todayStats,
        weeklyTrend,
        topDrivers,
        monthlyData,
      };
    },
    enabled: !!projectId && !!project,
  });

  const formatNumber = (num: number | undefined | null) => {
    if (!num && num !== 0) return '0';
    if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
    return num.toLocaleString();
  };

  const formatWeight = (weight: number | undefined | null) => {
    if (!weight && weight !== 0) return '0吨';
    if (weight >= 1000) return `${(weight / 1000).toFixed(1)}K吨`;
    return `${weight.toFixed(1)}吨`;
  };

  const getStatusIcon = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    const IconComponent = config?.icon || Activity;
    return <IconComponent className="h-4 w-4" />;
  };

  if (projectLoading || statsLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">加载项目详情中...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (!project) {
    return (
      <MobileLayout>
        <div className="text-center py-12">
          <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">项目不存在</h3>
          <p className="text-muted-foreground mb-4">请检查项目ID是否正确</p>
          <Button onClick={() => navigate('/m/projects')}>
            返回项目列表
          </Button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-6 pb-6">
        {/* 页面头部 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/m/projects')}
              className="p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Share className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 项目基本信息卡片 */}
          <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h1 className="text-xl font-bold text-gray-900 mb-2">{project.name}</h1>
                    <div className="flex items-center gap-2 mb-3">
                      {getStatusIcon(project.project_status)}
                      <Badge 
                        className={`${statusConfig[project.project_status as keyof typeof statusConfig]?.bgColor} ${statusConfig[project.project_status as keyof typeof statusConfig]?.textColor} border-0`}
                      >
                        {statusConfig[project.project_status as keyof typeof statusConfig]?.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {(stats?.completionRate || 0).toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">完成度</div>
                  </div>
                </div>

                {/* 进度条 */}
                {project.planned_total_tons && (
                  <div className="space-y-2">
                    <Progress value={stats?.completionRate || 0} className="h-3" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatWeight(stats?.totalWeight || 0)}</span>
                      <span>目标: {formatWeight(project.planned_total_tons)}</span>
                    </div>
                  </div>
                )}

                {/* 项目信息 */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-100">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">负责人:</span>
                      <span className="font-medium">{project.manager}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">开始:</span>
                      <span className="font-medium">
                        {format(new Date(project.start_date), 'MM/dd/yyyy')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">货物:</span>
                      <span className="font-medium">{project.cargo_type}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">结束:</span>
                      <span className="font-medium">
                        {format(new Date(project.end_date), 'MM/dd/yyyy')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 今日数据快览 */}
          {(stats?.todayStats.records || 0) > 0 && (
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <h3 className="font-semibold text-green-800">今日实时数据</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-900">
                      {stats?.todayStats.records || 0}
                    </div>
                    <div className="text-xs text-green-600">运单数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-900">
                      {formatWeight(stats?.todayStats.weight || 0)}
                    </div>
                    <div className="text-xs text-green-600">重量</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-900">
                      ¥{formatNumber(stats?.todayStats.amount || 0)}
                    </div>
                    <div className="text-xs text-green-600">金额</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 标签页内容 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-100">
            <TabsTrigger value="overview" className="text-xs">
              <BarChart3 className="h-4 w-4 mr-1" />
              概览
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs">
              <PieChart className="h-4 w-4 mr-1" />
              分析
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs">
              <Users className="h-4 w-4 mr-1" />
              团队
            </TabsTrigger>
          </TabsList>

          {/* 概览标签页 */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* 核心指标 */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">总运单</p>
                      <p className="text-2xl font-bold">{stats?.totalRecords || 0}</p>
                    </div>
                    <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">总重量</p>
                      <p className="text-2xl font-bold">{formatWeight(stats?.totalWeight || 0)}</p>
                    </div>
                    <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">总金额</p>
                      <p className="text-2xl font-bold">¥{formatNumber(stats?.totalAmount || 0)}</p>
                    </div>
                    <div className="h-10 w-10 bg-purple-500 rounded-full flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">活跃司机</p>
                      <p className="text-2xl font-bold">{stats?.activeDrivers || 0}</p>
                    </div>
                    <div className="h-10 w-10 bg-orange-500 rounded-full flex items-center justify-center">
                      <Truck className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 7天趋势图 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  7天趋势
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

            {/* 地址信息 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-green-500" />
                  运输路线
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <p className="text-sm text-muted-foreground">装货地点</p>
                    <p className="font-medium">{project.loading_address}</p>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="h-8 w-px bg-gray-300 relative">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <Truck className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <p className="text-sm text-muted-foreground">卸货地点</p>
                    <p className="font-medium">{project.unloading_address}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 分析标签页 */}
          <TabsContent value="analytics" className="space-y-4 mt-4">
            {/* 月度趋势 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                  月度趋势
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.monthlyData || []}>
                      <XAxis 
                        dataKey="month" 
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
                                <p className="text-purple-600">
                                  重量: {formatWeight(payload[0]?.value as number || 0)}
                                </p>
                                <p className="text-blue-600">
                                  运单: {payload[0]?.payload?.records || 0}单
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="weight" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 平均数据 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">平均数据</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">平均单重</p>
                      <p className="font-semibold text-blue-900">
                        {formatWeight(stats?.averageWeight || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">平均单价</p>
                      <p className="font-semibold text-green-900">
                        ¥{stats?.totalRecords ? ((stats.totalAmount / stats.totalRecords) || 0).toFixed(0) : 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">完成率</p>
                      <p className="font-semibold text-purple-900">
                        {(stats?.completionRate || 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 团队标签页 */}
          <TabsContent value="team" className="space-y-4 mt-4">
            {/* 司机排行榜 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  司机排行榜
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats?.topDrivers.map((driver, index) => (
                  <div key={driver.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-orange-500' : 'bg-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{driver.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{driver.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {driver.records}单 · {formatWeight(driver.weight)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">¥{formatNumber(driver.amount)}</p>
                      <p className="text-xs text-muted-foreground">总金额</p>
                    </div>
                  </div>
                ))}
                
                {(!stats?.topDrivers || stats.topDrivers.length === 0) && (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">暂无司机数据</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 项目团队信息 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  项目团队
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-blue-500 text-white">
                      {project.manager.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{project.manager}</p>
                    <p className="text-sm text-muted-foreground">项目经理</p>
                  </div>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                    负责人
                  </Badge>
                </div>

                {project.finance_manager && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-green-500 text-white">
                        {project.finance_manager.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{project.finance_manager}</p>
                      <p className="text-sm text-muted-foreground">财务经理</p>
                    </div>
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                      财务
                    </Badge>
                  </div>
                )}

                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                  <div className="h-12 w-12 bg-orange-500 rounded-full flex items-center justify-center">
                    <Truck className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{stats?.activeDrivers || 0}名司机</p>
                    <p className="text-sm text-muted-foreground">参与运输</p>
                  </div>
                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200">
                    司机团队
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 底部操作按钮 */}
        <div className="grid grid-cols-2 gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={() => navigate(`/m/projects/detail/${projectId}/records`)}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            查看运单
          </Button>
          <Button 
            onClick={() => navigate(`/m/projects/detail/${projectId}/dashboard`)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            <BarChart3 className="h-4 w-4" />
            详细看板
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
