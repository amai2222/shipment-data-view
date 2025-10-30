import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Loader2, Banknote, TrendingUp, DollarSign, FileText, AlertCircle, CheckCircle, Clock, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

// --- 类型定义 ---
interface FinancialStats { totalReceivables: number; monthlyReceivables: number; pendingPayment: number; pendingInvoice: number; }
interface MonthlyTrendData { month_start: string; total_receivables: number; }
interface PartnerRankingData { partner_name: string; total_payable: number; }
interface ProjectContributionData { project_name: string; total_receivables: number; }
interface LogisticsRecordDetail { id: string; auto_number: string; project_name: string; driver_name: string; license_plate: string | null; loading_location: string; unloading_location: string; loading_weight: number | null; unloading_weight: number | null; transport_type: string | null; payable_cost: number | null; remarks: string | null; }
interface DetailFilter { type: string; value: string; }
interface DialogPagination { currentPage: number; totalPages: number; totalCount: number; }

// --- 常量 ---
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];
const PAGE_SIZE = 30;
const PIE_CHART_AGGREGATION_THRESHOLD = 0.03;

// --- 主组件 ---
export default function FinancialOverview() {
  // --- State 管理 ---
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendData[]>([]);
  const [partnerRanking, setPartnerRanking] = useState<PartnerRankingData[]>([]);
  const [projectContribution, setProjectContribution] = useState<ProjectContributionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useLogScale, setUseLogScale] = useState(true);
  
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [detailFilter, setDetailFilter] = useState<DetailFilter | null>(null);
  const [dialogRecords, setDialogRecords] = useState<LogisticsRecordDetail[]>([]);
  const [isDialogLoading, setIsDialogLoading] = useState(false);
  const [dialogPagination, setDialogPagination] = useState<DialogPagination>({ currentPage: 1, totalPages: 1, totalCount: 0 });

  // --- 数据获取 ---
  const fetchAllDataInOneGo = useCallback(async () => { 
    setLoading(true); 
    setError(null); 
    try { 
      // 获取基础统计数据
      const [totalReceivables, monthlyReceivables, pendingPayment, pendingInvoice] = await Promise.all([
        supabase.rpc('get_total_receivables'),
        supabase.rpc('get_monthly_receivables'),
        supabase.rpc('get_pending_payments'),
        supabase.rpc('get_pending_invoicing')
      ]);
      
      setStats({
        totalReceivables: totalReceivables.data || 0,
        monthlyReceivables: monthlyReceivables.data || 0,
        pendingPayment: pendingPayment.data || 0,
        pendingInvoice: pendingInvoice.data || 0
      });

      // 获取月度趋势数据
      const { data: trendsData } = await supabase.rpc('get_monthly_trends');
      setMonthlyTrend(trendsData || []);

      // 获取合作方排名数据
      const { data: rankingData } = await supabase.rpc('get_partner_ranking');
      setPartnerRanking(rankingData || []);

      // 获取项目贡献数据（暂时为空，可后续添加函数）
      setProjectContribution([]);
    } catch (err: any) { 
      console.error("获取财务概览数据失败:", err); 
      setError(err.message || "发生未知错误，请检查浏览器控制台。"); 
    } finally { 
      setLoading(false); 
    } 
  }, []);
  const fetchDialogRecords = useCallback(async () => { 
    if (!detailFilter) return; 
    setIsDialogLoading(true); 
    try { 
      // 简化明细查询，直接查询 logistics_records 表
      const { data, error } = await supabase
        .from('logistics_records')
        .select('id, auto_number, project_name, driver_name, license_plate, loading_location, unloading_location, loading_weight, unloading_weight, transport_type, payable_cost, remarks')
        .range((dialogPagination.currentPage - 1) * PAGE_SIZE, dialogPagination.currentPage * PAGE_SIZE - 1);
      
      if (error) throw error;
      
      setDialogRecords(data || []); 
      setDialogPagination(prev => ({ ...prev, totalCount: data?.length || 0, totalPages: Math.ceil((data?.length || 0) / PAGE_SIZE) || 1 })); 
    } catch (err: any) { 
      console.error("获取明细数据失败:", err); 
    } finally { 
      setIsDialogLoading(false); 
    } 
  }, [detailFilter, dialogPagination.currentPage]);

  // --- Effects ---
  useEffect(() => { fetchAllDataInOneGo(); const handleVisibilityChange = () => { if (document.visibilityState === 'visible') { fetchAllDataInOneGo(); } }; document.addEventListener('visibilitychange', handleVisibilityChange); return () => document.removeEventListener('visibilitychange', handleVisibilityChange); }, [fetchAllDataInOneGo]);
  useEffect(() => { if (isDetailDialogOpen && detailFilter) { fetchDialogRecords(); } }, [isDetailDialogOpen, detailFilter, dialogPagination.currentPage, fetchDialogRecords]);

  // --- 事件处理器 ---
  const handleChartClick = (type: string, payload: any) => { let value = payload?.activePayload?.[0]?.payload?.name ?? payload?.activePayload?.[0]?.payload?.partner_name ?? payload?.activePayload?.[0]?.payload?.project_name ?? payload?.activePayload?.[0]?.payload?.month_start; if (!value && payload.value) { value = payload.value; } if (value && value !== '其它') { setDetailFilter({ type, value: String(value) }); setDialogPagination({ currentPage: 1, totalPages: 1, totalCount: 0 }); setIsDetailDialogOpen(true); } };

  // --- 辅助函数 ---
  const formatCurrency = (value: number | null | undefined) => `¥${(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatCompact = (value: number) => { if (value >= 10000) return `¥${(value/10000).toFixed(1)}万`; if (value >= 1000) return `¥${(value/1000).toFixed(1)}千`; return `¥${value.toFixed(0)}`; }

  // --- 派生数据 ---
  const aggregatePieData = (data: any[], nameKey: string, dataKey: string) => { const total = data.reduce((sum, item) => sum + item[dataKey], 0); if (total === 0) return []; const mainItems = data.filter(item => (item[dataKey] / total) >= PIE_CHART_AGGREGATION_THRESHOLD); const otherItems = data.filter(item => (item[dataKey] / total) < PIE_CHART_AGGREGATION_THRESHOLD); if (otherItems.length > 1) { const otherSum = otherItems.reduce((sum, item) => sum + item[dataKey], 0); return [...mainItems, { [nameKey]: '其它', [dataKey]: otherSum }]; } return data; };
  const financialStatusData = useMemo(() => stats ? aggregatePieData([ { name: '待开票', value: stats.pendingInvoice }, { name: '待付款', value: stats.pendingPayment }, { name: '已支付', value: Math.max(0, stats.totalReceivables - stats.pendingInvoice - stats.pendingPayment) } ].filter(item => item.value > 0), 'name', 'value') : [], [stats]);
  const aggregatedProjectData = useMemo(() => aggregatePieData(projectContribution, 'project_name', 'total_receivables'), [projectContribution]);

  // --- 渲染 ---
  if (loading && !stats) { return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><span className="ml-4 text-lg text-muted-foreground">正在加载财务数据...</span></div>; }
  if (error) { return <div className="flex flex-col justify-center items-center h-screen text-center p-4"><h2 className="text-xl font-semibold text-destructive">数据加载失败</h2><p className="mt-2 text-sm text-muted-foreground max-w-md">无法获取财务概览数据，这可能是由于数据库权限或函数错误导致的。</p><code className="mt-4 p-2 bg-muted text-muted-foreground rounded-md text-xs">{error}</code></div> }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {loading && <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex justify-center items-center z-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
      
      <PageHeader 
        title="财务看板" 
        description="运输财务统计分析"
        icon={Banknote}
        iconColor="text-green-600"
      />

      <div className="space-y-6">
        {/* 核心财务指标 - 美化版 */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* 总应收 */}
          <Card className="relative overflow-hidden border-l-4 border-l-blue-500 hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">总应收</CardTitle>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats?.totalReceivables || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">我司应收总额</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-600">累计收入</span>
              </div>
            </CardContent>
          </Card>

          {/* 本月应收 */}
          <Card className="relative overflow-hidden border-l-4 border-l-green-500 hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">本月应收</CardTitle>
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats?.monthlyReceivables || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">我司本月应收</p>
              <div className="flex items-center mt-2">
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-600">本月增长</span>
              </div>
            </CardContent>
          </Card>

          {/* 待付金额 */}
          <Card className="relative overflow-hidden border-l-4 border-l-orange-500 hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">待付金额</CardTitle>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="h-4 w-4 text-orange-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats?.pendingPayment || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">甲方待付总额</p>
              <div className="flex items-center mt-2">
                <AlertCircle className="h-3 w-3 text-orange-500 mr-1" />
                <span className="text-xs text-orange-600">待收款项</span>
              </div>
            </CardContent>
          </Card>

          {/* 待开票 */}
          <Card className="relative overflow-hidden border-l-4 border-l-purple-500 hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">待开票</CardTitle>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats?.pendingInvoice || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">我司待开票总额</p>
              <div className="flex items-center mt-2">
                <FileText className="h-3 w-3 text-purple-500 mr-1" />
                <span className="text-xs text-purple-600">需开票金额</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 财务状态概览 */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-blue-600" />
              财务状态概览
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-green-600">{formatCurrency(stats?.totalReceivables ? stats.totalReceivables - (stats.pendingPayment + stats.pendingInvoice) : 0)}</div>
                <p className="text-sm text-muted-foreground">已收款项</p>
                <Badge variant="outline" className="mt-2 bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  正常
                </Badge>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats?.pendingPayment || 0)}</div>
                <p className="text-sm text-muted-foreground">待收款项</p>
                <Badge variant="outline" className="mt-2 bg-orange-50 text-orange-700 border-orange-200">
                  <Clock className="h-3 w-3 mr-1" />
                  待处理
                </Badge>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats?.pendingInvoice || 0)}</div>
                <p className="text-sm text-muted-foreground">待开票金额</p>
                <Badge variant="outline" className="mt-2 bg-purple-50 text-purple-700 border-purple-200">
                  <FileText className="h-3 w-3 mr-1" />
                  需开票
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 图表控制面板 */}
        <Card className="bg-gradient-to-r from-gray-50 to-blue-50 border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch id="log-scale-switch" checked={useLogScale} onCheckedChange={setUseLogScale} />
                  <Label htmlFor="log-scale-switch" className="cursor-pointer font-medium">对数刻度</Label>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  数据可视化
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">当数值差异过大时，对数刻度可让您同时看清极大值和极小值</p>
            </div>
          </CardContent>
        </Card>

        {/* 图表区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 月度应收趋势图 */}
          <Card className="col-span-1 lg:col-span-2 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                月度应收趋势 (最近12个月)
                <Badge variant="secondary" className="ml-auto">趋势分析</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="h-80 p-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} onClick={(payload) => handleChartClick('monthly_trend', payload)} className="cursor-pointer">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="month_start" 
                    tick={{ fontSize: 12 }}
                    tickLine={{ stroke: '#6b7280' }}
                  />
                  <YAxis 
                    tickFormatter={formatCompact} 
                    scale={useLogScale ? "log" : "auto"} 
                    domain={useLogScale ? [0.1, 'dataMax'] : [0, 'dataMax']} 
                    allowDataOverflow
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
                    formatter={(value: number) => [formatCurrency(value), '应收款']} 
                  />
                  <Legend onClick={(payload) => handleChartClick('monthly_trend', payload)} formatter={() => '应收款'}/>
                  <Bar 
                    dataKey="total_receivables" 
                    fill="url(#blueGradient)" 
                    radius={[6, 6, 0, 0]}
                    className="hover:opacity-80 transition-opacity duration-200"
                  />
                  <defs>
                    <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 合作方应付金额排名 */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                合作方应付金额排名 (Top 10)
                <Badge variant="secondary" className="ml-auto">合作伙伴</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="h-96 p-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={partnerRanking} layout="vertical" onClick={(payload) => handleChartClick('partner_ranking', payload)} className="cursor-pointer">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    type="number" 
                    tickFormatter={formatCompact} 
                    scale={useLogScale ? "log" : "auto"} 
                    domain={useLogScale ? [0.1, 'dataMax'] : [0, 'dataMax']} 
                    allowDataOverflow
                    tick={{ fontSize: 12 }}
                    tickLine={{ stroke: '#6b7280' }}
                  />
                  <YAxis 
                    dataKey="partner_name" 
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
                    formatter={(value: number) => [formatCurrency(value), '应付总额']} 
                  />
                  <Legend onClick={(payload) => handleChartClick('partner_ranking', payload)} formatter={() => '应付总额'}/>
                  <Bar 
                    dataKey="total_payable" 
                    fill="url(#greenGradient)" 
                    radius={[0, 6, 6, 0]}
                    className="hover:opacity-80 transition-opacity duration-200"
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

          {/* 财务状态分布 */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                财务状态分布
                <Badge variant="secondary" className="ml-auto">状态分析</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="h-96 p-6">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={financialStatusData} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={70} 
                    outerRadius={120} 
                    labelLine={false} 
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    className="hover:opacity-80 transition-opacity duration-200"
                  >
                    {financialStatusData.map((entry, index) => ( 
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                        onClick={() => handleChartClick('financial_status', { activePayload: [{ payload: entry }] })} 
                        className="cursor-pointer hover:opacity-80 transition-opacity duration-200"
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: number) => formatCurrency(value)} 
                  />
                  <Legend onClick={(payload) => handleChartClick('financial_status', payload)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
      </div>
      
        {/* 项目应收贡献度 */}
        {aggregatedProjectData.length > 0 && (
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                项目应收贡献度
                <Badge variant="secondary" className="ml-auto">项目分析</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="h-96 p-6">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={aggregatedProjectData} 
                    dataKey="total_receivables" 
                    nameKey="project_name" 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={140} 
                    label={(props) => `${props.project_name} (${formatCompact(props.total_receivables)})`}
                    className="hover:opacity-80 transition-opacity duration-200"
                  >
                    {aggregatedProjectData.map((entry, index) => ( 
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                        onClick={() => handleChartClick('project_contribution', { activePayload: [{ payload: entry }] })} 
                        className="cursor-pointer hover:opacity-80 transition-opacity duration-200"
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: number) => formatCurrency(value)} 
                  />
                  <Legend onClick={(payload) => handleChartClick('project_contribution', payload)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      
        {/* 运单明细对话框 */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
            <DialogHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 -m-6 mb-0 p-6">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                运单明细: {detailFilter?.value}
                <Badge variant="outline" className="ml-auto bg-blue-50 text-blue-700 border-blue-200">
                  {dialogPagination.totalCount} 条记录
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                点击图表查看详细运单信息，支持分页浏览
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-grow overflow-y-auto p-6">
              {isDialogLoading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600"/>
                    <p className="text-muted-foreground">正在加载运单明细...</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="font-semibold">运单号</TableHead>
                        <TableHead className="font-semibold">项目</TableHead>
                        <TableHead className="font-semibold">司机</TableHead>
                        <TableHead className="font-semibold">车牌</TableHead>
                        <TableHead className="font-semibold">装货地</TableHead>
                        <TableHead className="font-semibold">卸货地</TableHead>
                        <TableHead className="font-semibold">装货重</TableHead>
                        <TableHead className="font-semibold">卸货重</TableHead>
                        <TableHead className="font-semibold">类型</TableHead>
                        <TableHead className="font-semibold text-right">司机应收</TableHead>
                        <TableHead className="font-semibold">备注</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dialogRecords.length > 0 ? dialogRecords.map((r, index) => (
                        <TableRow key={r.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <TableCell className="font-medium">{r.auto_number}</TableCell>
                          <TableCell>{r.project_name}</TableCell>
                          <TableCell>{r.driver_name}</TableCell>
                          <TableCell>{r.license_plate || '-'}</TableCell>
                          <TableCell>{r.loading_location}</TableCell>
                          <TableCell>{r.unloading_location}</TableCell>
                          <TableCell>{r.loading_weight || '-'}</TableCell>
                          <TableCell>{r.unloading_weight || '-'}</TableCell>
                          <TableCell>{r.transport_type || '-'}</TableCell>
                          <TableCell className="text-right font-semibold text-green-600">{formatCurrency(r.payable_cost)}</TableCell>
                          <TableCell className="text-muted-foreground">{r.remarks || '-'}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            没有找到相关记录
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            
            {dialogPagination.totalPages > 1 && (
              <div className="border-t p-4 bg-gray-50">
                <Pagination>
                  <PaginationContent className="justify-center">
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#" 
                        onClick={(e) => { 
                          e.preventDefault(); 
                          setDialogPagination(p => ({...p, currentPage: Math.max(1, p.currentPage - 1)})); 
                        }} 
                        className={dialogPagination.currentPage === 1 ? "pointer-events-none opacity-50" : ""} 
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink isActive>
                        {dialogPagination.currentPage} / {dialogPagination.totalPages}
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext 
                        href="#" 
                        onClick={(e) => { 
                          e.preventDefault(); 
                          setDialogPagination(p => ({...p, currentPage: Math.min(p.totalPages, p.currentPage + 1)})); 
                        }} 
                        className={dialogPagination.currentPage === dialogPagination.totalPages ? "pointer-events-none opacity-50" : ""} 
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
