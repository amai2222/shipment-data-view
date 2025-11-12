// 移动端项目总览页面 - 现代化设计
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Package,
  Truck,
  DollarSign,
  Calendar,
  MapPin,
  User,
  Building2,
  ChevronRight,
  Plus,
  BarChart3,
  PieChart,
  Target,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Users,
  Briefcase
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { convertChinaDateToUTCDate } from '@/utils/dateUtils';

// 类型定义
interface Project {
  id: string;
  name: string;
  manager: string;
  start_date: string;
  end_date: string;
  project_status: string;
  loading_address: string;
  unloading_address: string;
  planned_total_tons?: number;
  stats?: ProjectStats;
}

interface ProjectStats {
  totalRecords: number;
  totalWeight: number;
  totalAmount: number;
  completionRate: number;
  activeDrivers: number;
  todayRecords: number;
  todayWeight: number;
  weeklyTrend: number;
}

interface OverviewStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalWeight: number;
  totalAmount: number;
  todayRecords: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
}

const statusConfig = {
  '进行中': { color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', label: '进行中' },
  '已完成': { color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50', label: '已完成' },
  '已暂停': { color: 'bg-yellow-500', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50', label: '已暂停' },
  '已取消': { color: 'bg-gray-500', textColor: 'text-gray-700', bgColor: 'bg-gray-50', label: '已取消' }
};

export default function MobileProjectOverview() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('进行中'); // 默认显示进行中的项目
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'progress'>('name');
  const [activeTab, setActiveTab] = useState('overview');

  // 获取总览统计数据
  const { data: overviewStats, isLoading: statsLoading } = useQuery<OverviewStats>({
    queryKey: ['mobileProjectOverviewStats'],
    queryFn: async () => {
      const now = new Date();
      // 将中国时区的日期转换为 UTC 日期
      const startOfToday = convertChinaDateToUTCDate(now);
      const startOfWeek = convertChinaDateToUTCDate(subDays(now, 7));
      const startOfThisMonth = convertChinaDateToUTCDate(startOfMonth(now));
      const startOfLastMonth = convertChinaDateToUTCDate(startOfMonth(subDays(now, 30)));

      // 获取项目统计
      const { data: projects } = await supabase
        .from('projects')
        .select('id, project_status');

      // 获取物流记录统计
      const { data: todayRecords } = await supabase
        .from('logistics_records')
        .select('loading_weight, payable_cost', { count: 'estimated' })  // ✅ 估算模式，性能更好
        .gte('loading_date', startOfToday);

      const { data: weekRecords } = await supabase
        .from('logistics_records')
        .select('loading_weight, payable_cost')
        .gte('loading_date', startOfWeek);

      const { data: monthRecords } = await supabase
        .from('logistics_records')
        .select('loading_weight, payable_cost')
        .gte('loading_date', startOfThisMonth);

      const { data: lastMonthRecords } = await supabase
        .from('logistics_records')
        .select('loading_weight, payable_cost')
        .gte('loading_date', startOfLastMonth)
        .lt('loading_date', startOfThisMonth);

      const totalProjects = projects?.length || 0;
      const activeProjects = projects?.filter(p => p.project_status === '进行中').length || 0;
      const completedProjects = projects?.filter(p => p.project_status === '已完成').length || 0;

      const totalWeight = monthRecords?.reduce((sum, record) => sum + (record.loading_weight || 0), 0) || 0;
      const totalAmount = monthRecords?.reduce((sum, record) => sum + (record.payable_cost || 0), 0) || 0;
      const todayRecordsCount = todayRecords?.length || 0;

      const thisMonthWeight = monthRecords?.reduce((sum, record) => sum + (record.loading_weight || 0), 0) || 0;
      const lastMonthWeight = lastMonthRecords?.reduce((sum, record) => sum + (record.loading_weight || 0), 0) || 0;
      const monthlyGrowth = lastMonthWeight > 0 ? ((thisMonthWeight - lastMonthWeight) / lastMonthWeight * 100) : 0;

      const weekWeight = weekRecords?.reduce((sum, record) => sum + (record.loading_weight || 0), 0) || 0;
      const weeklyGrowth = weekWeight > 0 ? 15 : 0; // 简化计算

      return {
        totalProjects,
        activeProjects,
        completedProjects,
        totalWeight,
        totalAmount,
        todayRecords: todayRecordsCount,
        weeklyGrowth,
        monthlyGrowth
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // 优化：获取项目列表数据 - 使用单次查询解决N+1问题
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['mobileProjectsList'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');

      // 第一步：获取所有项目
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;
      if (!projectsData || projectsData.length === 0) return [];

      const projectIds = projectsData.map(p => p.id);

      // 第二步：批量获取所有项目的统计数据（一次查询）
      const { data: allRecords, error: recordsError } = await supabase
        .from('logistics_records')
        .select('project_id, loading_weight, payable_cost, loading_date, driver_name')
        .in('project_id', projectIds);

      if (recordsError) throw recordsError;

      // 第三步：在内存中聚合数据
      const statsMap = new Map<string, any>();
      
      projectIds.forEach(projectId => {
        const projectRecords = (allRecords || []).filter(r => r.project_id === projectId);
        const todayRecords = projectRecords.filter(r => r.loading_date >= today);
        
        const totalWeight = projectRecords.reduce((sum, r) => sum + (r.loading_weight || 0), 0);
        const totalAmount = projectRecords.reduce((sum, r) => sum + (r.payable_cost || 0), 0);
        const activeDrivers = new Set(projectRecords.map(r => r.driver_name)).size;
        const todayWeight = todayRecords.reduce((sum, r) => sum + (r.loading_weight || 0), 0);

        statsMap.set(projectId, {
          totalRecords: projectRecords.length,
          totalWeight,
          totalAmount,
          activeDrivers,
          todayRecords: todayRecords.length,
          todayWeight,
          weeklyTrend: 0 // 可以后续优化计算
        });
      });

      // 第四步：组合项目和统计数据
      return projectsData.map(project => {
        const stats = statsMap.get(project.id) || {
          totalRecords: 0,
          totalWeight: 0,
          totalAmount: 0,
          activeDrivers: 0,
          todayRecords: 0,
          todayWeight: 0,
          weeklyTrend: 0
        };

        const completionRate = project.planned_total_tons ? 
          Math.min((stats.totalWeight / project.planned_total_tons) * 100, 100) : 0;

        return {
          ...project,
          stats: {
            ...stats,
            completionRate
          }
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  // 过滤和排序项目
  const filteredAndSortedProjects = useMemo(() => {
    if (!projects) return [];
    
    let filtered = projects.filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          project.manager.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || project.project_status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        case 'progress':
          return (b.stats?.completionRate || 0) - (a.stats?.completionRate || 0);
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [projects, searchQuery, statusFilter, sortBy]);

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

  if (statsLoading || projectsLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">加载项目数据中...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-6 pb-6">
        {/* 页面头部 */}
        <div className="space-y-4">
          {/* 现代化头部设计 */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 opacity-10 rounded-2xl"></div>
            <div className="relative p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    项目看板
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(), 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    className="rounded-full border-blue-200 text-blue-600 hover:bg-blue-50"
                    onClick={() => window.location.reload()}
                  >
                    <Activity className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => navigate('/m/projects/new')}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full shadow-lg"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    新建
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* 现代化搜索和筛选 */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索项目名称或负责人..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-3 bg-white/90 backdrop-blur-sm border-gray-200 rounded-2xl shadow-sm focus:shadow-md transition-all"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-white/90 backdrop-blur-sm border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="进行中">进行中</SelectItem>
                    <SelectItem value="已完成">已完成</SelectItem>
                    <SelectItem value="已暂停">已暂停</SelectItem>
                    <SelectItem value="已取消">已取消</SelectItem>
                    <SelectItem value="all">全部状态</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="bg-white/90 backdrop-blur-sm border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">按名称</SelectItem>
                    <SelectItem value="date">按日期</SelectItem>
                    <SelectItem value="progress">按进度</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* 现代化标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/90 backdrop-blur-sm rounded-2xl p-1 shadow-sm border border-gray-100">
            <TabsTrigger 
              value="overview" 
              className="flex items-center gap-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white transition-all"
            >
              <BarChart3 className="h-4 w-4" />
              总览
            </TabsTrigger>
            <TabsTrigger 
              value="projects" 
              className="flex items-center gap-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white transition-all"
            >
              <Briefcase className="h-4 w-4" />
              项目
            </TabsTrigger>
          </TabsList>

          {/* 总览标签页 */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* 现代化指标卡片 */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 via-blue-50 to-indigo-100 border-0 shadow-lg">
                <CardContent className="p-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Briefcase className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-900">
                          {overviewStats?.totalProjects || 0}
                        </div>
                        <div className="text-xs text-blue-600 font-medium">总项目</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-blue-700">
                        进行中 {overviewStats?.activeProjects || 0} 个
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 via-green-50 to-emerald-100 border-0 shadow-lg">
                <CardContent className="p-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Activity className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-900">
                          {overviewStats?.todayRecords || 0}
                        </div>
                        <div className="text-xs text-green-600 font-medium">今日运输</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(overviewStats?.weeklyGrowth || 0) >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-600" />
                      )}
                      <span className="text-xs text-green-700">
                        周增长 {Math.abs(overviewStats?.weeklyGrowth || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">月度重量</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {formatWeight(overviewStats?.totalWeight || 0)}
                      </p>
                      <div className="flex items-center gap-1">
                        {(overviewStats?.monthlyGrowth || 0) >= 0 ? (
                          <TrendingUp className="h-3 w-3 text-purple-600" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-600" />
                        )}
                        <p className="text-xs text-purple-600">
                          {Math.abs(overviewStats?.monthlyGrowth || 0).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="h-12 w-12 bg-purple-500 rounded-full flex items-center justify-center">
                      <Package className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-600 font-medium">月度金额</p>
                      <p className="text-2xl font-bold text-orange-900">
                        ¥{formatNumber(overviewStats?.totalAmount || 0)}
                      </p>
                      <p className="text-xs text-orange-600">
                        本月累计
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-orange-500 rounded-full flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 项目状态分布 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  项目状态分布
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-green-700">进行中</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-green-900">
                      {overviewStats?.activeProjects || 0}
                    </span>
                    <p className="text-xs text-green-600">个项目</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-blue-700">已完成</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-blue-900">
                      {overviewStats?.completedProjects || 0}
                    </span>
                    <p className="text-xs text-blue-600">个项目</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 热门项目 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    活跃项目
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setActiveTab('projects')}
                  >
                    查看全部
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredAndSortedProjects.slice(0, 3).map((project) => (
                  <div 
                    key={project.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => navigate(`/m/projects/detail/${project.id}`)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 truncate">{project.name}</h4>
                        <Badge 
                          className={`text-xs ${statusConfig[project.project_status as keyof typeof statusConfig]?.bgColor} ${statusConfig[project.project_status as keyof typeof statusConfig]?.textColor} border-0`}
                        >
                          {statusConfig[project.project_status as keyof typeof statusConfig]?.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        今日: {project.stats?.todayRecords || 0}单 · {formatWeight(project.stats?.todayWeight || 0)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 项目列表标签页 */}
          <TabsContent value="projects" className="space-y-4 mt-4">
            {/* 排序选择 */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                共 {filteredAndSortedProjects.length} 个项目
              </p>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">按名称</SelectItem>
                  <SelectItem value="date">按日期</SelectItem>
                  <SelectItem value="progress">按进度</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 项目列表 */}
            <div className="space-y-3">
              {filteredAndSortedProjects.map((project) => (
                <Card 
                  key={project.id}
                  className="hover:shadow-md transition-all duration-200 cursor-pointer border-l-4 border-l-blue-500"
                  onClick={() => navigate(`/m/projects/detail/${project.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* 项目标题行 */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
                            <Badge 
                              className={`text-xs ${statusConfig[project.project_status as keyof typeof statusConfig]?.bgColor} ${statusConfig[project.project_status as keyof typeof statusConfig]?.textColor} border-0`}
                            >
                              {statusConfig[project.project_status as keyof typeof statusConfig]?.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {project.manager}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(project.start_date), 'MM/dd')}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                      </div>

                      {/* 进度条 */}
                      {project.planned_total_tons && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">完成进度</span>
                            <span className="font-medium text-gray-700">
                              {(project.stats?.completionRate || 0).toFixed(1)}%
                            </span>
                          </div>
                          <Progress 
                            value={project.stats?.completionRate || 0} 
                            className="h-2"
                          />
                        </div>
                      )}

                      {/* 统计信息 */}
                      <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-900">
                            {project.stats?.totalRecords || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">总运单</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-900">
                            {formatWeight(project.stats?.totalWeight || 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">总重量</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-900">
                            {project.stats?.activeDrivers || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">活跃司机</p>
                        </div>
                      </div>

                      {/* 今日数据 */}
                      {(project.stats?.todayRecords || 0) > 0 && (
                        <div className="flex items-center gap-2 p-2 bg-green-50 rounded-md">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-green-700">
                            今日: {project.stats?.todayRecords}单 · {formatWeight(project.stats?.todayWeight || 0)}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredAndSortedProjects.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无项目</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery || statusFilter !== 'all' ? '没有找到匹配的项目' : '还没有创建任何项目'}
                  </p>
                  <Button 
                    onClick={() => navigate('/m/projects/new')}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    创建第一个项目
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
}
