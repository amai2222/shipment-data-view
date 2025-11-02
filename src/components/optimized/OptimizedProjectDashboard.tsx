import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  TrendingUp, 
  Target, 
  Truck, 
  Wallet, 
  BarChartHorizontal, 
  Users, 
  Calendar as CalendarIcon, 
  Package
} from "lucide-react";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// 导入优化的服务和组件
import { 
  DashboardDataService, 
  DashboardData, 
  formatNumber, 
  calculateUnitConfig, 
  calculateProgressPercentage 
} from '@/services/DashboardDataService';
import { OptimizedLineChart, OptimizedCircularProgressChart } from '@/components/optimized/OptimizedCharts';

/**
 * 优化的项目看板组件
 * 使用统一的数据服务和优化的图表组件
 */
export default function OptimizedProjectDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [visibleLines, setVisibleLines] = useState({ 
    weight: true, 
    trips: true, 
    receivable: true 
  });

  // 使用 useRef 存储 toast 函数，避免 useEffect 依赖问题
  const toastRef = useRef(useToast());
  const { toast } = toastRef.current;

  // 优化的数据加载函数
  const fetchDashboardData = useCallback(async () => {
    if (!projectId) {
      console.warn("URL中未提供项目ID");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await DashboardDataService.getProjectDashboardData(
        projectId,
        format(reportDate, 'yyyy-MM-dd')
      );

      if (error) {
        throw error;
      }

      setDashboardData(data);
    } catch (error) {
      console.error("加载看板数据失败:", error);
      toast({ 
        title: "错误", 
        description: `加载看板数据失败: ${error instanceof Error ? error.message : "未知错误"}`, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, reportDate, toast]);

  // 优化的 useEffect，移除 toast 依赖
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // 缓存项目数据
  const allProjects = useMemo(() => 
    dashboardData?.project_details || [], 
    [dashboardData?.project_details]
  );

  const selectedProjectDetails = useMemo(() => 
    allProjects.find(p => p.id === projectId), 
    [allProjects, projectId]
  );

  // 缓存单位配置
  const unitConfig = useMemo(() => 
    calculateUnitConfig(selectedProjectDetails, dashboardData?.summary_stats),
    [selectedProjectDetails, dashboardData?.summary_stats]
  );

  // 缓存进度百分比
  const progressPercentage = useMemo(() => 
    calculateProgressPercentage(unitConfig),
    [unitConfig]
  );

  // 优化的图例点击处理
  const handleLegendClick = useCallback((dataKey: string) => {
    setVisibleLines(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  }, []);

  // 优化的项目切换处理
  const handleProjectChange = useCallback((newProjectId: string) => {
    navigate(`/project/${newProjectId}`);
  }, [navigate]);

  // 优化的日期变更处理
  const handleDateChange = useCallback((date: Date | undefined) => {
    if (date) {
      setReportDate(date);
    }
  }, []);

  // 加载状态
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  // 错误状态
  if (!dashboardData || !selectedProjectDetails) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen">
        <h1 className="text-3xl font-bold text-blue-600">项目看板</h1>
        <div className="text-center py-10 text-slate-500">
          项目数据不存在或加载失败。请检查项目ID是否正确。
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 space-y-6">
      {/* 优化的网格布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        
        {/* 项目进度卡片 */}
        <div className="lg:col-span-2">
          <Card className="shadow-sm flex flex-col h-full">
            <CardHeader className="flex flex-row justify-between items-center space-x-4">
              <div className="flex-shrink-0">
                <CardTitle className="flex items-center text-lg whitespace-nowrap">
                  <Target className="mr-2 h-5 w-5 text-blue-500"/>
                  <span className="text-blue-500">项目进度</span>
                  <span className="ml-1 text-base font-normal text-slate-600">
                    ({selectedProjectDetails.name})
                  </span>
                </CardTitle>
                <p className="text-sm text-slate-500 pt-1">
                  {selectedProjectDetails.partner_name}
                </p>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                <Select 
                  value={projectId || ''} 
                  onValueChange={handleProjectChange}
                >
                  <SelectTrigger className="w-auto min-w-[150px] bg-white text-slate-900 border-slate-300">
                    <SelectValue placeholder="请选择项目..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className={cn(
                        "w-auto min-w-[130px] justify-start text-left font-normal bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-900", 
                        !reportDate && "text-slate-500"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {reportDate ? format(reportDate, "yyyy-MM-dd") : <span>选择日期</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent 
                      mode="single" 
                      selected={reportDate} 
                      onSelect={handleDateChange} 
                      initialFocus 
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            
            <CardContent className="flex-grow flex flex-col justify-center items-center p-4 space-y-4">
              <div className="flex justify-between text-sm text-slate-600 w-full">
                <span>进度 ({unitConfig.unit})</span>
                <span className="font-semibold">{progressPercentage.toFixed(1)}%</span>
              </div>
              
              {/* 使用优化的环形进度图 */}
              <div className="w-full max-w-[200px] aspect-square">
                <OptimizedCircularProgressChart value={progressPercentage} />
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

        {/* 日报与汇总卡片 */}
        <div className="lg:col-span-3">
          <Card className="shadow-sm flex flex-col h-full">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-lg">
                <CalendarIcon className="mr-2 h-5 w-5 text-orange-500"/>
                <span className="text-orange-500">日报与汇总</span>
                <span className="ml-1 text-base font-normal text-slate-600">
                  ({format(reportDate, "yyyy-MM-dd")})
                </span>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="grid grid-cols-4 gap-4 flex-grow">
              <Card className="flex flex-col justify-center items-center p-2">
                <p className="text-2xl font-bold text-slate-800">
                  {formatNumber(dashboardData.daily_report?.trip_count, '次')}
                </p>
                <p className="text-sm text-slate-500 mt-1">当日车次</p>
              </Card>
              
              <Card className="flex flex-col justify-center items-center p-2">
                <p className="text-2xl font-bold text-slate-800">
                  {formatNumber(dashboardData.daily_report?.total_tonnage, unitConfig.unit)}
                </p>
                <p className="text-sm text-slate-500 mt-1">当日运输量</p>
              </Card>
              
              <Card className="flex flex-col justify-center items-center p-2">
                <p className="text-2xl font-bold text-green-600">
                  {formatNumber(dashboardData.daily_report?.driver_receivable, '元')}
                </p>
                <p className="text-sm text-slate-500 mt-1">司机应收</p>
              </Card>
              
              <Card className="flex flex-col justify-center items-center p-2">
                <p className="text-2xl font-bold text-red-600">
                  {formatNumber(dashboardData.daily_report?.partner_payable, '元')}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedProjectDetails.partner_name || '合作方'}应付
                </p>
              </Card>
              
              <Card className="flex flex-col justify-center items-center p-2">
                <p className="text-2xl font-bold text-slate-800">
                  {formatNumber(dashboardData.summary_stats?.total_trips, '车')}
                </p>
                <div className="flex items-center text-sm text-slate-500 mt-1">
                  <Truck className="h-4 w-4 mr-2"/>已发总车次
                </div>
              </Card>
              
              <Card className="flex flex-col justify-center items-center p-2">
                <p className="text-2xl font-bold text-slate-800">
                  {formatNumber(dashboardData.summary_stats?.total_tonnage, unitConfig.unit)}
                </p>
                <div className="flex items-center text-sm text-slate-500 mt-1">
                  <Package className="h-4 w-4 mr-2"/>已发总数量
                </div>
              </Card>
              
              <Card className="flex flex-col justify-center items-center p-2">
                <p className="text-2xl font-bold text-green-600">
                  {formatNumber(dashboardData.summary_stats?.avg_cost, `元/${unitConfig.unit}`)}
                </p>
                <div className="flex items-center text-sm text-slate-500 mt-1">
                  <BarChartHorizontal className="h-4 w-4 mr-2"/>平均单位成本
                </div>
              </Card>
              
              <Card className="flex flex-col justify-center items-center p-2">
                <p className="text-2xl font-bold text-red-600">
                  {formatNumber(dashboardData.summary_stats?.total_cost, '元')}
                </p>
                <div className="flex items-center text-sm text-slate-500 mt-1">
                  <Wallet className="h-4 w-4 mr-2"/>
                  {selectedProjectDetails.partner_name || '合作方'}总应付
                </div>
              </Card>
            </CardContent>
          </Card>
        </div>

        {/* 近7日进度图表 */}
        <div className="lg:col-span-5">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <TrendingUp className="mr-2 h-5 w-5 text-teal-500"/>
                <span className="text-teal-500">近7日进度</span>
                <span className="ml-1 text-base font-normal text-slate-600">
                  ({selectedProjectDetails.name})
                </span>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="h-[350px]">
              {/* 使用优化的折线图 */}
              <OptimizedLineChart
                data={dashboardData.seven_day_trend}
                visibleLines={visibleLines}
                unitConfig={unitConfig}
                onLegendClick={handleLegendClick}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
