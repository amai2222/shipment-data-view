import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  PolarAngleAxis,
  Legend
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileCard } from '@/components/mobile/MobileCard';
import { useQuery } from '@tanstack/react-query';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

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
  total_trips: number; 
  total_tonnage: number; 
  total_driver_receivable: number; 
}

interface TrendData { 
  date: string; 
  trips: number; 
  weight: number; 
  receivable: number; 
}

interface SummaryStats { 
  total_trips: number; 
  total_tonnage: number; 
  total_driver_receivable: number; 
}

interface DriverReportRow { 
  driver_id: string; 
  driver_name: string; 
  license_plate: string; 
  driver_phone: string; 
  daily_trip_count: number; 
  total_trip_count: number; 
  total_tonnage: number; 
  total_driver_receivable: number; 
}

interface DashboardData { 
  project_details: ProjectDetails[]; 
  daily_report: DailyReport; 
  seven_day_trend: TrendData[]; 
  summary_stats: SummaryStats; 
  driver_report_table: DriverReportRow[]; 
}

// 司机列表项组件
const DriverRow = ({ index, style, data }: ListChildComponentProps<{ rows: DriverReportRow[], unit: string, billingTypeId: number }>) => {
  const { rows, unit, billingTypeId } = data;
  const row = rows[index];
  
  return (
    <div style={style} className="flex items-center justify-between p-3 border-b">
      <div className="flex-1">
        <div className="font-medium text-sm">{row.driver_name}</div>
        <div className="text-xs text-muted-foreground">{row.license_plate} • {row.driver_phone}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium">
          {billingTypeId === 2 ? `${row.daily_trip_count}车` : `${row.total_tonnage.toFixed(1)}${unit}`}
        </div>
        <div className="text-xs text-muted-foreground">¥{row.total_driver_receivable.toLocaleString()}</div>
      </div>
    </div>
  );
};

export default function MobileProjectDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [visibleDrivers, setVisibleDrivers] = useState<number>(10);
  const { toast } = useToast();
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [showTrips, setShowTrips] = useState<boolean>(true);
  const [showWeight, setShowWeight] = useState<boolean>(true);
  const [showReceivable, setShowReceivable] = useState<boolean>(false);
  const [driverSortKey, setDriverSortKey] = useState<'daily' | 'total' | 'amount'>('total');
  const [driverSortAsc, setDriverSortAsc] = useState<boolean>(false);

  // React Query 缓存与请求
  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ['mobileProjectDashboard', projectId, format(reportDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!projectId) throw new Error('缺少项目ID');
      const { data, error } = await supabase.rpc('get_project_dashboard_data' as any, {
        p_project_id: projectId,
        p_report_date: format(reportDate, 'yyyy-MM-dd')
      });
      if (error) throw error;
      return data as DashboardData;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    onError: (e: any) => {
      toast({ title: '错误', description: `加载看板数据失败: ${e?.message || ''}`, variant: 'destructive' });
    }
  });

  // 司机列表改为前端排序（不调用排行 RPC）
  const sortedDriverRows = useMemo(() => {
    const rows = dashboardData?.driver_report_table || [];
    const getVal = (key: 'daily' | 'total' | 'amount', r: any) =>
      key === 'daily' ? r.daily_trip_count : key === 'total' ? r.total_trip_count : r.total_driver_receivable;
    const sorted = [...rows].sort((a, b) => {
      const diff = getVal(driverSortKey, b) - getVal(driverSortKey, a);
      return driverSortAsc ? -diff : diff;
    });
    return sorted;
  }, [dashboardData, driverSortKey, driverSortAsc]);

  const allProjects = dashboardData?.project_details || [];
  const selectedProjectDetails = useMemo(() => 
    allProjects.find(p => p.id === projectId), [allProjects, projectId]
  );

  const { summary_stats, daily_report } = dashboardData || {};
  const { planned_total_tons, billing_type_id } = selectedProjectDetails || {};

  // 单位配置
  const unitConfig = useMemo(() => {
    const typeId = billing_type_id || 1;
    return {
      unit: typeId === 2 ? '车' : '吨',
      billingTypeId: typeId,
      progressCompleted: typeId === 2 ? summary_stats?.total_trips || 0 : summary_stats?.total_tonnage || 0,
      progressPlanned: planned_total_tons || 1,
    };
  }, [selectedProjectDetails, dashboardData]);

  const progressPercentage = (unitConfig.progressPlanned > 0) 
    ? (unitConfig.progressCompleted / unitConfig.progressPlanned) * 100 
    : 0;

  // 趋势数据
  const trendSeries = dashboardData?.seven_day_trend || [];

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  if (!dashboardData || !selectedProjectDetails) {
    return (
      <MobileLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">未找到项目数据</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-4 p-4">
        {/* 项目信息 */}
        <MobileCard>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <Target className="mr-2 h-4 w-4 text-primary" />
              {selectedProjectDetails.name}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {selectedProjectDetails.partner_name} • 开始日期: {format(new Date(selectedProjectDetails.start_date), 'yyyy-MM-dd')}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">项目进度</span>
                <span className="text-sm font-medium">
                  {unitConfig.progressCompleted.toLocaleString()} / {unitConfig.progressPlanned.toLocaleString()} {unitConfig.unit}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <div className="text-right text-xs text-muted-foreground">
                {progressPercentage.toFixed(1)}%
              </div>
            </div>
          </CardContent>
        </MobileCard>

        {/* 今日数据 */}
        <MobileCard>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
              {format(reportDate, 'yyyy年MM月dd日')} 数据
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{daily_report?.total_trips || 0}</div>
                <div className="text-xs text-muted-foreground">车次</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{(daily_report?.total_tonnage || 0).toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">吨</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">¥{(daily_report?.total_driver_receivable || 0).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">金额</div>
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
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" variant={showTrips ? "default" : "outline"} onClick={() => setShowTrips(v => !v)}>车次</Button>
              <Button size="sm" variant={showWeight ? "default" : "outline"} onClick={() => setShowWeight(v => !v)}>数量</Button>
              <Button size="sm" variant={showReceivable ? "default" : "outline"} onClick={() => setShowReceivable(v => !v)}>金额</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {showWeight && <Line type="monotone" dataKey="weight" name="数量" stroke="#3b82f6" strokeWidth={2} />}
                  {showTrips && <Line type="monotone" dataKey="trips" name="车次" stroke="#10b981" strokeWidth={2} />}
                  {showReceivable && <Line type="monotone" dataKey="receivable" name="金额" stroke="#f59e0b" strokeWidth={2} />}
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
            <div className="mt-2 flex items-center gap-2">
              <Select value={driverSortKey} onValueChange={(v: any) => setDriverSortKey(v)}>
                <SelectTrigger className="h-8 w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">今日车次</SelectItem>
                  <SelectItem value="total">总车次</SelectItem>
                  <SelectItem value="amount">应收金额</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => setDriverSortAsc(v => !v)}>
                {driverSortAsc ? '升序' : '降序'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(sortedDriverRows.length > 0) ? (
              <div className="space-y-3">
                <List
                  height={Math.min(400, Math.max(200, sortedDriverRows.length * 84))}
                  itemCount={sortedDriverRows.length}
                  itemSize={84}
                  width={'100%'}
                  itemData={{ rows: sortedDriverRows, unit: unitConfig.unit, billingTypeId: unitConfig.billingTypeId }}
                >
                  {DriverRow}
                </List>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                暂无司机数据
              </div>
            )}
          </CardContent>
        </MobileCard>
      </div>
    </MobileLayout>
  );
}
