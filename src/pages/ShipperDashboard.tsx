// 货主看板 - 桌面端
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import {
  Package,
  Weight,
  DollarSign,
  Briefcase,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowRight,
  FileText,
  CreditCard,
  AlertCircle,
  Download,
  RefreshCw,
  Eye,
  ChevronRight,
  Building2
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
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format, subDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 类型定义
interface ShipperDashboardStats {
  summary: {
    totalRecords: number;
    totalWeight: number;
    totalAmount: number;
    selfRecords: number;
    selfWeight: number;
    selfAmount: number;
    subordinatesRecords: number;
    subordinatesWeight: number;
    subordinatesAmount: number;
    activeProjects: number;
    activeDrivers: number;
  };
  pending: {
    pendingPayments: number;
    pendingInvoices: number;
    overduePayments: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

interface SubordinateShipper {
  shipper_id: string;
  shipper_name: string;
  hierarchy_depth: number;
  parent_id: string | null;
  parent_name: string | null;
  record_count: number;
  total_weight: number;
  total_amount: number;
  active_projects: number;
  pending_payments: number;
  pending_invoices: number;
}

interface TrendData {
  date: string;
  self_count: number;
  subordinates_count: number;
  total_count: number;
  self_amount: number;
  subordinates_amount: number;
  total_amount: number;
}

interface TopRoute {
  loading_location: string;
  unloading_location: string;
  record_count: number;
  total_weight: number;
  total_amount: number;
  avg_weight: number;
  avg_amount: number;
}

interface ProjectDistribution {
  project_id: string;
  project_name: string;
  record_count: number;
  total_weight: number;
  total_amount: number;
  percentage: number;
}

// 饼图颜色
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// 格式化数字
const formatNumber = (num: number) => {
  if (num >= 10000) return `${(num / 10000).toFixed(2)}万`;
  return num.toLocaleString('zh-CN');
};

// 格式化金额
const formatCurrency = (num: number) => {
  if (num >= 10000) return `¥${(num / 10000).toFixed(2)}万`;
  return `¥${num.toLocaleString('zh-CN')}`;
};

// 格式化重量
const formatWeight = (num: number) => {
  return `${num.toFixed(2)}吨`;
};

export default function ShipperDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  // 状态管理
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ShipperDashboardStats | null>(null);
  const [subordinates, setSubordinates] = useState<SubordinateShipper[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [topRoutes, setTopRoutes] = useState<TopRoute[]>([]);
  const [projectDistribution, setProjectDistribution] = useState<ProjectDistribution[]>([]);
  const [availableShippers, setAvailableShippers] = useState<Array<{id: string, name: string}>>([]);
  
  // 筛选器状态
  const [dateRange, setDateRange] = useState<'7days' | '30days' | 'thisMonth' | 'lastMonth'>('30days');
  const [shipperScope, setShipperScope] = useState<'all' | 'self' | 'direct'>('all');
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const [selectedShipperId, setSelectedShipperId] = useState<string | null>(null);

  // 判断用户类型和权限
  const userRole = user?.role || 'viewer';
  const isPartnerRole = userRole === 'partner';
  const currentShipperId = isPartnerRole ? user?.partnerId || null : selectedShipperId;

  // 计算日期范围
  const getDateRange = (range: string) => {
    const today = new Date();
    let startDate: Date;
    
    switch (range) {
      case '7days':
        startDate = subDays(today, 7);
        break;
      case '30days':
        startDate = subDays(today, 30);
        break;
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endOfLastMonth, 'yyyy-MM-dd')
        };
      default:
        startDate = subDays(today, 30);
    }
    
    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd')
    };
  };

  // 加载可用货主列表（非合作方角色使用）
  const loadAvailableShippers = async () => {
    if (isPartnerRole) return;
    
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name')
        .eq('partner_type', '货主')
        .eq('is_root', true)
        .order('name');
      
      if (error) throw error;
      
      setAvailableShippers(data || []);
      
      // 如果还没有选择货主，默认选择第一个
      if (!selectedShipperId && data && data.length > 0) {
        setSelectedShipperId(data[0].id);
      }
    } catch (error: any) {
      console.error('加载货主列表失败:', error);
    }
  };

  // 加载数据
  const loadData = async () => {
    // 合作方角色：必须有 partnerId
    if (isPartnerRole && !user?.partnerId) {
      toast({
        title: '权限错误',
        description: '您不是货主用户，无法访问货主看板',
        variant: 'destructive'
      });
      setIsLoading(false);
      return;
    }
    
    // 非合作方角色：必须选择一个货主
    if (!isPartnerRole && !currentShipperId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const dates = getDateRange(dateRange);
      
      // 加载总体统计
      const { data: statsData, error: statsError } = await supabase.rpc(
        'get_shipper_dashboard_stats',
        {
          p_shipper_id: currentShipperId,
          p_start_date: dates.startDate,
          p_end_date: dates.endDate,
          p_include_self: shipperScope !== 'direct',
          p_include_subordinates: shipperScope !== 'self'
        }
      );

      if (statsError) throw statsError;
      setStats(statsData);

      // 加载下级货主列表
      const { data: subordinatesData, error: subordinatesError } = await supabase.rpc(
        'get_subordinate_shippers_stats',
        {
          p_shipper_id: currentShipperId,
          p_start_date: dates.startDate,
          p_end_date: dates.endDate
        }
      );

      if (subordinatesError) throw subordinatesError;
      setSubordinates(subordinatesData || []);

      // 加载趋势数据
      const { data: trendDataResult, error: trendError } = await supabase.rpc(
        'get_shipper_trend_data',
        {
          p_shipper_id: currentShipperId,
          p_days: trendDays
        }
      );

      if (trendError) throw trendError;
      setTrendData(trendDataResult || []);

      // 加载Top路线
      const { data: routesData, error: routesError } = await supabase.rpc(
        'get_shipper_top_routes',
        {
          p_shipper_id: currentShipperId,
          p_start_date: dates.startDate,
          p_end_date: dates.endDate,
          p_limit: 10
        }
      );

      if (routesError) throw routesError;
      setTopRoutes(routesData || []);

      // 加载项目分布
      const { data: projectsData, error: projectsError } = await supabase.rpc(
        'get_shipper_project_distribution',
        {
          p_shipper_id: currentShipperId,
          p_start_date: dates.startDate,
          p_end_date: dates.endDate
        }
      );

      if (projectsError) throw projectsError;
      setProjectDistribution(projectsData || []);

    } catch (error: any) {
      console.error('加载数据失败:', error);
      toast({
        title: '加载失败',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 初始加载可用货主列表
  useEffect(() => {
    if (!isPartnerRole) {
      loadAvailableShippers();
    }
  }, [isPartnerRole]);

  // 初始加载和筛选器变化时重新加载
  useEffect(() => {
    if (currentShipperId) {
      loadData();
    }
  }, [dateRange, shipperScope, trendDays, currentShipperId]);

  // 导出报表
  const handleExport = () => {
    toast({
      title: '导出功能',
      description: '报表导出功能正在开发中...'
    });
  };

  // 合作方角色但没有 partnerId
  if (isPartnerRole && !user?.partnerId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              权限不足
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              您是合作方用户，但未关联货主信息，无法访问货主看板。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 非合作方角色但没有可用货主
  if (!isPartnerRole && availableShippers.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              暂无数据
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              系统中还没有货主数据，请先在"合作方管理"中添加货主类型的合作方。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* 页面头部 */}
      <PageHeader
        title="货主看板"
        icon={Building2}
        actions={
          <div className="flex items-center gap-4">
            {/* 货主选择（非合作方角色显示） */}
            {!isPartnerRole && availableShippers.length > 0 && (
              <Select value={selectedShipperId || ''} onValueChange={setSelectedShipperId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="选择货主" />
                </SelectTrigger>
                <SelectContent>
                  {availableShippers.map(shipper => (
                    <SelectItem key={shipper.id} value={shipper.id}>
                      {shipper.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* 时间范围筛选 */}
            <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">最近7天</SelectItem>
                <SelectItem value="30days">最近30天</SelectItem>
                <SelectItem value="thisMonth">本月</SelectItem>
                <SelectItem value="lastMonth">上月</SelectItem>
              </SelectContent>
            </Select>

            {/* 货主范围筛选 */}
            <Select value={shipperScope} onValueChange={(value: any) => setShipperScope(value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部（本级+下级）</SelectItem>
                <SelectItem value="self">仅本级</SelectItem>
                <SelectItem value="direct">仅直接下级</SelectItem>
              </SelectContent>
            </Select>

            {/* 刷新按钮 */}
            <Button onClick={loadData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>

            {/* 导出按钮 */}
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出报表
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* 运单总数 */}
            <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 bg-gradient-to-br from-blue-50 to-white overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
              
              <CardContent className="relative p-6 space-y-4">
                <div className="inline-flex p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  <Package className="h-8 w-8 text-white" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-base font-semibold text-gray-600">运单总数</h3>
                    <Badge variant="outline" className="text-blue-600 border-blue-200">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      活跃
                    </Badge>
                  </div>
                  <div className="text-4xl font-bold text-gray-900">
                    {formatNumber(stats?.summary.totalRecords || 0)}
                  </div>
                  <p className="text-sm text-gray-500">
                    本级: {formatNumber(stats?.summary.selfRecords || 0)} | 
                    下级: {formatNumber(stats?.summary.subordinatesRecords || 0)}
                  </p>
                </div>
                
                <div className="h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full"></div>
              </CardContent>
            </Card>

            {/* 总重量 */}
            <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-emerald-500/5"></div>
              
              <CardContent className="relative p-6 space-y-4">
                <div className="inline-flex p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  <Weight className="h-8 w-8 text-white" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-gray-600">总重量</h3>
                  <div className="text-4xl font-bold text-gray-900">
                    {formatWeight(stats?.summary.totalWeight || 0)}
                  </div>
                  <p className="text-sm text-gray-500">
                    本级: {formatWeight(stats?.summary.selfWeight || 0)}
                  </p>
                </div>
                
                <div className="h-1.5 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 rounded-full"></div>
              </CardContent>
            </Card>

            {/* 总金额 */}
            <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 bg-gradient-to-br from-purple-50 to-pink-50">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5"></div>
              
              <CardContent className="relative p-6 space-y-4">
                <div className="inline-flex p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  <DollarSign className="h-8 w-8 text-white" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-gray-600">总金额</h3>
                  <div className="text-4xl font-bold text-gray-900">
                    {formatCurrency(stats?.summary.totalAmount || 0)}
                  </div>
                  <p className="text-sm text-gray-500">
                    本级: {formatCurrency(stats?.summary.selfAmount || 0)}
                  </p>
                </div>
                
                <div className="h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 rounded-full"></div>
              </CardContent>
            </Card>

            {/* 活跃项目 */}
            <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 bg-gradient-to-br from-orange-50 to-amber-50">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-amber-500/5"></div>
              
              <CardContent className="relative p-6 space-y-4">
                <div className="inline-flex p-3 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  <Briefcase className="h-8 w-8 text-white" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-gray-600">活跃项目</h3>
                  <div className="text-4xl font-bold text-gray-900">
                    {stats?.summary.activeProjects || 0}
                  </div>
                  <p className="text-sm text-gray-500">正在运行的项目</p>
                </div>
                
                <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-full"></div>
              </CardContent>
            </Card>

            {/* 合作司机 */}
            <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 bg-gradient-to-br from-pink-50 to-rose-50">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 via-transparent to-rose-500/5"></div>
              
              <CardContent className="relative p-6 space-y-4">
                <div className="inline-flex p-3 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  <Users className="h-8 w-8 text-white" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-gray-600">合作司机</h3>
                  <div className="text-4xl font-bold text-gray-900">
                    {stats?.summary.activeDrivers || 0}
                  </div>
                  <p className="text-sm text-gray-500">活跃司机数量</p>
                </div>
                
                <div className="h-1.5 bg-gradient-to-r from-pink-500 via-rose-500 to-pink-500 rounded-full"></div>
              </CardContent>
            </Card>
          </div>

          {/* 待处理事项 */}
          {stats && (stats.pending.pendingPayments > 0 || stats.pending.pendingInvoices > 0 || stats.pending.overduePayments > 0) && (
            <Card className="border-l-4 border-l-amber-500 bg-amber-50/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <div>
                      <h3 className="font-semibold text-amber-900">待处理事项</h3>
                      <div className="flex items-center gap-6 mt-1 text-sm text-amber-700">
                        <span>待付款: {stats.pending.pendingPayments}</span>
                        <span>待开票: {stats.pending.pendingInvoices}</span>
                        {stats.pending.overduePayments > 0 && (
                          <span className="text-red-600 font-semibold">
                            逾期付款: {stats.pending.overduePayments}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    立即处理
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 趋势图表 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 运单趋势 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    运单趋势
                  </CardTitle>
                  <Select value={String(trendDays)} onValueChange={(value) => setTrendDays(Number(value) as 7 | 30)}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7天</SelectItem>
                      <SelectItem value="30">30天</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'MM/dd')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value as string), 'yyyy-MM-dd', { locale: zhCN })}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="self_count" name="本级" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="subordinates_count" name="下级" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="total_count" name="总计" stroke="#8b5cf6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 金额趋势 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  金额趋势
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'MM/dd')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value as string), 'yyyy-MM-dd', { locale: zhCN })}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="self_amount" name="本级" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="subordinates_amount" name="下级" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* 项目分布和Top路线 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 项目分布 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  项目分布
                </CardTitle>
                <CardDescription>按运单数量统计</CardDescription>
              </CardHeader>
              <CardContent>
                {projectDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={projectDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ project_name, percentage }) => `${project_name} ${percentage.toFixed(1)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="record_count"
                      >
                        {projectDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatNumber(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    暂无数据
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top 10 路线 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  常用路线 Top 10
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {topRoutes.length > 0 ? (
                    topRoutes.map((route, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-sm font-semibold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">
                              {route.loading_location} → {route.unloading_location}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatNumber(route.record_count)}票 | {formatWeight(route.total_weight)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-blue-600">
                            {formatCurrency(route.total_amount)}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      暂无数据
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 下级货主统计列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                下级货主统计
              </CardTitle>
              <CardDescription>
                显示本级和所有下级货主的业务数据
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>货主名称</TableHead>
                      <TableHead>层级</TableHead>
                      <TableHead className="text-right">运单数</TableHead>
                      <TableHead className="text-right">总重量(吨)</TableHead>
                      <TableHead className="text-right">总金额</TableHead>
                      <TableHead className="text-center">活跃项目</TableHead>
                      <TableHead className="text-center">待付款</TableHead>
                      <TableHead className="text-center">待开票</TableHead>
                      <TableHead className="text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subordinates.length > 0 ? (
                      subordinates.map((shipper) => (
                        <TableRow key={shipper.shipper_id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{shipper.shipper_name}</span>
                              {shipper.hierarchy_depth === 0 && (
                                <Badge variant="outline" className="text-xs">根节点</Badge>
                              )}
                            </div>
                            {shipper.parent_name && (
                              <div className="text-xs text-muted-foreground mt-1">
                                上级: {shipper.parent_name}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              第 {shipper.hierarchy_depth + 1} 级
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatNumber(shipper.record_count)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatWeight(shipper.total_weight)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-blue-600">
                            {formatCurrency(shipper.total_amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              {shipper.active_projects}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {shipper.pending_payments > 0 ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                {shipper.pending_payments}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {shipper.pending_invoices > 0 ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {shipper.pending_invoices}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              查看详情
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          暂无下级货主数据
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

