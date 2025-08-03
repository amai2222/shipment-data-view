// 文件路径: src/pages/Home.tsx
// 描述: [后端驱动重构版] 1. 所有运算逻辑已转移到后端 get_dashboard_stats 函数。 2. 前端只负责请求和展示。 3. 添加搜索按钮，实现按需加载。

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Truck, Package, Eye, Database, RefreshCw, CheckCircle, Search } from "lucide-react";
import { SupabaseStorage } from "@/utils/supabase";
import { DataMigration } from "@/utils/migration";
import { LogisticsRecord, DailyTransportStats, DailyCostStats, Project } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase"; // 引入supabase实例

// [后端驱动] 每日运输次数统计接口
interface DailyCountStats {
  date: string;
  count: number;
}

// [后端驱动] 总览统计数据接口
interface OverviewStats {
  totalRecords: number;
  totalWeight: number;
  totalCost: number;
  actualTransportCount: number;
  returnCount: number;
}

// [后端驱动] 后端返回的记录类型（注意蛇形命名法）
interface BackendLogisticsRecord {
    id: string;
    project_id: string;
    project_name: string;
    loading_date: string;
    loading_weight: number;
    unloading_weight: number | null;
    transport_type: string;
    current_fee: number;
    extra_fee: number;
    payable_fee: number;
    auto_number: string;
    driver_name: string;
    license_plate: string;
    loading_location: string;
    unloading_location: string;
    remarks: string | null;
}


export default function Home() {
  // [后端驱动] 状态管理重构，直接存储后端计算好的结果
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [dailyTransportStats, setDailyTransportStats] = useState<DailyTransportStats[]>([]);
  const [dailyCostStats, setDailyCostStats] = useState<DailyCostStats[]>([]);
  const [dailyCountStats, setDailyCountStats] = useState<DailyCountStats[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<BackendLogisticsRecord[]>([]);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [migrationStatus, setMigrationStatus] = useState<{
    supabaseCount: number;
    localCount: number;
    isMigrated: boolean;
  } | null>(null);
  
  const getDefaultDateRange = () => {
    const today = new Date();
    const year = today.getFullYear();
    return {
      startDate: `${year}-01-01`,
      endDate: today.toISOString().split('T')[0],
    };
  };

  const [filterInputs, setFilterInputs] = useState({
    ...getDefaultDateRange(),
    projectId: 'all',
  });

  const { toast } = useToast();

  useEffect(() => {
    handleSearch(); // 首次加载时自动搜索
    loadProjects();
    checkMigrationStatus();
  }, []);

  const loadProjects = async () => {
    try {
      const allProjects = await SupabaseStorage.getProjects();
      setProjects(allProjects as Project[]);
    } catch (error) {
      console.error("加载项目列表失败:", error);
    }
  };

  // [后端驱动] 核心函数，调用后端的RPC
  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        start_date_param: filterInputs.startDate,
        end_date_param: filterInputs.endDate,
        project_id_param: filterInputs.projectId === 'all' ? null : filterInputs.projectId,
      });

      if (error) throw error;

      // 使用后端返回的数据更新所有状态
      setOverviewStats(data.overview);
      setDailyTransportStats(data.dailyTransportStats || []);
      setDailyCostStats(data.dailyCostStats || []);
      setDailyCountStats(data.dailyCountStats || []);
      setFilteredRecords(data.records || []);

    } catch (err) {
      console.error('获取看板数据失败:', err);
      toast({
        title: "数据加载失败",
        description: "无法从数据库获取统计数据，请检查网络或联系管理员。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkMigrationStatus = async () => {
    const status = await DataMigration.checkMigrationStatus();
    setMigrationStatus(status);
  };

  const handleMigrateData = async () => {
    try {
      toast({ title: "开始数据迁移", description: "正在将本地数据迁移到Supabase..." });
      const success = await DataMigration.migrateAllData();
      if (success) {
        await handleSearch();
        await checkMigrationStatus();
        toast({ title: "数据迁移完成", description: "所有本地数据已成功迁移到Supabase！" });
      } else {
        toast({ title: "迁移失败", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "迁移失败", variant: "destructive" });
    }
  };

  // [移除] 所有前端计算函数 (generate... , useMemo for filtering) 已被删除，因为后端完成了所有工作。

  const legendTotals = useMemo(() => {
    return {
      actualTransportTotal: dailyTransportStats.reduce((sum, day) => sum + (day.actualTransport || 0), 0),
      returnsTotal: dailyTransportStats.reduce((sum, day) => sum + (day.returns || 0), 0),
      totalCostSum: dailyCostStats.reduce((sum, day) => sum + (day.totalCost || 0), 0),
      totalTrips: dailyCountStats.reduce((sum, day) => sum + (day.count || 0), 0),
    };
  }, [dailyTransportStats, dailyCostStats, dailyCountStats]);

  const selectedRecordsForDialog = useMemo(() => {
    if (!selectedDate) return filteredRecords;
    return filteredRecords.filter(record => record.loading_date.startsWith(selectedDate));
  }, [selectedDate, filteredRecords]);

  const handleChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedDate = data.activePayload[0].payload.date;
      setSelectedDate(clickedDate);
      setIsDetailDialogOpen(true);
    }
  };

  const handleLegendClick = () => {
    setSelectedDate(null);
    setIsDetailDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDetailDialogOpen(open);
    if (!open) setSelectedDate(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2 text-lg text-gray-600">正在加载数据...</span>
      </div>
    );
  }

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

      <div className="bg-gradient-primary p-6 rounded-lg shadow-primary text-primary-foreground">
        <h1 className="text-2xl font-bold mb-2 flex items-center"><BarChart3 className="mr-2" />数据看板</h1>
        <p className="opacity-90">运输数据统计分析与可视化</p>
      </div>

      <Card className="shadow-card">
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
            <Button onClick={handleSearch} disabled={isLoading}>
              <Search className="mr-2 h-4 w-4" />
              {isLoading ? '正在搜索...' : '搜索'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-blue-100 rounded-lg mr-4"><Package className="h-6 w-6 text-blue-600" /></div><div><p className="text-sm font-medium text-muted-foreground">总运输次数</p><p className="text-2xl font-bold">{overviewStats?.totalRecords || 0}</p></div></CardContent></Card>
        <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-green-100 rounded-lg mr-4"><Truck className="h-6 w-6 text-green-600" /></div><div><p className="text-sm font-medium text-muted-foreground">总运输重量</p><p className="text-2xl font-bold">{(overviewStats?.totalWeight || 0).toFixed(1)}吨</p></div></CardContent></Card>
        <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-yellow-100 rounded-lg mr-4"><TrendingUp className="h-6 w-6 text-yellow-600" /></div><div><p className="text-sm font-medium text-muted-foreground">司机应收汇总</p><p className="text-2xl font-bold">¥{(overviewStats?.totalCost || 0).toFixed(2)}</p></div></CardContent></Card>
        <Card className="shadow-card"><CardContent className="flex items-center p-6"><div className="p-2 bg-purple-100 rounded-lg mr-4"><BarChart3 className="h-6 w-6 text-purple-600" /></div><div><p className="text-sm font-medium text-muted-foreground">实际运输/退货</p><p className="text-2xl font-bold">{overviewStats?.actualTransportCount || 0}/{overviewStats?.returnCount || 0}</p></div></CardContent></Card>
      </div>

      <div className="space-y-6">
        <Card className="shadow-card">
          <CardHeader><CardTitle>每日运输量统计 ({filterInputs.startDate} 至 {filterInputs.endDate}) (吨)</CardTitle></CardHeader>
          <CardContent><div className="h-96"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyTransportStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleChartClick}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} interval={0} /><YAxis domain={[0, 'dataMax + 20']} tickFormatter={(value) => value.toString()} /><Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value, name) => { const label = name === 'actualTransport' ? '有效运输量' : '退货量'; return [`${Number(value).toFixed(2)}`, label]; }} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} /><Legend formatter={(value) => { if (value === 'actualTransport') { return `有效运输量 (${legendTotals.actualTransportTotal.toFixed(1)}吨) - 点击查看全部运单`; } return `退货量 (${legendTotals.returnsTotal.toFixed(1)}吨) - 点击查看全部运单`; }} wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }} onClick={handleLegendClick} /><Bar dataKey="actualTransport" fill="#4ade80" name="actualTransport" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toFixed(1) : '' }} /><Bar dataKey="returns" fill="#ef4444" name="returns" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toFixed(1) : '' }} /></BarChart></ResponsiveContainer></div></CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader><CardTitle>运输日报 ({filterInputs.startDate} 至 {filterInputs.endDate})</CardTitle></CardHeader>
          <CardContent><div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={dailyCountStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleChartClick}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} interval={0} /><YAxis allowDecimals={false} domain={[0, 'dataMax + 1']} tickFormatter={(value) => value.toString()} /><Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value) => [`${value} 次`, '运输次数']} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} cursor={{ stroke: 'rgba(59, 130, 246, 0.3)', strokeWidth: 2 }} /><Legend formatter={() => `运输次数 (总计${legendTotals.totalTrips}次) - 点击查看全部运单`} wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }} onClick={handleLegendClick} /><Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4, cursor: 'pointer' }} activeDot={{ r: 6, fill: '#3b82f6', cursor: 'pointer' }} label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? value.toString() : '' }} /></LineChart></ResponsiveContainer></div></CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader><CardTitle>每日运输费用分析 ({filterInputs.startDate} 至 {filterInputs.endDate}) (元)</CardTitle></CardHeader>
          <CardContent><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyCostStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} onClick={handleChartClick}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} angle={-45} textAnchor="end" height={80} interval={0} /><YAxis tickFormatter={(value) => `¥${Number(value).toLocaleString('zh-CN')}`} /><Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')} formatter={(value) => [`¥${Number(value).toFixed(2)}`, '总费用']} contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }} cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }} /><Legend formatter={() => `总费用 (¥${legendTotals.totalCostSum.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) - 点击查看全部运单`} wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }} onClick={handleLegendClick} /><Bar dataKey="totalCost" fill="#10b981" name="totalCost" radius={[2, 2, 0, 0]} cursor="pointer" label={{ position: 'top', fontSize: 12, fill: '#374151', formatter: (value: number) => value > 0 ? `¥${Number(value).toFixed(0)}` : '' }} /></BarChart></ResponsiveContainer></div></CardContent>
        </Card>
      </div>

      <Dialog open={isDetailDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" aria-describedby="dialog-description">
          <DialogHeader>
            <DialogTitle className="flex items-center"><Eye className="mr-2 h-5 w-5" />{selectedDate ? `${new Date(selectedDate).toLocaleDateString('zh-CN')} 详细运输记录` : `全部筛选结果记录`}</DialogTitle>
            <div id="dialog-description" className="sr-only">显示运输记录详细信息</div>
          </DialogHeader>
          {selectedRecordsForDialog.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg"><h3 className="font-semibold text-blue-900">数据概览</h3><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2"><div><p className="text-sm text-blue-700">运输次数</p><p className="text-lg font-bold text-blue-900">{selectedRecordsForDialog.length}</p></div><div><p className="text-sm text-blue-700">总重量</p><p className="text-lg font-bold text-blue-900">{selectedRecordsForDialog.reduce((sum, r) => sum + r.loading_weight, 0).toFixed(1)}吨</p></div><div><p className="text-sm text-blue-700">总费用</p><p className="text-lg font-bold text-blue-900">¥{selectedRecordsForDialog.reduce((sum, r) => sum + (r.current_fee || 0) + (r.extra_fee || 0), 0).toFixed(2)}</p></div><div><p className="text-sm text-blue-700">实际运输/退货</p><p className="text-lg font-bold text-blue-900">{selectedRecordsForDialog.filter(r => r.transport_type === "实际运输").length}/{selectedRecordsForDialog.filter(r => r.transport_type === "退货").length}</p></div></div></div>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="text-xs"><TableHead className="px-2 py-2 text-xs">运单号</TableHead><TableHead className="px-2 py-2 text-xs">项目名称</TableHead><TableHead className="px-2 py-2 text-xs">司机</TableHead><TableHead className="px-2 py-2 text-xs">车牌号</TableHead><TableHead className="px-2 py-2 text-xs">装货地</TableHead><TableHead className="px-2 py-2 text-xs">卸货地</TableHead><TableHead className="px-2 py-2 text-xs">装货重量</TableHead><TableHead className="px-2 py-2 text-xs">卸货重量</TableHead><TableHead className="px-2 py-2 text-xs">运输类型</TableHead><TableHead className="px-2 py-2 text-xs">司机应收</TableHead><TableHead className="px-2 py-2 text-xs">备注</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {selectedRecordsForDialog.sort((a, b) => { const projectNameA = a.project_name || ''; const projectNameB = b.project_name || ''; const projectCompare = projectNameB.localeCompare(projectNameA, 'zh-CN'); if (projectCompare !== 0) return projectCompare; return b.auto_number.localeCompare(a.auto_number, 'zh-CN'); }).map((record) => (
                      <TableRow key={record.id} className="text-xs">
                        <TableCell className="font-medium px-2 py-2 text-xs whitespace-nowrap">{record.auto_number}</TableCell>
                        <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.project_name || '-'}</TableCell>
                        <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.driver_name}</TableCell>
                        <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.license_plate}</TableCell>
                        <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.loading_location}</TableCell>
                        <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.unloading_location}</TableCell>
                        <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.loading_weight.toFixed(2)}吨</TableCell>
                        <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.unloading_weight?.toFixed(2) || '-'}吨</TableCell>
                        <TableCell className="px-2 py-2 text-xs"><span className={`px-1 py-0.5 rounded-full text-xs whitespace-nowrap ${record.transport_type === "实际运输" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{record.transport_type}</span></TableCell>
                        <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.payable_fee ? `¥${(record.payable_fee).toFixed(2)}` : '-'} </TableCell>
                        <TableCell className="px-2 py-2 text-xs max-w-[120px] truncate" title={record.remarks}>{record.remarks || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (<div className="text-center py-8 text-muted-foreground">没有符合条件的运输记录</div>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
