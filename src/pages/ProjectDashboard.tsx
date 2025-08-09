// src/pages/ProjectDashboard.tsx

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { Loader2, Package, TrendingUp, Target, Truck, Wallet, BarChartHorizontal, Users, Calendar, Briefcase } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts';

// --- 类型定义 ---
interface ProjectDetails {
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
interface SummaryStats {
  total_trips: number;
  total_cost: number;
  avg_cost: number;
  total_tonnage: number;
}
interface DriverWorkload {
    driver_name: string;
    trip_count: number;
    total_tonnage: number;
    total_receivable: number;
}

// 主组件
export default function ProjectDashboard() {
  // --- States ---
  const [allProjects, setAllProjects] = useState<{ id: string, name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [projectDetailsList, setProjectDetailsList] = useState<ProjectDetails[]>([]);
  const [driverWorkload, setDriverWorkload] = useState<DriverWorkload[]>([]);

  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [visibleLines, setVisibleLines] = useState({
    trips: true,
    weight: true,
    receivable: true,
  });

  // --- Effects ---
  // 效果1: 首次加载，获取所有项目列表用于下拉框
  useEffect(() => {
    const fetchProjectList = async () => {
      setLoading(true);
      try {
        const data = await SupabaseStorage.getAllProjectsForSelect();
        setAllProjects(data || []);
        if (data && data.length > 0) {
          setSelectedProjectId(data[0].id); // 默认选中第一个
        } else {
          setLoading(false);
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
        const [dashboardData, driverData] = await Promise.all([
          SupabaseStorage.getProjectOverallStats(selectedProjectId),
          SupabaseStorage.getDriverDailyWorkload(selectedProjectId)
        ]);

        if (dashboardData) {
          setProjectDetailsList(dashboardData.project_details || []);
          setDailyReport(dashboardData.daily_report);
          setTrendData(dashboardData.seven_day_trend || []);
          setSummaryStats(dashboardData.summary_stats);
        }
        setDriverWorkload(driverData || []);
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
  const formatNumber = (val: number | undefined, unit: string = '') => `${(val || 0).toLocaleString(undefined, {maximumFractionDigits: 2})} ${unit}`;
  
  const selectedProjectDetails = useMemo(() => {
    return projectDetailsList.find(p => p.id === selectedProjectId);
  }, [projectDetailsList, selectedProjectId]);

  const completedTons = summaryStats?.total_tonnage || 0;
  const plannedTons = selectedProjectDetails?.planned_total_tons || 1;
  const progressPercentage = (completedTons / plannedTons) * 100;

  const maxTrips = useMemo(() => {
    if (!trendData || trendData.length === 0) return 30;
    const max = Math.max(...trendData.map(d => d.trips || 0));
    return Math.max(30, Math.ceil(max / 10) * 10);
  }, [trendData]);
  
  const handleLegendClick = (e: any) => {
    const { dataKey } = e;
    setVisibleLines(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };
  
  // --- 渲染 ---
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">项目看板</h1>
      {loading && !summaryStats ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : allProjects.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">暂无项目数据</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧区域 */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center"><Package className="mr-2 h-5 w-5"/>项目筛选</CardTitle></CardHeader>
              <CardContent>
                <Select value={selectedProjectId || ''} onValueChange={setSelectedProjectId}>
                  <SelectTrigger><SelectValue placeholder="请选择项目..." /></SelectTrigger>
                  <SelectContent>
                    {allProjects.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

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
            <Card>
             <CardHeader><CardTitle className="flex items-center"><Calendar className="mr-2 h-5 w-5"/>今日日报 ({new Date().toLocaleDateString()})</CardTitle></CardHeader>
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
            <div className="grid grid-cols-3 gap-6">
               <Card>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">项目已发车次</CardTitle><Truck className="h-4 w-4 text-muted-foreground" /></CardHeader>
                 <CardContent><p className="text-xl font-bold">{formatNumber(summaryStats?.total_trips, '车')}</p></CardContent>
               </Card>
               <Card>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">项目现应收</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader>
                 <CardContent><p className="text-xl font-bold">{formatNumber(summaryStats?.total_cost, '元')}</p></CardContent>
               </Card>
               <Card>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">平均吨成本</CardTitle><BarChartHorizontal className="h-4 w-4 text-muted-foreground" /></CardHeader>
                 <CardContent><p className="text-xl font-bold">{formatNumber(summaryStats?.avg_cost, '元')}</p></CardContent>
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
                    <YAxis yAxisId="left" domain={[0, maxTrips]} label={{ value: '吨 / 车', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: '元', angle: -90, position: 'insideRight' }} />
                    <Tooltip formatter={(value: number, name: string) => [`${value.toLocaleString()} ${name === '车次' ? '车' : name === '总重量' ? '吨' : '元'}`, name]} />
                    <Legend onClick={handleLegendClick} />
                    <Line yAxisId="left" type="monotone" dataKey="trips" name="车次" stroke="#8884d8" strokeWidth={2} hide={!visibleLines.trips} />
                    <Line yAxisId="left" type="monotone" dataKey="weight" name="总重量" stroke="#82ca9d" strokeWidth={2} hide={!visibleLines.weight} />
                    <Line yAxisId="right" type="monotone" dataKey="receivable" name="应收总额" stroke="#ffc658" strokeWidth={2} hide={!visibleLines.receivable} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          
          {/* 司机日报表格 */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />司机工作量日报 ({new Date().toLocaleDateString()})</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>司机姓名</TableHead>
                      <TableHead className="text-right">出车次数</TableHead>
                      <TableHead className="text-right">卸货吨数</TableHead>
                      <TableHead className="text-right">应收金额 (元)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {driverWorkload.length > 0 ? (
                      driverWorkload.map(driver => (
                        <TableRow key={driver.driver_name}>
                          <TableCell className="font-medium">{driver.driver_name}</TableCell>
                          <TableCell className="text-right">{driver.trip_count}</TableCell>
                          <TableCell className="text-right">{formatNumber(driver.total_tonnage)}</TableCell>
                          <TableCell className="text-right text-green-600 font-semibold">{formatNumber(driver.total_receivable)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">今日暂无司机工作记录</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
