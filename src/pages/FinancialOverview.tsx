import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Loader2 } from "lucide-react";

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
  const fetchAllDataInOneGo = useCallback(async () => { setLoading(true); setError(null); try { const { data, error: rpcError } = await supabase.rpc('get_financial_overview'); if (rpcError) throw rpcError; if (!data) throw new Error("函数返回了空数据，请检查数据库函数逻辑。"); setStats(data.stats || null); setMonthlyTrend(data.monthlyTrend || []); setPartnerRanking(data.partnerRanking || []); setProjectContribution(data.projectContribution || []); } catch (err: any) { console.error("获取财务概览数据失败:", err); setError(err.message || "发生未知错误，请检查浏览器控制台。"); } finally { setLoading(false); } }, []);
  const fetchDialogRecords = useCallback(async () => { if (!detailFilter) return; setIsDialogLoading(true); try { const { data, error: rpcError } = await supabase.rpc('get_detailed_records_for_chart', { p_filter_type: detailFilter.type, p_filter_value: detailFilter.value, p_page_size: PAGE_SIZE, p_page_number: dialogPagination.currentPage }); if (rpcError) throw rpcError; setDialogRecords(data.records || []); const totalCount = data.total_count || 0; setDialogPagination(prev => ({ ...prev, totalCount, totalPages: Math.ceil(totalCount / PAGE_SIZE) || 1 })); } catch (err: any) { console.error("获取明细数据失败:", err); } finally { setIsDialogLoading(false); } }, [detailFilter, dialogPagination.currentPage]);

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
    <div className="space-y-6 p-4 md:p-6 relative">
      {loading && <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex justify-center items-center z-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
      
      <div><h1 className="text-3xl font-bold text-foreground">财务概览</h1><p className="text-muted-foreground">运输财务统计分析</p></div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm font-medium">总应收</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats?.totalReceivables || 0)}</div><p className="text-xs text-muted-foreground">我司应收总额</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">本月应收</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats?.monthlyReceivables || 0)}</div><p className="text-xs text-muted-foreground">我司本月应收</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">待付金额</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats?.pendingPayment || 0)}</div><p className="text-xs text-muted-foreground">甲方待付总额</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">待开票</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats?.pendingInvoice || 0)}</div><p className="text-xs text-muted-foreground">我司待开票总额</p></CardContent></Card>
      </div>

      <div className="flex items-center space-x-2 my-4 p-4 border rounded-lg bg-muted/50">
        <Switch id="log-scale-switch" checked={useLogScale} onCheckedChange={setUseLogScale} />
        <Label htmlFor="log-scale-switch" className="cursor-pointer">为柱状图/条形图启用对数刻度</Label>
        <p className="text-xs text-muted-foreground ml-4">（当数值差异过大时，此功能可让您同时看清极大值和极小值）</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          {/* 【修改1】图表标题 */}
          <CardHeader><CardTitle>月度应收 (最近12个月)</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} onClick={(payload) => handleChartClick('monthly_trend', payload)} className="cursor-pointer">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month_start" />
                <YAxis tickFormatter={formatCompact} scale={useLogScale ? "log" : "auto"} domain={useLogScale ? [0.1, 'dataMax'] : [0, 'dataMax']} allowDataOverflow />
                {/* 【修改2】Tooltip 说明文字 */}
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }} formatter={(value: number) => [formatCurrency(value), '应收款']} />
                {/* 【修改2】图例说明文字 */}
                <Legend onClick={(payload) => handleChartClick('monthly_trend', payload)} formatter={() => '应收款'}/>
                <Bar dataKey="total_receivables" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>合作方应付金额排名 (Top 10)</CardTitle></CardHeader>
          <CardContent className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={partnerRanking} layout="vertical" onClick={(payload) => handleChartClick('partner_ranking', payload)} className="cursor-pointer">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={formatCompact} scale={useLogScale ? "log" : "auto"} domain={useLogScale ? [0.1, 'dataMax'] : [0, 'dataMax']} allowDataOverflow />
                <YAxis dataKey="partner_name" type="category" width={80} tick={{ fontSize: 12 }}/>
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }} formatter={(value: number) => [formatCurrency(value), '应付总额']} />
                <Legend onClick={(payload) => handleChartClick('partner_ranking', payload)} formatter={() => '应付总额'}/>
                <Bar dataKey="total_payable" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>财务状态分布</CardTitle></CardHeader>
          <CardContent className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={financialStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={120} labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {financialStatusData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} onClick={() => handleChartClick('financial_status', { activePayload: [{ payload: entry }] })} className="cursor-pointer"/> ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend onClick={(payload) => handleChartClick('financial_status', payload)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {aggregatedProjectData.length > 0 && (
          <Card>
              <CardHeader><CardTitle>项目应收贡献度</CardTitle></CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={aggregatedProjectData} dataKey="total_receivables" nameKey="project_name" cx="50%" cy="50%" outerRadius={150} label={(props) => `${props.project_name} (${formatCompact(props.total_receivables)})`}>
                            {aggregatedProjectData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} onClick={() => handleChartClick('project_contribution', { activePayload: [{ payload: entry }] })} className="cursor-pointer"/> ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend onClick={(payload) => handleChartClick('project_contribution', payload)} />
                    </PieChart>
                </ResponsiveContainer>
              </CardContent>
          </Card>
      )}
      
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>运单明细: {detailFilter?.value}</DialogTitle>
            <DialogDescription>共找到 {dialogPagination.totalCount} 条相关记录。</DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto">
            {isDialogLoading ? <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div> :
              <Table>
                <TableHeader>
                  <TableRow><TableHead>运单号</TableHead><TableHead>项目</TableHead><TableHead>司机</TableHead><TableHead>车牌</TableHead><TableHead>装货地</TableHead><TableHead>卸货地</TableHead><TableHead>装货重</TableHead><TableHead>卸货重</TableHead><TableHead>类型</TableHead><TableHead>司机应收</TableHead><TableHead>备注</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {dialogRecords.length > 0 ? dialogRecords.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.auto_number}</TableCell><TableCell>{r.project_name}</TableCell><TableCell>{r.driver_name}</TableCell><TableCell>{r.license_plate || '-'}</TableCell><TableCell>{r.loading_location}</TableCell><TableCell>{r.unloading_location}</TableCell><TableCell>{r.loading_weight}</TableCell><TableCell>{r.unloading_weight}</TableCell><TableCell>{r.transport_type}</TableCell><TableCell>{formatCurrency(r.payable_cost)}</TableCell><TableCell>{r.remarks || '-'}</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={11} className="text-center">没有找到记录</TableCell></TableRow>}
                </TableBody>
              </Table>
            }
          </div>
          {dialogPagination.totalPages > 1 &&
            <Pagination className="pt-4"><PaginationContent>
              <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setDialogPagination(p => ({...p, currentPage: Math.max(1, p.currentPage - 1)})); }} className={dialogPagination.currentPage === 1 ? "pointer-events-none opacity-50" : ""} /></PaginationItem>
              <PaginationItem><PaginationLink isActive>{dialogPagination.currentPage}</PaginationLink> / {dialogPagination.totalPages}</PaginationItem>
              <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); setDialogPagination(p => ({...p, currentPage: Math.min(p.totalPages, p.currentPage + 1)})); }} className={dialogPagination.currentPage === dialogPagination.totalPages ? "pointer-events-none opacity-50" : ""} /></PaginationItem>
            </PaginationContent></Pagination>
          }
        </DialogContent>
      </Dialog>
    </div>
  );
}
