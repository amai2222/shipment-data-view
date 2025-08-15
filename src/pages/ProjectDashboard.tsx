// 文件路径: src/pages/ProjectDashboard.tsx
// 描述: [CRASH-FIX-Final] 防崩溃最终版。增加了对潜在null值的健壮性处理。

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
  project_details: ProjectDetails[]; 
  daily_report: DailyReport; 
  seven_day_trend: TrendData[]; 
  summary_stats: SummaryStats; 
  driver_report_table: DriverReportRow[] | null; // ★★★ 防崩溃修改: 允许为null
  daily_logistics_records: Record<string, DailyLogisticsRecord[]> | null; // ★★★ 防崩溃修改: 允许为null
}

// --- 辅助函数 ---
const formatNumber = (val: number | null | undefined, unit: string = '') => `${(val || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}${unit ? ' ' + unit : ''}`;

// --- 环形进度图组件 ---
const CircularProgressChart = ({ value }: { value: number }) => {
  const data = [{ name: 'progress', value: value, fill: '#2563eb' }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="90%" barSize={12} data={data} startAngle={90} endAngle={-270}>
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar background={{ fill: '#e2e8f0' }} dataKey="value" cornerRadius={10} angleAxisId={0} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold fill-blue-600">{`${value.toFixed(1)}%`}</text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
};

// --- 主组件 ---
export default function ProjectDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{ date: string; records: DailyLogisticsRecord[] }>({ date: '', records: [] });

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        if (!projectId) { setLoading(false); return; }
        
        const { data, error } = await supabase.rpc('get_project_dashboard_data_v2' as any, {
          p_selected_project_id: projectId,
          p_report_date: format(reportDate, 'yyyy-MM-dd')
        });

        if (error) throw error;
        setDashboardData(data as unknown as DashboardData);

      } catch (error) {
        console.error("加载看板数据失败:", error);
        toast({ title: "错误", description: `加载看板数据失败: ${(error as any).message}`, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [projectId, reportDate, toast]);

  const allProjects = dashboardData?.project_details || [];
  const selectedProjectDetails = useMemo(() => allProjects.find(p => p.id === projectId), [allProjects, projectId]);

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

  const progressPercentage = (unitConfig.progressCompleted / unitConfig.progressPlanned) * 100;

  const handleDotClick = (e: any) => {
    const date = e.payload.date;
    const records = dashboardData?.daily_logistics_records?.[date] || [];
    setModalContent({ date, records });
    setIsModalOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
  }

  if (!dashboardData || !selectedProjectDetails) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <h1 className="text-3xl font-bold text-blue-600">项目看板</h1>
        <div className="text-center py-10 text-slate-500">项目数据不存在或加载失败。请检查项目ID是否正确或刷新重试。</div>
      </div>
    );
  }

  // ★★★ 防崩溃修改: 将可能为null的数组转为空数组，确保安全调用 .map() ★★★
  const safeDriverReportTable = dashboardData.driver_report_table || [];

  return (
    <div className="p-6 bg-slate-50 space-y-6">
      <LogisticsRecordsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        date={modalContent.date} 
        records={modalContent.records} 
      />

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-blue-600">项目看板</h1>
        <div className="flex items-center gap-4">
          <Select value={projectId || ''} onValueChange={(newId) => navigate(`/project/${newId}`)}>
            <SelectTrigger className="w-[250px]"><SelectValue placeholder="请选择项目..." /></SelectTrigger>
            <SelectContent>{allProjects.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild><Button variant={"outline"} className={cn("w-[200px] justify-start text-left font-normal", !reportDate && "text-slate-500")}><CalendarIcon className="mr-2 h-4 w-4" />{reportDate ? format(reportDate, "yyyy-MM-dd") : <span>选择日期</span>}</Button></PopoverTrigger>
            <PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={reportDate} onSelect={(date) => date && setReportDate(date)} initialFocus /></PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-sm">
                <CardHeader><CardTitle className="flex items-center text-slate-700"><Target className="mr-2 h-5 w-5 text-blue-500"/>项目进度 ({selectedProjectDetails.name})</CardTitle></CardHeader>
                <CardContent className="text-center space-y-4 pt-2">
                    <div className="h-40 w-full"><CircularProgressChart value={progressPercentage} /></div>
                    <Progress value={progressPercentage} />
                    <div className="text-lg font-semibold text-slate-500">{formatNumber(unitConfig.progressCompleted, unitConfig.progressUnit)} / <span className="text-slate-800">{formatNumber(unitConfig.progressPlanned, unitConfig.progressUnit)}</span></div>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
               <CardHeader><CardTitle className="flex items-center text-slate-700"><CalendarIcon className="mr-2 h-5 w-5 text-orange-500"/>日报 ({format(reportDate, "yyyy-MM-dd")})</CardTitle></CardHeader>
               <CardContent className="grid grid-cols-4 gap-4 text-center">
                  <div>
                      <p className="text-2xl font-bold text-slate-800">{formatNumber(dashboardData.daily_report?.trip_count)} / <span className="text-slate-500">{formatNumber(dashboardData.summary_stats?.total_trips)}</span></p>
                      <p className="text-sm text-slate-500">当日车次 / 总车次</p>
                  </div>
                  <div>
                      <p className="text-2xl font-bold text-slate-800">{formatNumber(unitConfig.dailyReportValue)} / <span className="text-slate-500">{formatNumber(unitConfig.progressCompleted)}</span></p>
                      <p className="text-sm text-slate-500">当日 / 总{unitConfig.progressUnit}</p>
                  </div>
                  <div>
                      <p className="text-2xl font-bold text-green-600">{formatNumber(dashboardData.daily_report?.driver_receivable, '元')}</p>
                      <p className="text-sm text-slate-500">司机应收</p>
                  </div>
                  <div>
                      <p className="text-2xl font-bold text-red-600">{formatNumber(dashboardData.daily_report?.partner_payable, '元')}</p>
                      <p className="text-sm text-slate-500">{selectedProjectDetails.partner_name || '合作方'}应付</p>
                  </div>
               </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-700"><Truck className="h-4 w-4 mr-2 text-slate-500"/>{selectedProjectDetails.name}已发总车次</CardTitle></CardHeader>
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
        <div className="lg:col-span-3">
            <Card className="shadow-sm">
              <CardHeader><CardTitle className="flex items-center text-slate-700"><TrendingUp className="mr-2 h-5 w-5 text-teal-500"/>{selectedProjectDetails.name} 近7日进度</CardTitle></CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.seven_day_trend || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" label={{ value: unitConfig.progressUnit, angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: '元', angle: -90, position: 'insideRight' }} />
                    <Tooltip formatter={(value: number, name: string) => [`${value.toLocaleString()} ${name === '车次' ? '车' : name === unitConfig.trendLineLabel ? unitConfig.progressUnit : '元'}`, name]} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="trips" name="车次" stroke="#4338ca" strokeWidth={2} activeDot={{ r: 8, onClick: handleDotClick }}>
                      <LabelList dataKey="trips" position="top" formatter={(value: number) => value > 0 ? `${value}车` : ''} />
                    </Line>
                    <Line yAxisId="left" type="monotone" dataKey="weight" name={unitConfig.trendLineLabel} stroke="#0d9488" strokeWidth={2} activeDot={{ r: 8, onClick: handleDotClick }}>
                      <LabelList dataKey="weight" position="top" formatter={(value: number) => value > 0 ? `${value.toFixed(1)}${unitConfig.progressUnit}` : ''} />
                    </Line>
                    <Line yAxisId="right" type="monotone" dataKey="receivable" name="应收总额" stroke="#f59e0b" strokeWidth={2} activeDot={{ r: 8, onClick: handleDotClick }}>
                       <LabelList dataKey="receivable" position="top" formatter={(value: number) => value > 0 ? `¥${Math.round(value)}` : ''} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-3">
            <Card className="shadow-sm">
              <CardHeader><CardTitle className="flex items-center text-slate-700"><Users className="mr-2 h-5 w-5 text-purple-500" />司机工作量报告 ({format(reportDate, "yyyy-MM-dd")})</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>司机</TableHead>
                      <TableHead>车牌</TableHead>
                      <TableHead>电话</TableHead>
                      <TableHead className="text-right">出车次数 / 总车次</TableHead>
                      <TableHead className="text-right">{unitConfig.driverReportColHeader}</TableHead>
                      <TableHead className="text-right">司机应收 / 总应收 (元)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeDriverReportTable.length > 0 ? (
                      safeDriverReportTable.map((row) => (
                        <TableRow key={row.driver_name}>
                          <TableCell className="font-medium">{row.driver_name}</TableCell>
                          <TableCell>{row.license_plate || '—'}</TableCell>
                          <TableCell>{row.phone || '—'}</TableCell>
                          <TableCell className="text-right">{row.trip_count} / <span className="text-muted-foreground">{row.total_trips_in_project}</span></TableCell>
                          <TableCell className="text-right">{formatNumber(unitConfig.getDriverReportRowValue(row))}</TableCell>
                          <TableCell className="text-right text-green-600 font-semibold">{formatNumber(row.total_driver_receivable)} / <span className="text-muted-foreground">{formatNumber(row.total_receivable_in_project)}</span></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={6} className="h-24 text-center text-slate-500">该日无司机工作记录</TableCell></TableRow>
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
