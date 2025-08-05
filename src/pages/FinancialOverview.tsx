import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Loader2 } from "lucide-react";

// --- 类型定义 ---
interface FinancialStats { totalReceivables: number; monthlyReceivables: number; pendingPayment: number; pendingInvoice: number; }
interface MonthlyTrendData { month_start: string; total_receivables: number; }
interface PartnerRankingData { partner_name: string; total_payable: number; }
interface ProjectContributionData { project_name: string; total_receivables: number; }
interface LogisticsRecord { id: string; auto_number: string; loading_date: string; project_name: string; driver_name: string; payable_cost: number | null; payment_status: string; }
interface DetailFilter { type: string; value: string; }
interface DialogPagination { currentPage: number; totalPages: number; totalCount: number; }

// --- 常量 ---
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];
const PAGE_SIZE = 30;

// --- 主组件 ---
export default function FinancialOverview() {
  // --- State 管理 ---
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendData[]>([]);
  const [partnerRanking, setPartnerRanking] = useState<PartnerRankingData[]>([]);
  const [projectContribution, setProjectContribution] = useState<ProjectContributionData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 弹窗状态
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [detailFilter, setDetailFilter] = useState<DetailFilter | null>(null);
  const [dialogRecords, setDialogRecords] = useState<LogisticsRecord[]>([]);
  const [isDialogLoading, setIsDialogLoading] = useState(false);
  const [dialogPagination, setDialogPagination] = useState<DialogPagination>({ currentPage: 1, totalPages: 1, totalCount: 0 });

  // --- 数据获取 ---
  const fetchAllDataInOneGo = useCallback(async () => { /* ... (此函数保持不变) ... */ setLoading(true); try { const { data, error } = await supabase.rpc('get_financial_overview'); if (error) throw error; setStats(data.stats); setMonthlyTrend(data.monthlyTrend); setPartnerRanking(data.partnerRanking); setProjectContribution(data.projectContribution); } catch (error) { console.error("获取财务概览数据失败:", error); } finally { setLoading(false); } }, []);
  
  // 获取弹窗明细数据
  const fetchDialogRecords = useCallback(async () => {
    if (!detailFilter) return;
    setIsDialogLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_detailed_records_for_chart', {
        p_filter_type: detailFilter.type,
        p_filter_value: detailFilter.value,
        p_page_size: PAGE_SIZE,
        p_page_number: dialogPagination.currentPage
      });
      if (error) throw error;
      setDialogRecords(data.records || []);
      const totalCount = data.total_count || 0;
      setDialogPagination(prev => ({ ...prev, totalCount, totalPages: Math.ceil(totalCount / PAGE_SIZE) }));
    } catch (error) {
      console.error("获取明细数据失败:", error);
    } finally {
      setIsDialogLoading(false);
    }
  }, [detailFilter, dialogPagination.currentPage]);

  // --- Effects ---
  useEffect(() => { fetchAllDataInOneGo(); /* ... (智能刷新逻辑保持不变) ... */ const handleVisibilityChange = () => { if (document.visibilityState === 'visible') { fetchAllDataInOneGo(); } }; document.addEventListener('visibilitychange', handleVisibilityChange); return () => document.removeEventListener('visibilitychange', handleVisibilityChange); }, [fetchAllDataInOneGo]);
  
  useEffect(() => {
    if (isDetailDialogOpen && detailFilter) {
      fetchDialogRecords();
    }
  }, [isDetailDialogOpen, detailFilter, dialogPagination.currentPage, fetchDialogRecords]);

  // --- 事件处理器 ---
  const handleChartClick = (type: string, payload: any) => {
    const value = payload?.activePayload?.[0]?.payload?.name ?? payload?.activePayload?.[0]?.payload?.partner_name ?? payload?.activePayload?.[0]?.payload?.project_name ?? payload?.activePayload?.[0]?.payload?.month_start;
    if (value) {
      setDetailFilter({ type, value: String(value) });
      setDialogPagination({ currentPage: 1, totalPages: 1, totalCount: 0 }); // 重置分页
      setIsDetailDialogOpen(true);
    }
  };

  // --- 辅助函数 ---
  const formatCurrency = (value: number | null | undefined) => `¥${(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatCompact = (value: number) => { if (value >= 10000) return `¥${(value/10000).toFixed(1)}万`; if (value >= 1000) return `¥${(value/1000).toFixed(1)}千`; return `¥${value.toFixed(0)}`; }

  // --- 派生数据 ---
  const financialStatusData = stats ? [ { name: '待开票', value: stats.pendingInvoice }, { name: '待付款', value: stats.pendingPayment }, { name: '已支付', value: Math.max(0, stats.totalReceivables - stats.pendingInvoice - stats.pendingPayment) } ].filter(item => item.value > 0) : [];

  // --- 渲染 ---
  if (loading && !stats) { /* ... (全屏加载逻辑保持不变) ... */ return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><span className="ml-4 text-lg text-muted-foreground">正在加载财务数据...</span></div>; }

  return (
    <div className="space-y-6 p-4 md:p-6 relative">
      {/* ... (刷新加载动画保持不变) ... */}
      {loading && <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex justify-center items-center z-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
      
      {/* --- 顶部标题和卡片区域 --- */}
      <div><h1 className="text-3xl font-bold text-foreground">财务概览</h1><p className="text-muted-foreground">运输财务统计分析</p></div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">{/* ... (卡片代码保持不变) ... */}</div>

      {/* --- 图表区域 (增加 onClick 事件) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1 lg:col-span-2"><CardHeader><CardTitle>月度应收趋势 (最近12个月)</CardTitle></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} onClick={(payload) => handleChartClick('monthly_trend', payload)} className="cursor-pointer"><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month_start" /><YAxis tickFormatter={formatCompact} /><Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }} formatter={(value: number) => [formatCurrency(value), '月应收']} /><Legend formatter={() => '月应收金额'} /><Bar dataKey="total_receivables" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>合作方应付金额排名 (Top 10)</CardTitle></CardHeader><CardContent className="h-96"><ResponsiveContainer width="100%" height="100%"><BarChart data={partnerRanking} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }} onClick={(payload) => handleChartClick('partner_ranking', payload)} className="cursor-pointer"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={formatCompact}/><YAxis dataKey="partner_name" type="category" width={80} tick={{ fontSize: 12 }}/><Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }} formatter={(value: number) => [formatCurrency(value), '应付总额']} /><Bar dataKey="total_payable" fill="#10b981" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader><CardTitle>财务状态分布</CardTitle></CardHeader><CardContent className="h-96"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={financialStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={120} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => { const radius = innerRadius + (outerRadius - innerRadius) * 0.5; const x = cx + radius * Math.cos(-midAngle * Math.PI / 180); const y = cy + radius * Math.sin(-midAngle * Math.PI / 180); return ( <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={14}> {`${(percent * 100).toFixed(0)}%`} </text> ); }} onClick={(_, index) => handleChartClick('financial_status', { activePayload: [{ payload: financialStatusData[index] }] })} className="cursor-pointer">{financialStatusData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}</Pie><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
      </div>
      {projectContribution.length > 0 && <Card><CardHeader><CardTitle>项目应收贡献度</CardTitle></CardHeader><CardContent className="h-96"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={projectContribution} dataKey="total_receivables" nameKey="project_name" cx="50%" cy="50%" outerRadius={150} label={(props) => `${props.project_name} (${formatCompact(props.total_receivables)})`} onClick={(_, index) => handleChartClick('project_contribution', { activePayload: [{ payload: projectContribution[index] }] })} className="cursor-pointer">{projectContribution.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}</Pie><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /></PieChart></ResponsiveContainer></CardContent></Card>}
      
      {/* --- 弹窗组件 --- */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>运单明细: {detailFilter?.value}</DialogTitle>
            <DialogDescription>共找到 {dialogPagination.totalCount} 条相关记录。</DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto">
            {isDialogLoading ? (
              <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>运单号</TableHead><TableHead>装货日期</TableHead><TableHead>项目</TableHead><TableHead>司机</TableHead><TableHead>司机应收</TableHead><TableHead>付款状态</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {dialogRecords.length > 0 ? dialogRecords.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>{record.auto_number}</TableCell>
                      <TableCell>{new Date(record.loading_date).toLocaleDateString()}</TableCell>
                      <TableCell>{record.project_name}</TableCell>
                      <TableCell>{record.driver_name}</TableCell>
                      <TableCell>{formatCurrency(record.payable_cost)}</TableCell>
                      <TableCell>{record.payment_status}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6} className="text-center">没有找到记录</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          {dialogPagination.totalPages > 1 && (
            <Pagination className="pt-4">
              <PaginationContent>
                <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setDialogPagination(p => ({...p, currentPage: Math.max(1, p.currentPage - 1)})); }} className={dialogPagination.currentPage === 1 ? "pointer-events-none opacity-50" : ""} /></PaginationItem>
                <PaginationItem><PaginationLink isActive>{dialogPagination.currentPage}</PaginationLink> / {dialogPagination.totalPages}</PaginationItem>
                <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); setDialogPagination(p => ({...p, currentPage: Math.min(p.totalPages, p.currentPage + 1)})); }} className={dialogPagination.currentPage === dialogPagination.totalPages ? "pointer-events-none opacity-50" : ""} /></PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
