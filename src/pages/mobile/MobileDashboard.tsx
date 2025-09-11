import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, Truck, Package, Filter } from "lucide-react";
import { SupabaseStorage } from "@/utils/supabase";
import { LogisticsRecord, Project } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { subDays } from "date-fns";
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileCard } from '@/components/mobile/MobileCard';

interface DailyCountStats {
  date: string;
  count: number;
}

export default function MobileDashboard() {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // 使用与桌面端相同的默认日期范围（1970-01-01到现在）
  const getDefaultDateRange = () => {
    const today = new Date();
    const startDate = new Date('1970-01-01');
    return { from: startDate, to: today };
  };
  
  const dateRange = getDefaultDateRange();

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

  const getValidDateString = (dateValue: string | Date): string | null => {
    if (!dateValue) return null;
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  };

  // 根据日期范围和项目过滤记录
  const filteredRecords = useMemo(() => {
    let filtered = records;
    
    // 按日期范围过滤（1970-01-01到现在）
    filtered = filtered.filter(record => {
      const dateStr = getValidDateString(record.loadingDate);
      if (!dateStr) return false;
      const recordDate = new Date(dateStr);
      return recordDate >= dateRange.from && recordDate <= dateRange.to;
    });
    
    // 按项目过滤
    if (selectedProjectId !== "all") {
      filtered = filtered.filter(record => record.projectId === selectedProjectId);
    }
    
    return filtered;
  }, [records, selectedProjectId, dateRange]);

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

  // 每日运输次数统计（简化版）
  const dailyStats = useMemo(() => {
    const statsMap = new Map<string, number>();
    
    filteredRecords.forEach(record => {
      const date = getValidDateString(record.loadingDate);
      if (!date) return;
      const current = statsMap.get(date) || 0;
      statsMap.set(date, current + 1);
    });
    
    return Array.from(statsMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7); // 只显示最近7天
  }, [filteredRecords]);

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <MobileCard>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              数据看板
            </CardTitle>
            <p className="text-sm text-muted-foreground">全部历史运输数据概览</p>
          </CardHeader>
        </MobileCard>

        {/* 项目筛选 */}
        <MobileCard>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              数据筛选
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <label className="text-sm font-medium">项目筛选</label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
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
          </CardContent>
        </MobileCard>

        {/* 统计概览 */}
        <div className="grid grid-cols-2 gap-3">
          <MobileCard>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">运输次数</p>
                  <p className="text-lg font-bold">{overviewStats.totalRecords}</p>
                </div>
              </div>
            </CardContent>
          </MobileCard>

          <MobileCard>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Truck className="h-4 w-4 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">运输重量</p>
                  <p className="text-lg font-bold">{overviewStats.totalWeight.toFixed(1)}吨</p>
                </div>
              </div>
            </CardContent>
          </MobileCard>

          <MobileCard>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-yellow-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">司机应收</p>
                  <p className="text-sm font-bold">¥{overviewStats.totalCost.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </MobileCard>

          <MobileCard>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">实运/退货</p>
                  <p className="text-lg font-bold">{overviewStats.actualTransportCount}/{overviewStats.returnCount}</p>
                </div>
              </div>
            </CardContent>
          </MobileCard>
        </div>

        {/* 最近7天运输次数图表 */}
        <MobileCard>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">最近7天运输次数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyStats} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                    formatter={(value) => [`${value}次`, '运输次数']}
                  />
                  <Bar dataKey="count" fill="#4ade80" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </MobileCard>

        {/* 当前项目信息 */}
        {selectedProjectId !== "all" && (
          <MobileCard>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">当前项目信息</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const currentProject = projects.find(p => p.id === selectedProjectId);
                return currentProject ? (
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-muted-foreground">项目名称：</span>
                      <span className="text-sm font-medium">{currentProject.name}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">负责人：</span>
                      <span className="text-sm font-medium">{currentProject.manager}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">装货地址：</span>
                      <span className="text-sm">{currentProject.loadingAddress}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">卸货地址：</span>
                      <span className="text-sm">{currentProject.unloadingAddress}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">项目信息不存在</p>
                );
              })()}
            </CardContent>
          </MobileCard>
        )}
      </div>
    </MobileLayout>
  );
}