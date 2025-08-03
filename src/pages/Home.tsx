// 文件路径: src/pages/Home.tsx
// 描述: [8ndPM 最终修正版] 严格基于您的完整原始代码进行修改，未省略任何部分，并正确调用 SupabaseStorage。

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Truck, Package, Eye, Database, RefreshCw, Search } from "lucide-react";
import { SupabaseStorage } from "@/utils/supabase";
import { DataMigration } from "@/utils/migration";
import { Project, LogisticsRecord } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";

// 定义后端返回的聚合数据结构
interface DailyTransportStats { date: string; actualTransport: number; returns: number; }
interface DailyCostStats { date: string; totalCost: number; }
interface DailyCountStats { date: string; count: number; }
interface OverviewStats { totalRecords: number; totalWeight: number; totalCost: number; actualTransportCount: number; returnCount: number; }

export default function Home() {
  // 状态管理 (完全保留您的原始状态)
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [dailyTransportStats, setDailyTransportStats] = useState<DailyTransportStats[]>([]);
  const [dailyCostStats, setDailyCostStats] = useState<DailyCostStats[]>([]);
  const [dailyCountStats, setDailyCountStats] = useState<DailyCountStats[]>([]);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{ supabaseCount: number; localCount: number; isMigrated: boolean; } | null>(null);
  
  const [dialogRecords, setDialogRecords] = useState<LogisticsRecord[]>([]);
  const [isDialogLoading, setIsDialogLoading] = useState(false);
  const [dialogFilter, setDialogFilter] = useState<{projectId: string | null, date: string | null}>({ projectId: null, date: null });

  const getDefaultDateRange = () => {
    const today = new Date();
    const year = today.getFullYear();
    return { 
      startDate: `${year}-01-01`, 
      endDate: today.toISOString().split('T')[0] 
    };
  };

  const [filterInputs, setFilterInputs] = useState({ ...getDefaultDateRange(), projectId: 'all' });
  const { toast } = useToast();

  // 初始加载 (完全保留您的原始逻辑)
  useEffect(() => {
    const initialLoad = async () => {
      setIsLoading(true);
      await Promise.all([loadProjects(), checkMigrationStatus()]);
      await handleSearch(true);
      setIsLoading(false);
    };
    initialLoad();
  }, []);

  useEffect(() => {
    if (isDetailDialogOpen) {
      fetchDialogRecords();
    }
  }, [isDetailDialogOpen, dialogFilter]);

  // fetchDialogRecords (完全保留您的原始逻辑)
  const fetchDialogRecords = async () => {
    setIsDialogLoading(true);
    try {
      const projectId = dialogFilter.projectId === 'all' ? undefined : dialogFilter.projectId;
      const startDate = dialogFilter.date ? dialogFilter.date : filterInputs.startDate;
      const endDate = dialogFilter.date ? dialogFilter.date : filterInputs.endDate;
      const { records } = await SupabaseStorage.getFilteredLogisticsRecords(
        projectId, undefined, startDate, endDate, 1000, 0
      );
      setDialogRecords(records);
    } catch (error) {
      console.error("获取详细记录失败:", error);
      toast({ title: "获取详细记录失败", variant: "destructive" });
    } finally {
      setIsDialogLoading(false);
    }
  };

  // loadProjects (完全保留您的原始逻辑)
  const loadProjects = async () => {
    try {
      setProjects(await SupabaseStorage.getProjects());
    } catch (error) {
      console.error("加载项目列表失败:", error);
    }
  };

  // [核心修正] handleSearch 函数，确保正确适配 RPC 返回的数据结构
  const handleSearch = async (isInitialLoad = false) => {
    if (!isInitialLoad) setIsSearching(true);
    try {
      const data = await SupabaseStorage.getDashboardStats({
        startDate: filterInputs.startDate,
        endDate: filterInputs.endDate,
        projectId: filterInputs.projectId,
      });
      
      // 适配 RPC 返回的数据结构
      // overview 是一个数组，通常只包含一个对象
      setOverviewStats(data.overview[0] || null); 
      // 其他统计数据，确保在数据不存在时提供空数组作为后备
      setDailyTransportStats(data.daily_transport_stats || []);
      setDailyCostStats(data.daily_cost_stats || []);
      setDailyCountStats(data.daily_count_stats || []);

    } catch (err) {
      console.error('获取看板数据失败:', err);
      toast({ title: "数据加载失败", variant: "destructive" });
    } finally {
      if (!isInitialLoad) setIsSearching(false);
    }
  };

  // 数据迁移功能 (完全保留您的原始逻辑)
  const checkMigrationStatus = async () => {
    setMigrationStatus(await DataMigration.checkMigrationStatus());
  };

  const handleMigrateData = async () => {
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
  };

  // 图表交互 (完全保留您的原始逻辑)
  const handleChartClick = (data: any) => {
    if (data?.activePayload?.[0]) {
      const clickedDate = data.activePayload[0].payload.date;
      setDialogFilter({ projectId: filterInputs.projectId, date: clickedDate });
      setIsDetailDialogOpen(true);
    }
  };

  const handleLegendClick = () => {
    setDialogFilter({ projectId: filterInputs.projectId, date: null });
    setIsDetailDialogOpen(true);
  };

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

  // [最终交付] 返回完整的、未经任何省略的 JSX
  return (
    <div className="space-y-8 p-4 md:p-8">
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

      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 rounded-lg shadow-lg text-white">
        <h1 className="text-2xl font-bold mb-2 flex items-center"><BarChart3 className="mr-2" />数据看板</h1>
        <p className="opacity-90">运输数据统计分析与可视化</p>
      </div>

      <Card className="shadow-md">
        <CardHeader><CardTitle>数据筛选</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="startDate">开始日期</Label>
              <Input id="startDate" type="date" value={filterInputs.startDate} onChange={(e) => setFilterInputs(prev => ({...prev, startDate: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">结束日期</Label>
              <Input id="endDate" type="date" value={filterInputs.endDate} onChange={(e) => setFilterInputs(prev => ({...prev, endDate: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectFilter">项目筛选</Label>
              <Select value={filterInputs.projectId} onValueChange={(value) => setFilterInputs(prev => ({...prev, projectId: value}))}>
                <SelectTrigger id="projectFilter"><SelectValue placeholder="选择项目" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有项目</SelectItem>
                  {projects.map(project => (<SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => handleSearch(false)} disabled={isSearching}>
              {isSearching ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              {isSearching ? '正在搜索...' : '搜索'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-md"><CardContent className="flex items-center p-6"><div className="p-3 bg-blue-100 rounded-lg mr-4"><Package className="h-6 w-6 text-blue-600" /></div><div><p className="text-sm font-medium text-muted-foreground">总运输次数</p><p className="text-2xl font-bold">{overviewStats?.totalRecords || 0}</p></div></CardContent></Card>
        <Card className="shadow-md"><CardContent className="flex items-center p-6"><div className="p-3 bg-green-100 rounded-lg mr-4"><Truck className="h-6 w-6 text-green-600" /></div><div><p className="text-sm font-medium text-muted-foreground">总运输重量</p><p className="text-2xl font-bold">{(overviewStats?.totalWeight || 0).toFixed(1)}吨</p></div></CardContent></Card>
        <Card className="shadow-md"><CardContent className="flex items-center p-6"><div className="p-3 bg-yellow-100 rounded-lg mr-4"><TrendingUp className="h-6 w-6 text-yellow-600" /></div><div><p className="text-sm font-medium text-muted-foreground">司机应收汇总</p><p className="text-2xl font-bold">{(overviewStats?.totalCost || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}</p></div></CardContent></Card>
        <Card className="shadow-md"><CardContent className="flex items-center p-6"><div className="p-3 bg-purple-100 rounded-lg mr-4"><BarChart3 className="h-6 w-6 text-purple-600" /></div><div><p className="text-sm font-medium text-muted-foreground">实际运输/退货</p><p className="text-2xl font-bold">{overviewStats?.actualTransportCount || 0}/{overviewStats?.returnCount || 0}</p></div></CardContent></Card>
      </div>

      <div className="space-y-6">
        <Card className="shadow-md">
          <CardHeader><CardTitle>每日运输量统计 ({filterInputs.startDate} 至 {filterInputs.endDate}) (吨)</CardTitle></CardHeader>
          <CardContent><div className="h-96"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyTransportStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleChartClick}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} interval={0} /><YAxis domain={[0, 'dataMax + 20']} /><Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value, name) => { const label = name === 'actualTransport' ? '有效运输量' : '退货量'; return [`${Number(value).toFixed(2)} 吨`, label]; }} /><Legend formatter={(value) => { if (value === 'actualTransport') { return `有效运输量 (${legendTotals.actualTransportTotal.toFixed(1)}吨) - 点击查看全部`; } return `退货量 (${legendTotals.returnsTotal.toFixed(1)}吨) - 点击查看全部`; }} wrapperStyle={{ paddingTop: '20px', cursor: 'pointer' }} onClick={handleLegendClick} /><Bar dataKey="actualTransport" fill="#4ade80" name="actualTransport" radius={[2, 2, 0, 0]} label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toFixed(1) : '' }} /><Bar dataKey="returns" fill="#ef4444" name="returns" radius={[2, 2, 0, 0]} label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toFixed(1) : '' }} /></BarChart></ResponsiveContainer></div></CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader><CardTitle>运输日报 ({filterInputs.startDate} 至 {filterInputs.endDate})</CardTitle></CardHeader>
          <CardContent><div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={dailyCountStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleChartClick}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} interval={0} /><YAxis allowDecimals={false} domain={[0, 'dataMax + 1']} /><Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value) => [`${value} 次`, '运输次数']} /><Legend formatter={() => `运输次数 (总计${legendTotals.totalTrips}次) - 点击查看全部`} wrapperStyle={{ paddingTop: '20px', cursor: 'pointer' }} onClick={handleLegendClick} /><Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toString() : '' }} /></LineChart></ResponsiveContainer></div></CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader><CardTitle>每日运输费用分析 ({filterInputs.startDate} 至 {filterInputs.endDate}) (元)</CardTitle></CardHeader>
          <CardContent><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyCostStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleChartClick}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} interval={0} /><YAxis tickFormatter={(value) => `¥${Number(value).toLocaleString('zh-CN')}`} /><Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value) => [`¥${Number(value).toFixed(2)}`, '总费用']} /><Legend formatter={() => `总费用 (¥${legendTotals.totalCostSum.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) - 点击查看全部`} wrapperStyle={{ paddingTop: '20px', cursor: 'pointer' }} onClick={handleLegendClick} /><Bar dataKey="totalCost" fill="#10b981" name="totalCost" radius={[2, 2, 0, 0]} label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? `¥${Number(value).toFixed(0)}` : '' }} /></BarChart></ResponsiveContainer></div></CardContent>
        </Card>
      </div>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center"><Eye className="mr-2 h-5 w-5" />{dialogFilter.date ? `${new Date(dialogFilter.date).toLocaleDateString('zh-CN')} 详细运输记录` : `全部筛选结果记录`}</DialogTitle>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto">
            {isDialogLoading ? (
              <div className="flex items-center justify-center h-full"><RefreshCw className="h-6 w-6 animate-spin" /><span className="ml-2">正在加载详细记录...</span></div>
            ) : dialogRecords.length > 0 ? (
              <Table><TableHeader><TableRow><TableHead>运单号</TableHead><TableHead>项目</TableHead><TableHead>司机</TableHead><TableHead>车牌</TableHead><TableHead>装货地</TableHead><TableHead>卸货地</TableHead><TableHead>装货重</TableHead><TableHead>卸货重</TableHead><TableHead>类型</TableHead><TableHead>司机应收</TableHead><TableHead>备注</TableHead></TableRow></TableHeader>
                <TableBody>
                  {dialogRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.autoNumber}</TableCell>
                      <TableCell>{record.projectName}</TableCell>
                      <TableCell>{record.driverName}</TableCell>
                      <TableCell>{record.licensePlate}</TableCell>
                      <TableCell>{record.loadingLocation}</TableCell>
                      <TableCell>{record.unloadingLocation}</TableCell>
                      <TableCell>{record.loadingWeight?.toFixed(2) || '-'}吨</TableCell>
                      <TableCell>{record.unloadingWeight?.toFixed(2) || '-'}吨</TableCell>
                      <TableCell><span className={`px-2 py-1 rounded-full text-xs ${record.transportType === "实际运输" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{record.transportType}</span></TableCell>
                      <TableCell className="font-mono">{record.payableFee ? `¥${(record.payableFee).toFixed(2)}` : '-'}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={record.remarks}>{record.remarks || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (<div className="flex items-center justify-center h-full text-muted-foreground">没有符合条件的运输记录</div>)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
