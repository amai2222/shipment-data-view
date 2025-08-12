// 文件路径: src/pages/ProjectDashboard.tsx
// 描述: [QKYDe 最终审计版] 此代码已修复项目切换时单位“闪烁”的BUG，确保始终按项目默认链路展示。

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, Target, Truck, Wallet, BarChartHorizontal, Users, Calendar as CalendarIcon } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// --- 类型定义 ---
interface ProjectDetails { id: string; name: string; partner_name: string; start_date: string; planned_total_tons: number; billing_type_id: number; }
interface DailyReport { trip_count: number; total_tonnage: number; driver_receivable: number; partner_payable: number; }
interface TrendData { date: string; trips: number; weight: number; receivable: number; }
interface SummaryStats { total_trips: number; total_cost: number; avg_cost: number; total_tonnage: number; }
interface DriverReportRow { driver_name: string; trip_count: number; total_tonnage: number; total_driver_receivable: number; total_partner_payable: number; }
interface DashboardData { project_details: ProjectDetails[]; daily_report: DailyReport; seven_day_trend: TrendData[]; summary_stats: SummaryStats; driver_report_table: DriverReportRow[]; }

const formatNumber = (val: number | null | undefined, unit: string = '') => `${(val || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}${unit ? ' ' + unit : ''}`;

// 【配色方案】环形进度图组件
const CircularProgressChart = ({ value }: { value: number }) => {
  const data = [{ name: 'progress', value: value, fill: '#2563eb' }]; // 主色调 - 深蓝
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart
        cx="50%"
        cy="50%"
        innerRadius="70%"
        outerRadius="90%"
        barSize={12}
        data={data}
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar background={{ fill: '#e2e8f0' }} dataKey="value" cornerRadius={10} angleAxisId={0} />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-2xl font-bold fill-blue-600" // 主色调 - 深蓝
        >
          {`${value.toFixed(1)}%`}
        </text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
};


// 主组件
export default function ProjectDashboard() {
  // --- States (保持不变) ---
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [visibleLines, setVisibleLines] = useState({ trips: true, weight: true, receivable: true });
  const [reportDate, setReportDate] = useState<Date>(new Date());

  // --- DATA FETCHING (保持不变) ---
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_project_dashboard_data' as any, {
          p_selected_project_id: selectedProjectId,
          p_report_date: format(reportDate, 'yyyy-MM-dd')
        });

        if (error) throw error;
        const typed = data as unknown as DashboardData;
        setDashboardData(typed);

        if (!selectedProjectId && typed.project_details && typed.project_details.length > 0) {
          setSelectedProjectId(typed.project_details[0].id);
        }
      } catch (error) {
        console.error("加载看板数据失败:", error);
        toast({ title: "错误", description: `加载看板数据失败: ${(error as any).message}`, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [selectedProjectId, reportDate, toast]);

  // --- 辅助函数和计算 ---
  const allProjects = dashboardData?.project_details || [];
  const selectedProjectDetails = useMemo(() => {
    return allProjects.find(p => p.id === selectedProjectId);
  }, [allProjects, selectedProjectId]);

  // 【核心修改】根据 billing_type_id 动态生成单位和数据
  const unitConfig = useMemo(() => {
    // 【修复】直接从 allProjects 列表中查找，确保在数据加载期间也能获取到正确的 billing_type_id
    const billingType = allProjects.find(p => p.id === selectedProjectId)?.billing_type_id;
    const stats = dashboardData?.summary_stats;
    const daily = dashboardData?.daily_report;

    switch (billingType) {
      case 2: // 计车
        return {
          progressUnit: '车',
          progressCompleted: stats?.total_trips || 0,
          progressPlanned: selectedProjectDetails?.planned_total_tons || 1, // 按指示，计划数用吨位的值
          dailyReportLabel: '当日运输车次',
          dailyReportValue: daily?.trip_count || 0,
          trendLineLabel: '总车次',
          driverReportColHeader: '出车次数',
          getDriverReportRowValue: (row: DriverReportRow) => row.trip_count,
        };
      case 3: // 计方
        // 警告：后端未提供体积数据，暂时使用吨位数据进行展示，标签已按要求修改。
        // 建议未来更新后端以提供真实体积数据。
        return {
          progressUnit: '立方',
          progressCompleted: stats?.total_tonnage || 0, // 使用吨位数据
          progressPlanned: selectedProjectDetails?.planned_total_tons || 1, // 使用吨位数据
          dailyReportLabel: '当日运输立方',
          dailyReportValue: daily?.total_tonnage || 0, // 使用吨位数据
          trendLineLabel: '总立方',
          driverReportColHeader: '卸货立方',
          getDriverReportRowValue: (row: DriverReportRow) => row.total_tonnage, // 使用吨位数据
        };
      default: // 计吨 (billing_type_id 为 1, null, 或其他)
        return {
          progressUnit: '吨',
          progressCompleted: stats?.total_tonnage || 0,
          progressPlanned: selectedProjectDetails?.planned_total_tons || 1,
          dailyReportLabel: '当日运输吨数',
          dailyReportValue: daily?.total_tonnage || 0,
          trendLineLabel: '总重量',
          driverReportColHeader: '卸货吨数',
          getDriverReportRowValue: (row: DriverReportRow) => row.total_tonnage,
        };
    }
  }, [selectedProjectId, dashboardData, allProjects]); // 【修复】优化依赖项，确保在ID或数据变化时正确重新计算

  const progressPercentage = (unitConfig.progressCompleted / unitConfig.progressPlanned) * 100;

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
      <div className="p-6 bg-slate-50 min-h-screen">
        <h1 className="text-3xl font-bold text-blue-600">项目看板</h1>
        <div className="text-center py-10 text-slate-500">暂无项目数据</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-blue-600">项目看板</h1>
        <div className="flex items-center gap-4">
          <Select value={selectedProjectId || ''} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[250px]"><SelectValue placeholder="请选择项目..." /></SelectTrigger>
            <SelectContent>
              {allProjects.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className={cn("w-[200px] justify-start text-left font-normal", !reportDate && "text-slate-500")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {reportDate ? format(reportDate, "yyyy-MM-dd") : <span>选择日期</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <CalendarComponent mode="single" selected={reportDate} onSelect={(date) => date && setReportDate(date)} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* 左侧区域 */}
        <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-sm">
                <CardHeader><CardTitle className="flex items-center text-slate-700"><Target className="mr-2 h-5 w-5 text-blue-500"/>项目进度 ({selectedProjectDetails?.name})</CardTitle></CardHeader>
                <CardContent className="text-center space-y-4 pt-2">
                    <div className="h-40 w-full">
                      <CircularProgressChart value={progressPercentage} />
                    </div>
                    <Progress value={progressPercentage} />
                    <div className="text-lg font-semibold text-slate-500">
                        {formatNumber(unitConfig.progressCompleted, unitConfig.progressUnit)} / <span className="text-slate-800">{formatNumber(unitConfig.progressPlanned, unitConfig.progressUnit)}</span>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* 右侧区域 */}
        <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
               <CardHeader><CardTitle className="flex items-center text-slate-700"><CalendarIcon className="mr-2 h-5 w-5 text-orange-500"/>日报</CardTitle></CardHeader>
               <CardContent className="grid grid-cols-4 gap-4 text-center">
                  <div>
                      <p className="text-2xl font-bold text-slate-800">{formatNumber(dashboardData.daily_report?.trip_count, '车')}</p>
                      <p className="text-sm text-slate-500">当日车次</p>
                  </div>
                  <div>
                      <p className="text-2xl font-bold text-slate-800">{formatNumber(unitConfig.dailyReportValue, unitConfig.progressUnit)}</p>
                      <p className="text-sm text-slate-500">{unitConfig.dailyReportLabel}</p>
                  </div>
                  <div>
                      <p className="text-2xl font-bold text-green-600">{formatNumber(dashboardData.daily_report?.driver_receivable, '元')}</p>
                      <p className="text-sm text-slate-500">司机应收</p>
                  </div>
                  <div>
                      <p className="text-2xl font-bold text-red-600">{formatNumber(dashboardData.daily_report?.partner_payable, '元')}</p>
                      <p className="text-sm text-slate-500">{selectedProjectDetails?.partner_name || '合作方'}应付</p>
                  </div>
               </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-700"><Truck className="h-4 w-4 mr-2 text-slate-500"/>项目已发车次</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-slate-800">{formatNumber(dashboardData.summary_stats?.total_trips, '车')}</p></CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-700"><Wallet className="h-4 w-4 mr-2 text-green-500"/>项目现应收</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-slate-800">{formatNumber(dashboardData.summary_stats?.total_cost, '元')}</p></CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-700"><BarChartHorizontal className="h-4 w-4 mr-2 text-indigo-500"/>平均吨成本</CardTitle></CardHeader>
                  <CardContent><p className="text-xl font-bold text-slate-800">{formatNumber(dashboardData.summary_stats?.avg_cost, '元')}</p></CardContent>
                </Card>
            </div>
        </div>

        {/* 底部图表区域 */}
        <div className="lg:col-span-3">
            <Card className="shadow-sm">
              <CardHeader><CardTitle className="flex items-center text-slate-700"><TrendingUp className="mr-2 h-5 w-5 text-teal-500"/>项目近7日进度 ({selectedProjectDetails?.name})</CardTitle></CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.seven_day_trend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" domain={[0, maxTrips]} label={{ value: '吨 / 车', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: '元', angle: -90, position: 'insideRight' }} />
                    <Tooltip formatter={(value: number, name: string) => [`${value.toLocaleString()} ${name === '车次' ? '车' : name === '总重量' || name === '总车次' || name === '总立方' ? unitConfig.progressUnit : '元'}`, name]} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="trips" name="车次" stroke="#4338ca" strokeWidth={2} hide={!visibleLines.trips} />
                    <Line yAxisId="left" type="monotone" dataKey="weight" name={unitConfig.trendLineLabel} stroke="#0d9488" strokeWidth={2} hide={!visibleLines.weight} />
                    <Line yAxisId="right" type="monotone" dataKey="receivable" name="应收总额" stroke="#f59e0b" strokeWidth={2} hide={!visibleLines.receivable} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
        </div>
        
        {/* 司机工作量报告表格 */}
        <div className="lg:col-span-3">
            <Card className="shadow-sm">
              <CardHeader><CardTitle className="flex items-center text-slate-700"><Users className="mr-2 h-5 w-5 text-purple-500" />司机工作量报告 ({format(reportDate, "yyyy-MM-dd")})</CardTitle></Header>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>司机姓名</TableHead>
                      <TableHead className="text-right">出车次数</TableHead>
                      <TableHead className="text-right">{unitConfig.driverReportColHeader}</TableHead>
                      <TableHead className="text-right">司机应收 (元)</TableHead>
                      {selectedProjectDetails?.billing_type_id === 1 && (
                        <TableHead className="text-right">{selectedProjectDetails?.partner_name || '合作方'}应付 (元)</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.driver_report_table.length > 0 ? (
                      dashboardData.driver_report_table.map((row) => (
                        <TableRow key={row.driver_name}>
                          <TableCell className="font-medium">{row.driver_name}</TableCell>
                          <TableCell className="text-right">{row.trip_count}</TableCell>
                          <TableCell className="text-right">{formatNumber(unitConfig.getDriverReportRowValue(row))}</TableCell>
                          <TableCell className="text-right text-green-600 font-semibold">{formatNumber(row.total_driver_receivable)}</TableCell>
                          {selectedProjectDetails?.billing_type_id === 1 && (
                            <TableCell className="text-right text-red-600 font-semibold">{formatNumber(row.total_partner_payable)}</TableCell>
                          )}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={selectedProjectDetails?.billing_type_id === 1 ? 5 : 4} className="h-24 text-center text-slate-500">
                          该日无司机工作记录
                        </TableCell>
                      </TableRow>
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
