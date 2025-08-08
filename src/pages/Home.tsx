// 文件路径: src/pages/Home.tsx
// 描述: [最终修复版] 已实现图例格式化、弹窗分页和弹窗布局优化。

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BarChart3, TrendingUp, Truck, Package, Eye, Database, RefreshCw, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { SupabaseStorage } from "@/utils/supabase";
import { DataMigration } from "@/utils/migration";
import { Project, LogisticsRecord } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";

// 辅助函数：获取默认日期范围
const getDefaultDateRange = () => {
  const today = new Date();
  const year = today.getFullYear();
  return { startDate: `${year}-01-01`, endDate: today.toISOString().split('T')[0] };
};

// 【图例格式化】辅助函数：格式化为财务数字
const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return '¥0.00';
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
};

// 为RPC返回的数据定义完整的类型
interface DailyTransportStats { date: string; actualTransport: number; returns: number; }
interface DailyCostStats { date: string; totalCost: number; }
interface DailyCountStats { date: string; count: number; }
interface OverviewStats { totalRecords: number; totalWeight: number; totalCost: number; actualTransportCount: number; returnCount: number; }
interface DashboardData {
  overview: OverviewStats;
  dailyTransportStats: DailyTransportStats[];
  dailyCostStats: DailyCostStats[];
  dailyCountStats: DailyCountStats[];
}

// --- 主组件 ---
export default function Home() {
  // 状态管理
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [dailyTransportStats, setDailyTransportStats] = useState<DailyTransportStats[]>([]);
  const [dailyCostStats, setDailyCostStats] = useState<DailyCostStats[]>([]);
  const [dailyCountStats, setDailyCountStats] = useState<DailyCountStats[]>([]);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{ supabaseCount: number; localCount: number; isMigrated: boolean; } | null>(null);
  const [useLogScale, setUseLogScale] = useState(false);

  // 【弹窗分页 - 状态】为弹窗详情增加独立的分页状态
  const [dialogRecords, setDialogRecords] = useState<LogisticsRecord[]>([]);
  const [isDialogLoading, setIsDialogLoading] = useState(false);
  const [dialogFilter, setDialogFilter] = useState<{projectId: string | null, date: string | null}>({ projectId: null, date: null });
  const [dialogPagination, setDialogPagination] = useState({
    currentPage: 1,
    pageSize: 15, // 每页显示15条
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

  // 【弹窗分页 - 数据获取】改造数据获取函数以支持分页
  const fetchDialogRecords = useCallback(async (page = 1) => {
    setIsDialogLoading(true);
    setDialogPagination(prev => ({ ...prev, currentPage: page }));
    try {
      const projectId = dialogFilter.projectId === 'all' ? undefined : dialogFilter.projectId;
      const startDate = dialogFilter.date ? dialogFilter.date : filterInputs.startDate;
      const endDate = dialogFilter.date ? dialogFilter.date : filterInputs.endDate;
      const offset = (page - 1) * dialogPagination.pageSize;

      const { records, totalCount } = await SupabaseStorage.getFilteredLogisticsRecords(
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
      await Promise.all([loadProjects(), checkMigrationStatus()]);
      await handleSearch(true);
      setIsLoading(false);
    };
    initialLoad();
  }, [loadProjects, checkMigrationStatus, handleSearch]);

  useEffect(() => {
    if (isDetailDialogOpen) {
      // 弹窗打开时，从第一页开始加载
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

  const legendTotals = useMemo(() => ({
    actualTransportTotal: dailyTransportStats.reduce((sum, day) => sum + (day.actualTransport || 0), 0),
    returnsTotal: dailyTransportStats.reduce((sum, day) => sum + (day.returns || 0), 0),
    totalCostSum: dailyCostStats.reduce((sum, day) => sum + (day.totalCost || 0), 0),
    totalTrips: dailyCountStats.reduce((sum, day) => sum + (day.count || 0), 0),
  }), [dailyTransportStats, dailyCostStats, dailyCountStats]);
  
  // 【弹窗分页 - UI】计算总页数
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-blue-100 rounded-lg mr-4"><Package className="h-6 w-6 text-blue-600" /></div><div><p className="text-sm font-medium text-muted-foreground">总运输次数</p><p className="text-2xl font-bold">{overviewStats?.totalRecords || 0}</p></div></CardContent></Card>
        <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-green-100 rounded-lg mr-4"><Truck className="h-6 w-6 text-green-600" /></div><div><p className="text-sm font-medium text-muted-foreground">总运输重量</p><p className="text-2xl font-bold">{(overviewStats?.totalWeight || 0).toFixed(1)}吨</p></div></CardContent></Card>
        <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-yellow-100 rounded-lg mr-4"><TrendingUp className="h-6 w-6 text-yellow-600" /></div><div><p className="text-sm font-medium text-muted-foreground">司机应收汇总</p><p className="text-2xl font-bold">{formatCurrency(overviewStats?.totalCost)}</p></div></CardContent></Card>
        <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-purple-100 rounded-lg mr-4"><BarChart3 className="h-6 w-6 text-purple-600" /></div><div><p className="text-sm font-medium text-muted-foreground">实际运输/退货</p><p className="text-2xl font-bold">{overviewStats?.actualTransportCount || 0}/{overviewStats?.returnCount || 0}</p></div></CardContent></Card>
      </div>
      
      <div className="space-y-6">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>每日运输量统计 ({filterInputs.startDate} 至 {filterInputs.endDate}) (吨)</CardTitle>
            <div className="flex items-center space-x-2">
              <Switch id="log-scale-switch-home" checked={useLogScale} onCheckedChange={setUseLogScale} />
              <Label htmlFor="log-scale-switch-home" className="cursor-pointer text-sm">对数刻度</Label>
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
                  <Legend formatter={(value) => { if (value === 'actualTransport') { return `有效运输量 (${legendTotals.actualTransportTotal.toFixed(1)}吨) - 点击查看全部运单`; } return `退货量 (${legendTotals.returnsTotal.toFixed(1)}吨) - 点击查看全部运单`; }} wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }} onClick={handleLegendClick} />
                  <Bar dataKey="actualTransport" fill="#4ade80" name="actualTransport" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toFixed(1) : '' }} />
                  <Bar dataKey="returns" fill="#ef4444" name="returns" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toFixed(1) : '' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
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
                  {/* 【图例格式化】Y轴刻度也使用财务格式 */}
                  <YAxis scale={useLogScale ? "log" : "auto"} domain={useLogScale ? [0.1, 'dataMax'] : [0, 'dataMax']} allowDataOverflow tickFormatter={(value) => `¥${Number(value).toLocaleString('zh-CN', {minimumFractionDigits: 0})}`} />
                  {/* 【图例格式化】Tooltip提示也使用财务格式 */}
                  <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value) => [formatCurrency(value as number), '总费用']} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }} />
                  {/* 【图例格式化】图例也使用财务格式 */}
                  <Legend formatter={() => `总费用 (${formatCurrency(legendTotals.totalCostSum)}) - 点击查看全部运单`} wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }} onClick={handleLegendClick} />
                  <Bar dataKey="totalCost" fill="#10b981" name="totalCost" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? `¥${Number(value).toFixed(0)}` : '' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 【弹窗布局优化】DialogContent 使用 flex 布局，并为表格内容区设置 flex-grow */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col" aria-describedby="dialog-description">
          <DialogHeader>
            <DialogTitle className="flex items-center"><Eye className="mr-2 h-5 w-5" />{dialogFilter.date ? `${new Date(dialogFilter.date).toLocaleDateString('zh-CN')} 详细运输记录` : `全部筛选结果记录`}</DialogTitle>
            <div id="dialog-description" className="sr-only">显示运输记录详细信息</div>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto">
          {isDialogLoading ? (
            <div className="flex items-center justify-center h-full"><RefreshCw className="h-6 w-6 animate-spin" /><span className="ml-2">正在加载详细记录...</span></div>
          ) : dialogRecords.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader><TableRow className="text-xs"><TableHead>运单号</TableHead><TableHead>项目</TableHead><TableHead>司机</TableHead><TableHead>车牌</TableHead><TableHead>装货地</TableHead><TableHead>卸货地</TableHead><TableHead>装货重</TableHead><TableHead>卸货重</TableHead><TableHead>类型</TableHead><TableHead>司机应收</TableHead><TableHead>备注</TableHead></TableRow></TableHeader>
                <TableBody>
                  {dialogRecords.map((record) => (
                    <TableRow key={record.id} className="text-xs">
                      <TableCell className="font-medium whitespace-nowrap">{record.autoNumber}</TableCell>
                      <TableCell className="whitespace-nowrap">{record.projectName || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{record.driverName}</TableCell>
                      <TableCell className="whitespace-nowrap">{record.licensePlate}</TableCell>
                      <TableCell className="whitespace-nowrap">{record.loadingLocation}</TableCell>
                      <TableCell className="whitespace-nowrap">{record.unloadingLocation}</TableCell>
                      <TableCell className="whitespace-nowrap">{record.loadingWeight?.toFixed(2) || '-'}吨</TableCell>
                      <TableCell className="whitespace-nowrap">{record.unloadingWeight?.toFixed(2) || '-'}吨</TableCell>
                      <TableCell><span className={`px-1 py-0.5 rounded-full text-xs whitespace-nowrap ${record.transportType === "实际运输" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{record.transportType}</span></TableCell>
                      <TableCell className="whitespace-nowrap">{record.payableFee ? formatCurrency(record.payableFee) : '-'}</TableCell>
                      <TableCell className="max-w-[120px] truncate" title={record.remarks}>{record.remarks || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (<div className="flex items-center justify-center h-full text-muted-foreground">没有符合条件的运输记录</div>)}
          </div>
          {/* 【弹窗分页 - UI】添加分页组件 */}
          {totalDialogPages > 1 && (
            <DialogFooter className="pt-4 border-t">
                <div className="flex items-center justify-between w-full">
                    <div className="text-sm text-muted-foreground">
                        共 {dialogPagination.totalCount} 条记录
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchDialogRecords(dialogPagination.currentPage - 1)}
                            disabled={dialogPagination.currentPage <= 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            上一页
                        </Button>
                        <span className="text-sm">
                            第 {dialogPagination.currentPage} 页 / 共 {totalDialogPages} 页
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchDialogRecords(dialogPagination.currentPage + 1)}
                            disabled={dialogPagination.currentPage >= totalDialogPages}
                        >
                            下一页
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
