// 移动端项目详细看板页面 - 对标桌面端功能
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  Target,
  Truck,
  DollarSign,
  BarChart3,
  PieChart,
  Users,
  Package,
  Activity,
  Eye,
  EyeOff,
  Settings,
  Download,
  Share,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Navigation,
  Building2
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// 类型定义 - 对标桌面端
interface ProjectDetails { 
  id: string; 
  name: string; 
  partner_name: string; 
  start_date: string; 
  planned_total_tons: number; 
  billing_type_id: number; 
}

interface DailyReport { 
  trip_count: number; 
  total_tonnage: number;
  daily_receivable_amount: number; 
  date: string; 
}

interface TrendData {
  date: string;
  trip_count: number;
  total_tonnage: number;
  daily_receivable_amount: number;
}

interface SummaryStats {
  total_trips: number;
  total_tonnage: number;
  total_cost: number;
  avg_cost: number;
}

interface DriverReportRow {
  driver_name: string;
  license_plate: string;
  phone: string;
  daily_trip_count: number;
  total_trip_count: number;
  total_tonnage: number;
  total_driver_receivable: number;
  total_partner_payable: number;
}

interface DashboardData {
  project_details: ProjectDetails[];
  daily_report: DailyReport;
  seven_day_trend: TrendData[];
  summary_stats: SummaryStats;
  driver_report_table: DriverReportRow[];
}

const billingTypeConfig = {
  1: { name: '计重', unit: '吨', icon: Package },
  2: { name: '计车', unit: '车', icon: Truck },
  3: { name: '计体积', unit: '立方', icon: Package }
};

// 圆形进度图组件
const CircularProgressChart: React.FC<{ 
  percentage: number; 
  size?: number; 
  strokeWidth?: number;
  color?: string;
}> = ({ 
  percentage, 
  size = 120, 
  strokeWidth = 8,
  color = '#3B82F6'
}) => {
  const data = [{ value: percentage, fill: color }];
  
  return (
    <ResponsiveContainer width={size} height={size}>
      <RadialBarChart
        cx="50%"
        cy="50%"
        innerRadius="60%"
        outerRadius="90%"
        data={data}
        startAngle={90}
        endAngle={450}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="value" cornerRadius={strokeWidth / 2} />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-2xl font-bold fill-current"
        >
          {percentage.toFixed(1)}%
        </text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
};

export default function MobileProjectDashboardDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [visibleLines, setVisibleLines] = useState({ 
    weight: true, 
    trips: true, 
    receivable: true 
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [driverSortBy, setDriverSortBy] = useState<'daily' | 'total' | 'amount'>('total');

  // 获取项目看板数据 - 对标桌面端RPC调用
  const { data: dashboardData, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ['projectDashboard', projectId, format(reportDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!projectId) throw new Error('项目ID不存在');
      
      const { data, error } = await supabase.rpc('get_project_dashboard_data', {
        p_selected_project_id: projectId,
        p_report_date: format(reportDate, 'yyyy-MM-dd')
      });

      if (error) throw error;
      return data as DashboardData;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // 计算数据 - 对标桌面端逻辑
  const selectedProject = useMemo(() => {
    return dashboardData?.project_details?.find(p => p.id === projectId);
  }, [dashboardData, projectId]);

  const billingConfig = useMemo(() => {
    if (!selectedProject) return billingTypeConfig[1];
    return billingTypeConfig[selectedProject.billing_type_id as keyof typeof billingTypeConfig] || billingTypeConfig[1];
  }, [selectedProject]);

  const unitConfig = useMemo(() => {
    const defaultConfig = { billingTypeId: 1, unit: '吨', progressCompleted: 0, progressPlanned: 1 };
    if (!selectedProject || !dashboardData) return defaultConfig;
    
    const { billing_type_id, planned_total_tons } = selectedProject;
    const { summary_stats } = dashboardData;
    const typeId = parseInt(billing_type_id as any, 10);
    
    let unitText = '吨';
    if (typeId === 2) unitText = '车';
    if (typeId === 3) unitText = '立方';
    
    return {
      billingTypeId: typeId,
      unit: unitText,
      progressCompleted: typeId === 2 ? summary_stats?.total_trips || 0 : summary_stats?.total_tonnage || 0,
      progressPlanned: planned_total_tons || 1,
    };
  }, [selectedProject, dashboardData]);

  const progressPercentage = useMemo(() => {
    return (unitConfig.progressPlanned > 0) ? (unitConfig.progressCompleted / unitConfig.progressPlanned) * 100 : 0;
  }, [unitConfig]);

  const chartData = useMemo(() => {
    if (!dashboardData?.seven_day_trend) return [];
    
    return dashboardData.seven_day_trend.map(trend => ({
      date: format(new Date(trend.date), 'MM/dd'),
      weight: trend.total_tonnage,
      trips: trend.trip_count,
      amount: trend.daily_receivable_amount
    }));
  }, [dashboardData]);

  const sortedDrivers = useMemo(() => {
    if (!dashboardData?.driver_report_table) return [];
    
    const drivers = [...dashboardData.driver_report_table];
    
    switch (driverSortBy) {
      case 'daily':
        return drivers.sort((a, b) => b.daily_trip_count - a.daily_trip_count);
      case 'total':
        return drivers.sort((a, b) => b.total_tonnage - a.total_tonnage);
      case 'amount':
        return drivers.sort((a, b) => b.total_driver_receivable - a.total_driver_receivable);
      default:
        return drivers;
    }
  }, [dashboardData?.driver_report_table, driverSortBy]);

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

  const formatAmount = (amount: number | undefined | null) => {
    if (!amount && amount !== 0) return '¥0';
    return `¥${formatNumber(amount)}`;
  };

  const toggleLineVisibility = (line: keyof typeof visibleLines) => {
    setVisibleLines(prev => ({ ...prev, [line]: !prev[line] }));
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">加载看板数据中...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (error || !dashboardData) {
    return (
      <MobileLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">加载失败</h3>
          <p className="text-muted-foreground mb-4">无法加载看板数据</p>
          <div className="space-y-2">
            <Button onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重新加载
            </Button>
            <Button variant="outline" onClick={() => navigate(-1)}>
              返回上一页
            </Button>
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
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">项目看板</h1>
              {selectedProject && (
                <p className="text-sm text-muted-foreground truncate">
                  {selectedProject.name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {format(reportDate, 'MM/dd')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={reportDate}
                    onSelect={(date) => date && setReportDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()}
                className="p-2"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* 项目基本信息卡片 */}
        {selectedProject && (
          <Card className="bg-gradient-to-br from-blue-50 via-blue-50 to-purple-100 border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-blue-900">{selectedProject.name}</h2>
                    <p className="text-sm text-blue-600">合作伙伴: {selectedProject.partner_name}</p>
                  </div>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                    {billingConfig.name}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-200">
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-900">
                      {formatWeight(selectedProject.planned_total_tons)}
                    </div>
                    <div className="text-xs text-blue-600">计划总量</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-900">
                      {progressPercentage.toFixed(1)}%
                    </div>
                    <div className="text-xs text-blue-600">完成进度</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 核心指标 */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                    <Truck className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-900">
                      {dashboardData.summary_stats?.total_trips || 0}
                    </div>
                    <div className="text-xs text-green-600">总运输次数</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-purple-900">
                      {formatWeight(dashboardData.summary_stats?.total_tonnage || 0)}
                    </div>
                    <div className="text-xs text-purple-600">总运输量</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-orange-900">
                      {formatAmount(dashboardData.summary_stats?.total_cost || 0)}
                    </div>
                    <div className="text-xs text-orange-600">总金额</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-blue-900">
                      {sortedDrivers.length || 0}
                    </div>
                    <div className="text-xs text-blue-600">活跃司机</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 标签页内容 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white/90 backdrop-blur-sm rounded-xl p-1 shadow-sm">
            <TabsTrigger 
              value="overview" 
              className="flex items-center gap-2 rounded-lg text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
            >
              <BarChart3 className="h-4 w-4" />
              趋势
            </TabsTrigger>
            <TabsTrigger 
              value="progress" 
              className="flex items-center gap-2 rounded-lg text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
            >
              <Target className="h-4 w-4" />
              进度
            </TabsTrigger>
            <TabsTrigger 
              value="drivers" 
              className="flex items-center gap-2 rounded-lg text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
            >
              <Users className="h-4 w-4" />
              司机
            </TabsTrigger>
          </TabsList>

          {/* 趋势分析 */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* 图表控制 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">数据趋势</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={visibleLines.weight ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleLineVisibility('weight')}
                      className="text-xs"
                    >
                      {visibleLines.weight ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                      重量
                    </Button>
                    <Button
                      variant={visibleLines.trips ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleLineVisibility('trips')}
                      className="text-xs"
                    >
                      {visibleLines.trips ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                      次数
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
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
                                <p className="font-medium mb-2">{label}</p>
                                {payload.map((item, index) => (
                                  <p key={index} style={{ color: item.color }}>
                                    {item.name === 'weight' && `重量: ${formatWeight(item.value as number)}`}
                                    {item.name === 'trips' && `次数: ${item.value}次`}
                                    {item.name === 'amount' && `金额: ${formatAmount(item.value as number)}`}
                                  </p>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {visibleLines.weight && (
                        <Line 
                          type="monotone" 
                          dataKey="weight" 
                          stroke="#10B981" 
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          name="weight"
                        />
                      )}
                      {visibleLines.trips && (
                        <Line 
                          type="monotone" 
                          dataKey="trips" 
                          stroke="#3B82F6" 
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          name="trips"
                        />
                      )}
                      {visibleLines.receivable && (
                        <Line 
                          type="monotone" 
                          dataKey="amount" 
                          stroke="#F59E0B" 
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          name="amount"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 完成进度 */}
          <TabsContent value="progress" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">完成进度 ({unitConfig.unit})</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-6">
                <CircularProgressChart 
                  percentage={progressPercentage}
                  size={160}
                  strokeWidth={12}
                  color="#3B82F6"
                />
                
                <div className="w-full space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium">已完成</span>
                    <span className="font-bold text-blue-600">
                      {unitConfig.billingTypeId === 2 
                        ? `${formatNumber(unitConfig.progressCompleted)}车`
                        : formatWeight(unitConfig.progressCompleted)
                      }
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">计划总量</span>
                    <span className="font-bold">
                      {unitConfig.billingTypeId === 2 
                        ? `${formatNumber(unitConfig.progressPlanned)}车`
                        : formatWeight(unitConfig.progressPlanned)
                      }
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium">剩余量</span>
                    <span className="font-bold text-green-600">
                      {unitConfig.billingTypeId === 2 
                        ? `${formatNumber(Math.max(0, unitConfig.progressPlanned - unitConfig.progressCompleted))}车`
                        : formatWeight(Math.max(0, unitConfig.progressPlanned - unitConfig.progressCompleted))
                      }
                    </span>
                  </div>

                  {dashboardData.daily_report && (
                    <div className="pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium mb-3">今日数据</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <div className="text-lg font-bold text-orange-600">
                            {dashboardData.daily_report.trip_count || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">今日车次</div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <div className="text-lg font-bold text-purple-600">
                            {unitConfig.billingTypeId === 2 
                              ? `${formatNumber(dashboardData.daily_report.trip_count)}车`
                              : formatWeight(dashboardData.daily_report.total_tonnage)
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">今日运输量</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 司机排行 */}
          <TabsContent value="drivers" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">司机排行</CardTitle>
                  <Select value={driverSortBy} onValueChange={(value: any) => setDriverSortBy(value)}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">今日</SelectItem>
                      <SelectItem value="total">累计</SelectItem>
                      <SelectItem value="amount">金额</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {sortedDrivers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">暂无司机数据</p>
                  </div>
                ) : (
                  sortedDrivers.slice(0, 10).map((driver, index) => (
                    <div key={driver.driver_name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                        index < 3 ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white" : "bg-gray-200"
                      )}>
                        {index + 1}
                      </div>
                      
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-500 text-white text-sm">
                          {driver.driver_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <p className="font-medium text-sm">{driver.driver_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {driver.license_plate}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        {driverSortBy === 'daily' && (
                          <>
                            <div className="font-bold text-blue-600">
                              {driver.daily_trip_count}次
                            </div>
                            <div className="text-xs text-muted-foreground">
                              今日
                            </div>
                          </>
                        )}
                        {driverSortBy === 'total' && (
                          <>
                            <div className="font-bold text-green-600">
                              {formatWeight(driver.total_tonnage)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {driver.total_trip_count}次
                            </div>
                          </>
                        )}
                        {driverSortBy === 'amount' && (
                          <>
                            <div className="font-bold text-orange-600">
                              {formatAmount(driver.total_driver_receivable)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {driver.total_trip_count}次
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
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
            <Eye className="h-4 w-4" />
            查看运单
          </Button>
          <Button 
            onClick={() => {
              // 分享功能
              if (navigator.share) {
                navigator.share({
                  title: `项目看板 - ${selectedProject?.name}`,
                  text: `完成进度: ${dashboardData.summary?.completion_rate?.toFixed(1)}%`,
                  url: window.location.href,
                });
              }
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            <Share className="h-4 w-4" />
            分享看板
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
