// 文件路径: src/pages/Home.tsx
// 描述: [uajfj 最终修复版] 修复了灾难性的运行时崩溃错误，并增加了代码健壮性。

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BarChart3, TrendingUp, Truck, Package, Eye, Database, RefreshCw, Search, Settings, CalendarDays, Scale, Banknote, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DataMigration } from "@/utils/migration";
import { Project, LogisticsRecord } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";

// --- 类型定义 ---
interface DailyTransportStats { date: string; actualTransport: number; returns: number; }
interface DailyCostStats { date: string; totalCost: number; }
interface DailyCountStats { date: string; count: number; }
interface OverviewStats { totalRecords: number; totalWeight: number; totalCost: number; actualTransportCount: number; returnCount: number; }

interface SummaryStats {
  yesterday_trip_count: number;
  yesterday_loading_weight: number;
  yesterday_payable_amount: number;
  yesterday_invoice_amount: number;
  unsettled_over_30_days_amount: number;
  unsettled_over_60_days_amount: number;
  unsettled_over_90_days_amount: number;
  uninvoiced_over_30_days_amount: number;
  uninvoiced_over_60_days_amount: number;
  uninvoiced_over_90_days_amount: number;
}

const initialSummaryStats: SummaryStats = {
  yesterday_trip_count: 0, yesterday_loading_weight: 0, yesterday_payable_amount: 0, yesterday_invoice_amount: 0,
  unsettled_over_30_days_amount: 0, unsettled_over_60_days_amount: 0, unsettled_over_90_days_amount: 0,
  uninvoiced_over_30_days_amount: 0, uninvoiced_over_60_days_amount: 0, uninvoiced_over_90_days_amount: 0,
};

export default function Home() {
  // --- 状态管理 ---
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [dailyTransportStats, setDailyTransportStats] = useState<DailyTransportStats[]>([]);
  const [dailyCostStats, setDailyCostStats] = useState<DailyCostStats[]>([]);
  const [dailyCountStats, setDailyCountStats] = useState<DailyCountStats[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats>(initialSummaryStats);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{ supabaseCount: number; localCount: number; isMigrated: boolean; } | null>(null);
  
  const [dialogRecords, setDialogRecords] = useState<LogisticsRecord[]>([]);
  const [isDialogLoading, setIsDialogLoading] = useState(false);
  const [dialogFilter, setDialogFilter] = useState<{projectId: string | null, date: string | null}>({ projectId: null, date: null });

  const [useLogScale, setUseLogScale] = useState(true);

  const getDefaultDateRange = useCallback(() => {
    const today = new Date();
    const year = today.getFullYear();
    return { startDate: `${year}-01-01`, endDate: today.toISOString().split('T')[0] };
  }, []);

  const [filterInputs, setFilterInputs] = useState({ ...getDefaultDateRange(), projectId: 'all' });
  const { toast } = useToast();

  // --- 核心函数 ---
  const formatCurrency = useCallback((value: number | null | undefined, precision = 2) => {
    if (typeof value !== 'number') return '0.00';
    return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: precision, maximumFractionDigits: precision }).format(value);
  }, []);

  const handleSearch = useCallback(async (isInitialLoad = false) => {
    if (!isInitialLoad) setIsSearching(true);
    try {
      const { data, error } = await supabase.rpc('get_unified_dashboard_stats', {
        start_date: filterInputs.startDate,
        end_date: filterInputs.endDate,
        project_id_filter: filterInputs.projectId === 'all' ? null : filterInputs.projectId,
      });
      if (error) throw error;
      // 【关键修复】使用安全的默认值，防止RPC返回不完整数据时崩溃
      setSummaryStats(data.summary_stats || initialSummaryStats);
      setOverviewStats(data.overview || null);
      setDailyTransportStats(data.dailyTransportStats || []);
      setDailyCostStats(data.dailyCostStats || []);
      setDailyCountStats(data.dailyCountStats || []);
    } catch (err) {
      console.error('获取看板数据失败:', err);
      toast({ title: "数据加载失败", variant: "destructive" });
    } finally {
      if (!isInitialLoad) setIsSearching(false);
    }
  }, [filterInputs, toast]);

  const checkMigrationStatus = useCallback(async () => {
    setMigrationStatus(await DataMigration.checkMigrationStatus());
  }, []);

  useEffect(() => {
    const initialLoad = async () => {
      setIsLoading(true);
      const getProjects = async () => {
        const { data, error } = await supabase.from('projects').select('*');
        if (error) {
          console.error("加载项目列表失败:", error);
          toast({ title: "加载项目列表失败", variant: "destructive" });
          return;
        }
        setProjects(data as Project[]);
      };
      await Promise.all([ getProjects(), checkMigrationStatus() ]);
      await handleSearch(true);
      setIsLoading(false);
    };
    initialLoad();
  }, [checkMigrationStatus, handleSearch, toast]);

  const fetchDialogRecords = useCallback(async () => {
    setIsDialogLoading(true);
    try {
      const projectId = dialogFilter.projectId === 'all' ? null : dialogFilter.projectId;
      const startDate = dialogFilter.date ? dialogFilter.date : filterInputs.startDate;
      const endDate = dialogFilter.date ? dialogFilter.date : filterInputs.endDate;
      
      let query = supabase.from('logistics_records').select('*').order('created_at', { ascending: false });
      
      if (dialogFilter.date) {
        // 如果是点击图表某一天，则精确筛选那一天
        const dayStart = new Date(dialogFilter.date).toISOString();
        const dayEnd = new Date(new Date(dialogFilter.date).getTime() + 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', dayStart).lt('created_at', dayEnd);
      } else {
        // 如果是点击图例，则使用看板的日期范围
        query = query.gte('created_at', startDate).lt('created_at', new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000).toISOString());
      }

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query.limit(1000);
      if (error) throw error;
      setDialogRecords(data as LogisticsRecord[]);
    } catch (error) {
      console.error("获取详细记录失败:", error);
      toast({ title: "获取详细记录失败", variant: "destructive" });
    } finally {
      setIsDialogLoading(false);
    }
  }, [dialogFilter, filterInputs.startDate, filterInputs.endDate, toast]);

  useEffect(() => { if (isDetailDialogOpen) { fetchDialogRecords(); } }, [isDetailDialogOpen, fetchDialogRecords]);

  const handleMigrateData = useCallback(async () => {
    try {
      toast({ title: "开始数据迁移" });
      const success = await DataMigration.migrateAllData();
      if (success) {
        await handleSearch(true);
        await checkMigrationStatus();
        toast({ title: "数据迁移完成" });
      } else {
        toast({ title: "迁移失败", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "迁移失败", variant: "destructive" });
    }
  }, [handleSearch, checkMigrationStatus, toast]);

  const handleChartClick = useCallback((data: any) => {
    if (data?.activePayload?.[0]) {
      const clickedDate = data.activePayload[0].payload.date;
      setDialogFilter({ projectId: filterInputs.projectId, date: clickedDate });
      setIsDetailDialogOpen(true);
    }
  }, [filterInputs.projectId]);

  const handleLegendClick = useCallback(() => {
    setDialogFilter({ projectId: filterInputs.projectId, date: null });
    setIsDetailDialogOpen(true);
  }, [filterInputs.projectId]);

  const legendTotals = useMemo(() => ({
    actualTransportTotal: dailyTransportStats.reduce((sum, day) => sum + (day.actualTransport || 0), 0),
    returnsTotal: dailyTransportStats.reduce((sum, day) => sum + (day.returns || 0), 0),
    totalCostSum: dailyCostStats.reduce((sum, day) => sum + (day.totalCost || 0), 0),
    totalTrips: dailyCountStats.reduce((sum, day) => sum + (day.count || 0), 0),
  }), [dailyTransportStats, dailyCostStats, dailyCountStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2 text-lg text-gray-600">正在初始化应用...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {migrationStatus && !migrationStatus.isMigrated && migrationStatus.localCount > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Database className="h-5 w-5 text-orange-600 mr-2" />
                <div>
                  <p className="text-sm font-medium">检测到本地数据</p>
                  <p className="text-xs text-muted-foreground">本地有{migrationStatus.localCount}条记录，建议迁移到Supabase</p>
                </div>
              </div>
              <Button onClick={handleMigrateData} size="sm">迁移数据</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-gradient-primary p-6 rounded-lg shadow-primary text-primary-foreground">
        <h1 className="text-2xl font-bold mb-2 flex items-center"><BarChart3 className="mr-2" />数据看板</h1>
        <p className="opacity-90">运输数据统计分析与可视化</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center text-lg"><CalendarDays className="mr-2 h-5 w-5 text-primary" />昨日数据统计</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg"><p className="text-sm text-muted-foreground">发车车次</p><p className="text-2xl font-bold">{summaryStats.yesterday_trip_count}</p></div>
            <div className="p-4 border rounded-lg"><p className="text-sm text-muted-foreground">装货吨数</p><p className="text-2xl font-bold">{formatCurrency(summaryStats.yesterday_loading_weight, 2)}</p></div>
            <div className="p-4 border rounded-lg"><p className="text-sm text-muted-foreground">应收金额</p><p className="text-2xl font-bold">{formatCurrency(summaryStats.yesterday_payable_amount, 2)}</p></div>
            <div className="p-4 border rounded-lg"><p className="text-sm text-muted-foreground">开票金额</p><p className="text-2xl font-bold">{formatCurrency(summaryStats.yesterday_invoice_amount, 2)}</p></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center text-lg"><Scale className="mr-2 h-5 w-5 text-primary" />结算监控台</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base font-medium flex items-center"><Banknote className="mr-2 h-4 w-4 text-destructive"/>未结算运单金额</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-baseline"><p className="text-sm text-muted-foreground">超30天</p><p className="font-mono text-lg">{formatCurrency(summaryStats.unsettled_over_30_days_amount)} 元</p></div>
              <div className="flex justify-between items-baseline"><p className="text-sm text-muted-foreground">超60天</p><p className="font-mono text-lg">{formatCurrency(summaryStats.unsettled_over_60_days_amount)} 元</p></div>
              <div className="flex justify-between items-baseline"><p className="text-sm text-muted-foreground">超90天</p><p className="font-mono text-lg">{formatCurrency(summaryStats.unsettled_over_90_days_amount)} 元</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base font-medium flex items-center"><FileText className="mr-2 h-4 w-4 text-destructive"/>未开票运单金额</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-baseline"><p className="text-sm text-muted-foreground">超30天</p><p className="font-mono text-lg">{formatCurrency(summaryStats.uninvoiced_over_30_days_amount)} 元</p></div>
              <div className="flex justify-between items-baseline"><p className="text-sm text-muted-foreground">超60天</p><p className="font-mono text-lg">{formatCurrency(summaryStats.uninvoiced_over_60_days_amount)} 元</p></div>
              <div className="flex justify-between items-baseline"><p className="text-sm text-muted-foreground">超90天</p><p className="font-mono text-lg">{formatCurrency(summaryStats.uninvoiced_over_90_days_amount)} 元</p></div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader><CardTitle>数据筛选</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2"><Label htmlFor="startDate">开始日期</Label><Input id="startDate" type="date" value={filterInputs.startDate} onChange={(e) => setFilterInputs(prev => ({...prev, startDate: e.target.value}))} /></div>
            <div className="space-y-2"><Label htmlFor="endDate">结束日期</Label><Input id="endDate" type="date" value={filterInputs.endDate} onChange={(e) => setFilterInputs(prev => ({...prev, endDate: e.target.value}))} /></div>
            <div className="space-y-2"><Label htmlFor="projectFilter">项目筛选</Label><Select value={filterInputs.projectId} onValueChange={(value) => setFilterInputs(prev => ({...prev, projectId: value}))}><SelectTrigger id="projectFilter"><SelectValue placeholder="选择项目" /></SelectTrigger><SelectContent><SelectItem value="all">所有项目</SelectItem>{projects.map(project => (<SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>))}</SelectContent></Select></div>
            <Button onClick={() => handleSearch(false)} disabled={isSearching}>{isSearching ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}{isSearching ? '正在搜索...' : '搜索'}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-blue-100 rounded-lg mr-4"><Package className="h-6 w-6 text-blue-600" /></div><div><p className="text-sm font-medium text-muted-foreground">总运输次数</p><p className="text-2xl font-bold">{overviewStats?.totalRecords || 0}</p></div></CardContent></Card>
        <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-green-100 rounded-lg mr-4"><Truck className="h-6 w-6 text-green-600" /></div><div><p className="text-sm font-medium text-muted-foreground">总运输重量</p><p className="text-2xl font-bold">{formatCurrency(overviewStats?.totalWeight, 1)}吨</p></div></CardContent></Card>
        <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-yellow-100 rounded-lg mr-4"><TrendingUp className="h-6 w-6 text-yellow-600" /></div><div><p className="text-sm font-medium text-muted-foreground">司机应收汇总</p><p className="text-2xl font-bold">{formatCurrency(overviewStats?.totalCost)}</p></div></CardContent></Card>
        <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-purple-100 rounded-lg mr-4"><BarChart3 className="h-6 w-6 text-purple-600" /></div><div><p className="text-sm font-medium text-muted-foreground">实际运输/退货</p><p className="text-2xl font-bold">{overviewStats?.actualTransportCount || 0}/{overviewStats?.returnCount || 0}</p></div></CardContent></Card>
      </div>

      <div className="space-y-6">
        <Card className="shadow-card">
          <CardHeader><CardTitle>每日运输量统计 ({filterInputs.startDate} 至 {filterInputs.endDate}) (吨)</CardTitle></CardHeader>
          <CardContent><div className="h-96"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyTransportStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleChartClick}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} interval={0} /><YAxis scale={useLogScale ? "log" : "auto"} domain={useLogScale ? [0.1, 'dataMax'] : [0, 'dataMax + 20']} tickFormatter={(value) => value.toString()} allowDataOverflow={true} /><Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value, name) => { const label = name === 'actualTransport' ? '有效运输量' : '退货量'; return [`${Number(value).toFixed(2)}`, label]; }} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} /><Legend formatter={(value) => { if (value === 'actualTransport') { return `有效运输量 (${formatCurrency(legendTotals.actualTransportTotal, 1)}吨) - 点击查看全部运单`; } return `退货量 (${formatCurrency(legendTotals.returnsTotal, 1)}吨) - 点击查看全部运单`; }} wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }} onClick={handleLegendClick} /><Bar dataKey="actualTransport" fill="#4ade80" name="actualTransport" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? formatCurrency(value, 1) : '' }} /><Bar dataKey="returns" fill="#ef4444" name="returns" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? formatCurrency(value, 1) : '' }} /></BarChart></ResponsiveContainer></div></CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader><CardTitle>运输日报 ({filterInputs.startDate} 至 {filterInputs.endDate})</CardTitle></CardHeader>
          <CardContent><div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={dailyCountStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleChartClick}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} interval={0} /><YAxis scale={useLogScale ? "log" : "auto"} domain={useLogScale ? [0.1, 'dataMax'] : [0, 'dataMax + 1']} allowDecimals={false} tickFormatter={(value) => value.toString()} allowDataOverflow={true} /><Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value) => [`${value} 次`, '运输次数']} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} cursor={{ stroke: 'rgba(59, 130, 246, 0.3)', strokeWidth: 2 }} /><Legend formatter={() => `运输次数 (总计${legendTotals.totalTrips}次) - 点击查看全部运单`} wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }} onClick={handleLegendClick} /><Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4, cursor: 'pointer' }} activeDot={{ r: 6, fill: '#3b82f6', cursor: 'pointer' }} label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toString() : '' }} /></LineChart></ResponsiveContainer></div></CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader><CardTitle>每日运输费用分析 ({filterInputs.startDate} 至 {filterInputs.endDate}) (元)</CardTitle></CardHeader>
          <CardContent><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyCostStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleChartClick}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} interval={0} /><YAxis scale={useLogScale ? "log" : "auto"} domain={useLogScale ? [0.1, 'dataMax'] : [0, 'dataMax']} tickFormatter={(value) => formatCurrency(value, 0)} allowDataOverflow={true} /><Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value) => [formatCurrency(value as number), '总费用']} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }} /><Legend formatter={() => `总费用 (${formatCurrency(legendTotals.totalCostSum)}) - 点击查看全部运单`} wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }} onClick={handleLegendClick} /><Bar dataKey="totalCost" fill="#10b981" name="totalCost" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? formatCurrency(value, 0) : '' }} /></BarChart></ResponsiveContainer></div></CardContent>
        </Card>
      </div>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" aria-describedby="dialog-description">
          <DialogHeader><DialogTitle className="flex items-center"><Eye className="mr-2 h-5 w-5" />{dialogFilter.date ? `${new Date(dialogFilter.date).toLocaleDateString('zh-CN')} 详细运输记录` : `全部筛选结果记录`}</DialogTitle><div id="dialog-description" className="sr-only">显示运输记录详细信息</div></DialogHeader>
          {isDialogLoading ? (<div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin" /><span className="ml-2">正在加载详细记录...</span></div>) : dialogRecords.length > 0 ? (<div className="space-y-4"><div className="border rounded-lg overflow-x-auto"><Table><TableHeader><TableRow className="text-xs"><TableHead>运单号</TableHead><TableHead>项目</TableHead><TableHead>司机</TableHead><TableHead>车牌</TableHead><TableHead>装货地</TableHead><TableHead>卸货地</TableHead><TableHead>装货重</TableHead><TableHead>卸货重</TableHead><TableHead>类型</TableHead><TableHead>司机应收</TableHead><TableHead>备注</TableHead></TableRow></TableHeader><TableBody>{dialogRecords.map((record) => (<TableRow key={record.id} className="text-xs">
            <TableCell className="font-medium whitespace-nowrap">{record.autoNumber}</TableCell>
            <TableCell className="whitespace-nowrap">{record.projectName || '-'}</TableCell>
            <TableCell className="whitespace-nowrap">{record.driverName}</TableCell>
            <TableCell className="whitespace-nowrap">{record.licensePlate}</TableCell>
            <TableCell className="whitespace-nowrap">{record.loadingLocation}</TableCell>
            <TableCell className="whitespace-nowrap">{record.unloadingLocation}</TableCell>
            {/* 【关键修复】对所有可能为null的数字进行安全处理 */}
            <TableCell className="whitespace-nowrap">{typeof record.loadingWeight === 'number' ? record.loadingWeight.toFixed(2) + '吨' : '-'}</TableCell>
            <TableCell className="whitespace-nowrap">{typeof record.unloadingWeight === 'number' ? record.unloadingWeight.toFixed(2) + '吨' : '-'}</TableCell>
            <TableCell><span className={`px-1 py-0.5 rounded-full text-xs whitespace-nowrap ${record.transportType === "实际运输" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{record.transportType}</span></TableCell>
            <TableCell className="whitespace-nowrap font-mono">{formatCurrency(record.payable_cost)}</TableCell>
            <TableCell className="max-w-[120px] truncate" title={record.remarks || ''}>{record.remarks || '-'}</TableCell>
          </TableRow>))}</TableBody></Table></div></div>) : (<div className="text-center py-8 text-muted-foreground">没有符合条件的运输记录</div>)}
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-6 right-6 bg-background/80 backdrop-blur-sm p-3 rounded-lg shadow-lg border flex items-center gap-3 z-50">
        <Settings className="h-5 w-5 text-muted-foreground" /><Label htmlFor="log-scale-switch" className="text-sm font-medium">图表对数刻度</Label>
        <Switch id="log-scale-switch" checked={useLogScale} onCheckedChange={setUseLogScale} aria-label="切换所有图表的对数刻度" />
      </div>
    </div>
  );
}
