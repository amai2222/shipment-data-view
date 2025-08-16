// 文件路径: src/pages/ProjectDashboard.tsx
// 描述: [Definitive-Final-Fix] 调用 v7 后端函数，该函数已基于真实表结构修正所有错误。

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
  RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// --- 类型定义 ---
interface ProjectDetails { id: string; name: string; partner_name: string; start_date: string; planned_total_tons: number; billing_type_id: number; }
interface DailyReport { trip_count: number; total_tonnage: number; driver_receivable: number; partner_payable: number; total_trip_count: number; }
interface SummaryStats { total_trips: number; total_cost: number; avg_cost: number; total_tonnage: number; }
interface DriverReportRow { driver_name: string; license_plate: string; phone: string; trip_count: number; total_tonnage: number; total_driver_receivable: number; total_partner_payable: number; daily_trip_count: number; daily_receivable: number; total_trip_count: number; payable_cost: number; }
interface DailyTransportStats { date: string; actualTransport: number; returns: number; }
interface DailyCostStats { date: string; totalCost: number; }
interface DailyCountStats { date: string; count: number; }

interface DashboardData { 
  project_details: ProjectDetails[]; 
  daily_report: DailyReport; 
  summary_stats: SummaryStats; 
  driver_report_table: DriverReportRow[];
  daily_transport_stats: DailyTransportStats[];
  daily_count_stats: DailyCountStats[];
  daily_cost_stats: DailyCostStats[];
}

// --- 辅助函数 ---
const formatNumber = (val: number | null | undefined, unit: string = '') => `${(val || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}${unit ? ' ' + unit : ''}`;

// --- 环形进度图组件 ---
const CircularProgressChart = ({ value }: { value: number }) => {
  const data = [{ name: 'progress', value: value, fill: 'hsl(var(--primary))' }];
  return (
    <ResponsiveContainer width="100%" height={80}>
      <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="85%" barSize={8} data={data} startAngle={90} endAngle={-270}>
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar background={{ fill: 'hsl(var(--muted))' }} dataKey="value" cornerRadius={6} angleAxisId={0} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-sm font-bold fill-primary">{`${value.toFixed(1)}%`}</text>
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

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        if (!projectId) {
          setLoading(false);
          return;
        }
        // ★★★ 核心修改: 调用最终的 v7 后端函数 ★★★
        const { data, error } = await supabase.rpc('get_project_dashboard_data_v7' as any, {
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
    const defaultConfig = {
      progressUnit: '吨', progressCompleted: 0, progressPlanned: 1, dailyReportLabel: '当日/总运输量',
      dailyReportValue: 0, totalReportValue: 0, trendLineLabel: '总重量', driverReportColHeader: '数量（吨）',
      getDriverReportRowValue: (row: DriverReportRow) => row.total_tonnage, showQuantityColumn: true,
    };
    if (!selectedProjectDetails || !dashboardData) return defaultConfig;
    const { billing_type_id, planned_total_tons } = selectedProjectDetails;
    const { summary_stats, daily_report } = dashboardData;
    const typeId = parseInt(billing_type_id as any, 10);
    const isByTrip = typeId === 2;
    const isByVolume = typeId === 3;
    return {
      progressUnit: isByTrip ? '车' : (isByVolume ? '立方' : '吨'),
      progressCompleted: isByTrip ? summary_stats?.total_trips || 0 : summary_stats?.total_tonnage || 0,
      progressPlanned: planned_total_tons || 1,
      dailyReportLabel: '当日/总运输量',
      dailyReportValue: isByTrip ? daily_report?.trip_count || 0 : daily_report?.total_tonnage || 0,
      totalReportValue: isByTrip ? daily_report?.total_trip_count || 0 : summary_stats?.total_tonnage || 0,
      trendLineLabel: isByTrip ? '总车次' : (isByVolume ? '总立方' : '总重量'),
      driverReportColHeader: isByTrip ? '出车次数' : (isByVolume ? '数量（立方）' : '数量（吨）'),
      getDriverReportRowValue: (row: DriverReportRow) => isByTrip ? row.trip_count : row.total_tonnage,
      showQuantityColumn: !isByTrip,
    };
  }, [selectedProjectDetails, dashboardData]);

  const progressPercentage = (unitConfig.progressCompleted / unitConfig.progressPlanned) * 100;

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
  }

  if (!dashboardData || !selectedProjectDetails) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <h1 className="text-3xl font-bold text-blue-600">项目看板</h1>
        <div className="text-center py-10 text-slate-500">项目数据不存在或加载失败。请检查项目ID是否正确。</div>
      </div>
    );
  }

  const legendTotals = {
    actualTransportTotal: dashboardData.daily_transport_stats.reduce((sum, day) => sum + day.actualTransport, 0),
    returnsTotal: dashboardData.daily_transport_stats.reduce((sum, day) => sum + day.returns, 0),
    totalCostSum: dashboardData.daily_cost_stats.reduce((sum, day) => sum + day.totalCost, 0),
    totalTrips: dashboardData.daily_count_stats.reduce((sum, day) => sum + day.count, 0),
  };

  return (
    <div className="p-6 bg-slate-50 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-blue-600">项目看板</h1>
        <div className="flex items-center gap-4">
          <Select value={projectId || ''} onValueChange={(newId) => navigate(`/project/${newId}`)}>
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
        <div className="lg:col-span-1 space-y-6">
            <Card className="shadow-sm flex flex-col h-full">
                <CardHeader>
                    <CardTitle className="flex items-center text-slate-700"><Target className="mr-2 h-5 w-5 text-blue-500"/>项目进度 ({selectedProjectDetails.name})</CardTitle>
                    <p className="text-sm text-slate-500 pt-1">{selectedProjectDetails.partner_name}</p>
                </CardHeader>
                <CardContent className="space-y-4 flex-grow flex flex-col justify-center">
                    <div>
                        <div className="flex justify-between text-sm text-slate-600 mb-2">
                            <span>进度 ({unitConfig.progressUnit})</span>
                            <span className="font-semibold">{progressPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex-shrink-0 w-20 h-20">
                                <CircularProgressChart value={progressPercentage} />
                            </div>
                            <div className="flex-grow">
                                <Progress value={progressPercentage} />
                                <p className="text-xs text-right text-slate-500 mt-1">
                                    {formatNumber(unitConfig.progressCompleted)} / {formatNumber(unitConfig.progressPlanned)}
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
               <CardHeader><CardTitle className="flex items-center text-slate-700"><CalendarIcon className="mr-2 h-5 w-5 text-orange-500"/>{format(reportDate, "yyyy-MM-dd")} 日报</CardTitle></CardHeader>
               <CardContent className="grid grid-cols-4 gap-4 text-center pt-4">
                  <div>
                      <p className="text-2xl font-bold text-slate-800">{formatNumber(dashboardData.daily_report?.trip_count)}/{formatNumber(dashboardData.daily_report?.total_trip_count)}</p>
                      <p className="text-sm text-slate-500">当日/总车次</p>
                  </div>
                  <div>
                      <p className="text-2xl font-bold text-slate-800">{formatNumber(unitConfig.dailyReportValue)}/{formatNumber(unitConfig.totalReportValue)} {unitConfig.progressUnit}</p>
                      <p className="text-sm text-slate-500">{unitConfig.dailyReportLabel}</p>
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
          <Card className="shadow-card">
            <CardHeader><CardTitle>每日运输量统计 (吨)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.daily_transport_stats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} interval={Math.floor(dashboardData.daily_transport_stats.length / 15)} />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [`${Number(value).toFixed(2)} 吨`, name === 'actualTransport' ? '有效运输' : '退货']} />
                    <Legend formatter={(value) => value === 'actualTransport' ? `有效运输 (${legendTotals.actualTransportTotal.toFixed(1)}吨)` : `退货 (${legendTotals.returnsTotal.toFixed(1)}吨)`} />
                    <Bar dataKey="actualTransport" fill="#4ade80" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="returns" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="shadow-card">
            <CardHeader><CardTitle>运输日报 (车次)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.daily_count_stats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} interval={Math.floor(dashboardData.daily_count_stats.length / 15)} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(value) => [`${value} 次`, '运输次数']} />
                    <Legend formatter={() => `运输次数 (总计 ${legendTotals.totalTrips} 次)`} />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="shadow-card">
            <CardHeader><CardTitle>每日运输费用分析 (元)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.daily_cost_stats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} interval={Math.floor(dashboardData.daily_cost_stats.length / 15)} />
                    <YAxis />
                    <Tooltip formatter={(value) => [`¥${Number(value).toFixed(2)}`, '总费用']} />
                    <Legend formatter={() => `总费用 (¥${legendTotals.totalCostSum.toFixed(2)})`} />
                    <Bar dataKey="totalCost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
                      <TableHead>司机信息</TableHead>
                      <TableHead className="text-right">当日出车/总出车</TableHead>
                      {unitConfig.showQuantityColumn && (<TableHead className="text-right">{unitConfig.driverReportColHeader}</TableHead>)}
                      <TableHead className="text-right">司机应收 (元)</TableHead>
                      {selectedProjectDetails.billing_type_id === 1 && (<TableHead className="text-right">{selectedProjectDetails.partner_name || '合作方'}应付 (元)</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.driver_report_table.length > 0 ? (
                      dashboardData.driver_report_table.map((row) => (
                        <TableRow key={row.driver_name}>
                          <TableCell className="font-medium">
                            <div className="space-y-1">
                              <div className="font-semibold">{row.driver_name}</div>
                              <div className="text-sm text-slate-500">{row.license_plate}</div>
                              <div className="text-sm text-slate-500">{row.phone}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{row.daily_trip_count} / {row.total_trip_count}</TableCell>
                          {unitConfig.showQuantityColumn && (<TableCell className="text-right">{formatNumber(unitConfig.getDriverReportRowValue(row), unitConfig.progressUnit)}</TableCell>)}
                          <TableCell className="text-right text-green-600 font-semibold">{formatNumber(row.daily_receivable)} / {formatNumber(row.payable_cost)}</TableCell>
                          {selectedProjectDetails.billing_type_id === 1 && (<TableCell className="text-right text-red-600 font-semibold">{formatNumber(row.total_partner_payable)}</TableCell>)}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={selectedProjectDetails.billing_type_id === 1 ? (unitConfig.showQuantityColumn ? 5 : 4) : (unitConfig.showQuantityColumn ? 4 : 3)} className="h-24 text-center text-slate-500">该日无司机工作记录</TableCell>
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
