// 货主看板 - 移动端（美化版，参考移动端财务看板设计）
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useAuth } from '@/contexts/AuthContext';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileCard } from '@/components/mobile/MobileCard';
import {
  Package,
  Weight,
  DollarSign,
  Briefcase,
  Users,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Building2,
  Calendar,
  TreePine,
  CheckCircle,
  Clock,
  FileText,
  ArrowUpRight,
  Loader2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { format } from 'date-fns';

// 复用桌面端的类型定义
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
}

interface SubordinateShipper {
  shipper_id: string;
  shipper_name: string;
  hierarchy_depth: number;
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
  total_count: number;
  total_amount: number;
}

// 格式化函数
const formatNumber = (num: number) => {
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
  return num.toLocaleString('zh-CN');
};

const formatCurrency = (num: number) => {
  if (num >= 10000) return `¥${(num / 10000).toFixed(1)}万`;
  return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatWeight = (num: number) => `${num.toFixed(1)}吨`;

export default function MobileShipperDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ShipperDashboardStats | null>(null);
  const [subordinates, setSubordinates] = useState<SubordinateShipper[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [dateRange, setDateRange] = useState<'7days' | '30days'>('7days');
  const [showDetails, setShowDetails] = useState(false);
  const [availableShippers, setAvailableShippers] = useState<Array<{id: string, name: string}>>([]);
  const [selectedShipperId, setSelectedShipperId] = useState<string | null>(null);

  // 判断用户类型和权限
  const userRole = user?.role || 'viewer';
  const isPartnerRole = userRole === 'partner';
  const currentShipperId = isPartnerRole ? null : selectedShipperId;

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
      
      // 默认选择第一个
      if (!selectedShipperId && data && data.length > 0) {
        setSelectedShipperId(data[0].id);
      }
    } catch (error: any) {
      console.error('加载货主列表失败:', error);
    }
  }, [isPartnerRole, selectedShipperId]);

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
      const today = new Date();
      const startDate = dateRange === '7days' 
        ? new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        : new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const dates = {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd')
      };

      // 加载统计数据
      const { data: statsData, error: statsError } = await supabase.rpc(
        'get_shipper_dashboard_stats',
        {
          p_shipper_id: currentShipperId,
          p_start_date: dates.startDate,
          p_end_date: dates.endDate,
          p_include_self: true,
          p_include_subordinates: true
        }
      );

      if (statsError) throw statsError;
      setStats(statsData as unknown as ShipperDashboardStats);

      // 加载下级货主
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

      // 加载趋势数据（如果函数存在）
      try {
        const { data: trendDataResult, error: trendError } = await supabase.rpc(
          'get_shipper_trend_data',
          {
            p_shipper_id: currentShipperId,
            p_days: dateRange === '7days' ? 7 : 30
          }
        );

        if (!trendError && trendDataResult) {
          setTrendData(trendDataResult || []);
        }
      } catch (trendErr) {
        // 趋势数据函数可能不存在，忽略错误
        console.log('趋势数据加载失败（忽略）:', trendErr);
      }

    } catch (error: any) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [isPartnerRole, currentShipperId, dateRange, toast]);

  // 初始加载可用货主列表
  useEffect(() => {
    if (!isPartnerRole) {
      loadAvailableShippers();
    }
  }, [isPartnerRole, loadAvailableShippers]);

  useEffect(() => {
    if (currentShipperId) {
      loadData();
    }
  }, [dateRange, currentShipperId, loadData]);

  // 合作方角色：暂时不支持
  if (isPartnerRole) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-screen p-4">
          <Card className="w-full">
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
      </MobileLayout>
    );
  }

  // 非合作方角色但没有可用货主
  if (!isPartnerRole && availableShippers.length === 0 && !isLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-screen p-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                暂无数据
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                系统中还没有货主数据，请先添加货主类型的合作方。
              </p>
            </CardContent>
          </Card>
        </div>
      </MobileLayout>
    );
  }

  if (isLoading && !stats) {
    return (
      <MobileLayout>
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  // 计算图表数据
  const levelComparisonData = stats ? [
    { name: '本级', records: stats.summary.selfRecords, amount: stats.summary.selfAmount },
    { name: '下级', records: stats.summary.subordinatesRecords, amount: stats.summary.subordinatesAmount }
  ] : [];

  return (
    <MobileLayout>
      <div className="space-y-4 pb-20">
        {/* 页面标题卡片 - 美化版（参考财务看板） */}
        <MobileCard>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl">
                  <TreePine className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">货主看板</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">数据统计和层级管理</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={loadData}
                disabled={isLoading}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 货主选择（非合作方角色显示） */}
            {!isPartnerRole && availableShippers.length > 0 && (
              <Select value={selectedShipperId || ''} onValueChange={setSelectedShipperId}>
                <SelectTrigger className="w-full">
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

            {/* 时间筛选 */}
            <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">最近7天</SelectItem>
                <SelectItem value="30days">最近30天</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </MobileCard>

        {/* 核心指标卡片 - 美化版（参考财务看板） */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <MobileCard>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">总运单数</p>
                    <p className="text-sm font-bold">{formatNumber(stats.summary.totalRecords)}</p>
                  </div>
                </div>
              </CardContent>
            </MobileCard>

            <MobileCard>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Weight className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">总重量</p>
                    <p className="text-sm font-bold">{formatWeight(stats.summary.totalWeight)}</p>
                  </div>
                </div>
              </CardContent>
            </MobileCard>

            <MobileCard>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <DollarSign className="h-4 w-4 text-orange-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">总金额</p>
                    <p className="text-sm font-bold">{formatCurrency(stats.summary.totalAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </MobileCard>

            <MobileCard>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Briefcase className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">活跃项目</p>
                    <p className="text-sm font-bold">{stats.summary.activeProjects}</p>
                  </div>
                </div>
              </CardContent>
            </MobileCard>
          </div>
        )}

        {/* 待处理事项 - 美化版 */}
        {stats && (stats.pending.pendingPayments > 0 || stats.pending.pendingInvoices > 0 || stats.pending.overduePayments > 0) && (
          <MobileCard className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-orange-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-3">待处理事项</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 bg-white rounded-lg">
                      <div className="text-lg font-bold text-blue-600">{stats.pending.pendingPayments}</div>
                      <div className="text-xs text-muted-foreground mt-1">待付款</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded-lg">
                      <div className="text-lg font-bold text-purple-600">{stats.pending.pendingInvoices}</div>
                      <div className="text-xs text-muted-foreground mt-1">待开票</div>
                    </div>
                    <div className="text-center p-2 bg-white rounded-lg">
                      <div className="text-lg font-bold text-red-600">{stats.pending.overduePayments}</div>
                      <div className="text-xs text-muted-foreground mt-1">逾期</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </MobileCard>
        )}

        {/* 本级/下级对比图表 - 美化版 */}
        {stats && levelComparisonData.length > 0 && (
          <MobileCard>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                本级 vs 下级
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={levelComparisonData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      tickFormatter={formatNumber}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === 'amount') return [formatCurrency(value), '金额'];
                        return [formatNumber(value), '运单数'];
                      }}
                    />
                    <Bar dataKey="records" fill="#3b82f6" name="运单数" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="amount" fill="#f97316" name="金额" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </MobileCard>
        )}

        {/* 统计详情 */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            {/* 活跃项目 */}
            <MobileCard className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                    <Briefcase className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-green-900">
                  {stats.summary.activeProjects}
                </div>
                <div className="text-sm text-green-700 mt-1">活跃项目</div>
              </CardContent>
            </MobileCard>

            {/* 合作司机 */}
            <MobileCard className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-orange-900">
                  {stats.summary.activeDrivers}
                </div>
                <div className="text-sm text-orange-700 mt-1">合作司机</div>
              </CardContent>
            </MobileCard>
          </div>
        )}

        {/* 本级/下级对比进度条 */}
        {stats && (
          <MobileCard>
            <CardHeader>
              <CardTitle className="text-base">层级数据分布</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>本级运单</span>
                  <span className="font-semibold">{formatNumber(stats.summary.selfRecords)}</span>
                </div>
                <Progress 
                  value={(stats.summary.selfRecords / stats.summary.totalRecords) * 100} 
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>下级运单</span>
                  <span className="font-semibold">{formatNumber(stats.summary.subordinatesRecords)}</span>
                </div>
                <Progress 
                  value={(stats.summary.subordinatesRecords / stats.summary.totalRecords) * 100} 
                  className="h-2"
                />
              </div>
            </CardContent>
          </MobileCard>
        )}

        {/* 趋势图表 */}
        {trendData.length > 0 && (
          <MobileCard>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                运单趋势
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'MM/dd')}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                    />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value as string), 'MM月dd日')}
                      formatter={(value: number) => formatNumber(value)}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="total_count" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={false}
                      name="运单数"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </MobileCard>
        )}

        {/* 下级货主列表 - 美化版 */}
        {subordinates.length > 0 && (
          <MobileCard>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  下级货主
                  <Badge variant="secondary" className="ml-2">
                    {subordinates.length}
                  </Badge>
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? '隐藏' : '详细'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {subordinates.map((shipper) => (
                  <div 
                    key={shipper.shipper_id}
                    className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="font-semibold text-base">{shipper.shipper_name}</div>
                        {shipper.parent_name && (
                          <div className="text-xs text-muted-foreground mt-1">
                            上级: {shipper.parent_name}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                        第{shipper.hierarchy_depth + 1}级
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-2 bg-white rounded">
                        <div className="text-sm font-semibold text-blue-600">
                          {formatNumber(shipper.record_count)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">运单</div>
                      </div>
                      <div className="p-2 bg-white rounded">
                        <div className="text-sm font-semibold text-green-600">
                          {formatWeight(shipper.total_weight)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">重量</div>
                      </div>
                      <div className="p-2 bg-white rounded">
                        <div className="text-sm font-semibold text-purple-600">
                          {formatCurrency(shipper.total_amount)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">金额</div>
                      </div>
                    </div>

                    {showDetails && (
                      <div className="grid grid-cols-3 gap-2 text-center mt-3 pt-3 border-t border-gray-200">
                        <div>
                          <div className="text-xs text-muted-foreground">项目</div>
                          <div className="text-sm font-semibold">
                            {shipper.active_projects}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">待付款</div>
                          <div className="text-sm font-semibold text-amber-600">
                            {shipper.pending_payments}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">待开票</div>
                          <div className="text-sm font-semibold text-blue-600">
                            {shipper.pending_invoices}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </MobileCard>
        )}
      </div>
    </MobileLayout>
  );
}
