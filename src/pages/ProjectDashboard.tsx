// src/pages/ProjectDashboard.tsx

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // 引入Select组件
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { Loader2, Building, Calendar, Package, TrendingUp, Target, Briefcase, Truck, Wallet, BarChartHorizontal } from "lucide-react"; // 引入新图标
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts';

// --- 类型定义 (保持不变) ---
interface ProjectInfo {
  id: string;
  name: string;
  partner_name: string;
  start_date: string;
  planned_total_tons: number;
}
interface DailyReport {
  total_tonnage: number;
  driver_receivable: number;
  partner_payable: number;
}
interface TrendData {
  date: string;
  trips: number;
  weight: number;
  receivable: number;
}
interface OverallStats {
  total_trips: number;
  total_cost: number;
  avg_cost: number;
  total_tonnage: number;
}

// 主组件
export default function ProjectDashboard() {
  // --- States ---
  const [projectsForSelect, setProjectsForSelect] = useState<{ id: string, name: string }[]>([]); // 1. 改为存储所有项目用于下拉框
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null); // 1. 只存储选中的项目ID
  
  // (其他 state 保持不变)
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [selectedProjectDetails, setSelectedProjectDetails] = useState<ProjectInfo | null>(null); // 用于显示选中项目的详细信息
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // 5. 新增 state 用于控制图表线的显示/隐藏
  const [visibleLines, setVisibleLines] = useState({
    trips: true,
    weight: true,
    receivable: true,
  });

  // --- Effects ---
  // 效果1: 页面首次加载时，获取所有项目列表用于填充下拉框
  useEffect(() => {
    const fetchProjectList = async () => {
      try {
        const data = await SupabaseStorage.getAllProjectsForSelect();
        setProjectsForSelect(data || []);
        // 1. 默认选中最新项目（列表中的第一个）
        if (data && data.length > 0) {
          setSelectedProjectId(data[0].id);
        } else {
          setLoading(false); // 没有项目，停止加载
        }
      } catch (error) {
        toast({ title: "错误", description: "加载项目列表失败", variant: "destructive" });
        setLoading(false);
      }
    };
    fetchProjectList();
  }, [toast]);

  // 效果2: 当选中的项目ID变化时，获取该项目的所有看板数据
  useEffect(() => {
    if (!selectedProjectId) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const dashboardData = await SupabaseStorage.getProjectDashboardData(selectedProjectId);

        if (dashboardData) {
          // 在 "recent_projects" 数组中找到当前选中项目的详细信息
          const currentProjectDetails = dashboardData.recent_projects?.find((p: ProjectInfo) => p.id === selectedProjectId);
          setSelectedProjectDetails(currentProjectDetails || null);
          
          setDailyReport(dashboardData.daily_report);
          setTrendData(dashboardData.seven_day_trend || []);
          setOverallStats(dashboardData.overall_stats);
        }
      } catch (error) {
        console.error("加载看板数据失败:", error);
        toast({ title: "错误", description: "加载看板数据失败", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [selectedProjectId, toast]);

  // --- 辅助函数和计算 ---
  const formatNumber = (val: number | undefined, unit: string = '') => `${(val || 0).toLocaleString()} ${unit}`;
  const completedTons = overallStats?.total_tonnage || 0;
  const plannedTons = selectedProjectDetails?.planned_total_tons || 1;
  const progressPercentage = (completedTons / plannedTons) * 100;

  // 4. 计算车次Y轴的最大值
  const maxTrips = useMemo(() => {
    if (!trendData || trendData.length === 0) return 30;
    const max = Math.max(...trendData.map(d => d.trips || 0));
    return Math.max(30, Math.ceil(max / 10) * 10); // 保证是10的倍数且至少为30
  }, [trendData]);
  
  // 5. 处理图例点击事件
  const handleLegendClick = (e: any) => {
    const { dataKey } = e;
    setVisibleLines(prev => ({
      ...prev,
      [dataKey]: !prev[dataKey]
    }));
  };
  
  // --- 渲染 ---
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">项目看板</h1>
      {loading && !selectedProjectDetails ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : projectsForSelect.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">暂无项目数据</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧区域 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 1. 最近的项目卡片改成项目筛选 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><Package className="mr-2 h-5 w-5"/>项目筛选</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedProjectId || ''} onValueChange={setSelectedProjectId}>
                  <SelectTrigger><SelectValue placeholder="请选择项目..." /></SelectTrigger>
                  <SelectContent>
                    {projectsForSelect.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* 项目进度卡片 */}
            <Card>
                <CardHeader><CardTitle className="flex items-center"><Target className="mr-2 h-5 w-5"/>项目进度 ({selectedProjectDetails?.name})</CardTitle></CardHeader>
                <CardContent className="text-center space-y-3 pt-2">
                    <Progress value={progressPercentage} className="h-4" />
                    <div className="text-lg font-semibold text-muted-foreground">
                        {formatNumber(completedTons, '吨')} / <span className="text-foreground">{formatNumber(plannedTons, '吨')}</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">{progressPercentage.toFixed(1)}%</p>
                </CardContent>
            </Card>
          </div>

          {/* 右侧区域 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 今日日报卡片 */}
            <Card>
             <CardHeader><CardTitle>今日日报 ({new Date().toLocaleDateString()})</CardTitle></CardHeader>
             <CardContent className="flex justify-around text-center">
                <div>
                    <p className="text-2xl font-bold">{formatNumber(dailyReport?.total_tonnage, '吨')}</p>
                    <p className="text-sm text-muted-foreground">当日运输吨数</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-green-600">{formatNumber(dailyReport?.driver_receivable, '元')}</p>
                    <p className="text-sm text-muted-foreground">司机应收</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-red-600">{formatNumber(dailyReport?.partner_payable, '元')}</p>
                    <p className="text-sm text-muted-foreground">合作方应付</p>
                </div>
             </CardContent>
            </Card>
            {/* 项目总览数据卡片 */}
            <div className="grid grid-cols-3 gap-6">
               {/* 2 & 3. 添加图标并修改标题 */}
               <Card>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">项目已发车次</CardTitle><Truck className="h-4 w-4 text-muted-foreground" /></CardHeader>
                 <CardContent><p className="text-xl font-bold">{formatNumber(overallStats?.total_trips, '车')}</p></CardContent>
               </Card>
               <Card>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">项目现应收</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader>
                 <CardContent><p className="text-xl font-bold">{formatNumber(overallStats?.total_cost, '元')}</p></CardContent>
               </Card>
               <Card>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">平均吨成本</CardTitle><BarChartHorizontal className="h-4 w-4 text-muted-foreground" /></CardHeader>
                 <CardContent><p className="text-xl font-bold">{formatNumber(overallStats?.avg_cost, '元')}</p></CardContent>
               </Card>
            </div>
          </div>

          {/* 底部图表区域 */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center"><TrendingUp className="mr-2 h-5 w-5"/>项目近7日进度 ({selectedProjectDetails?.name})</CardTitle></CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    {/* 4. 车次和重量使用左侧Y轴，并动态调整domain */}
                    <YAxis yAxisId="left" domain={[0, maxTrips]} label={{ value: '吨 / 车', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: '元', angle: -90, position: 'insideRight' }} />
                    <Tooltip formatter={(value: number, name: string) => [`${value.toLocaleString()} ${name === '车次' ? '车' : name === '总重量' ? '吨' : '元'}`, name]} />
                    {/* 5. 添加可点击的 Legend */}
                    <Legend onClick={handleLegendClick} />
                    {/* 5. 根据 state 决定是否隐藏 Line */}
                    <Line yAxisId="left" type="monotone" dataKey="trips" name="车次" stroke="#8884d8" strokeWidth={2} hide={!visibleLines.trips} />
                    <Line yAxisId="left" type="monotone" dataKey="weight" name="总重量" stroke="#82ca9d" strokeWidth={2} hide={!visibleLines.weight} />
                    <Line yAxisId="right" type="monotone" dataKey="receivable" name="应收总额" stroke="#ffc658" strokeWidth={2} hide={!visibleLines.receivable} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
