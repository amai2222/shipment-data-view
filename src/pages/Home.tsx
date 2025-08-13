// 文件路径: src/pages/Home.tsx
// 描述: 增强版运输看板，支持按计费模式动态显示统计卡片、图表和弹窗列

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BarChart3, TrendingUp, Truck, Package, Eye, Database, RefreshCw, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { SupabaseStorage } from "@/utils/supabase";
import { DataMigration } from "@/utils/migration";
import { Project } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";

// 辅助函数：获取默认日期范围
const getDefaultDateRange = () => {
  const today = new Date();
  const year = today.getFullYear();
  return { startDate: `${year}-01-01`, endDate: today.toISOString().split('T')[0] };
};

// 格式化为财务数字
const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return '¥0.00';
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
};

// 为RPC返回的数据定义完整的类型
interface DailyTransportStats { date: string; actualTransport: number; returns: number; }
interface DailyCostStats { date: string; totalCost: number; }
interface DailyCountStats { date: string; count: number; }
interface OverviewStats { 
  totalRecords: number; 
  totalWeight: number; 
  totalVolume: number;
  totalTrips: number;
  totalCost: number; 
  actualTransportCount: number; 
  returnCount: number;
  weightRecordsCount: number;
  tripRecordsCount: number;
  volumeRecordsCount: number;
}
interface DashboardData {
  overview: OverviewStats;
  dailyTransportStats: DailyTransportStats[];
  dailyTripStats: DailyTransportStats[];
  dailyVolumeStats: DailyTransportStats[];
  dailyCostStats: DailyCostStats[];
  dailyCountStats: DailyCountStats[];
}

// 运单记录扩展类型，包含计费模式信息
interface EnhancedLogisticsRecord {
  id: string;
  auto_number: string;
  project_name: string;
  driver_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  unloading_date?: string;
  loading_weight?: number;
  unloading_weight?: number;
  transport_type: string;
  current_cost?: number;
  extra_cost?: number;
  payable_cost?: number;
  license_plate: string;
  driver_phone: string;
  remarks?: string;
  billing_type_id: number;
  chain_name?: string;
}

// --- 主组件 ---
export default function Home() {
  // 状态管理
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [dailyTransportStats, setDailyTransportStats] = useState<DailyTransportStats[]>([]);
  const [dailyTripStats, setDailyTripStats] = useState<DailyTransportStats[]>([]);
  const [dailyVolumeStats, setDailyVolumeStats] = useState<DailyTransportStats[]>([]);
  const [dailyCostStats, setDailyCostStats] = useState<DailyCostStats[]>([]);
  const [dailyCountStats, setDailyCountStats] = useState<DailyCountStats[]>([]);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{ supabaseCount: number; localCount: number; isMigrated: boolean; } | null>(null);
  const [useLogScale, setUseLogScale] = useState(false);

  // 弹窗分页状态
  const [dialogRecords, setDialogRecords] = useState<EnhancedLogisticsRecord[]>([]);
  const [isDialogLoading, setIsDialogLoading] = useState(false);
  const [dialogFilter, setDialogFilter] = useState<{projectId: string | null, date: string | null}>({ projectId: null, date: null });
  const [dialogPagination, setDialogPagination] = useState({
    currentPage: 1,
    pageSize: 15,
    totalCount: 0,
  });

  const [filterInputs, setFilterInputs] = useState(() => ({ ...getDefaultDateRange(), projectId: 'all' }));
  const { toast } = useToast();

  const handleSearch = useCallback(async (isInitialLoad = false) => {
    if (!isInitialLoad) setIsSearching(true);
    try {
      const data: DashboardData = await SupabaseStorage.getDashboardStats(filterInputs);
      setOverviewStats(data.overview);
      setDailyTransportStats(data.dailyTransportStats || []);
      setDailyTripStats(data.dailyTripStats || []);
      setDailyVolumeStats(data.dailyVolumeStats || []);
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

  const loadProjects = useCallback(async () => {
    try {
      setProjects(await SupabaseStorage.getProjects() as Project[]);
    } catch (error) {
      console.error("加载项目列表失败:", error);
    }
  }, []);

  // 弹窗数据获取函数 - 使用新的带计费模式信息的函数
  const fetchDialogRecords = useCallback(async (page = 1) => {
    setIsDialogLoading(true);
    setDialogPagination(prev => ({ ...prev, currentPage: page }));
    try {
      const projectId = dialogFilter.projectId === 'all' ? undefined : dialogFilter.projectId;
      const startDate = dialogFilter.date ? dialogFilter.date : filterInputs.startDate;
      const endDate = dialogFilter.date ? dialogFilter.date : filterInputs.endDate;
      const offset = (page - 1) * dialogPagination.pageSize;

      const { records, totalCount } = await SupabaseStorage.getFilteredLogisticsRecordsWithBilling(
        projectId, 
        undefined, 
        startDate, 
        endDate, 
        dialogPagination.pageSize, 
        offset
      );
      setDialogRecords(records);
      setDialogPagination(prev => ({ ...prev, totalCount: totalCount }));
    } catch (error) {
      console.error("获取详细记录失败:", error);
      toast({ title: "获取详细记录失败", variant: "destructive" });
    } finally {
      setIsDialogLoading(false);
    }
  }, [dialogFilter, filterInputs.startDate, filterInputs.endDate, toast, dialogPagination.pageSize]);

  useEffect(() => {
    const initialLoad = async () => {
      setIsLoading(true);
      try {
        await Promise.all([loadProjects(), checkMigrationStatus()]);
        await handleSearch(true);
      } catch (error) {
        console.error('Initial load error:', error);
        // 即使出错也不阻塞加载
      } finally {
        setIsLoading(false);
      }
    };
    initialLoad();
  }, [loadProjects, checkMigrationStatus, handleSearch]);

  useEffect(() => {
    if (isDetailDialogOpen) {
      fetchDialogRecords(1);
    }
  }, [isDetailDialogOpen, dialogFilter, fetchDialogRecords]);

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

  const handleStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterInputs(prev => ({...prev, startDate: e.target.value}));
  }, []);

  const handleEndDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterInputs(prev => ({...prev, endDate: e.target.value}));
  }, []);

  const handleProjectChange = useCallback((value: string) => {
    setFilterInputs(prev => ({...prev, projectId: value}));
  }, []);

  // 计算图例总数
  const legendTotals = useMemo(() => ({
    weightTransportTotal: dailyTransportStats.reduce((sum, day) => sum + (day.actualTransport || 0), 0),
    weightReturnsTotal: dailyTransportStats.reduce((sum, day) => sum + (day.returns || 0), 0),
    tripTransportTotal: dailyTripStats.reduce((sum, day) => sum + (day.actualTransport || 0), 0),
    tripReturnsTotal: dailyTripStats.reduce((sum, day) => sum + (day.returns || 0), 0),
    volumeTransportTotal: dailyVolumeStats.reduce((sum, day) => sum + (day.actualTransport || 0), 0),
    volumeReturnsTotal: dailyVolumeStats.reduce((sum, day) => sum + (day.returns || 0), 0),
    totalCostSum: dailyCostStats.reduce((sum, day) => sum + (day.totalCost || 0), 0),
    totalTrips: dailyCountStats.reduce((sum, day) => sum + (day.count || 0), 0),
  }), [dailyTransportStats, dailyTripStats, dailyVolumeStats, dailyCostStats, dailyCountStats]);

  // 计算弹窗表格中的合计
  const dialogTotals = useMemo(() => {
    const billingTypes = new Set(dialogRecords.map(r => r.billing_type_id || 1));
    
    return {
      billingTypes,
      weightTotal: dialogRecords
        .filter(r => (r.billing_type_id || 1) === 1)
        .reduce((sum, r) => sum + (r.unloading_weight || r.loading_weight || 0), 0),
      tripTotal: dialogRecords
        .filter(r => (r.billing_type_id || 1) === 2)
        .length,
      volumeTotal: dialogRecords
        .filter(r => (r.billing_type_id || 1) === 3)
        .reduce((sum, r) => sum + (r.loading_weight || 0), 0),
    };
  }, [dialogRecords]);
  
  const totalDialogPages = Math.ceil(dialogPagination.totalCount / dialogPagination.pageSize);

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

      <Card className="shadow-card">
        <CardHeader><CardTitle>数据筛选</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2"><Label htmlFor="startDate">开始日期</Label><Input id="startDate" type="date" value={filterInputs.startDate} onChange={handleStartDateChange} /></div>
            <div className="space-y-2"><Label htmlFor="endDate">结束日期</Label><Input id="endDate" type="date" value={filterInputs.endDate} onChange={handleEndDateChange} /></div>
            <div className="space-y-2"><Label htmlFor="projectFilter">项目筛选</Label><Select value={filterInputs.projectId} onValueChange={handleProjectChange}><SelectTrigger id="projectFilter"><SelectValue placeholder="选择项目" /></SelectTrigger><SelectContent><SelectItem value="all">所有项目</SelectItem>{projects.map(project => (<SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>))}</SelectContent></Select></div>
            <Button onClick={() => handleSearch(false)} disabled={isSearching}>{isSearching ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}{isSearching ? '正在搜索...' : '搜索'}</Button>
          </div>
        </CardContent>
      </Card>

      {/* 动态显示统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-blue-100 rounded-lg mr-4"><Package className="h-6 w-6 text-blue-600" /></div><div><p className="text-sm font-medium text-muted-foreground">总运输次数</p><p className="text-2xl font-bold">{overviewStats?.totalRecords || 0}</p></div></CardContent></Card>
        
        {/* 按重量计费卡片 */}
        {overviewStats?.weightRecordsCount && overviewStats.weightRecordsCount > 0 && (
          <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-green-100 rounded-lg mr-4"><Truck className="h-6 w-6 text-green-600" /></div><div><p className="text-sm font-medium text-muted-foreground">总运输重量</p><p className="text-2xl font-bold">{(overviewStats?.totalWeight || 0).toFixed(1)}吨</p></div></CardContent></Card>
        )}
        
        {/* 按车次计费卡片 */}
        {overviewStats?.tripRecordsCount && overviewStats.tripRecordsCount > 0 && (
          <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-purple-100 rounded-lg mr-4"><Truck className="h-6 w-6 text-purple-600" /></div><div><p className="text-sm font-medium text-muted-foreground">总运输车次</p><p className="text-2xl font-bold">{overviewStats?.totalTrips || 0}车次</p></div></CardContent></Card>
        )}
        
        {/* 按体积计费卡片 */}
        {overviewStats?.volumeRecordsCount && overviewStats.volumeRecordsCount > 0 && (
          <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-orange-100 rounded-lg mr-4"><Package className="h-6 w-6 text-orange-600" /></div><div><p className="text-sm font-medium text-muted-foreground">总运输体积</p><p className="text-2xl font-bold">{(overviewStats?.totalVolume || 0).toFixed(1)}立方</p></div></CardContent></Card>
        )}
        
        <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-yellow-100 rounded-lg mr-4"><TrendingUp className="h-6 w-6 text-yellow-600" /></div><div><p className="text-sm font-medium text-muted-foreground">司机应收汇总</p><p className="text-2xl font-bold">{formatCurrency(overviewStats?.totalCost)}</p></div></CardContent></Card>
      </div>
      
      <div className="space-y-6">
        {/* 重量统计图表 */}
        {overviewStats?.weightRecordsCount && overviewStats.weightRecordsCount > 0 && (
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>每日运输重量统计 ({filterInputs.startDate} 至 {filterInputs.endDate}) (吨)</CardTitle>
              <div className="flex items-center space-x-2">
                <Switch id="log-scale-switch-weight" checked={useLogScale} onCheckedChange={setUseLogScale} />
                <Label htmlFor="log-scale-switch-weight" className="cursor-pointer text-sm">对数刻度</Label>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTransportStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleChartClick}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} interval={0} />
                    <YAxis scale={useLogScale ? "log" : "auto"} domain={useLogScale ? [0.1, 'dataMax'] : [0, 'dataMax']} allowDataOverflow tickFormatter={(value) => value.toString()} />
                    <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value, name) => { const label = name === 'actualTransport' ? '有效运输量' : '退货量'; return [`${Number(value).toFixed(2)}`, label]; }} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                    <Legend formatter={(value) => { if (value === 'actualTransport') { return `有效运输量 (${legendTotals.weightTransportTotal.toFixed(1)}吨) - 点击查看全部运单`; } return `退货量 (${legendTotals.weightReturnsTotal.toFixed(1)}吨) - 点击查看全部运单`; }} wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }} onClick={handleLegendClick} />
                    <Bar dataKey="actualTransport" fill="#4ade80" name="actualTransport" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toFixed(1) : '' }} />
                    <Bar dataKey="returns" fill="#ef4444" name="returns" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toFixed(1) : '' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 车次统计图表 */}
        {overviewStats?.tripRecordsCount && overviewStats.tripRecordsCount > 0 && (
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>每日运输车次统计 ({filterInputs.startDate} 至 {filterInputs.endDate}) (车次)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTripStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleChartClick}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} interval={0} />
                    <YAxis allowDecimals={false} domain={[0, 'dataMax + 1']} tickFormatter={(value) => value.toString()} />
                    <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value, name) => { const label = name === 'actualTransport' ? '有效运输' : '退货'; return [`${value} 车次`, label]; }} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                    <Legend formatter={(value) => { if (value === 'actualTransport') { return `有效运输 (${legendTotals.tripTransportTotal}车次) - 点击查看全部运单`; } return `退货 (${legendTotals.tripReturnsTotal}车次) - 点击查看全部运单`; }} wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }} onClick={handleLegendClick} />
                    <Bar dataKey="actualTransport" fill="#8b5cf6" name="actualTransport" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toString() : '' }} />
                    <Bar dataKey="returns" fill="#ef4444" name="returns" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toString() : '' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 体积统计图表 */}
        {overviewStats?.volumeRecordsCount && overviewStats.volumeRecordsCount > 0 && (
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>每日运输体积统计 ({filterInputs.startDate} 至 {filterInputs.endDate}) (立方)</CardTitle>
              <div className="flex items-center space-x-2">
                <Switch id="log-scale-switch-volume" checked={useLogScale} onCheckedChange={setUseLogScale} />
                <Label htmlFor="log-scale-switch-volume" className="cursor-pointer text-sm">对数刻度</Label>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyVolumeStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleChartClick}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} interval={0} />
                    <YAxis scale={useLogScale ? "log" : "auto"} domain={useLogScale ? [0.1, 'dataMax'] : [0, 'dataMax']} allowDataOverflow tickFormatter={(value) => value.toString()} />
                    <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value, name) => { const label = name === 'actualTransport' ? '有效运输量' : '退货量'; return [`${Number(value).toFixed(2)}`, label]; }} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                    <Legend formatter={(value) => { if (value === 'actualTransport') { return `有效运输量 (${legendTotals.volumeTransportTotal.toFixed(1)}立方) - 点击查看全部运单`; } return `退货量 (${legendTotals.volumeReturnsTotal.toFixed(1)}立方) - 点击查看全部运单`; }} wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }} onClick={handleLegendClick} />
                    <Bar dataKey="actualTransport" fill="#f97316" name="actualTransport" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toFixed(1) : '' }} />
                    <Bar dataKey="returns" fill="#ef4444" name="returns" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toFixed(1) : '' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-card">
          <CardHeader><CardTitle>运输日报 ({filterInputs.startDate} 至 {filterInputs.endDate})</CardTitle></CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyCountStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleChartClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} interval={0} />
                  <YAxis allowDecimals={false} domain={[0, 'dataMax + 1']} tickFormatter={(value) => value.toString()} />
                  <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value) => [`${value} 次`, '运输次数']} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} cursor={{ stroke: 'rgba(59, 130, 246, 0.3)', strokeWidth: 2 }} />
                  <Legend formatter={() => `运输次数 (总计${legendTotals.totalTrips}次) - 点击查看全部运单`} wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }} onClick={handleLegendClick} />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4, cursor: 'pointer' }} activeDot={{ r: 6, fill: '#3b82f6', cursor: 'pointer' }} label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toString() : '' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-card">
          <CardHeader><CardTitle>每日运输费用分析 ({filterInputs.startDate} 至 {filterInputs.endDate}) (元)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyCostStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleChartClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} interval={0} />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value) => [formatCurrency(Number(value)), '司机应收']} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                  <Legend formatter={() => `司机应收 (总计${formatCurrency(legendTotals.totalCostSum)}) - 点击查看全部运单`} wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }} onClick={handleLegendClick} />
                  <Bar dataKey="totalCost" fill="#fbbf24" name="totalCost" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 10, fill: '#374151', formatter: (value: number) => value > 0 ? `¥${value.toFixed(0)}` : '' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 详细记录弹窗 - 支持按计费模式显示不同列 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              运单详情 
              {dialogFilter.date ? ` - ${new Date(dialogFilter.date).toLocaleDateString('zh-CN')}` : ' - 全部记录'}
              {filterInputs.projectId !== 'all' && (
                <span className="text-sm text-muted-foreground ml-2">
                  ({projects.find(p => p.id === filterInputs.projectId)?.name})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {isDialogLoading ? (
              <div className="flex justify-center items-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                <span>加载中...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>运单号</TableHead>
                    <TableHead>项目名称</TableHead>
                    <TableHead>司机姓名</TableHead>
                    <TableHead>路线</TableHead>
                    <TableHead>装车日期</TableHead>
                    {/* 动态显示计费相关列 */}
                    {dialogTotals.billingTypes.has(1) && <TableHead className="text-right">装车重量(吨)</TableHead>}
                    {dialogTotals.billingTypes.has(1) && <TableHead className="text-right">卸车重量(吨)</TableHead>}
                    {dialogTotals.billingTypes.has(2) && <TableHead className="text-right">装车车次</TableHead>}
                    {dialogTotals.billingTypes.has(2) && <TableHead className="text-right">卸车车次</TableHead>}
                    {dialogTotals.billingTypes.has(3) && <TableHead className="text-right">装车体积(立方)</TableHead>}
                    {dialogTotals.billingTypes.has(3) && <TableHead className="text-right">卸车体积(立方)</TableHead>}
                    <TableHead>运输类型</TableHead>
                    <TableHead className="text-right">运费(元)</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dialogRecords.length > 0 ? (
                    dialogRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.auto_number}</TableCell>
                        <TableCell>{record.project_name}</TableCell>
                        <TableCell>{record.driver_name}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {record.loading_location} → {record.unloading_location}
                        </TableCell>
                        <TableCell>{new Date(record.loading_date).toLocaleDateString('zh-CN')}</TableCell>
                        {/* 重量列 - 只在包含重量计费时显示 */}
                        {dialogTotals.billingTypes.has(1) && (
                          <>
                            <TableCell className="text-right">
                              {(record.billing_type_id || 1) === 1 ? (record.loading_weight?.toFixed(2) || '-') : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {(record.billing_type_id || 1) === 1 ? (record.unloading_weight?.toFixed(2) || '-') : '-'}
                            </TableCell>
                          </>
                        )}
                        {/* 车次列 - 只在包含车次计费时显示 */}
                        {dialogTotals.billingTypes.has(2) && (
                          <>
                            <TableCell className="text-right">
                              {(record.billing_type_id || 1) === 2 ? '1' : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {(record.billing_type_id || 1) === 2 ? (record.unloading_date ? '1' : '-') : '-'}
                            </TableCell>
                          </>
                        )}
                        {/* 体积列 - 只在包含体积计费时显示 */}
                        {dialogTotals.billingTypes.has(3) && (
                          <>
                            <TableCell className="text-right">
                              {(record.billing_type_id || 1) === 3 ? (record.loading_weight?.toFixed(2) || '-') : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {(record.billing_type_id || 1) === 3 ? (record.loading_weight?.toFixed(2) || '-') : '-'}
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            record.transport_type === '实际运输' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {record.transport_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(record.payable_cost)}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">{record.remarks || '-'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell 
                        colSpan={9 + (dialogTotals.billingTypes.size * 2)} 
                        className="h-24 text-center text-slate-500"
                      >
                        暂无运单记录
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {/* 合计行 */}
                {dialogRecords.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="font-medium">合计</TableCell>
                      {/* 重量合计 */}
                      {dialogTotals.billingTypes.has(1) && (
                        <>
                          <TableCell className="text-right font-medium">{dialogTotals.weightTotal.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">{dialogTotals.weightTotal.toFixed(2)}</TableCell>
                        </>
                      )}
                      {/* 车次合计 */}
                      {dialogTotals.billingTypes.has(2) && (
                        <>
                          <TableCell className="text-right font-medium">{dialogTotals.tripTotal}</TableCell>
                          <TableCell className="text-right font-medium">{dialogTotals.tripTotal}</TableCell>
                        </>
                      )}
                      {/* 体积合计 */}
                      {dialogTotals.billingTypes.has(3) && (
                        <>
                          <TableCell className="text-right font-medium">{dialogTotals.volumeTotal.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">{dialogTotals.volumeTotal.toFixed(2)}</TableCell>
                        </>
                      )}
                      <TableCell></TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(dialogRecords.reduce((sum, r) => sum + (r.payable_cost || 0), 0))}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            )}
          </div>

          <DialogFooter className="flex flex-row justify-between items-center space-y-0">
            <div className="text-sm text-muted-foreground">
              共 {dialogPagination.totalCount} 条记录，第 {dialogPagination.currentPage} / {totalDialogPages} 页
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchDialogRecords(dialogPagination.currentPage - 1)}
                disabled={dialogPagination.currentPage <= 1 || isDialogLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchDialogRecords(dialogPagination.currentPage + 1)}
                disabled={dialogPagination.currentPage >= totalDialogPages || isDialogLoading}
              >
                下一页
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}