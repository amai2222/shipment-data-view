import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  TrendingUp, 
  Target, 
  Truck, 
  Wallet, 
  BarChartHorizontal, 
  Users, 
  Calendar as CalendarIcon, 
  Package,
  ChevronDown,
  Activity
} from "lucide-react";
import {
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  RadialBarChart, 
  RadialBar, 
  PolarAngleAxis
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileCard } from '@/components/mobile/MobileCard';

// 类型定义
interface ProjectDetails { 
  id: string; 
  name: string; 
  partner_name: string; 
  start_date: string; 
  planned_total_tons: number; 
  billing_type_id: number; 
}

interface DailyReport { 
  trip_count: number; 
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

interface DriverReportRow { 
  driver_name: string; 
  license_plate: string; 
  phone: string; 
  daily_trip_count: number; 
  total_trip_count: number; 
  total_tonnage: number; 
  total_driver_receivable: number; 
  total_partner_payable: number; 
}

interface DashboardData { 
  project_details: ProjectDetails[]; 
  daily_report: DailyReport; 
  seven_day_trend: TrendData[]; 
  summary_stats: SummaryStats; 
  driver_report_table: DriverReportRow[]; 
}

const formatNumber = (val: number | null | undefined, unit: string = '') => 
  `${(val || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}${unit ? ' ' + unit : ''}`;

const CircularProgressChart = ({ value }: { value: number }) => {
  const data = [{ name: 'progress', value: value, fill: 'hsl(var(--primary))' }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart 
        cx="50%" 
        cy="50%" 
        innerRadius="60%" 
        outerRadius="85%" 
        barSize={8} 
        data={data} 
        startAngle={90} 
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar 
          background={{ fill: 'hsl(var(--muted))' }} 
          dataKey="value" 
          cornerRadius={6} 
          angleAxisId={0} 
        />
        <text 
          x="50%" 
          y="50%" 
          textAnchor="middle" 
          dominantBaseline="middle" 
          className="text-lg font-bold fill-primary"
        >
          {`${value.toFixed(1)}%`}
        </text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
};

export default function MobileProjectDashboard() {
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
        toast({ 
          title: "错误", 
          description: `加载看板数据失败: ${(error as any).message}`, 
          variant: "destructive" 
        });
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [projectId, reportDate, toast]);

  const allProjects = dashboardData?.project_details || [];
  const selectedProjectDetails = useMemo(() => 
    allProjects.find(p => p.id === projectId), [allProjects, projectId]
  );

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

  const progressPercentage = (unitConfig.progressPlanned > 0) 
    ? (unitConfig.progressCompleted / unitConfig.progressPlanned) * 100 
    : 0;

  if (loading) {
    return (
      <MobileLayout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  if (!dashboardData || !selectedProjectDetails) {
    return (
      <MobileLayout>
        <div className="text-center py-10 text-muted-foreground">
          项目数据不存在或加载失败。请检查项目ID是否正确。
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 项目选择和日期选择 */}
        <div className="space-y-3">
          <Select value={projectId || ''} onValueChange={(newId) => navigate(`/m/project/${newId}`)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="请选择项目..." />
            </SelectTrigger>
            <SelectContent>
              {allProjects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !reportDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {reportDate ? format(reportDate, "yyyy-MM-dd") : <span>选择日期</span>}
                <ChevronDown className="ml-auto h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent 
                mode="single" 
                selected={reportDate} 
                onSelect={(date) => date && setReportDate(date)} 
                initialFocus 
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* 项目进度卡片 */}
        <MobileCard>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <Target className="mr-2 h-4 w-4 text-primary" />
              项目进度
            </CardTitle>
            <div>
              <p className="text-sm font-medium">{selectedProjectDetails.name}</p>
              <p className="text-xs text-muted-foreground">{selectedProjectDetails.partner_name}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">进度 ({unitConfig.unit})</span>
              <span className="text-sm font-semibold">{progressPercentage.toFixed(1)}%</span>
            </div>
            
            <div className="w-32 h-32 mx-auto">
              <CircularProgressChart value={progressPercentage} />
            </div>
            
            <div className="space-y-2">
              <Progress value={progressPercentage} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">
                {formatNumber(unitConfig.progressCompleted, unitConfig.unit)} / {formatNumber(unitConfig.progressPlanned, unitConfig.unit)}
              </p>
            </div>
          </CardContent>
        </MobileCard>

        {/* 当日数据 */}
        <MobileCard>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
              今日数据
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({format(reportDate, "MM-dd")})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-lg font-bold text-foreground">
                  {formatNumber(dashboardData.daily_report?.trip_count)}
                </p>
                <p className="text-xs text-muted-foreground">车次</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-lg font-bold text-foreground">
                  {formatNumber(dashboardData.daily_report?.total_tonnage)}
                </p>
                <p className="text-xs text-muted-foreground">运输量({unitConfig.unit})</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-lg font-bold text-green-600">
                  {formatNumber(dashboardData.daily_report?.driver_receivable)}
                </p>
                <p className="text-xs text-muted-foreground">司机应收(元)</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-lg font-bold text-red-600">
                  {formatNumber(dashboardData.daily_report?.partner_payable)}
                </p>
                <p className="text-xs text-muted-foreground">合作方应付(元)</p>
              </div>
            </div>
          </CardContent>
        </MobileCard>

        {/* 汇总统计 */}
        <MobileCard>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <Activity className="mr-2 h-4 w-4 text-primary" />
              项目汇总
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <div className="flex items-center">
                  <Truck className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="text-sm">总车次</span>
                </div>
                <span className="font-semibold">
                  {formatNumber(dashboardData.summary_stats?.total_trips, '车')}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-border">
                <div className="flex items-center">
                  <Package className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="text-sm">总运量</span>
                </div>
                <span className="font-semibold">
                  {formatNumber(dashboardData.summary_stats?.total_tonnage, unitConfig.unit)}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-border">
                <div className="flex items-center">
                  <BarChartHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="text-sm">平均单价</span>
                </div>
                <span className="font-semibold">
                  {formatNumber(dashboardData.summary_stats?.avg_cost, `元/${unitConfig.unit}`)}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center">
                  <Wallet className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="text-sm">总应付</span>
                </div>
                <span className="font-semibold text-red-600">
                  {formatNumber(dashboardData.summary_stats?.total_cost, '元')}
                </span>
              </div>
            </div>
          </CardContent>
        </MobileCard>

        {/* 7日趋势图 */}
        <MobileCard>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <TrendingUp className="mr-2 h-4 w-4 text-primary" />
              近7日趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={dashboardData.seven_day_trend} 
                  margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString()} ${
                        name === '车次' ? '车' : 
                        name === '数量' ? unitConfig.unit : '元'
                      }`, 
                      name
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="weight" 
                    name="数量" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="trips" 
                    name="车次" 
                    stroke="hsl(var(--secondary))" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </MobileCard>

        {/* 司机工作量 */}
        <MobileCard>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <Users className="mr-2 h-4 w-4 text-primary" />
              司机工作量
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboardData.driver_report_table.length > 0 ? (
              <div className="space-y-3">
                {dashboardData.driver_report_table.map((driver, index) => (
                  <div key={driver.driver_name} className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{driver.driver_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {driver.license_plate || 'N/A'} • {driver.phone || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          今日: {driver.daily_trip_count}车
                        </p>
                        <p className="text-xs text-muted-foreground">
                          总计: {driver.total_trip_count}车
                        </p>
                      </div>
                    </div>
                    
                    {unitConfig.billingTypeId !== 2 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">运输量</span>
                        <span>{formatNumber(driver.total_tonnage, unitConfig.unit)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">司机应收</span>
                      <span className="text-green-600 font-medium">
                        {formatNumber(driver.total_driver_receivable, '元')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">暂无司机数据</p>
            )}
          </CardContent>
        </MobileCard>
      </div>
    </MobileLayout>
  );
}