// 货主看板 - 移动端
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import {
  Package,
  Weight,
  DollarSign,
  Briefcase,
  Users,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  Building2,
  Calendar,
  Eye
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

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
  return `¥${num.toLocaleString('zh-CN')}`;
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

  const currentShipperId = user?.partnerId || null;

  const loadData = async () => {
    if (!currentShipperId) {
      toast({
        title: '权限错误',
        description: '您不是货主用户',
        variant: 'destructive'
      });
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
      setStats(statsData);

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
      setSubordinates(subordinatesData || []);

      // 加载趋势数据
      const { data: trendDataResult, error: trendError } = await supabase.rpc(
        'get_shipper_trend_data',
        {
          p_shipper_id: currentShipperId,
          p_days: dateRange === '7days' ? 7 : 30
        }
      );

      if (trendError) throw trendError;
      setTrendData(trendDataResult || []);

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
  };

  useEffect(() => {
    loadData();
  }, [dateRange, currentShipperId]);

  if (!currentShipperId) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-screen p-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                权限不足
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                您不是货主用户，无法访问货主看板。
              </p>
            </CardContent>
          </Card>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-4 p-4 pb-20">
        {/* 顶部信息卡片 */}
        <Card className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white border-0 shadow-lg">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">货主看板</h1>
                  <p className="text-sm text-blue-100">数据总览</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={loadData}
                className="text-white hover:bg-white/20"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* 时间筛选 */}
            <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
              <SelectTrigger className="bg-white/20 border-white/30 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">最近7天</SelectItem>
                <SelectItem value="30days">最近30天</SelectItem>
              </SelectContent>
            </Select>

            {/* 今日数据 */}
            {!isLoading && stats && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
                <div className="text-center">
                  <div className="text-2xl font-bold">{formatNumber(stats.summary.totalRecords)}</div>
                  <div className="text-xs text-blue-100 mt-1">运单总数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{formatWeight(stats.summary.totalWeight)}</div>
                  <div className="text-xs text-blue-100 mt-1">总重量</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{formatCurrency(stats.summary.totalAmount)}</div>
                  <div className="text-xs text-blue-100 mt-1">总金额</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 加载中 */}
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* 统计卡片 */}
        {!isLoading && stats && (
          <>
            {/* 待处理事项 */}
            {(stats.pending.pendingPayments > 0 || stats.pending.pendingInvoices > 0) && (
              <Card className="border-l-4 border-l-amber-500 bg-amber-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-amber-900 mb-2">待处理事项</h3>
                      <div className="space-y-1 text-sm text-amber-700">
                        <div>待付款: {stats.pending.pendingPayments}</div>
                        <div>待开票: {stats.pending.pendingInvoices}</div>
                        {stats.pending.overduePayments > 0 && (
                          <div className="text-red-600 font-semibold">
                            逾期付款: {stats.pending.overduePayments}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 统计网格 */}
            <div className="grid grid-cols-2 gap-4">
              {/* 活跃项目 */}
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                      <Briefcase className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-green-900">
                    {stats.summary.activeProjects}
                  </div>
                  <div className="text-sm text-green-700 mt-1">活跃项目</div>
                </CardContent>
              </Card>

              {/* 合作司机 */}
              <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-orange-900">
                    {stats.summary.activeDrivers}
                  </div>
                  <div className="text-sm text-orange-700 mt-1">合作司机</div>
                </CardContent>
              </Card>
            </div>

            {/* 本级/下级对比 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">本级 vs 下级</CardTitle>
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
            </Card>

            {/* 趋势图表 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  运单趋势
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData}>
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'MM/dd')}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value as string), 'MM月dd日')}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="total_count" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 下级货主列表 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    下级货主
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
                  {subordinates.length > 0 ? (
                    subordinates.map((shipper) => (
                      <div 
                        key={shipper.shipper_id}
                        className="p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-semibold text-sm">{shipper.shipper_name}</div>
                            {shipper.parent_name && (
                              <div className="text-xs text-muted-foreground mt-1">
                                上级: {shipper.parent_name}
                              </div>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            第{shipper.hierarchy_depth + 1}级
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-sm font-semibold text-blue-600">
                              {formatNumber(shipper.record_count)}
                            </div>
                            <div className="text-xs text-muted-foreground">运单</div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-green-600">
                              {formatWeight(shipper.total_weight)}
                            </div>
                            <div className="text-xs text-muted-foreground">重量</div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-purple-600">
                              {formatCurrency(shipper.total_amount)}
                            </div>
                            <div className="text-xs text-muted-foreground">金额</div>
                          </div>
                        </div>

                        {showDetails && (
                          <div className="grid grid-cols-3 gap-2 text-center mt-3 pt-3 border-t">
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
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      暂无下级货主数据
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MobileLayout>
  );
}

