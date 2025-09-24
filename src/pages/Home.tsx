// 文件路径: src/pages/Home.tsx
// 描述: [最终审核版] 实现了数据看板的全部功能，包括混合式搜索、动态卡片和所有UI优化。

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BarChart3, TrendingUp, Truck, Package, Eye, RefreshCw, Search, ChevronLeft, ChevronRight, Cuboid, DollarSign, Banknote } from "lucide-react";
import { SupabaseStorage } from "@/utils/supabase";
import { Project, LogisticsRecord } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveNumber, ResponsiveCurrency, ResponsiveNumberWithUnit } from "@/components/ResponsiveNumber";
import { WaybillDetailDialog } from "@/components/WaybillDetailDialog";

// --- 类型定义 ---

const BILLING_TYPE_MAP = {
  '1': { name: '计重', unit: '吨', icon: Truck, color: 'text-green-600', bgColor: 'bg-green-100' },
  '2': { name: '计车', unit: '车', icon: Package, color: 'text-sky-600', bgColor: 'bg-sky-100' },
  '3': { name: '计体积', unit: '立方', icon: Cuboid, color: 'text-orange-600', bgColor: 'bg-orange-100' },
};

interface DailyStat { date: string; actualTransport: number; returns: number; }
interface DailyStatsGroup { stats: DailyStat[]; totalActual: number; totalReturns: number; }
interface DailyCostStat { date:string; totalCost: number; }
interface DailyCountStat { date: string; count: number; }
interface OverviewStats { totalRecords: number; totalCost: number; actualTransportCount: number; returnCount: number; }
interface DashboardDataV2 {
  overview: OverviewStats;
  totalQuantityByType: { [key in '1' | '2' | '3']?: number };
  daily_stats_by_type: { [key in '1' | '2' | '3']?: DailyStatsGroup };
  dailyCostStats: DailyCostStat[];
  dailyCountStats: DailyCountStat[];
}

// --- 辅助函数 ---

const getDefaultDateRange = () => {
  const today = new Date();
  // 默认开始日期设为2025-01-01
  const startDate = new Date('2025-01-01');
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
  
  // 运单详情弹窗状态
  const [isWaybillDetailOpen, setIsWaybillDetailOpen] = useState(false);
  const [selectedWaybill, setSelectedWaybill] = useState<LogisticsRecord | null>(null);

  const [projectStatusFilter, setProjectStatusFilter] = useState('进行中');
  const [filterInputs, setFilterInputs] = useState(() => ({ ...getDefaultDateRange(), projectId: 'all' }));
  const { toast } = useToast();
  const isInitialMount = useRef(true);

  // --- 数据获取 ---

  const handleSearch = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setIsLoading(true);
    else setIsSearching(true);
    
    try {
      const { data, error } = await supabase.rpc('get_dashboard_stats_with_billing_types', {
        p_start_date: filterInputs.startDate,
        p_end_date: filterInputs.endDate,
        p_project_id: filterInputs.projectId === 'all' ? null : filterInputs.projectId,
      });
      if (error) throw error;
      setDashboardData(data as any);
    } catch (err: any) {
      console.error('获取看板数据失败:', err);
      toast({ title: "数据加载失败", description: err.message, variant: "destructive" });
    } finally {
      if (isInitialLoad) setIsLoading(false);
      else setIsSearching(false);
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

  // 根据状态筛选获取项目列表
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const projectsData = await SupabaseStorage.getProjects(projectStatusFilter);
        setProjects(projectsData);
        if (filterInputs.projectId !== 'all' && !projectsData.some(p => p.id === filterInputs.projectId)) {
          setFilterInputs(p => ({ ...p, projectId: 'all' }));
        }
      } catch (error) {
        console.error("加载项目列表失败:", error);
        toast({ title: "加载项目列表失败", variant: "destructive" });
      }
    };
    fetchProjects();
  }, [projectStatusFilter, filterInputs.projectId, toast]);

  // 首次加载
  useEffect(() => {
    handleSearch(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听项目状态和项目ID变化，自动执行搜索
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    handleSearch(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterInputs.projectId, projectStatusFilter]);

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

  // 处理运单详情点击
  const handleWaybillClick = useCallback((record: LogisticsRecord) => {
    // 转换字段名以兼容WaybillDetailDialog组件
    const mappedRecord = {
      ...record,
      auto_number: record.autoNumber || record.auto_number,
      loading_location: record.loadingLocation || record.loading_location,
      unloading_location: record.unloadingLocation || record.unloading_location,
      driver_name: record.driverName || record.driver_name,
      license_plate: record.licensePlate || record.license_plate,
      driver_phone: record.driverPhone || record.driver_phone,
      project_name: record.projectName || record.project_name,
      transport_type: record.transportType || record.transport_type,
      loading_weight: record.loadingWeight || record.loading_weight,
      unloading_weight: record.unloadingWeight || record.unloading_weight,
      loading_date: record.loadingDate || record.loading_date,
      unloading_date: record.unloadingDate || record.unloading_date,
      payable_cost: record.payableFee || record.payable_cost || record.payableCost,
      current_cost: record.currentCost || record.current_cost,
      extra_cost: record.extraCost || record.extra_cost,
      billing_type_id: record.billing_type_id || record.billingTypeId,
      chain_name: record.chainName || record.chain_name,
      remarks: record.remarks
    };
    setSelectedWaybill(mappedRecord as LogisticsRecord);
    setIsWaybillDetailOpen(true);
  }, []);

  // 关闭运单详情弹窗
  const handleCloseWaybillDetail = useCallback(() => {
    setIsWaybillDetailOpen(false);
    setSelectedWaybill(null);
  }, []);

  // --- 计算属性 ---
  const selectedProjectName = useMemo(() => {
    if (filterInputs.projectId === 'all') return '所有项目';
    return projects.find(p => p.id === filterInputs.projectId)?.name || '所有项目';
  }, [filterInputs.projectId, projects]);

  const totalDialogPages = Math.ceil(dialogPagination.totalCount / dialogPagination.pageSize);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">正在初始化...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 pl-4 md:pl-6">
      <header className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 shadow-sm sticky top-4 z-10">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
                <Truck className="mr-3 h-7 w-7 text-blue-600" />
                运输看板
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">实时监控运输数据和业务指标</p>
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <div className="space-y-1"><Label htmlFor="startDate" className="text-xs font-medium">开始日期</Label><Input id="startDate" type="date" value={filterInputs.startDate} onChange={(e) => setFilterInputs(p => ({...p, startDate: e.target.value}))} /></div>
              <div className="space-y-1"><Label htmlFor="endDate" className="text-xs font-medium">结束日期</Label><Input id="endDate" type="date" value={filterInputs.endDate} onChange={(e) => setFilterInputs(p => ({...p, endDate: e.target.value}))} /></div>
              <div className="space-y-1">
                <Label htmlFor="projectStatusFilter" className="text-xs font-medium">项目状态</Label>
                <Select value={projectStatusFilter} onValueChange={setProjectStatusFilter}>
                  <SelectTrigger id="projectStatusFilter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="进行中">进行中</SelectItem>
                    <SelectItem value="已完成">已完成</SelectItem>
                    <SelectItem value="所有状态">所有状态</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              <Button onClick={() => handleSearch(false)} disabled={isSearching}>
                {isSearching ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                {isSearching ? '搜索中...' : '搜索'}
              </Button>
            </div>
        </div>
      </header>

      {/* 重新设计的卡片组 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
        {/* 总运输次数卡片 - 主要指标 */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50 border-0 shadow-lg hover:shadow-2xl transition-all duration-500 group cursor-pointer" onClick={handleOverviewLegendClick}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5"></div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -translate-y-12 translate-x-12"></div>
          <CardContent className="relative p-4 space-y-3 h-full flex flex-col">
            <div className="flex items-center">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                <Package className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-gray-600">总运输次数</h3>
                <div className="flex items-center text-xs text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  活跃
                </div>
              </div>
              <ResponsiveNumber value={dashboardData?.overview?.totalRecords || 0} className="text-gray-900" />
              <p className="text-xs text-gray-500">累计运输记录统计</p>
            </div>
            <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full"></div>
          </CardContent>
        </Card>
        
        {/* 货运类型统计卡片 */}
        {dashboardData?.totalQuantityByType && Object.entries(dashboardData.totalQuantityByType)
          .sort(([keyA], [keyB]) => parseInt(keyA) - parseInt(keyB))
          .map(([typeId, total], index) => {
            const typeInfo = BILLING_TYPE_MAP[typeId as keyof typeof BILLING_TYPE_MAP];
            if (!typeInfo || total <= 0) return null;
            const Icon = typeInfo.icon;
            
            // 为不同类型定义不同的颜色主题
            const colorThemes = [
              { bg: 'from-emerald-50 via-white to-teal-50', gradient: 'from-emerald-500 to-teal-600', accent: 'emerald-600', ring: 'emerald-500/20' },
              { bg: 'from-orange-50 via-white to-red-50', gradient: 'from-orange-500 to-red-600', accent: 'orange-600', ring: 'orange-500/20' },
              { bg: 'from-purple-50 via-white to-indigo-50', gradient: 'from-purple-500 to-indigo-600', accent: 'purple-600', ring: 'purple-500/20' },
              { bg: 'from-pink-50 via-white to-rose-50', gradient: 'from-pink-500 to-rose-600', accent: 'pink-600', ring: 'pink-500/20' }
            ];
            const theme = colorThemes[index % colorThemes.length];
            
            return (
              <Card key={typeId} className={`relative overflow-hidden bg-gradient-to-br ${theme.bg} border-0 shadow-lg hover:shadow-2xl transition-all duration-500 group cursor-pointer`}>
                <div className={`absolute inset-0 bg-gradient-to-br from-${theme.accent}/5 via-transparent to-${theme.accent}/5`}></div>
                <div className={`absolute -top-6 -right-6 w-20 h-20 bg-gradient-to-br from-${theme.accent}/10 to-transparent rounded-full`}></div>
                <CardContent className="relative p-4 space-y-3 h-full flex flex-col">
                  <div className="flex items-center">
                    <div className={`p-2 bg-gradient-to-br ${theme.gradient} rounded-xl shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-sm font-semibold text-gray-600">{typeInfo.name}总量</h3>
                      <div className={`px-2 py-1 bg-${theme.accent}/10 rounded-full`}>
                        <span className={`text-xs font-medium text-${theme.accent}`}>统计</span>
                      </div>
                    </div>
                    <ResponsiveNumberWithUnit value={total} unit={typeInfo.unit} className="text-gray-900" />
                    <p className="text-xs text-gray-500">累计{typeInfo.name}数据</p>
                  </div>
                  <div className={`h-1 bg-gradient-to-r ${theme.gradient} rounded-full`}></div>
                </CardContent>
              </Card>
            );
        })}

        {/* 司机应收汇总卡片 */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-yellow-50 border-0 shadow-lg hover:shadow-2xl transition-all duration-500 group cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-yellow-500/5"></div>
          <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-full"></div>
          <CardContent className="relative p-4 space-y-3 h-full flex flex-col">
            <div className="flex items-center">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-gray-600">司机应收汇总</h3>
                <div className="flex items-center text-xs text-amber-600">
                  <Banknote className="h-3 w-3 mr-1" />
                  收入
                </div>
              </div>
              <ResponsiveCurrency value={dashboardData?.overview?.totalCost} className="text-gray-900" />
              <p className="text-xs text-gray-500">累计应收费用统计</p>
            </div>
            <div className="h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 rounded-full"></div>
          </CardContent>
        </Card>

        {/* 运输状态统计卡片 */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-white to-purple-50 border-0 shadow-lg hover:shadow-2xl transition-all duration-500 group cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-purple-500/5"></div>
          <div className="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-violet-500/10 to-transparent rounded-full -translate-x-10 -translate-y-10"></div>
          <CardContent className="relative p-4 space-y-3 h-full flex flex-col">
            <div className="flex items-center">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-gray-600">运输状态</h3>
                <div className="flex items-center text-xs text-violet-600">
                  <Truck className="h-3 w-3 mr-1" />
                  统计
                </div>
              </div>
              <div className="text-center">
                <ResponsiveNumber value={`${dashboardData?.overview?.actualTransportCount ?? 0} / ${dashboardData?.overview?.returnCount ?? 0}`} className="text-gray-900" />
              </div>
              <p className="text-xs text-gray-500">实际运输/退货数量</p>
            </div>
            <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500 rounded-full"></div>
          </CardContent>
        </Card>
      </div>
      
      <div className="space-y-8">
        {Object.entries(dashboardData?.daily_stats_by_type || {}).map(([typeId, data]) => {
          const typeInfo = BILLING_TYPE_MAP[typeId as keyof typeof BILLING_TYPE_MAP];
          if (!typeInfo || !data) return null;
          const filteredData = data.stats.filter(day => day.actualTransport > 0 || day.returns > 0);

          return (
            <Card key={typeId} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  {typeInfo.icon && <typeInfo.icon className="h-5 w-5" />}
                  <span>{selectedProjectName}</span>
                  <span className="font-bold">({typeInfo.name})</span>
                  <span>- 每日运输量</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Switch id={`log-scale-${typeId}`} checked={useLogScale} onCheckedChange={setUseLogScale} />
                  <Label htmlFor={`log-scale-${typeId}`} className="text-sm">对数刻度</Label>
                </div>
              </CardHeader>
              <CardContent>
                {filteredData.length > 0 ? (
                  <div className="h-[500px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredData} margin={{ top: 30, right: 40, left: 30, bottom: 80 }} onClick={(d) => handleTypeChartClick(typeId as keyof typeof BILLING_TYPE_MAP, d)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(val) => new Date(val).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} 
                          angle={-45} 
                          textAnchor="end" 
                          height={100}
                          interval={0}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                          scale={useLogScale ? "log" : "auto"} 
                          domain={useLogScale ? [0.1, 'dataMax'] : [0, 'dataMax']} 
                          tickFormatter={(val) => val.toString()}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip 
                          labelFormatter={(val) => new Date(val).toLocaleDateString('zh-CN')} 
                          formatter={(val, name) => [`${Number(val).toFixed(2)} ${typeInfo.unit}`, name === 'actualTransport' ? '有效运输' : '退货']}
                          contentStyle={{ fontSize: '14px' }}
                        />
                        <Legend 
                          onClick={() => handleTypeLegendClick(typeId as keyof typeof BILLING_TYPE_MAP)} 
                          formatter={(val) => `${val === 'actualTransport' ? '有效运输' : '退货'} (总计 ${val === 'actualTransport' ? data.totalActual.toFixed(1) : data.totalReturns.toFixed(1)} ${typeInfo.unit})`} 
                          wrapperStyle={{ paddingTop: '20px', cursor: 'pointer', fontSize: '14px' }} 
                        />
                        <Bar dataKey="actualTransport" fill="#4ade80" name="actualTransport" radius={[2, 2, 0, 0]} label={{ position: 'top', fontSize: 10, formatter: (val: number) => val > 0 ? val.toFixed(1) : '' }} />
                        <Bar dataKey="returns" fill="#ef4444" name="returns" radius={[2, 2, 0, 0]} label={{ position: 'top', fontSize: 10, formatter: (val: number) => val > 0 ? val.toFixed(1) : '' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[500px] flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      {typeInfo.icon && <typeInfo.icon className="h-12 w-12 text-gray-400 mx-auto mb-4" />}
                      <p className="text-gray-500 text-lg font-medium">暂无{typeInfo.name}数据</p>
                      <p className="text-gray-400 text-sm mt-2">选择时间范围查看{typeInfo.name}运输量</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              {selectedProjectName} - 运输日报
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData?.dailyCountStats && dashboardData.dailyCountStats.length > 0 ? (
              <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.dailyCountStats.filter(d => d.count > 0)} margin={{ top: 30, right: 40, left: 30, bottom: 80 }} onClick={handleOverviewChartClick}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => new Date(val).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} 
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      interval={0}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      allowDecimals={false} 
                      domain={[0, 'dataMax + 1']}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      labelFormatter={(val) => new Date(val).toLocaleDateString('zh-CN')} 
                      formatter={(val) => [`${val} 次`, '运输次数']}
                      contentStyle={{ fontSize: '14px' }}
                    />
                    <Legend 
                      onClick={handleOverviewLegendClick} 
                      formatter={() => `运输次数 (总计 ${dashboardData.overview.totalRecords} 次)`} 
                      wrapperStyle={{ paddingTop: '20px', cursor: 'pointer', fontSize: '14px' }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#3b82f6" 
                      strokeWidth={2} 
                      dot={{ r: 4 }} 
                      activeDot={{ r: 6 }} 
                      label={{ position: 'top', fontSize: 10, formatter: (val: number) => val > 0 ? val.toString() : '' }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[500px] flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg font-medium">暂无运输数据</p>
                  <p className="text-gray-400 text-sm mt-2">选择时间范围查看运输日报</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              {selectedProjectName} - 每日运输费用分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData?.dailyCostStats && dashboardData.dailyCostStats.length > 0 ? (
              <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.dailyCostStats.filter(d => d.totalCost > 0)} margin={{ top: 30, right: 40, left: 30, bottom: 80 }} onClick={handleOverviewChartClick}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => new Date(val).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} 
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      interval={0}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      tickFormatter={(val) => `¥${Number(val || 0).toLocaleString()}`}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      labelFormatter={(val) => new Date(val).toLocaleDateString('zh-CN')} 
                      formatter={(val) => [formatCurrency(val as number), '总费用']}
                      contentStyle={{ fontSize: '14px' }}
                    />
                    <Legend 
                      onClick={handleOverviewLegendClick} 
                      formatter={() => `总费用 (${formatCurrency(dashboardData.overview.totalCost)})`} 
                      wrapperStyle={{ paddingTop: '20px', cursor: 'pointer', fontSize: '14px' }} 
                    />
                    <Bar 
                      dataKey="totalCost" 
                      fill="#10b981" 
                      radius={[2, 2, 0, 0]} 
                      label={{ position: 'top', fontSize: 10, formatter: (val: number) => val > 0 ? `¥${val.toFixed(0)}` : '' }} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[500px] flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg font-medium">暂无费用数据</p>
                  <p className="text-gray-400 text-sm mt-2">选择时间范围查看运输费用分析</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Eye className="mr-2" />
                {dialogFilter.date ? `${new Date(dialogFilter.date).toLocaleDateString('zh-CN')} 详细记录` : `全部筛选结果`} 
                ({dialogFilter.billingTypeId ? BILLING_TYPE_MAP[dialogFilter.billingTypeId]?.name : '所有类型'})
              </div>
              <div className="text-sm font-normal text-muted-foreground flex items-center">
                <Package className="mr-1 h-4 w-4" />
                点击行查看运单详情
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto">
          {isDialogLoading ? (
            <div className="flex items-center justify-center h-full"><RefreshCw className="h-6 w-6 animate-spin" /><span>加载中...</span></div>
          ) : dialogRecords.length > 0 ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>运单号</TableHead><TableHead>项目</TableHead><TableHead>司机</TableHead><TableHead>车牌</TableHead>
                <TableHead>线路</TableHead>
                <TableHead>装货量</TableHead><TableHead>卸货量</TableHead>
                <TableHead>类型</TableHead><TableHead>司机应收</TableHead><TableHead>备注</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {dialogRecords.map((record) => {
                  const unit = record.billing_type_id 
                    ? BILLING_TYPE_MAP[record.billing_type_id.toString() as keyof typeof BILLING_TYPE_MAP]?.unit || '' 
                    : '';
                  const route = `${record.loadingLocation?.substring(0, 2) || ''}-${record.unloadingLocation?.substring(0, 2) || ''}`;
                  
                  return (
                    <TableRow 
                      key={record.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleWaybillClick(record)}
                    >
                      <TableCell className="whitespace-nowrap">{record.autoNumber}</TableCell>
                      <TableCell className="whitespace-nowrap max-w-[150px] truncate" title={record.projectName}>{record.projectName || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{record.driverName}</TableCell>
                      <TableCell className="whitespace-nowrap">{record.licensePlate}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{route}</TableCell>
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

      {/* 运单详情弹窗 */}
      <WaybillDetailDialog
        isOpen={isWaybillDetailOpen}
        onClose={handleCloseWaybillDetail}
        record={selectedWaybill}
      />
    </div>
  );
}
