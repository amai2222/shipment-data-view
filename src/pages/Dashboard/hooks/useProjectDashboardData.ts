import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from 'date-fns';

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

export interface DashboardData { 
  project_details: ProjectDetails[]; 
  daily_report: DailyReport; 
  seven_day_trend: TrendData[]; 
  summary_stats: SummaryStats; 
  driver_report_table: DriverReportRow[]; 
}

export function useProjectDashboardData() {
  const { projectId } = useParams<{ projectId: string }>();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [visibleLines, setVisibleLines] = useState({ 
    weight: true, 
    trips: true, 
    receivable: true 
  });
  const { toast } = useToast();

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        if (!projectId) {
          console.warn("URL中未提供项目ID");
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.rpc('get_project_dashboard_data', {
          p_selected_project_id: projectId,
          p_report_date: format(reportDate, 'yyyy-MM-dd')
        });
        if (error) throw error;
        setDashboardData(data as DashboardData);
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
    };
    fetchDashboardData();
  }, [projectId, reportDate, toast]);

  const allProjects = dashboardData?.project_details || [];
  
  const selectedProjectDetails = useMemo(
    () => allProjects.find(p => p.id === projectId), 
    [allProjects, projectId]
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

  const handleLegendClick = (dataKey: string) => {
    setVisibleLines(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };

  return {
    projectId,
    dashboardData,
    loading,
    reportDate,
    setReportDate,
    visibleLines,
    handleLegendClick,
    allProjects,
    selectedProjectDetails,
    unitConfig,
    progressPercentage,
  };
}

