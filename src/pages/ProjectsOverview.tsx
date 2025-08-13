// 文件路径: src/pages/ProjectsOverview.tsx
// 描述: [Final-v4] 已使用新的函数名 'get_all_projects_overview_data_v3'。

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, Wallet, Truck, Users, Calendar as CalendarIcon, Briefcase, LineChart as LineChartIcon } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, RadialBarChart, RadialBar, PolarAngleAxis, ComposedChart } from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { MultiSelectProjects, OptionType } from '@/components/ui/MultiSelectProjects';
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// --- 类型定义 ---
interface ProjectDetails { id: string; name: string; partner_name: string; start_date: string; planned_total_tons: number; billing_type_id: number; }
interface DailyReport { trip_count: number; total_tonnage: number; driver_receivable: number; partner_payable: number; }
interface DriverReportRow { driver_name: string; trip_count: number; total_tonnage: number; total_driver_receivable: number; }
interface FifteenDayTrendData { date: string; payable_amount: number; trip_count: number; partner_name: string; }
interface ProjectDataPackage {
  project_details: ProjectDetails;
  daily_report: DailyReport;
  summary_stats: SummaryStats;
  fifteen_day_partner_trend: FifteenDayTrendData[];
  driver_report_table: DriverReportRow[];
}
interface SummaryStats { total_trips: number; total_cost: number; avg_cost: number; total_tonnage: number; }
interface OverviewDashboardData { all_projects_data: ProjectDataPackage[]; global_summary: { total_projects: number; total_receivable: number; total_trips: number; } }

// --- 辅助函数 ---
const formatNumber = (val: number | null | undefined, unit: string = '') => `${(val || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit ? ' ' + unit : ''}`;
const formatCurrency = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

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

// --- 单个项目卡片子组件 ---
const ProjectSummaryCard = ({ projectData, onClick }: { projectData: ProjectDataPackage, onClick: () => void }) => {
    const { project_details, daily_report, summary_stats } = projectData;
    const unitConfig = useMemo(() => {
        const { billing_type_id, planned_total_tons } = project_details;
        const completed = billing_type_id === 2 ? summary_stats?.total_trips : summary_stats?.total_tonnage;
        return {
            progressUnit: billing_type_id === 2 ? '车' : (billing_type_id === 3 ? '立方' : '吨'),
            progressCompleted: completed || 0,
            progressPlanned: planned_total_tons || 1,
        };
    }, [project_details, summary_stats]);
    const progressPercentage = (unitConfig.progressCompleted / unitConfig.progressPlanned) * 100;

    return (
        <Card onClick={onClick} className="shadow-md hover:shadow-xl hover:border-blue-500 transition-all duration-300 flex flex-col cursor-pointer">
            <CardHeader>
                <CardTitle className="text-lg text-blue-600 truncate">{project_details.name}</CardTitle>
                <p className="text-sm text-slate-500">{project_details.partner_name}</p>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow">
                <div>
                    <div className="flex justify-between text-sm text-slate-600 mb-2">
                        <span>进度 ({unitConfig.progressUnit})</span>
                        <span className="font-semibold">{progressPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                            <CircularProgressChart value={progressPercentage} />
                        </div>
                        <div className="flex-grow">
                            <Progress value={progressPercentage} />
                            <p className="text-xs text-right text-slate-500 mt-1">{formatNumber(unitConfig.progressCompleted)} / {formatNumber(unitConfig.progressPlanned)}</p>
                        </div>
                    </div>
                </div>
                <div className="border-t pt-4 grid grid-cols-2 gap-4 text-center">
                    <div>
                        <p className="text-lg font-bold text-slate-800">{formatNumber(daily_report?.trip_count, '车')}</p>
                        <p className="text-xs text-slate-500">当日车次</p>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-green-600">{formatNumber(daily_report?.driver_receivable, '元')}</p>
                        <p className="text-xs text-slate-500">当日应收</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// --- 主组件 ---
export default function ProjectsOverview() {
    const [dashboardData, setDashboardData] = useState<OverviewDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [reportDate, setReportDate] = useState<Date>(new Date());
    const navigate = useNavigate();
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                const params = {
                    p_report_date: format(reportDate, 'yyyy-MM-dd'),
                    p_project_ids: selectedProjectIds.length > 0 ? selectedProjectIds : null
                };

                const { data, error } = await supabase.rpc('get_all_projects_overview_data_v3' as any, params);

                if (error) throw error;
                setDashboardData(data as unknown as OverviewDashboardData);
            } catch (error) {
                console.error("加载看板数据失败:", error);
                toast({ title: "错误", description: `加载看板数据失败: ${(error as any).message}`, variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, [reportDate, toast, selectedProjectIds]);

    const projectOptions = useMemo((): OptionType[] => {
        if (!dashboardData?.all_projects_data) return [];
        return dashboardData.all_projects_data.map(p => ({ value: p.project_details.id, label: p.project_details.name }));
    }, [dashboardData?.all_projects_data]);

    const isFiltering = selectedProjectIds.length > 0;

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
    if (!dashboardData) return <div className="p-6 bg-slate-50 min-h-screen"><h1 className="text-3xl font-bold text-blue-600">项目组合看板</h1><div className="text-center py-10 text-slate-500">暂无运行中的项目数据</div></div>;

    const { all_projects_data, global_summary } = dashboardData;

    return (
        <div className="p-6 bg-slate-50 space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-blue-600">项目组合看板</h1>
                <div className="flex flex-wrap items-center gap-4">
                    <MultiSelectProjects options={projectOptions} selected={selectedProjectIds} onChange={setSelectedProjectIds} className="w-[300px] lg:w-[400px]" />
                    <Popover>
                        <PopoverTrigger asChild><Button variant={"outline"} className={cn("w-[200px] justify-start text-left font-normal", !reportDate && "text-slate-500")}><CalendarIcon className="mr-2 h-4 w-4" />{reportDate ? format(reportDate, "yyyy-MM-dd") : <span>选择日期</span>}</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={reportDate} onSelect={(date) => date && setReportDate(date)} initialFocus /></PopoverContent>
                    </Popover>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-700">{isFiltering ? '已选项目' : '运行中项目'}</CardTitle><Briefcase className="h-4 w-4 text-slate-500" /></CardHeader><CardContent><p className="text-2xl font-bold text-slate-800">{global_summary?.total_projects || 0}</p></CardContent></Card>
                <Card className="shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-700">总应收</CardTitle><Wallet className="h-4 w-4 text-green-500" /></CardHeader><CardContent><p className="text-2xl font-bold text-slate-800">{formatNumber(global_summary?.total_receivable, '元')}</p></CardContent></Card>
                <Card className="shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-slate-700">总车次</CardTitle><Truck className="h-4 w-4 text-indigo-500" /></CardHeader><CardContent><p className="text-2xl font-bold text-slate-800">{formatNumber(global_summary?.total_trips, '车')}</p></CardContent></Card>
            </div>
            <div>
                <h2 className="text-2xl font-semibold text-slate-800 mb-4">{isFiltering ? '已选项目详情' : '各项目概览'}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {all_projects_data.map(projectData => (<ProjectSummaryCard key={projectData.project_details.id} projectData={projectData} onClick={() => navigate(`/project/${projectData.project_details.id}`)} />))}
                </div>
                {all_projects_data.length === 0 && (<div className="text-center py-10 text-slate-500 bg-white rounded-lg shadow-sm">当前筛选条件下无项目数据。</div>)}
            </div>

            {all_projects_data.map(projectData => (
                <div key={`charts-${projectData.project_details.id}`} className="space-y-6">
                    <h3 className="text-xl font-semibold text-slate-800">{projectData.project_details.name} - 详细数据</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center text-slate-700">
                                    <LineChartIcon className="mr-2 h-5 w-5 text-teal-500" />
                                    近15日项目追踪 (合作方: {projectData.fifteen_day_partner_trend[0]?.partner_name || '无'})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={projectData.fifteen_day_partner_trend || []}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tickFormatter={(dateStr) => format(new Date(dateStr), 'MM-dd')} />
                                        <YAxis yAxisId="left" stroke="#8884d8" label={{ value: '应付金额 (元)', angle: -90, position: 'insideLeft' }} tickFormatter={(value) => `¥${value / 1000}k`} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" label={{ value: '出车次数', angle: -90, position: 'insideRight' }} allowDecimals={false} />
                                        <Tooltip
                                            formatter={(value: number, name: string) => {
                                                if (name === '应付金额') return [formatCurrency(value), name];
                                                if (name === '出车次数') return [`${value} 次`, name];
                                                return [value, name];
                                            }}
                                            labelFormatter={(label: string) => format(new Date(label), 'yyyy-MM-dd')}
                                        />
                                        <Legend />
                                        <Line yAxisId="left" type="monotone" dataKey="payable_amount" name="应付金额" stroke="#8884d8" strokeWidth={2} dot={false} />
                                        <Line yAxisId="right" type="monotone" dataKey="trip_count" name="出车次数" stroke="#82ca9d" strokeWidth={2} dot={false} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center text-slate-700">
                                    <Users className="mr-2 h-5 w-5 text-purple-500" />
                                    {projectData.project_details.name} 司机工作情况统计 ({format(reportDate, "yyyy-MM-dd")})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="max-h-[300px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>司机姓名</TableHead>
                                            <TableHead className="text-right">车次</TableHead>
                                            <TableHead className="text-right">
                                                {projectData.project_details.billing_type_id === 2 ? '车次' :
                                                    projectData.project_details.billing_type_id === 3 ? '立方' : '吨数'}
                                            </TableHead>
                                            <TableHead className="text-right">应收 (元)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(projectData.driver_report_table || []).length > 0 ? (
                                            projectData.driver_report_table.map((row) => (
                                                <TableRow key={`${projectData.project_details.id}-${row.driver_name}`}>
                                                    <TableCell className="font-medium">{row.driver_name}</TableCell>
                                                    <TableCell className="text-right">{row.trip_count}</TableCell>
                                                    <TableCell className="text-right">
                                                        {projectData.project_details.billing_type_id === 2 ?
                                                            row.trip_count :
                                                            formatNumber(row.total_tonnage, projectData.project_details.billing_type_id === 3 ? '立方' : '吨')}
                                                    </TableCell>
                                                    <TableCell className="text-right text-green-600 font-semibold">{formatNumber(row.total_driver_receivable)}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center text-slate-500">该日无司机工作记录</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ))}
        </div>
    );
}
