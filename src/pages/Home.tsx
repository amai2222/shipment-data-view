// 文件路径: src/pages/Home.tsx
// 描述: [V2.7 最终版] 实现了自动筛选、美化汇总卡片、并优化了详情弹窗表格。

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BarChart3, TrendingUp, Truck, Package, Eye, RefreshCw, Search, ChevronLeft, ChevronRight, Cuboid } from "lucide-react";
import { SupabaseStorage } from "@/utils/supabase";
import { Project, LogisticsRecord } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// --- 类型定义 ---

const BILLING_TYPE_MAP = {
  '1': { name: '计重', unit: '吨', icon: Truck },
  '2': { name: '计车', unit: '车', icon: Package },
  '3': { name: '计体积', unit: '立方', icon: Cuboid },
};

interface DailyStat { date: string; actualTransport: number; returns: number; }
interface DailyStatsGroup { stats: DailyStat[]; totalActual: number; totalReturns: number; }
interface DailyCostStat { date:string; totalCost: number; }
interface DailyCountStat { date: string; count: number; }
interface OverviewStats { totalRecords: number; totalCost: number; actualTransportCount: number; returnCount: number; }
interface DashboardDataV2 {
  overview: OverviewStats;
  daily_stats_by_type: { [key in '1' | '2' | '3']?: DailyStatsGroup };
  dailyCostStats: DailyCostStat[];
  dailyCountStats: DailyCountStat[];
}

// --- 辅助函数 ---

const getDefaultDateRange = () => {
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - 45);
  const formatISODate = (date: Date) => date.toISOString().split('T')[0];
  return { startDate: formatISODate(startDate), endDate: formatISODate(today) };
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return '¥0.00';
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
};

// --- 主组件 ---
export default function Home() {
  // --- 状态管理 ---
  const [dashboardData, setDashboardData] = useState<DashboardDataV2 | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [useLogScale, setUseLogScale] = useState(false);
  
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [dialogRecords, setDialogRecords] = useState<LogisticsRecord[]>([]);
  const [isDialogLoading, setIsDialogLoading] = useState(false);
  const [dialogFilter, setDialogFilter] = useState<{ projectId: string | null; date: string | null; billingTypeId: keyof typeof BILLING_TYPE_MAP | null }>({ projectId: null, date: null, billingTypeId: null });
  const [dialogPagination, setDialogPagination] = useState({ currentPage: 1, pageSize: 15, totalCount: 0 });

  const [filterInputs, setFilterInputs] = useState(() => ({ ...getDefaultDateRange(), projectId: 'all' }));
  const { toast } = useToast();
  // ★★★ 核心修改 #1: 用于实现自动筛选，避免首次加载时触发两次搜索 ★★★
  const isInitialMount = useRef(true);

  // --- 数据获取 ---

  const handleSearch = useCallback(async () => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase.rpc('get_dashboard_stats_v2', {
        p_start_date: filterInputs.startDate,
        p_end_date: filterInputs.endDate,
        p_project_id: filterInputs.projectId === 'all' ? null : filterInputs.projectId,
      });
      if (error) throw error;
      setDashboardData(data);
    } catch (err: any) {
      console.error('获取看板数据失败:', err);
      toast({ title: "数据加载失败", description: err.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  }, [filterInputs, toast]);

  const fetchDialogRecords = useCallback(async (page = 1) => {
    setIsDialogLoading(true);
    setDialogPagination(prev => ({ ...prev, currentPage: page }));
    try {
      const projectId = dialogFilter.projectId === 'all' ? undefined : dialogFilter.projectId;
      const startDate = dialogFilter.date ? dialogFilter.date : filterInputs.startDate;
      const endDate = dialogFilter.date ? dialogFilter.date : filterInputs.endDate;
      const offset = (page - 1) * dialogPagination.pageSize;
      const typeId = dialogFilter.billingTypeId ? parseInt(dialogFilter.billingTypeId, 10) : undefined;

      const { records, totalCount } = await SupabaseStorage.getFilteredLogisticsRecords(
        projectId, undefined, startDate, endDate, 
        dialogPagination.pageSize, offset, typeId
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

  // 首次加载
  useEffect(() => {
    const initialLoad = async () => {
      setIsLoading(true);
      try {
        const [projectsData] = await Promise.all([
          SupabaseStorage.getProjects() as Promise<Project[]>,
        ]);
        setProjects(projectsData);
        
        // 首次加载数据
        const { data, error } = await supabase.rpc('get_dashboard_stats_v2', {
          p_start_date: filterInputs.startDate,
          p_end_date: filterInputs.endDate,
          p_project_id: filterInputs.projectId === 'all' ? null : filterInputs.projectId,
        });
        if (error) throw error;
        setDashboardData(data);

      } catch (error) {
        console.error("初始化加载失败:", error);
        toast({ title: "初始化加载失败", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    initialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ★★★ 核心修改 #2: 监听筛选条件变化，自动执行搜索 ★★★
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const handler = setTimeout(() => {
      handleSearch();
    }, 500); // 添加一个防抖，避免日期选择时频繁请求
    return () => clearTimeout(handler);
  }, [filterInputs, handleSearch]);


  useEffect(() => {
    if (isDetailDialogOpen) {
      fetchDialogRecords(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDetailDialogOpen, dialogFilter]);

  // --- 事件处理 ---

  const handleTypeChartClick = useCallback((billingTypeId: keyof typeof BILLING_TYPE_MAP, data: any) => {
    if (data?.activePayload?.[0]) {
      const clickedDate = data.activePayload[0].payload.date;
      setDialogFilter({ projectId: filterInputs.projectId, date: clickedDate, billingTypeId });
      setIsDetailDialogOpen(true);
    }
  }, [filterInputs.projectId]);

  const handleTypeLegendClick = useCallback((billingTypeId: keyof typeof BILLING_TYPE_MAP) => {
    setDialogFilter({ projectId: filterInputs.projectId, date: null, billingTypeId });
    setIsDetailDialogOpen(true);
  }, [filterInputs.projectId]);

  const handleOverviewChartClick = useCallback((data: any) => {
    if (data?.activePayload?.[0]) {
      const clickedDate = data.activePayload[0].payload.date;
      setDialogFilter({ projectId: filterInputs.projectId, date: clickedDate, billingTypeId: null });
      setIsDetailDialogOpen(true);
    }
  }, [filterInputs.projectId]);

  const handleOverviewLegendClick = useCallback(() => {
    setDialogFilter({ projectId: filterInputs.projectId, date: null, billingTypeId: null });
    setIsDetailDialogOpen(true);
  }, [filterInputs.projectId]);


  // --- 计算属性 ---

  const selectedProjectName = useMemo(() => {
    if (filterInputs.projectId === 'all') return '所有项目';
    return projects.find(p => p.id === filterInputs.projectId)?.name || '所有项目';
  }, [filterInputs.projectId, projects]);

  const totalDialogPages = Math.ceil(dialogPagination.totalCount / dialogPagination.pageSize);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><RefreshCw className="h-8 w-8 animate-spin" /><span className="ml-2">正在初始化...</span></div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 sticky top-4 z-10 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center"><BarChart3 className="mr-2" />数据看板</h1>
            {isSearching && <RefreshCw className="ml-3 h-5 w-5 animate-spin text-blue-500" />}
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="space-y-1"><Label htmlFor="startDate" className="text-xs font-medium">开始日期</Label><Input id="startDate" type="date" value={filterInputs.startDate} onChange={(e) => setFilterInputs(p => ({...p, startDate: e.target.value}))} /></div>
            <div className="space-y-1"><Label htmlFor="endDate" className="text-xs font-medium">结束日期</Label><Input id="endDate" type="date" value={filterInputs.endDate} onChange={(e) => setFilterInputs(p => ({...p, endDate: e.target.value}))} /></div>
            <div className="space-y-1">
              <Label htmlFor="projectFilter" className="text-xs font-medium">项目筛选</Label>
              <Select value={filterInputs.projectId} onValueChange={(val) => setFilterInputs(p => ({...p, projectId: val}))}>
                <SelectTrigger id="projectFilter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有项目</SelectItem>
                  {projects.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {/* ★★★ 核心修改 #3: 移除了搜索按钮 ★★★ */}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card><CardContent className="flex items-center p-6"><div className="p-3 bg-blue-100 rounded-lg mr-4"><Package className="h-6 w-6 text-blue-600" /></div><div><p className="text-sm text-muted-foreground">总运输次数</p><p className="text-2xl font-bold text-blue-600">{dashboardData?.overview?.totalRecords || 0}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center p-6"><div className="p-3 bg-yellow-100 rounded-lg mr-4"><TrendingUp className="h-6 w-6 text-yellow-600" /></div><div><p className="text-sm text-muted-foreground">司机应收汇总</p><p className="text-2xl font-bold text-yellow-600">{formatCurrency(dashboardData?.overview?.totalCost)}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center p-6"><div className="p-3 bg-purple-100 rounded-lg mr-4"><BarChart3 className="h-6 w-6 text-purple-600" /></div><div><p className="text-sm text-muted-foreground">实际运输/退货</p><p className="text-2xl font-bold text-purple-600">{dashboardData?.overview?.actualTransportCount ?? '—'} / {dashboardData?.overview?.returnCount ?? '—'}</p></div></CardContent></Card>
      </div>
      
      <div className="space-y-6">
        {/* ... 图表部分代码保持不变 ... */}
        {Object.entries(dashboardData?.daily_stats_by_type || {}).map(([typeId, data]) => {
          const typeInfo = BILLING_TYPE_MAP[typeId as keyof typeof BILLING_TYPE_MAP];
          if (!typeInfo || !data) return null;
          const filteredData = data.stats.filter(day => day.actualTransport > 0 || day.returns > 0);

          return (
            <Card key={typeId}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {typeInfo.icon && <typeInfo.icon className="h-5 w-5" />}
                  <span className="text-base font-medium text-muted-foreground">({typeInfo.name})</span>
                  <span>{selectedProjectName} - 每日运输量</span>
                </CardTitle>
                <div className="flex items-center space-x-2"><Switch id={`log-scale-${typeId}`} checked={useLogScale} onCheckedChange={setUseLogScale} /><Label htmlFor={`log-scale-${typeId}`} className="text-sm">对数刻度</Label></div>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={(d) => handleTypeChartClick(typeId as keyof typeof BILLING_TYPE_MAP, d)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} />
                      <YAxis scale={useLogScale ? "log" : "auto"} domain={useLogScale ? [0.1, 'dataMax'] : [0, 'dataMax']} tickFormatter={(val) => val.toString()} />
                      <Tooltip labelFormatter={(val) => new Date(val).toLocaleDateString('zh-CN')} formatter={(val, name) => [`${Number(val).toFixed(2)} ${typeInfo.unit}`, name === 'actualTransport' ? '有效运输' : '退货']} />
                      <Legend onClick={() => handleTypeLegendClick(typeId as keyof typeof BILLING_TYPE_MAP)} formatter={(val) => `${val === 'actualTransport' ? '有效运输' : '退货'} (总计 ${val === 'actualTransport' ? data.totalActual.toFixed(1) : data.totalReturns.toFixed(1)} ${typeInfo.unit})`} wrapperStyle={{ paddingTop: '20px', cursor: 'pointer' }} />
                      <Bar dataKey="actualTransport" fill="#4ade80" name="actualTransport" radius={[2, 2, 0, 0]} label={{ position: 'top', fontSize: 12, formatter: (val: number) => val > 0 ? val.toFixed(1) : '' }} />
                      <Bar dataKey="returns" fill="#ef4444" name="returns" radius={[2, 2, 0, 0]} label={{ position: 'top', fontSize: 12, formatter: (val: number) => val > 0 ? val.toFixed(1) : '' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {dashboardData?.dailyCountStats && dashboardData.dailyCountStats.length > 0 && (
          <Card>
            <CardHeader><CardTitle>{selectedProjectName} - 运输日报</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.dailyCountStats.filter(d => d.count > 0)} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleOverviewChartClick}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} />
                    <YAxis allowDecimals={false} domain={[0, 'dataMax + 1']} />
                    <Tooltip labelFormatter={(val) => new Date(val).toLocaleDateString('zh-CN')} formatter={(val) => [`${val} 次`, '运输次数']} />
                    <Legend onClick={handleOverviewLegendClick} formatter={() => `运输次数 (总计 ${dashboardData.overview.totalRecords} 次)`} wrapperStyle={{ paddingTop: '20px', cursor: 'pointer' }} />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} label={{ position: 'top', fontSize: 12, formatter: (val: number) => val > 0 ? val.toString() : '' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {dashboardData?.dailyCostStats && dashboardData.dailyCostStats.length > 0 && (
          <Card>
            <CardHeader><CardTitle>{selectedProjectName} - 每日运输费用分析</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.dailyCostStats.filter(d => d.totalCost > 0)} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleOverviewChartClick}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(val) => `¥${Number(val).toLocaleString()}`} />
                    <Tooltip labelFormatter={(val) => new Date(val).toLocaleDateString('zh-CN')} formatter={(val) => [formatCurrency(val as number), '总费用']} />
                    <Legend onClick={handleOverviewLegendClick} formatter={() => `总费用 (${formatCurrency(dashboardData.overview.totalCost)})`} wrapperStyle={{ paddingTop: '20px', cursor: 'pointer' }} />
                    <Bar dataKey="totalCost" fill="#10b981" radius={[2, 2, 0, 0]} label={{ position: 'top', fontSize: 12, formatter: (val: number) => val > 0 ? `¥${val.toFixed(0)}` : '' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Eye className="mr-2" />
              {dialogFilter.date ? `${new Date(dialogFilter.date).toLocaleDateString('zh-CN')} 详细记录` : `全部筛选结果`} 
              ({dialogFilter.billingTypeId ? BILLING_TYPE_MAP[dialogFilter.billingTypeId]?.name : '所有类型'})
            </DialogTitle>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto">
          {isDialogLoading ? (
            <div className="flex items-center justify-center h-full"><RefreshCw className="h-6 w-6 animate-spin" /><span>加载中...</span></div>
          ) : dialogRecords.length > 0 ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>运单号</TableHead><TableHead>项目</TableHead><TableHead>司机</TableHead><TableHead>车牌</TableHead>
                {/* ★★★ 核心修改 #4: 合并装卸地为“线路” ★★★ */}
                <TableHead>线路</TableHead>
                <TableHead>装货量</TableHead><TableHead>卸货量</TableHead>
                <TableHead>类型</TableHead><TableHead>司机应收</TableHead><TableHead>备注</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {dialogRecords.map((record) => {
                  const unit = record.billing_type_id 
                    ? BILLING_TYPE_MAP[record.billing_type_id.toString() as keyof typeof BILLING_TYPE_MAP]?.unit || '' 
                    : '';
                  // ★★★ 核心修改 #5: 创建线路字符串 ★★★
                  const route = `${record.loadingLocation?.substring(0, 2) || ''}-${record.unloadingLocation?.substring(0, 2) || ''}`;
                  
                  return (
                    <TableRow key={record.id}>
                      {/* ★★★ 核心修改 #6: 应用 nowrap 和 truncate 样式 ★★★ */}
                      <TableCell className="whitespace-nowrap">{record.autoNumber}</TableCell>
                      <TableCell className="whitespace-nowrap max-w-[150px] truncate" title={record.projectName}>{record.projectName || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{record.driverName}</TableCell>
                      <TableCell className="whitespace-nowrap">{record.licensePlate}</TableCell>
                      <TableCell className="whitespace-nowrap">{route}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {record.loadingWeight != null ? `${record.loadingWeight.toFixed(2)} ${unit}`.trim() : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {record.unloadingWeight != null ? `${record.unloadingWeight.toFixed(2)} ${unit}`.trim() : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap"><span className={`px-2 py-1 rounded-full text-xs ${record.transportType === "实际运输" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{record.transportType}</span></TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(record.payableFee)}</TableCell>
                      <TableCell className="whitespace-nowrap max-w-[150px] truncate" title={record.remarks}>{record.remarks || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (<div className="flex items-center justify-center h-full text-muted-foreground">没有符合条件的记录</div>)}
          </div>
          {totalDialogPages > 1 && (
            <DialogFooter className="pt-4 border-t">
              <div className="flex items-center justify-between w-full">
                <div className="text-sm">共 {dialogPagination.totalCount} 条</div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => fetchDialogRecords(dialogPagination.currentPage - 1)} disabled={dialogPagination.currentPage <= 1}><ChevronLeft className="h-4 w-4" /> 上一页</Button>
                  <span>第 {dialogPagination.currentPage} / {totalDialogPages} 页</span>
                  <Button variant="outline" size="sm" onClick={() => fetchDialogRecords(dialogPagination.currentPage + 1)} disabled={dialogPagination.currentPage >= totalDialogPages}>下一页 <ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
