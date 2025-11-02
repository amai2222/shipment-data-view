// 货主看板 - 桌面端（美化版，参考财务看板设计）
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { 
  Package, 
  Weight, 
  DollarSign, 
  Briefcase, 
  AlertCircle, 
  Download, 
  RefreshCw, 
  Building2,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  FileText,
  ArrowUpRight,
  TreePine,
  Loader2
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

// 图表颜色
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

// 格式化数字
const formatNumber = (num: number) => {
  if (num >= 10000) return `${(num / 10000).toFixed(2)}万`;
  return num.toLocaleString('zh-CN');
};

// 格式化金额
const formatCurrency = (num: number) => {
  if (num >= 10000) return `¥${(num / 10000).toFixed(2)}万`;
  return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// 格式化重量
const formatWeight = (num: number) => {
  return `${num.toFixed(2)}吨`;
};

export default function ShipperDashboard() {
  const { user } = useAuth() as { user: { role: string; id: string } | null };
  const { toast } = useToast();

  // 状态管理
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ShipperDashboardStats | null>(null);
  const [subordinates, setSubordinates] = useState<SubordinateShipper[]>([]);
  const [availableShippers, setAvailableShippers] = useState<Array<{id: string, name: string}>>([]);
  
  // 筛选器状态
  const [dateRange, setDateRange] = useState<'7days' | '30days' | 'thisMonth' | 'lastMonth'>('30days');
  const [shipperScope, setShipperScope] = useState<'all' | 'self' | 'direct'>('all');
  const [selectedShipperId, setSelectedShipperId] = useState<string | null>(null);

  // 判断用户类型和权限
  const userRole = user?.role || 'viewer';
  const isPartnerRole = userRole === 'partner';
  const currentShipperId = isPartnerRole ? null : selectedShipperId;

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
      case 'lastMonth': {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          startDate: format(lastMonth, 'yyyy-MM-dd'),
          endDate: format(lastMonthEnd, 'yyyy-MM-dd')
        };
      }
      default:
        startDate = subDays(today, 30);
    }
    
    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd')
    };
  };

  // 加载可用货主列表（非合作方角色使用）
  const loadAvailableShippers = useCallback(async () => {
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
    } catch (error: unknown) {
      console.error('加载货主列表失败:', error);
    }
  }, [isPartnerRole, selectedShipperId]);

  // 加载数据
  const loadData = useCallback(async () => {
    // 合作方角色：暂时不支持（需要实现用户-合作方关联）
    if (isPartnerRole) {
      toast({
        title: '功能暂未开放',
        description: '合作方角色的货主看板功能正在开发中，请使用其他角色访问',
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
      setStats(statsData as unknown as ShipperDashboardStats);

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
      setSubordinates(subordinatesData as unknown as SubordinateShipper[] || []);

    } catch (error: unknown) {
      console.error('加载失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast({
        title: '加载失败',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [isPartnerRole, currentShipperId, dateRange, shipperScope, toast]);

  // 初始加载可用货主列表
  useEffect(() => {
    if (!isPartnerRole) {
      loadAvailableShippers();
    }
  }, [isPartnerRole, loadAvailableShippers]);

  // 初始加载和筛选器变化时重新加载
  useEffect(() => {
    if (currentShipperId) {
      loadData();
    }
  }, [currentShipperId, loadData]);

  // 导出报表
  const handleExport = () => {
    toast({
      title: '导出功能',
      description: '报表导出功能正在开发中...'
    });
  };

  // 合作方角色：暂时不支持
  if (isPartnerRole) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              功能开发中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              合作方角色的货主看板功能正在开发中，请使用其他角色访问。
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

  // 计算图表数据
  const levelComparisonData = stats ? [
    { name: '本级', records: stats.summary.selfRecords, weight: stats.summary.selfWeight, amount: stats.summary.selfAmount },
    { name: '下级', records: stats.summary.subordinatesRecords, weight: stats.summary.subordinatesWeight, amount: stats.summary.subordinatesAmount }
  ] : [];

  const subordinatesChartData = subordinates.slice(0, 10).map(sub => ({
    name: sub.shipper_name.length > 6 ? sub.shipper_name.substring(0, 6) + '...' : sub.shipper_name,
    full_name: sub.shipper_name,
    records: sub.record_count,
    amount: sub.total_amount
  }));

  return (
    <div className="space-y-6 p-4 md:p-6 relative">
      {isLoading && (
        <div className="fixed inset-0 bg-background/30 backdrop-blur-[2px] flex justify-center items-center z-[5] pointer-events-none">
          <div className="relative z-[6] bg-background/90 backdrop-blur-sm rounded-lg p-6 shadow-lg border">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      )}
      
      <PageHeader 
        title="货主看板" 
        description="货主数据统计和层级管理"
        icon={TreePine}
        iconColor="text-emerald-600"
      >
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
          <Select value={dateRange} onValueChange={(value: '7days' | '30days' | 'thisMonth' | 'lastMonth') => setDateRange(value)}>
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
          <Select value={shipperScope} onValueChange={(value: 'all' | 'self' | 'direct') => setShipperScope(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="self">仅本级</SelectItem>
              <SelectItem value="direct">仅下级</SelectItem>
            </SelectContent>
          </Select>

          {/* 操作按钮 */}
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出报表
          </Button>
          
          <Button onClick={loadData} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </PageHeader>

      {/* 主要内容 */}
      {!isLoading && stats && (
        <>
          {/* 核心统计指标 - 美化版（参考财务看板） */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* 总运单数 */}
            <Card className="relative overflow-hidden border-l-4 border-l-blue-500 hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">总运单数</CardTitle>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{formatNumber(stats.summary.totalRecords)}</div>
                <p className="text-xs text-muted-foreground mt-1">本级: {formatNumber(stats.summary.selfRecords)} | 下级: {formatNumber(stats.summary.subordinatesRecords)}</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-xs text-green-600">累计运单</span>
                </div>
              </CardContent>
            </Card>

            {/* 总重量 */}
            <Card className="relative overflow-hidden border-l-4 border-l-green-500 hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">总重量</CardTitle>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Weight className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatWeight(stats.summary.totalWeight)}</div>
                <p className="text-xs text-muted-foreground mt-1">本级: {formatWeight(stats.summary.selfWeight)} | 下级: {formatWeight(stats.summary.subordinatesWeight)}</p>
                <div className="flex items-center mt-2">
                  <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-xs text-green-600">运输总量</span>
                </div>
              </CardContent>
            </Card>

            {/* 总金额 */}
            <Card className="relative overflow-hidden border-l-4 border-l-orange-500 hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">总金额</CardTitle>
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <DollarSign className="h-4 w-4 text-orange-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats.summary.totalAmount)}</div>
                <p className="text-xs text-muted-foreground mt-1">本级: {formatCurrency(stats.summary.selfAmount)} | 下级: {formatCurrency(stats.summary.subordinatesAmount)}</p>
                <div className="flex items-center mt-2">
                  <DollarSign className="h-3 w-3 text-orange-500 mr-1" />
                  <span className="text-xs text-orange-600">应收总额</span>
                </div>
              </CardContent>
            </Card>

            {/* 活跃项目 */}
            <Card className="relative overflow-hidden border-l-4 border-l-purple-500 hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">活跃项目</CardTitle>
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Briefcase className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats.summary.activeProjects}</div>
                <p className="text-xs text-muted-foreground mt-1">活跃司机: {stats.summary.activeDrivers}</p>
                <div className="flex items-center mt-2">
                  <Users className="h-3 w-3 text-purple-500 mr-1" />
                  <span className="text-xs text-purple-600">活跃资源</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 待处理事项概览 - 美化版 */}
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                待处理事项
                <Badge variant="secondary" className="ml-auto bg-amber-100 text-amber-700 border-amber-200">
                  需关注
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-blue-600">{stats.pending.pendingPayments}</div>
                  <p className="text-sm text-muted-foreground">待付款</p>
                  <Badge variant="outline" className="mt-2 bg-blue-50 text-blue-700 border-blue-200">
                    <Clock className="h-3 w-3 mr-1" />
                    待处理
                  </Badge>
                </div>
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-purple-600">{stats.pending.pendingInvoices}</div>
                  <p className="text-sm text-muted-foreground">待开票</p>
                  <Badge variant="outline" className="mt-2 bg-purple-50 text-purple-700 border-purple-200">
                    <FileText className="h-3 w-3 mr-1" />
                    需开票
                  </Badge>
                </div>
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-red-600">{stats.pending.overduePayments}</div>
                  <p className="text-sm text-muted-foreground">逾期付款</p>
                  <Badge variant="outline" className="mt-2 bg-red-50 text-red-700 border-red-200">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    逾期
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 图表区域 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 本级/下级对比 */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  本级 vs 下级对比
                  <Badge variant="secondary" className="ml-auto">数据对比</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80 p-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={levelComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      tickLine={{ stroke: '#6b7280' }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickLine={{ stroke: '#6b7280' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'amount') return [formatCurrency(value), '金额'];
                        if (name === 'weight') return [formatWeight(value), '重量'];
                        return [formatNumber(value), '运单数'];
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="records" 
                      fill="url(#blueGradient)" 
                      name="运单数"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar 
                      dataKey="amount" 
                      fill="url(#orangeGradient)" 
                      name="金额"
                      radius={[6, 6, 0, 0]}
                    />
                    <defs>
                      <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#1d4ed8" />
                      </linearGradient>
                      <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#ea580c" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 下级货主排名 */}
            {subordinatesChartData.length > 0 && (
              <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-emerald-600" />
                    下级货主排名 (Top 10)
                    <Badge variant="secondary" className="ml-auto">合作伙伴</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-80 p-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subordinatesChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        type="number" 
                        tickFormatter={formatCurrency}
                        tick={{ fontSize: 12 }}
                        tickLine={{ stroke: '#6b7280' }}
                      />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={100} 
                        tick={{ fontSize: 11 }}
                        tickLine={{ stroke: '#6b7280' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value: number) => [formatCurrency(value), '总金额']}
                        labelFormatter={(value: string) => {
                          const item = subordinatesChartData.find(d => d.name === value);
                          return item?.full_name || value;
                        }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="amount" 
                        fill="url(#greenGradient)" 
                        name="总金额"
                        radius={[0, 6, 6, 0]}
                      />
                      <defs>
                        <linearGradient id="greenGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 下级货主列表 - 美化版 */}
          {subordinates.length > 0 && (
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-blue-50">
                <CardTitle className="flex items-center gap-2">
                  <TreePine className="h-5 w-5 text-emerald-600" />
                  下级货主详情
                  <Badge variant="outline" className="ml-auto bg-emerald-50 text-emerald-700 border-emerald-200">
                    {subordinates.length} 个货主
                  </Badge>
                </CardTitle>
                <CardDescription>下级货主的详细运单统计信息</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="font-semibold">货主名称</TableHead>
                        <TableHead className="font-semibold">层级</TableHead>
                        <TableHead className="font-semibold">运单数</TableHead>
                        <TableHead className="font-semibold">总重量</TableHead>
                        <TableHead className="font-semibold">总金额</TableHead>
                        <TableHead className="font-semibold">活跃项目</TableHead>
                        <TableHead className="font-semibold">待付款</TableHead>
                        <TableHead className="font-semibold">待开票</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subordinates.map((shipper, index) => (
                        <TableRow key={shipper.shipper_id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <TableCell className="font-medium">{shipper.shipper_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              第{shipper.hierarchy_depth}级
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-blue-600">{formatNumber(shipper.record_count)}</TableCell>
                          <TableCell className="font-semibold text-green-600">{formatWeight(shipper.total_weight)}</TableCell>
                          <TableCell className="font-semibold text-orange-600">{formatCurrency(shipper.total_amount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              {shipper.active_projects}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              {shipper.pending_payments}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {shipper.pending_invoices}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
