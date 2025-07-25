import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Truck, Package, Eye, Database, RefreshCw } from "lucide-react";
import { SupabaseStorage } from "@/utils/supabase";
import { DataMigration } from "@/utils/migration";
import { LogisticsRecord, DailyTransportStats, DailyCostStats } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";

// 每日运输次数统计
interface DailyCountStats {
  date: string;
  count: number;
}

export default function Home() {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [migrationStatus, setMigrationStatus] = useState<{
    supabaseCount: number;
    localCount: number;
    isMigrated: boolean;
  } | null>(null);
  // 默认显示当前月份1号到当前日期的数据
  const getDefaultDateRange = () => {
    const today = new Date();
    // 确保使用本地时间避免时区问题
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-11
    const day = today.getDate();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const currentDate = new Date(year, month, day);
    
    return {
      startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  };

  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const { toast } = useToast();

  // 加载数据
  useEffect(() => {
    loadData();
    checkMigrationStatus();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      // 尝试从Supabase加载数据，如果失败则使用本地数据
      try {
        const [allRecords, allProjects] = await Promise.all([
          SupabaseStorage.getLogisticsRecords(),
          SupabaseStorage.getProjects()
        ]);
        
        setRecords(allRecords);
        setProjects(allProjects);
      } catch (supabaseError) {
        console.warn('Supabase数据加载失败，使用本地数据:', supabaseError);
        // 回退到本地存储
        const { LocalStorage } = await import('@/utils/storage');
        const localRecords = LocalStorage.getLogisticsRecords();
        const localProjects = LocalStorage.getProjects();
        
        setRecords(localRecords);
        setProjects(localProjects);
        
        toast({
          title: "使用本地数据",
          description: "Supabase连接失败，正在使用本地存储的数据。",
          variant: "default",
        });
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "数据加载失败",
        description: "无法加载数据，请检查连接。",
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
      toast({
        title: "开始数据迁移",
        description: "正在将本地数据迁移到Supabase...",
      });

      const success = await DataMigration.migrateAllData();
      if (success) {
        await loadData();
        await checkMigrationStatus();
        toast({
          title: "数据迁移完成",
          description: "所有本地数据已成功迁移到Supabase！",
        });
      } else {
        toast({
          title: "迁移失败",
          description: "数据迁移过程中出现错误，请重试。",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "迁移失败", 
        description: "数据迁移过程中出现错误，请重试。",
        variant: "destructive",
      });
    }
  };

  // 安全的日期转换函数
  const getValidDateString = (dateValue: string | Date): string | null => {
    if (!dateValue) return null;
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  };

  // 根据日期范围和项目过滤记录
  const filteredRecords = useMemo(() => {
    let filtered = records;
    
    // 按日期范围过滤
    if (dateRange.startDate && dateRange.endDate) {
      filtered = filtered.filter(record => {
        const dateStr = getValidDateString(record.loadingDate);
        if (!dateStr) return false;
        return dateStr >= dateRange.startDate && dateStr <= dateRange.endDate;
      });
    }
    
    // 按项目过滤
    if (selectedProjectId && selectedProjectId !== 'all') {
      filtered = filtered.filter(record => record.projectId === selectedProjectId);
    }
    
    return filtered;
  }, [records, dateRange, selectedProjectId]);

  // 按项目分组的记录
  const recordsByProject = useMemo(() => {
    const grouped = filteredRecords.reduce((acc, record) => {
      if (!acc[record.projectId]) {
        acc[record.projectId] = [];
      }
      acc[record.projectId].push(record);
      return acc;
  }, {} as Record<string, LogisticsRecord[]>);
    return grouped;
  }, [filteredRecords]);

  // 生成每日运输量统计的辅助函数
  const generateDailyTransportStats = (projectRecords: LogisticsRecord[]): DailyTransportStats[] => {
    const statsMap = new Map<string, { actualTransport: number; returns: number }>();
    
    projectRecords.forEach(record => {
      const date = getValidDateString(record.loadingDate);
      if (!date) return;
      const current = statsMap.get(date) || { actualTransport: 0, returns: 0 };
      
      if (record.transportType === "实际运输") {
        current.actualTransport += record.loadingWeight;
      } else {
        current.returns += record.loadingWeight;
      }
      
      statsMap.set(date, current);
    });
    
    return Array.from(statsMap.entries()).map(([date, stats]) => ({
      date,
      ...stats,
    })).sort((a, b) => a.date.localeCompare(b.date));
  };

  // 生成每日成本统计的辅助函数
  const generateDailyCostStats = (projectRecords: LogisticsRecord[]): DailyCostStats[] => {
    const statsMap = new Map<string, number>();
    
    projectRecords.forEach(record => {
      const date = getValidDateString(record.loadingDate);
      if (!date) return;
      const current = statsMap.get(date) || 0;
      const cost = (record.currentFee || 0) + (record.extraFee || 0);
      statsMap.set(date, current + cost);
    });
    
    return Array.from(statsMap.entries()).map(([date, totalCost]) => ({
      date,
      totalCost,
    })).sort((a, b) => a.date.localeCompare(b.date));
  };

  // 生成每日运输次数统计的辅助函数
  const generateDailyCountStats = (projectRecords: LogisticsRecord[]): DailyCountStats[] => {
    const statsMap = new Map<string, number>();
    
    projectRecords.forEach(record => {
      const date = getValidDateString(record.loadingDate);
      if (!date) return;
      const current = statsMap.get(date) || 0;
      statsMap.set(date, current + 1);
    });
    
    return Array.from(statsMap.entries()).map(([date, count]) => ({
      date,
      count,
    })).sort((a, b) => a.date.localeCompare(b.date));
  };

  // 生成图例汇总数据的辅助函数
  const generateLegendTotals = (projectRecords: LogisticsRecord[]) => {
    const dailyTransportStats = generateDailyTransportStats(projectRecords);
    const dailyCostStats = generateDailyCostStats(projectRecords);
    const dailyCountStats = generateDailyCountStats(projectRecords);
    
    return {
      actualTransportTotal: dailyTransportStats.reduce((sum, day) => sum + day.actualTransport, 0),
      returnsTotal: dailyTransportStats.reduce((sum, day) => sum + day.returns, 0),
      totalCostSum: dailyCostStats.reduce((sum, day) => sum + day.totalCost, 0),
      totalTrips: dailyCountStats.reduce((sum, day) => sum + day.count, 0),
    };
  };

  // 按项目生成统计数据
  const projectStats = useMemo(() => {
    if (selectedProjectId) {
      // 选中了特定项目，只显示该项目
      const projectRecords = recordsByProject[selectedProjectId] || [];
      const project = projects.find(p => p.id === selectedProjectId);
      
      return [{
        projectId: selectedProjectId,
        project,
        projectRecords,
        dailyTransportStats: generateDailyTransportStats(projectRecords),
        dailyCostStats: generateDailyCostStats(projectRecords), 
        dailyCountStats: generateDailyCountStats(projectRecords),
        legendTotals: generateLegendTotals(projectRecords),
        isAllProjects: false
      }];
    } else {
      // 没有选择项目，显示所有项目汇总
      return [{
        projectId: 'all',
        project: { name: '所有项目', manager: '全部负责人' },
        projectRecords: filteredRecords,
        dailyTransportStats: generateDailyTransportStats(filteredRecords),
        dailyCostStats: generateDailyCostStats(filteredRecords),
        dailyCountStats: generateDailyCountStats(filteredRecords), 
        legendTotals: generateLegendTotals(filteredRecords),
        isAllProjects: true
      }];
    }
  }, [recordsByProject, projects, selectedProjectId, filteredRecords]);

  // 获取选中日期和项目的详细记录
  const selectedRecords = useMemo(() => {
    console.log('Calculating selectedRecords:', { selectedDate, selectedProjectId });
    
    if (!selectedProjectId) {
      console.log('Missing selectedProjectId, returning empty array');
      return [];
    }
    
    let projectRecords: any[] = [];
    if (selectedProjectId === 'all') {
      // 如果选择的是"所有项目"，则获取所有项目的记录
      projectRecords = filteredRecords;
      console.log('Using all filtered records:', filteredRecords.length);
    } else {
      // 否则获取特定项目的记录
      projectRecords = recordsByProject[selectedProjectId] || [];
      console.log('Using specific project records:', projectRecords.length);
    }
    
    // 如果没有选中特定日期，返回该项目的所有记录
    if (!selectedDate) {
      console.log('No specific date selected, returning all project records:', projectRecords.length);
      return projectRecords;
    }
    
    // 添加调试：显示一些记录的实际loadingDate格式
    if (projectRecords.length > 0) {
      console.log('Sample record loading dates:', projectRecords.slice(0, 3).map(r => ({
        original: r.loadingDate,
        processed: getValidDateString(r.loadingDate)
      })));
    }
    
    const result = projectRecords.filter(record => {
      const recordDate = getValidDateString(record.loadingDate);
      const matches = recordDate === selectedDate;
      if (!matches && projectRecords.length < 10) {
        console.log('Date comparison:', { recordDate, selectedDate, matches, originalDate: record.loadingDate });
      }
      return matches;
    });
    
    console.log('Selected records result:', result.length, 'for date:', selectedDate);
    return result;
  }, [selectedDate, selectedProjectId, recordsByProject, filteredRecords]);

  // 处理图表点击事件
  const handleChartClick = (data: any, projectId: string) => {
    console.log('Chart clicked:', { data, projectId, activePayload: data?.activePayload });
    
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedDate = data.activePayload[0].payload.date;
      console.log('Setting selected date:', clickedDate, 'projectId:', projectId);
      setSelectedDate(clickedDate);
      setSelectedProjectId(projectId);
      setIsDetailDialogOpen(true);
    } else {
      console.log('Chart click data invalid:', data);
    }
  };

  // 处理图例点击事件 - 显示该项目所有日期的运单
  const handleLegendClick = (projectId: string) => {
    console.log('Legend clicked for project:', projectId);
    // 清除选中的日期，显示该项目所有运单
    setSelectedDate(null);
    // 如果当前显示的是所有项目汇总，保持显示所有项目
    if (projectId === 'all' || !selectedProjectId) {
      setSelectedProjectId('all');
    } else {
      setSelectedProjectId(projectId);
    }
    setIsDetailDialogOpen(true);
  };

  // 处理对话框关闭事件
  const handleDialogClose = (open: boolean) => {
    setIsDetailDialogOpen(open);
    if (!open) {
      // 对话框关闭时，清除选择状态，恢复到图表显示
      setSelectedDate(null);
      // 清除选中的项目ID，回到正常的筛选状态
      setSelectedProjectId(null);
    }
  };

  // 统计概览
  const overviewStats = useMemo(() => {
    const totalRecords = filteredRecords.length;
    const totalWeight = filteredRecords.reduce((sum, record) => sum + record.loadingWeight, 0);
    const totalCost = filteredRecords.reduce((sum, record) => 
      sum + (record.currentFee || 0) + (record.extraFee || 0), 0);
    const actualTransportCount = filteredRecords.filter(r => r.transportType === "实际运输").length;
    
    return {
      totalRecords,
      totalWeight,
      totalCost,
      actualTransportCount,
      returnCount: totalRecords - actualTransportCount,
    };
  }, [filteredRecords]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">加载数据中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 数据迁移状态 */}
      {migrationStatus && !migrationStatus.isMigrated && migrationStatus.localCount > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Database className="h-5 w-5 text-orange-600 mr-2" />
                <div>
                  <p className="text-sm font-medium">检测到本地数据</p>
                  <p className="text-xs text-muted-foreground">
                    本地有{migrationStatus.localCount}条记录，建议迁移到Supabase
                  </p>
                </div>
              </div>
              <Button onClick={handleMigrateData} size="sm">
                迁移数据
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 页面标题 */}
      <div className="bg-gradient-primary p-6 rounded-lg shadow-primary text-primary-foreground">
        <h1 className="text-2xl font-bold mb-2 flex items-center">
          <BarChart3 className="mr-2" />
          数据看板
        </h1>
        <p className="opacity-90">运输数据统计分析与可视化（Supabase数据库）</p>
      </div>

      {/* 日期筛选器 */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>数据筛选</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">开始日期</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({...prev, startDate: e.target.value}))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">结束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({...prev, endDate: e.target.value}))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectFilter">项目筛选</Label>
              <Select 
                value={selectedProjectId || "all"} 
                onValueChange={(value) => setSelectedProjectId(value === "all" ? null : value)}
              >
                <SelectTrigger id="projectFilter">
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有项目</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-card">
          <CardContent className="flex items-center p-6">
            <div className="p-2 bg-blue-100 rounded-lg mr-4">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">总运输次数</p>
              <p className="text-2xl font-bold">{overviewStats.totalRecords}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="flex items-center p-6">
            <div className="p-2 bg-green-100 rounded-lg mr-4">
              <Truck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">总运输重量</p>
              <p className="text-2xl font-bold">{overviewStats.totalWeight.toFixed(1)}吨</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="flex items-center p-6">
            <div className="p-2 bg-yellow-100 rounded-lg mr-4">
              <TrendingUp className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">司机应收汇总</p>
              <p className="text-2xl font-bold">¥{overviewStats.totalCost.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="flex items-center p-6">
            <div className="p-2 bg-purple-100 rounded-lg mr-4">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">实际运输/退货</p>
              <p className="text-2xl font-bold">{overviewStats.actualTransportCount}/{overviewStats.returnCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 按项目分类显示图表 */}
      {projectStats.map((projectData) => (
        <div key={projectData.projectId} className="space-y-6">
           {/* 项目分隔标题 */}
           <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
             <h2 className="text-xl font-bold text-blue-900 mb-1">
               {projectData.isAllProjects ? '所有项目' : (projectData.project?.name || '未知项目')}
             </h2>
             <p className="text-blue-700">
               {projectData.isAllProjects ? '数据汇总统计' : `项目负责人：${projectData.project?.manager || '未指定'}`}
             </p>
           </div>

          {/* 每日运输量统计图表 */}
          <Card className="shadow-card">
            <CardHeader>
               <CardTitle>
                 每日运输量统计 - {projectData.isAllProjects ? '所有项目' : (projectData.project?.name || '未知项目')} ({dateRange.startDate} 至 {dateRange.endDate}) (吨)
               </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={projectData.dailyTransportStats}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    onClick={(data) => handleChartClick(data, projectData.projectId)}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis 
                      domain={[0, 'dataMax + 20']}
                      tickFormatter={(value) => value.toString()}
                    />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                      formatter={(value, name) => {
                        const label = name === 'actualTransport' ? '有效运输量' : '退货量';
                        return [`${Number(value).toFixed(2)}`, label];
                      }}
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                      cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                    />
                    <Legend 
                      formatter={(value) => {
                        if (value === 'actualTransport') {
                          return `有效运输量 (${projectData.legendTotals.actualTransportTotal.toFixed(1)}吨) - 点击查看全部运单`;
                        }
                        return `退货量 (${projectData.legendTotals.returnsTotal.toFixed(1)}吨) - 点击查看全部运单`;
                      }}
                      wrapperStyle={{ 
                        paddingTop: '20px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleLegendClick(projectData.projectId)}
                    />
                    <Bar 
                      dataKey="actualTransport" 
                      fill="#4ade80" 
                      name="actualTransport"
                      radius={[2, 2, 0, 0]}
                      cursor="pointer"
                      label={{
                        position: 'top',
                        fontSize: 12,
                        fill: '#374151',
                        formatter: (value: number) => value.toFixed(1)
                      }}
                    />
                    <Bar 
                      dataKey="returns" 
                      fill="#ef4444" 
                      name="returns"
                      radius={[2, 2, 0, 0]}
                      cursor="pointer"
                      label={{
                        position: 'top',
                        fontSize: 12,
                        fill: '#374151',
                        formatter: (value: number) => value.toFixed(1)
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* 运输日报 - 折线图 */}
          <Card className="shadow-card">
            <CardHeader>
               <CardTitle>
                 运输日报 - {projectData.isAllProjects ? '所有项目' : (projectData.project?.name || '未知项目')} ({dateRange.startDate} 至 {dateRange.endDate})
               </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={projectData.dailyCountStats}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    onClick={(data) => handleChartClick(data, projectData.projectId)}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis 
                      domain={[0, 'dataMax + 1']}
                      tickFormatter={(value) => value.toString()}
                    />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                      formatter={(value) => [`${value} 次`, '运输次数']}
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                      cursor={{ stroke: 'rgba(59, 130, 246, 0.3)', strokeWidth: 2 }}
                    />
                    <Legend 
                      formatter={() => `运输次数 (总计${projectData.legendTotals.totalTrips}次) - 点击查看全部运单`}
                      wrapperStyle={{ 
                        paddingTop: '20px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleLegendClick(projectData.projectId)}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4, cursor: 'pointer' }}
                      activeDot={{ r: 6, fill: '#3b82f6', cursor: 'pointer' }}
                      label={{
                        position: 'top',
                        fontSize: 12,
                        fill: '#374151',
                        formatter: (value: number) => value.toString()
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* 每日运输成本分析图表 */}
          <Card className="shadow-card">
            <CardHeader>
               <CardTitle>
                 每日运输费用分析 - {projectData.isAllProjects ? '所有项目' : (projectData.project?.name || '未知项目')} ({dateRange.startDate} 至 {dateRange.endDate}) (元)
               </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={projectData.dailyCostStats}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    onClick={(data) => handleChartClick(data, projectData.projectId)}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                      }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                     <YAxis
                       tickFormatter={(value) => `¥${Number(value).toLocaleString('zh-CN')}`}
                     />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                      formatter={(value) => [`¥${Number(value).toFixed(2)}`, '总费用']}
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                      cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }}
                    />
                     <Legend 
                       formatter={() => `总费用 (¥${projectData.legendTotals.totalCostSum.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) - 点击查看全部运单`}
                      wrapperStyle={{ 
                        paddingTop: '20px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleLegendClick(projectData.projectId)}
                    />
                    <Bar 
                      dataKey="totalCost" 
                      fill="#10b981" 
                      name="totalCost"
                      radius={[2, 2, 0, 0]}
                      cursor="pointer"
                       label={{
                         position: 'top',
                         fontSize: 12,
                         fill: '#374151',
                         formatter: (value: number) => `¥${Number(value).toFixed(2)}`
                       }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}

      {/* 详细数据对话框 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" aria-describedby="dialog-description">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Eye className="mr-2 h-5 w-5" />
              {selectedDate 
                ? `${new Date(selectedDate).toLocaleDateString('zh-CN')} 详细运输记录`
                : selectedProjectId === 'all' 
                  ? '所有项目运输记录'
                  : `${projects.find(p => p.id === selectedProjectId)?.name || '项目'} 全部运输记录`
              }
            </DialogTitle>
            <div id="dialog-description" className="sr-only">
              显示运输记录详细信息
            </div>
          </DialogHeader>
          
          {selectedRecords.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900">数据概览</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  <div>
                    <p className="text-sm text-blue-700">运输次数</p>
                    <p className="text-lg font-bold text-blue-900">{selectedRecords.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">总重量</p>
                    <p className="text-lg font-bold text-blue-900">
                      {selectedRecords.reduce((sum, r) => sum + r.loadingWeight, 0).toFixed(1)}吨
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">总费用</p>
                    <p className="text-lg font-bold text-blue-900">
                      ¥{selectedRecords.reduce((sum, r) => sum + (r.currentFee || 0) + (r.extraFee || 0), 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">实际运输/退货</p>
                    <p className="text-lg font-bold text-blue-900">
                      {selectedRecords.filter(r => r.transportType === "实际运输").length}/
                      {selectedRecords.filter(r => r.transportType === "退货").length}
                    </p>
                  </div>
                </div>
              </div>
              
               <div className="border rounded-lg overflow-x-auto">
                <Table>
                   <TableHeader>
                     <TableRow className="text-xs">
                       <TableHead className="px-2 py-2 text-xs">运单号</TableHead>
                       <TableHead className="px-2 py-2 text-xs">项目名称</TableHead>
                       <TableHead className="px-2 py-2 text-xs">司机</TableHead>
                       <TableHead className="px-2 py-2 text-xs">车牌号</TableHead>
                       <TableHead className="px-2 py-2 text-xs">装货地</TableHead>
                       <TableHead className="px-2 py-2 text-xs">卸货地</TableHead>
                       <TableHead className="px-2 py-2 text-xs">装货重量</TableHead>
                       <TableHead className="px-2 py-2 text-xs">卸货重量</TableHead>
                       <TableHead className="px-2 py-2 text-xs">运输类型</TableHead>
                       <TableHead className="px-2 py-2 text-xs">司机应收</TableHead>
                       <TableHead className="px-2 py-2 text-xs">备注</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {selectedRecords
                       .sort((a, b) => {
                         // 按项目名称降序排列
                         const projectNameA = a.projectName || projects.find(p => p.id === a.projectId)?.name || '';
                         const projectNameB = b.projectName || projects.find(p => p.id === b.projectId)?.name || '';
                         const projectCompare = projectNameB.localeCompare(projectNameA, 'zh-CN');
                         if (projectCompare !== 0) return projectCompare;
                         
                         // 项目名称相同时，按运单号降序排列
                         return b.autoNumber.localeCompare(a.autoNumber, 'zh-CN');
                       })
                       .map((record) => (
                       <TableRow key={record.id} className="text-xs">
                         <TableCell className="font-medium px-2 py-2 text-xs whitespace-nowrap">{record.autoNumber}</TableCell>
                         <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.projectName || projects.find(p => p.id === record.projectId)?.name || '-'}</TableCell>
                         <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.driverName}</TableCell>
                         <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.licensePlate}</TableCell>
                         <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.loadingLocation}</TableCell>
                         <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.unloadingLocation}</TableCell>
                         <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.loadingWeight.toFixed(2)}吨</TableCell>
                         <TableCell className="px-2 py-2 text-xs whitespace-nowrap">{record.unloadingWeight?.toFixed(2) || '-'}吨</TableCell>
                         <TableCell className="px-2 py-2 text-xs">
                           <span className={`px-1 py-0.5 rounded-full text-xs whitespace-nowrap ${
                             record.transportType === "实际运输" 
                               ? "bg-green-100 text-green-800" 
                               : "bg-red-100 text-red-800"
                           }`}>
                             {record.transportType}
                           </span>
                         </TableCell>
                         <TableCell className="px-2 py-2 text-xs whitespace-nowrap">
                           {record.payableFee ? `¥${(record.payableFee).toFixed(2)}` : '-'} 
                         </TableCell>
                         <TableCell className="px-2 py-2 text-xs max-w-[120px] truncate" title={record.remarks}>
                           {record.remarks || '-'}
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              该日期没有运输记录
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
