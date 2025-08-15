// 文件路径: src/pages/ProjectDashboard.tsx
// 描述: [DIAGNOSTIC-STEP-2 / r9N7N] 恢复部分UI，用于定位渲染崩溃点。

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  RadialBarChart, RadialBar, PolarAngleAxis, LabelList
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { LogisticsRecordsModal } from '@/components/LogisticsRecordsModal';

// --- 类型定义 ---
interface ProjectDetails { id: string; name: string; partner_name: string; start_date: string; planned_total_tons: number; billing_type_id: number; }
interface DailyReport { trip_count: number; total_tonnage: number; driver_receivable: number; partner_payable: number; }
interface TrendData { date: string; trips: number; weight: number; receivable: number; }
interface SummaryStats { total_trips: number; total_cost: number; avg_cost: number; total_tonnage: number; }
interface DriverReportRow { 
  driver_name: string; 
  license_plate: string;
  phone: string;
  trip_count: number; 
  total_tonnage: number; 
  total_driver_receivable: number; 
  total_partner_payable: number;
  total_trips_in_project: number;
  total_receivable_in_project: number;
}
interface DailyLogisticsRecord { id: string; auto_number: string; driver_name: string; license_plate: string; loading_weight: number; unloading_weight: number; current_cost: number; }
interface DashboardData { 
  project_details: ProjectDetails[] | null; 
  daily_report: DailyReport | null; 
  seven_day_trend: TrendData[] | null;
  summary_stats: SummaryStats | null; 
  driver_report_table: DriverReportRow[] | null;
  daily_logistics_records: Record<string, DailyLogisticsRecord[]> | null;
}

// --- 辅助函数 ---
const formatNumber = (val: number | null | undefined, unit: string = '') => `${(val || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}${unit ? ' ' + unit : ''}`;

// --- 环形进度图组件 ---
const CircularProgressChart = ({ value }: { value: number }) => {
  // 增加对无效值的防御
  const safeValue = isFinite(value) ? value : 0;
  console.log(`[调试] CircularProgressChart 接收到的 value: ${value}, 安全处理后: ${safeValue}`);
  const data = [{ name: 'progress', value: safeValue, fill: '#2563eb' }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="90%" barSize={12} data={data} startAngle={90} endAngle={-270}>
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar background={{ fill: '#e2e8f0' }} dataKey="value" cornerRadius={10} angleAxisId={0} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold fill-blue-600">{`${safeValue.toFixed(1)}%`}</text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
};

// --- 主组件 ---
export default function ProjectDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportDate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        if (!projectId) { return; }
        const { data, error } = await supabase.rpc('get_project_dashboard_data_v2' as any, {
          p_selected_project_id: projectId,
          p_report_date: format(reportDate, 'yyyy-MM-dd')
        });
        if (error) throw error;
        setDashboardData(data);
      } catch (error) {
        console.error("诊断代码捕获错误:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [projectId, reportDate]);

  if (loading) {
    return <div className="p-6">正在加载数据...</div>;
  }

  const allProjects = dashboardData?.project_details || [];
  const selectedProjectDetails = allProjects.find(p => p.id === projectId);

  if (!selectedProjectDetails) {
    return <div className="p-6">当前项目数据不存在或加载失败。请确认URL中的项目ID是否正确。</div>;
  }

  // --- 隔离可疑计算 ---
  console.log("[调试] 开始计算 unitConfig...");
  const unitConfig = useMemo(() => {
    const billingType = selectedProjectDetails?.billing_type_id;
    const stats = dashboardData?.summary_stats;
    const daily = dashboardData?.daily_report;
    switch (billingType) {
      case 2: return { progressUnit: '车', progressCompleted: stats?.total_trips || 0, progressPlanned: selectedProjectDetails?.planned_total_tons || 1, dailyReportLabel: '当日运输车次', dailyReportValue: daily?.trip_count || 0, trendLineLabel: '总车次', driverReportColHeader: '卸货车次', getDriverReportRowValue: (row: DriverReportRow) => row.trip_count, };
      case 3: return { progressUnit: '立方', progressCompleted: stats?.total_tonnage || 0, progressPlanned: selectedProjectDetails?.planned_total_tons || 1, dailyReportLabel: '当日运输立方', dailyReportValue: daily?.total_tonnage || 0, trendLineLabel: '总立方', driverReportColHeader: '卸货立方', getDriverReportRowValue: (row: DriverReportRow) => row.total_tonnage, };
      default: return { progressUnit: '吨', progressCompleted: stats?.total_tonnage || 0, progressPlanned: selectedProjectDetails?.planned_total_tons || 1, dailyReportLabel: '当日运输吨数', dailyReportValue: daily?.total_tonnage || 0, trendLineLabel: '总重量', driverReportColHeader: '卸货吨数', getDriverReportRowValue: (row: DriverReportRow) => row.total_tonnage, };
    }
  }, [selectedProjectDetails, dashboardData]);
  console.log("[调试] unitConfig 计算结果:", unitConfig);

  const progressPlannedSafe = unitConfig.progressPlanned || 1;
  console.log("[调试] progressPlannedSafe:", progressPlannedSafe);

  const progressPercentage = (unitConfig.progressCompleted / progressPlannedSafe) * 100;
  console.log("[调试] progressPercentage 计算结果 (传递给组件的值):", progressPercentage);

  // --- 只渲染最可疑的组件 ---
  return (
    <div className="p-6">
      <h1>诊断渲染页面</h1>
      <p>此页面用于测试。请打开开发者工具的控制台查看 [调试] 日志。</p>
      <hr style={{ margin: '20px 0' }} />

      <Card className="shadow-sm">
        <CardHeader><CardTitle>项目进度 ({selectedProjectDetails.name})</CardTitle></CardHeader>
        <CardContent className="text-center space-y-4 pt-2">
          
          <p style={{ color: 'blue', fontWeight: 'bold' }}>即将渲染图表，传递的 value 是: {progressPercentage}</p>
          {/* 步骤A: 先注释掉这个组件 */}
          {/* <div className="h-40 w-full"><CircularProgressChart value={progressPercentage} /></div> */}
          
          <p style={{ color: 'blue', fontWeight: 'bold' }}>即将渲染进度条，传递的 value 是: {progressPercentage}</p>
          {/* 步骤A: 先注释掉这个组件 */}
          {/* <Progress value={progressPercentage} /> */}

          <div className="text-lg font-semibold text-slate-500">
            {formatNumber(unitConfig.progressCompleted, unitConfig.progressUnit)} / <span className="text-slate-800">{formatNumber(progressPlannedSafe, unitConfig.progressUnit)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
