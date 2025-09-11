import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, Truck, Package, CalendarIcon } from "lucide-react";
import { SupabaseStorage } from "@/utils/supabase";
import { LogisticsRecord, DailyTransportStats, DailyCostStats, Project } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

// 每日运输次数统计
interface DailyCountStats {
  date: string;
  count: number;
}

export default function Dashboard() {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: subDays(new Date(), 45),
    to: new Date(),
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [allRecords, allProjects] = await Promise.all([
        SupabaseStorage.getLogisticsRecords(),
        SupabaseStorage.getProjects()
      ]);
      
      setRecords(allRecords);
      setProjects(allProjects);
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
    if (dateRange.from && dateRange.to) {
      filtered = filtered.filter(record => {
        const dateStr = getValidDateString(record.loadingDate);
        if (!dateStr) return false;
        const recordDate = new Date(dateStr);
        return recordDate >= dateRange.from! && recordDate <= dateRange.to!;
      });
    }
    
    // 按项目过滤
    if (selectedProjectId !== "all") {
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

  const projectStats = useMemo(() => {
    const projectIds = selectedProjectId === "all" 
      ? Object.keys(recordsByProject)
      : [selectedProjectId];
    
    return projectIds.map(projectId => {
      const projectRecords = recordsByProject[projectId] || [];
      const project = projects.find(p => p.id === projectId);
      
      // 每日运输量统计
      const dailyTransportStats: DailyTransportStats[] = (() => {
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
      })();

      // 每日费用统计
      const dailyCostStats: DailyCostStats[] = (() => {
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
      })();

      // 每日运输次数统计
      const dailyCountStats: DailyCountStats[] = (() => {
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
      })();

      // 图例汇总数据
      const legendTotals = {
        actualTransportTotal: dailyTransportStats.reduce((sum, day) => sum + day.actualTransport, 0),
        returnsTotal: dailyTransportStats.reduce((sum, day) => sum + day.returns, 0),
        totalCostSum: dailyCostStats.reduce((sum, day) => sum + day.totalCost, 0),
        totalTrips: dailyCountStats.reduce((sum, day) => sum + day.count, 0),
      };

      return {
        projectId,
        project,
        projectRecords,
        dailyTransportStats,
        dailyCostStats,
        dailyCountStats,
        legendTotals,
      };
    });
  }, [recordsByProject, projects, selectedProjectId]);

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
    return <div className="text-center py-8">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="space-y-8 p-4 md:p-6">
        {/* 美化后的页面标题 */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 rounded-2xl shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>
          
          <div className="relative p-8 text-white">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                  数据看板
                </h1>
                <p className="text-blue-100 mt-1 text-lg">运输数据统计分析与可视化</p>
              </div>
            </div>
          </div>
        </div>

        {/* 美化后的筛选器 */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
            <CardTitle className="flex items-center gap-3 text-slate-800">
              <div className="p-2 bg-slate-200 rounded-lg">
                <CalendarIcon className="h-5 w-5 text-slate-600" />
              </div>
              数据筛选
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 日期范围选择器 */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700">日期范围</label>
                <div className="grid grid-cols-2 gap-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal bg-white/60 border-slate-300 hover:bg-white/80",
                          !dateRange.from && "text-slate-500"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : "开始日期"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal bg-white/60 border-slate-300 hover:bg-white/80",
                          !dateRange.to && "text-slate-500"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : "结束日期"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* 项目选择器 */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700">项目筛选</label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="bg-white/60 border-slate-300">
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

        {/* 美化后的统计概览 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-300 hover:scale-105 hover:shadow-2xl border-0">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-100">总运输次数</p>
                    <p className="text-3xl font-bold">{overviewStats.totalRecords}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all duration-300 hover:scale-105 hover:shadow-2xl border-0">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                    <Truck className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-100">总运输重量</p>
                    <p className="text-3xl font-bold">{overviewStats.totalWeight.toFixed(1)}吨</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden bg-gradient-to-br from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 transition-all duration-300 hover:scale-105 hover:shadow-2xl border-0">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-yellow-100">司机应收汇总</p>
                    <p className="text-3xl font-bold">¥{overviewStats.totalCost.toFixed(2)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden bg-gradient-to-br from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 transition-all duration-300 hover:scale-105 hover:shadow-2xl border-0">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <CardContent className="relative p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-100">实际运输/退货</p>
                    <p className="text-3xl font-bold">{overviewStats.actualTransportCount}/{overviewStats.returnCount}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                </div>
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
              {projectData.project?.name || '未知项目'}
            </h2>
            <p className="text-blue-700">
              项目负责人：{projectData.project?.manager || '未指定'}
            </p>
          </div>

          {/* 每日运输量统计图表 */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>
                每日运输量统计 - {projectData.project?.name || '未知项目'} (负责人：{projectData.project?.manager || '未指定'}) (吨)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={projectData.dailyTransportStats}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
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
                    />
                    <Legend 
                      formatter={(value) => {
                        if (value === 'actualTransport') {
                          return `有效运输量 (${projectData.legendTotals.actualTransportTotal.toFixed(1)}吨)`;
                        }
                        return `退货量 (${projectData.legendTotals.returnsTotal.toFixed(1)}吨)`;
                      }}
                      wrapperStyle={{ 
                        paddingTop: '20px',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    />
                    <Bar 
                      dataKey="actualTransport" 
                      fill="#4ade80" 
                      name="actualTransport"
                      radius={[2, 2, 0, 0]}
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
                运输日报 - {projectData.project?.name || '未知项目'} (负责人：{projectData.project?.manager || '未指定'})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={projectData.dailyCountStats}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
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
                    />
                    <Legend 
                      formatter={() => `运输次数 (总计${projectData.legendTotals.totalTrips}次)`}
                      wrapperStyle={{ 
                        paddingTop: '20px',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#3b82f6' }}
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

          {/* 每日运输费用分析图表 */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>
                每日运输费用分析 - {projectData.project?.name || '未知项目'} (负责人：{projectData.project?.manager || '未指定'}) (元)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={projectData.dailyCostStats}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
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
                      domain={[0, 'dataMax + 100']}
                      tickFormatter={(value) => value.toString()}
                    />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                      formatter={(value) => [`¥${Number(value).toFixed(2)}`, '总费用']}
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                    />
                    <Legend 
                      formatter={() => `总费用 (¥${projectData.legendTotals.totalCostSum.toFixed(2)})`}
                      wrapperStyle={{ 
                        paddingTop: '20px',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    />
                    <Bar 
                      dataKey="totalCost" 
                      fill="#f59e0b" 
                      radius={[2, 2, 0, 0]}
                      label={{
                        position: 'top',
                        fontSize: 12,
                        fill: '#374151',
                        formatter: (value: number) => `¥${value.toFixed(0)}`
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}