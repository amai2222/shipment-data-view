// 文件路径: src/pages/ProjectDashboard.tsx
// 描述: [Definitive-Final-Code-V2] 调用 v5 后端函数，该函数动态获取 billing_type_id。

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, Target, Truck, Wallet, BarChartHorizontal, Users, Calendar as CalendarIcon } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList,
  RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// --- 类型定义 ---
interface ProjectDetails { id: string; name: string; partner_name: string; start_date: string; planned_total_tons: number; billing_type_id: number; }
interface DailyReport { trip_count: number; total_tonnage: number; driver_receivable: number; partner_payable: number; }
interface TrendData { date: string; trips: number; weight: number; receivable: number; }
interface SummaryStats { total_trips: number; total_cost: number; avg_cost: number; total_tonnage: number; }
interface LogisticsRecord { id: string; driver_name: string; license_plate: string; net_weight: number; timestamp: string; }
interface DriverReportRowV2 {
  driver_name: string; phone: string; license_plate: string; trip_count: number; total_trips_in_project: number;
  total_tonnage: number; total_driver_receivable: number; total_receivable_in_project: number; total_partner_payable: number;
}
interface DashboardDataV5 {
  project_details: ProjectDetails; 
  daily_report: DailyReport; 
  seven_day_trend: TrendData[]; 
  summary_stats: SummaryStats;
  driver_report_table: DriverReportRowV2[]; 
  daily_logistics_records: LogisticsRecord[];
}

// --- 弹窗组件 ---
const LogisticsRecordsModal = ({ isOpen, onClose, date, records }: { isOpen: boolean; onClose: () => void; date: string; records: LogisticsRecord[] }) => (
  <Dialog open={isOpen} onOpenChange={onClose}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>运单记录 - {date}</DialogTitle><DialogDescription>以下是 {date} 当天的所有运单详情。</DialogDescription></DialogHeader><div className="max-h-[60vh] overflow-y-auto"><Table><TableHeader><TableRow><TableHead>司机</TableHead><TableHead>车牌</TableHead><TableHead>卸货重量</TableHead><TableHead>时间</TableHead></TableRow></TableHeader><TableBody>{records && records.length > 0 ? records.map(r => (<TableRow key={r.id}><TableCell>{r.driver_name}</TableCell><TableCell>{r.license_plate}</TableCell><TableCell>{r.net_weight}</TableCell><TableCell>{format(new Date(r.timestamp), 'HH:mm:ss')}</TableCell></TableRow>)) : <TableRow><TableCell colSpan={4} className="text-center h-24">当日无运单记录</TableCell></TableRow>}</TableBody></Table></div></DialogContent></Dialog>
);

// --- 辅助函数 ---
const formatNumber = (val: number | null | undefined, unit: string = '') => `${(val || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}${unit ? ' ' + unit : ''}`;

// --- 环形图组件 ---
const CircularProgressChart = ({ value }: { value: number }) => {
  const data = [{ name: 'progress', value: value, fill: 'hsl(var(--primary))' }];
  return (
    <ResponsiveContainer width="100%" height={120}>
      <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="85%" barSize={10} data={data} startAngle={90} endAngle={-270}>
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar background={{ fill: 'hsl(var(--muted))' }} dataKey="value" cornerRadius={10} angleAxisId={0} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-bold fill-primary">{`${value.toFixed(1)}%`}</text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
};

// --- 主组件 ---
export default function ProjectDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardDataV5 | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{ date: string; records: LogisticsRecord[] }>({ date: '', records: [] });
  const [allProjects, setAllProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchAllProjects = async () => {
      const { data, error } = await supabase.from('projects').select('id, name');
      if (error) {
        toast({ title: "错误", description: "加载项目列表失败", variant: "destructive" });
      } else {
        setAllProjects(data || []);
      }
    };
    fetchAllProjects();
  }, [toast]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      if (!projectId) { setLoading(false); return; }
      try {
        // ★★★ 核心终极修复: 调用 v5 后端函数 ★★★
        const { data, error } = await supabase.rpc('fetch_comprehensive_project_report_final_v5' as any, {
          p_selected_project_id: projectId,
          p_report_date: format(reportDate, 'yyyy-MM-dd')
        });
        if (error) throw error;
        setDashboardData(data as unknown as DashboardDataV5);
      } catch (error) {
        toast({ title: "错误", description: `加载看板数据失败: ${(error as any).message}`, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [projectId, reportDate, toast]);

  const selectedProjectDetails = dashboardData?.project_details;

  const unitConfig = useMemo(() => {
    if (!selectedProjectDetails || !dashboardData) {
      return { progressUnit: '吨', progressCompleted: 0, progressPlanned: 1, dailyReportValue: 0, trendLineName: '总重量', driverReportColHeader: '卸货吨数' };
    }
    const { billing_type_id, planned_total_tons } = selectedProjectDetails;
    const { summary_stats, daily_report } = dashboardData;
    const typeId = parseInt(billing_type_id as any, 10);
    const isByTrip = typeId === 2;
    const isByVolume = typeId === 3;
    return {
      progressUnit: isByTrip ? '车' : (isByVolume ? '立方' : '吨'),
      progressCompleted: isByTrip ? summary_stats?.total_trips || 0 : summary_stats?.total_tonnage || 0,
      progressPlanned: planned_total_tons || 1,
      dailyReportValue: isByTrip ? daily_report?.trip_count || 0 : daily_report?.total_tonnage || 0,
      trendLineName: isByTrip ? '总车次' : (isByVolume ? '总立方' : '总重量'),
      driverReportColHeader: isByTrip ? '出车次数' : (isByVolume ? '卸货立方' : '卸货吨数'),
    };
  }, [selectedProjectDetails, dashboardData]);

  const handleDotClick = (data: any) => {
    const date = data?.payload?.date;
    if (!date || !dashboardData?.daily_logistics_records) {
      toast({ title: "提示", description: "暂无当日详细运单数据。" }); return;
    }
    const recordsForDate = dashboardData.daily_logistics_records.filter(r => format(new Date(r.timestamp), 'yyyy-MM-dd') === date);
    setModalContent({ date, records: recordsForDate });
    setIsModalOpen(true);
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-blue-600" /></div>;
  if (!dashboardData || !selectedProjectDetails) return <div className="p-6 bg-slate-50 min-h-screen"><h1 className="text-3xl font-bold text-blue-600">项目看板</h1><div className="text-center py-10 text-slate-500">项目数据不存在或加载失败。</div></div>;

  const progressPercentage = (unitConfig.progressCompleted / (unitConfig.progressPlanned || 1)) * 100;

  return (
    <div className="p-6 bg-slate-50 space-y-6">
      <LogisticsRecordsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} date={modalContent.date} records={modalContent.records} />
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-blue-600">项目看板</h1>
        <div className="flex items-center gap-4">
          <Select value={projectId || ''} onValueChange={(newId) => navigate(`/project/${newId}`)}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="请选择项目..." />
            </SelectTrigger>
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
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-slate-700">
                <Target className="mr-2 h-5 w-5 text-blue-500"/>项目进度 ({selectedProjectDetails.name})
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4 pt-2">
              <CircularProgressChart value={progressPercentage} />
              <Progress value={progressPercentage} />
              <div className="text-lg font-semibold text-slate-500">
                {formatNumber(unitConfig.progressCompleted, unitConfig.progressUnit)} / <span className="text-slate-800">{formatNumber(unitConfig.progressPlanned, unitConfig.progressUnit)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm"><CardHeader><CardTitle className="flex items-center text-slate-700"><CalendarIcon className="mr-2 h-5 w-5 text-orange-500"/>日报 ({format(reportDate, "yyyy-MM-dd")})</CardTitle></CardHeader><CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center pt-4">
              <div><p className="text-2xl font-bold text-slate-800">{formatNumber(dashboardData.daily_report?.trip_count)} / <span className="text-lg text-slate-500">{formatNumber(dashboardData.summary_stats?.total_trips)}</span></p><p className="text-sm text-slate-500">当日 / 总车次</p></div>
              <div><p className="text-2xl font-bold text-slate-800">{formatNumber(unitConfig.dailyReportValue, unitConfig.progressUnit)} / <span className="text-lg text-slate-500">{formatNumber(unitConfig.progressCompleted, unitConfig.progressUnit)}</span></p><p className="text-sm text-slate-500">当日 / 总{unitConfig.progressUnit}</p></div>
              <div><p className="text-2xl font-bold text-green-600">{formatNumber(dashboardData.daily_report?.driver_receivable, '元')}</p><p className="text-sm text-slate-500">司机应收</p></div>
              <div><p className="text-2xl font-bold text-red-600">{formatNumber(dashboardData.daily_report?.partner_payable, '元')}</p><p className="text-sm text-slate-500">{selectedProjectDetails.partner_name || '合作方'}应付</p></div>
            </CardContent></Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{selectedProjectDetails.name} 已发总车次</CardTitle><Truck className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(dashboardData.summary_stats?.total_trips, '车')}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">项目现应收</CardTitle><Wallet className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(dashboardData.summary_stats?.total_cost, '元')}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">平均吨成本</CardTitle><BarChartHorizontal className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(dashboardData.summary_stats?.avg_cost, '元')}</div></CardContent></Card>
          </div>
        </div>
        <div className="lg:col-span-3">
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="flex items-center text-slate-700"><TrendingUp className="mr-2 h-5 w-5 text-teal-500"/>{selectedProjectDetails.name} 近7日进度</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboardData.seven_day_trend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" label={{ value: unitConfig.progressUnit, angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: '车', angle: -90, position: 'insideRight' }} />
                  <Tooltip formatter={(value: number, name: string) => [`${value.toLocaleString()} ${name === '车次' ? '车' : unitConfig.progressUnit}`, name]} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="weight" name={unitConfig.trendLineName} stroke="#0d9488" strokeWidth={2} activeDot={{ r: 8, onClick: (e, payload) => handleDotClick(payload) }}><LabelList dataKey="weight" position="top" formatter={(v: number) => `${v}${unitConfig.progressUnit}`} /></Line>
                  <Line yAxisId="right" type="monotone" dataKey="trips" name="车次" stroke="#4338ca" strokeWidth={2} activeDot={{ r: 8, onClick: (e, payload) => handleDotClick(payload) }}><LabelList dataKey="trips" position="top" formatter={(v: number) => `${v}车`} /></Line>
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-3">
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="flex items-center text-slate-700"><Users className="mr-2 h-5 w-5 text-purple-500" />{selectedProjectDetails.name} 司机工作量报告 ({format(reportDate, "yyyy-MM-dd")})</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>司机信息</TableHead>
                  <TableHead className="text-right">出车次数</TableHead>
                  <TableHead className="text-right">{unitConfig.driverReportColHeader}</TableHead>
                  <TableHead className="text-right">司机应收 (元)</TableHead>
                </TableRow></TableHeader>
                <TableBody>{dashboardData.driver_report_table && dashboardData.driver_report_table.length > 0 ? (dashboardData.driver_report_table.map((row, index) => (<TableRow key={`${row.driver_name}-${index}`}>
                  <TableCell className="font-medium">{`${row.driver_name || ''}-${row.license_plate || ''}-${row.phone || ''}`}</TableCell>
                  <TableCell className="text-right">{formatNumber(row.trip_count)} / <span className="text-slate-500">{formatNumber(row.total_trips_in_project)}</span></TableCell>
                  <TableCell className="text-right">{formatNumber(row.total_tonnage)}</TableCell>
                  <TableCell className="text-right text-green-600 font-semibold">{formatNumber(row.total_driver_receivable)} / <span className="text-slate-500">{formatNumber(row.total_receivable_in_project)}</span></TableCell>
                </TableRow>))) : (<TableRow><TableCell colSpan={4} className="h-24 text-center text-slate-500">该日无司机工作记录</TableCell></TableRow>)}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}```
