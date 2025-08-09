// 文件路径: src/pages/ProjectDashboard.tsx
// 描述: [KbjZj 最终审计版] 此代码已恢复下拉框筛选，并实现了全新的司机工作量报告表格。

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, TrendingUp, Target, Truck, Wallet, BarChartHorizontal, Users, Calendar } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { format } from 'date-fns';

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
// 【关键新增】司机工作量报告的行类型
interface DriverReportRow {
    report_date: string;
    driver_name: string;
    trip_count: number;
    total_tonnage: number;
    total_driver_receivable: number;
    total_partner_payable: number;
}
// 【关键修改】看板完整数据类型
interface DashboardData {
  project_details: ProjectDetails[];
  daily_report: DailyReport;
  seven_day_trend: TrendData[];
  summary_stats: SummaryStats;
  driver_report_table: DriverReportRow[];
}

const formatNumber = (val: number | null | undefined, unit: string = '') => `${(val || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}${unit ? ' ' + unit : ''}`;

// 主组件
export default function ProjectDashboard() {
  // --- States ---
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [visibleLines, setVisibleLines] = useState({
    trips: true,
    weight: true,
    receivable: true,
  });

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_project_dashboard_data', {
          p_selected_project_id: selectedProjectId,
          p_report_date: format(new Date(), 'yyyy-MM-dd')
        });

        if (error) throw error;
        setDashboardData(data);

        if (!selectedProjectId && data.project_details && data.project_details.length > 0) {
          setSelectedProjectId(data.project_details[0].id);
        }
      } catch (error) {
        console.error("加载看板数据失败:", error);
        toast({ title: "错误", description: `加载看板数据失败: ${(error as any).message}`, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [selectedProjectId, toast]);

  // --- 辅助函数和计算 ---
  const allProjects = dashboardData?.project_details || [];
  const selectedProjectDetails = useMemo(() => {
    return allProjects.find(p => p.id === selectedProjectId);
  }, [allProjects, selectedProjectId]);

  const completedTons = dashboardData?.summary_stats?.total_tonnage || 0;
  const plannedTons = selectedProjectDetails?.planned_total_tons || 1;
  const progressPercentage = (completedTons / plannedTons) * 100;

  const maxTrips = useMemo(() => {
    const trendData = dashboardData?.seven_day_trend;
    if (!trendData || trendData.length === 0) return 30;
    const max = Math.max(...trendData.map(d => d.trips || 0));
    return Math.max(30, Math.ceil(max / 10) * 10);
  }, [dashboardData?.seven_day_trend]);
  
  const handleLegendClick = (e: any) => {
    const { dataKey } = e;
    setVisibleLines(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };
  
  // --- 渲染 ---
  if (loading && !dashboardData) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!dashboardData || allProjects.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">项目看板</h1>
        <div className="text-center py-10 text-muted-foreground">暂无项目数据</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">项目看板</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧区域 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 【关键修改】恢复为下拉框筛选器 */}
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
                  <p className="text-2xl font-bold">{formatNumber(dashboardData.daily_report?.total_tonnage, '吨')}</p>
                  <p className="text-sm text-muted-foreground">当日运输吨数</p>
              </div>
              <div>
                  <p className="text-2xl font-bold text-green-600">{formatNumber(dashboardData.daily_report?.driver_receivable, '元')}</p>
                  <p className="text-sm text-muted-foreground">司机应收</p>
              </div>
              <div>
                  <p className="text-2xl font-bold text-red-600">{formatNumber(dashboardData.daily_report?.partner_payable, '元')}</p>
                  <p className="text-sm text-muted-foreground">合作方应付</p>
              </div>
           </CardContent>
          </Card>
          <div className="grid grid-cols-3 gap-6">
             <Card>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">项目已发车次</CardTitle><Truck className="h-4 w-4 text-muted-foreground" /></CardHeader>
               <CardContent><p className="text-xl font-bold">{formatNumber(dashboardData.summary_stats?.total_trips, '车')}</p></CardContent>
             </Card>
             <Card>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">项目现应收</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader>
               <CardContent><p className="text-xl font-bold">{formatNumber(dashboardData.summary_stats?.total_cost, '元')}</p></CardContent>
             </Card>
             <Card>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">平均吨成本</CardTitle><BarChartHorizontal className="h-4 w-4 text-muted-foreground" /></CardHeader>
               <CardContent><p className="text-xl font-bold">{formatNumber(dashboardData.summary_stats?.avg_cost, '元')}</p></CardContent>
             </Card>
          </div>
        </div>

        {/* 底部图表区域 */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center"><TrendingUp className="mr-2 h-5 w-5"/>项目近7日进度 ({selectedProjectDetails?.name})</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboardData.seven_day_trend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
        
        {/* 【关键重构】司机工作量报告表格 */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />司机工作量报告</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead>司机姓名</TableHead>
                    <TableHead className="text-right">出车次数</TableHead>
                    <TableHead className="text-right">卸货吨数</TableHead>
                    <TableHead className="text-right">司机应收 (元)</TableHead>
                    <TableHead className="text-right">应付金额 (元)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.driver_report_table.length > 0 ? (
                    dashboardData.driver_report_table.map((row, index) => (
                      <TableRow key={`${row.report_date}-${row.driver_name}-${index}`}>
                        <TableCell>{format(new Date(row.report_date), 'yyyy-MM-dd')}</TableCell>
                        <TableCell className="font-medium">{row.driver_name}</TableCell>
                        <TableCell className="text-right">{row.trip_count}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.total_tonnage)}</TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">{formatNumber(row.total_driver_receivable)}</TableCell>
                        <TableCell className="text-right text-red-600 font-semibold">{formatNumber(row.total_partner_payable)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">该项目暂无司机工作记录</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
