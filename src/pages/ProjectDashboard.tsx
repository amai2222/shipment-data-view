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
import { Loader2, TrendingUp, Target, Truck, Wallet, BarChartHorizontal, Users, Calendar as CalendarIcon, Package, LayoutDashboard } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
  RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// --- 类型定义 (保持不变) ---
interface ProjectDetails { id: string; name: string; partner_name: string; start_date: string; planned_total_tons: number; billing_type_id: number; }
interface DailyReport { trip_count: number; total_tonnage: number; driver_receivable: number; partner_payable: number; }
interface TrendData { date: string; trips: number; weight: number; receivable: number; }
interface SummaryStats { total_trips: number; total_cost: number; avg_cost: number; total_tonnage: number; }
interface DriverReportRow { driver_name: string; license_plate: string; phone: string; daily_trip_count: number; total_trip_count: number; total_tonnage: number; total_driver_receivable: number; total_partner_payable: number; }
interface DashboardData { project_details: ProjectDetails[]; daily_report: DailyReport; seven_day_trend: TrendData[]; summary_stats: SummaryStats; driver_report_table: DriverReportRow[]; }

// --- 辅助函数 (保持不变) ---
const formatNumber = (val: number | null | undefined, unit: string = '') => `${(val || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}${unit ? ' ' + unit : ''}`;

const CircularProgressChart = ({ value }: { value: number }) => {
  const data = [{ name: 'progress', value: value, fill: 'hsl(var(--primary))' }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="85%" barSize={10} data={data} startAngle={90} endAngle={-270}>
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar background={{ fill: 'hsl(var(--muted))' }} dataKey="value" cornerRadius={6} angleAxisId={0} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-lg font-bold fill-primary">{`${value.toFixed(1)}%`}</text>
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
  const [visibleLines, setVisibleLines] = useState({ weight: true, trips: true, receivable: true });

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        if (!projectId) {
          console.warn("URL中未提供项目ID");
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.rpc('get_project_dashboard_data' as any, {
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
    const defaultConfig = { billingTypeId: 1, unit: '吨', progressCompleted: 0, progressPlanned: 1 };
    if (!selectedProjectDetails || !dashboardData) return defaultConfig;
    const { billing_type_id, planned_total_tons } = selectedProjectDetails;
    const { summary_stats } = dashboardData;
    const typeId = parseInt(billing_type_id as any, 10);
    let unitText = '吨';
    if (typeId === 2) unitText = '车';
    if (typeId === 3) unitText = '立方';
    return {
      billingTypeId: typeId,
      unit: unitText,
      progressCompleted: typeId === 2 ? summary_stats?.total_trips || 0 : summary_stats?.total_tonnage || 0,
      progressPlanned: planned_total_tons || 1,
    };
  }, [selectedProjectDetails, dashboardData]);

  const progressPercentage = (unitConfig.progressPlanned > 0) ? (unitConfig.progressCompleted / unitConfig.progressPlanned) * 100 : 0;

  const handleLegendClick = (dataKey: string) => {
    setVisibleLines(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };

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

  return (
    <div className="p-6 bg-slate-50 space-y-6">
      {/* ★★★ 2.1: 调整网格布局以适应新的卡片尺寸 ★★★ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        {/* ★★★ 2.2: 调整项目进度卡片的列宽 ★★★ */}
        <div className="lg:col-span-2">
            <Card className="shadow-sm flex flex-col h-full">
                {/* ★★★ 2.3: 调整 CardHeader 布局防止换行 ★★★ */}
                <CardHeader className="flex flex-row justify-between items-center space-x-4">
                    <div className="flex-shrink-0">
                        <CardTitle className="flex items-center text-lg whitespace-nowrap">
                            <Target className="mr-2 h-5 w-5 text-blue-500"/>
                            <span className="text-blue-500">项目进度</span>
                            <span className="ml-1 text-base font-normal text-slate-600">({selectedProjectDetails.name})</span>
                        </CardTitle>
                        <p className="text-sm text-slate-500 pt-1">{selectedProjectDetails.partner_name}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Select value={projectId || ''} onValueChange={(newId) => navigate(`/project/${newId}`)}>
                            <SelectTrigger className="w-auto min-w-[150px] bg-white text-slate-900 border-slate-300">
                                <SelectValue placeholder="请选择项目..." />
                            </SelectTrigger>
                            <SelectContent>
                                {allProjects.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-auto min-w-[130px] justify-start text-left font-normal bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-900", !reportDate && "text-slate-500")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {reportDate ? format(reportDate, "yyyy-MM-dd") : <span>选择日期</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <CalendarComponent mode="single" selected={reportDate} onSelect={(date) => date && setReportDate(date)} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                </CardHeader>
                {/* ★★★ 1.1: 修复环形图显示问题 ★★★ */}
                <CardContent className="flex-grow flex flex-col justify-center items-center p-4 space-y-4">
                    <div className="flex justify-between text-sm text-slate-600 w-full">
                        <span>进度 ({unitConfig.unit})</span>
                        <span className="font-semibold">{progressPercentage.toFixed(1)}%</span>
                    </div>
                    {/* ★★★ 1.2: 为环形图提供一个固定高宽比的容器 ★★★ */}
                    <div className="w-full max-w-[200px] aspect-square">
                        <CircularProgressChart value={progressPercentage} />
                    </div>
                    <div className="w-full">
                        <Progress value={progressPercentage} />
                        <p className="text-sm font-bold text-center text-slate-600 mt-2">
                            {formatNumber(unitConfig.progressCompleted, unitConfig.unit)} / {formatNumber(unitConfig.progressPlanned, unitConfig.unit)}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
        {/* ★★★ 2.2: 调整日报与汇总卡片的列宽 ★★★ */}
        <div className="lg:col-span-3">
            <Card className="shadow-sm flex flex-col h-full">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-lg">
                  <CalendarIcon className="mr-2 h-5 w-5 text-orange-500"/>
                  <span className="text-orange-500">日报与汇总</span>
                  <span className="ml-1 text-base font-normal text-slate-600">({format(reportDate, "yyyy-MM-dd")})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-4 gap-4 flex-grow">
                  <Card className="flex flex-col justify-center items-center p-2">
                      <p className="text-2xl font-bold text-slate-800">{formatNumber(dashboardData.daily_report?.trip_count, '次')}</p>
                      <p className="text-sm text-slate-500 mt-1">当日车次</p>
                  </Card>
                  <Card className="flex flex-col justify-center items-center p-2">
                      <p className="text-2xl font-bold text-slate-800">{formatNumber(dashboardData.daily_report?.total_tonnage, unitConfig.unit)}</p>
                      <p className="text-sm text-slate-500 mt-1">当日运输量</p>
                  </Card>
                  <Card className="flex flex-col justify-center items-center p-2">
                      <p className="text-2xl font-bold text-green-600">{formatNumber(dashboardData.daily_report?.driver_receivable, '元')}</p>
                      <p className="text-sm text-slate-500 mt-1">司机应收</p>
                  </Card>
                  <Card className="flex flex-col justify-center items-center p-2">
                      <p className="text-2xl font-bold text-red-600">{formatNumber(dashboardData.daily_report?.partner_payable, '元')}</p>
                      <p className="text-sm text-slate-500 mt-1">{selectedProjectDetails.partner_name || '合作方'}应付</p>
                  </Card>
                  <Card className="flex flex-col justify-center items-center p-2">
                    <p className="text-2xl font-bold text-slate-800">{formatNumber(dashboardData.summary_stats?.total_trips, '车')}</p>
                    <div className="flex items-center text-sm text-slate-500 mt-1">
                      <Truck className="h-4 w-4 mr-2"/>已发总车次
                    </div>
                  </Card>
                  <Card className="flex flex-col justify-center items-center p-2">
                    <p className="text-2xl font-bold text-slate-800">{formatNumber(dashboardData.summary_stats?.total_tonnage, unitConfig.unit)}</p>
                    <div className="flex items-center text-sm text-slate-500 mt-1">
                      <Package className="h-4 w-4 mr-2"/>已发总数量
                    </div>
                  </Card>
                  <Card className="flex flex-col justify-center items-center p-2">
                    <p className="text-2xl font-bold text-green-600">{formatNumber(dashboardData.summary_stats?.avg_cost, `元/${unitConfig.unit}`)}</p>
                    <div className="flex items-center text-sm text-slate-500 mt-1">
                      <BarChartHorizontal className="h-4 w-4 mr-2"/>平均单位成本
                    </div>
                  </Card>
                  <Card className="flex flex-col justify-center items-center p-2">
                    <p className="text-2xl font-bold text-red-600">{formatNumber(dashboardData.summary_stats?.total_cost, '元')}</p>
                    <div className="flex items-center text-sm text-slate-500 mt-1">
                      <Wallet className="h-4 w-4 mr-2"/>{selectedProjectDetails.partner_name || '合作方'}总应付
                    </div>
                  </Card>
              </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-5">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                    <TrendingUp className="mr-2 h-5 w-5 text-teal-500"/>
                    <span className="text-teal-500">近7日进度</span>
                    <span className="ml-1 text-base font-normal text-slate-600">({selectedProjectDetails.name})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.seven_day_trend} margin={{ top: 5, right: 40, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left-weight" orientation="left" stroke="#0d9488" label={{ value: unitConfig.unit, angle: -90, position: 'insideLeft', fill: '#0d9488' }} />
                    <YAxis yAxisId="middle-trips" orientation="left" stroke="#4338ca" label={{ value: '车次', angle: -90, position: 'insideLeft', offset: -20, fill: '#4338ca' }} />
                    <YAxis yAxisId="right-cost" orientation="right" stroke="#f59e0b" label={{ value: '元', angle: -90, position: 'insideRight', fill: '#f59e0b' }} />
                    <Tooltip formatter={(value: number, name: string) => [`${value.toLocaleString()} ${name === '车次' ? '车' : name === '数量' ? unitConfig.unit : '元'}`, name]} />
                    <Legend 
                      onClick={(e: any) => handleLegendClick(e.dataKey as string)} 
                      formatter={(value, entry: any) => {
                        const dataKey = entry.dataKey as string;
                        const isVisible = visibleLines[dataKey as keyof typeof visibleLines];
                        return <span style={{ textDecoration: isVisible ? 'none' : 'line-through', color: isVisible ? '#333' : '#aaa' }}>{value}</span>;
                      }}
                    />
                    <Line yAxisId="left-weight" type="monotone" dataKey="weight" name="数量" stroke="#0d9488" strokeWidth={2} hide={!visibleLines.weight} />
                    <Line yAxisId="middle-trips" type="monotone" dataKey="trips" name="车次" stroke="#4338ca" strokeWidth={2} hide={!visibleLines.trips} />
                    <Line yAxisId="right-cost" type="monotone" dataKey="receivable" name="应收总额" stroke="#f59e0b" strokeWidth={2} hide={!visibleLines.receivable} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-5">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Users className="mr-2 h-5 w-5 text-purple-500" />
                  <span className="text-purple-500">司机工作量报告</span>
                  <span className="ml-1 text-base font-normal text-slate-600">({selectedProjectDetails.name} - {format(reportDate, "yyyy-MM-dd")})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>司机</TableHead>
                      <TableHead>车牌号</TableHead>
                      <TableHead>电话</TableHead>
                      <TableHead className="text-right">当日出车</TableHead>
                      <TableHead className="text-right">总出车</TableHead>
                      {unitConfig.billingTypeId !== 2 && (
                        <TableHead className="text-right">当日数量 ({unitConfig.unit})</TableHead>
                      )}
                      <TableHead className="text-right">司机应收 (元)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.driver_report_table.length > 0 ? (
                      dashboardData.driver_report_table.map((row) => (
                        <TableRow key={row.driver_name}>
                          <TableCell className="font-medium">{row.driver_name}</TableCell>
                          <TableCell>{row.license_plate || 'N/A'}</TableCell>
                          <TableCell>{row.phone || 'N/A'}</TableCell>
                          <TableCell className="text-right">{row.daily_trip_count}</TableCell>
                          <TableCell className="text-right">{row.total_trip_count}</TableCell>
                          {unitConfig.billingTypeId !== 2 && (
                            <TableCell className="text-right">{formatNumber(row.total_tonnage)}</TableCell>
                          )}
                          <TableCell className="text-right text-green-600 font-semibold">
                            {formatNumber(row.total_partner_payable)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={unitConfig.billingTypeId !== 2 ? 7 : 6} className="h-24 text-center text-slate-500">
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
