import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';

// 看板数据类型定义
export interface ProjectDetails {
  id: string;
  name: string;
  partner_name: string;
  start_date: string;
  planned_total_tons: number;
  billing_type_id: number;
}

export interface DailyReport {
  trip_count: number;
  total_tonnage: number;
  driver_receivable: number;
  partner_payable: number;
}

export interface TrendData {
  date: string;
  trips: number;
  weight: number;
  receivable: number;
}

export interface SummaryStats {
  total_trips: number;
  total_cost: number;
  avg_cost: number;
  total_tonnage: number;
}

export interface DriverReportRow {
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

export interface OverviewDashboardData {
  all_projects_data: Array<{
    project_details: ProjectDetails;
    daily_report: DailyReport;
    summary_stats: SummaryStats;
    seven_day_trend: TrendData[];
    driver_report_table: DriverReportRow[];
  }>;
  global_seven_day_trend: TrendData[];
  global_driver_report_table: DriverReportRow[];
  global_summary: {
    total_projects: number;
    total_receivable: number;
    total_trips: number;
  };
}

/**
 * 看板数据服务 - 统一管理所有看板数据请求
 * 实现数据缓存和共享，避免重复的 RPC 调用
 */
export class DashboardDataService {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 获取项目看板数据
   */
  static async getProjectDashboardData(
    projectId: string, 
    reportDate: string
  ): Promise<{ data: DashboardData | null; error: any }> {
    const cacheKey = `project-dashboard-${projectId}-${reportDate}`;
    
    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return { data: cached.data, error: null };
    }

    try {
      const { data, error } = await supabase.rpc('get_project_dashboard_data', {
        p_selected_project_id: projectId,
        p_report_date: reportDate
      });

      if (error) {
        return { data: null, error };
      }

      // 更新缓存
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * 获取项目概览数据
   */
  static async getProjectsOverviewData(
    reportDate: string,
    projectIds?: string[]
  ): Promise<{ data: OverviewDashboardData | null; error: any }> {
    const cacheKey = `projects-overview-${reportDate}-${projectIds?.join(',') || 'all'}`;
    
    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return { data: cached.data, error: null };
    }

    try {
      const params = {
        p_report_date: reportDate,
        p_project_ids: projectIds && projectIds.length > 0 ? projectIds : null
      };
      
      const { data, error } = await supabase.rpc('get_all_projects_overview_data' as any, params);

      if (error) {
        return { data: null, error };
      }

      // 更新缓存
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * 获取项目趋势数据（按区间）
   */
  static async getProjectTrendByRange(
    projectId: string,
    days: number
  ): Promise<{ data: TrendData[] | null; error: any }> {
    const cacheKey = `project-trend-${projectId}-${days}`;
    
    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return { data: cached.data, error: null };
    }

    try {
      const { data, error } = await supabase.rpc('get_project_trend_by_range' as any, {
        p_project_id: projectId,
        p_days: days
      });

      if (error) {
        return { data: null, error };
      }

      // 更新缓存
      this.cache.set(cacheKey, { data: data || [], timestamp: Date.now() });
      return { data: data || [], error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * 清除特定缓存
   */
  static clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * 清除过期缓存
   */
  static clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

/**
 * 格式化数字的辅助函数
 */
export const formatNumber = (val: number | null | undefined, unit: string = '') => 
  `${(val || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit ? ' ' + unit : ''}`;

/**
 * 计算单位配置的辅助函数
 */
export const calculateUnitConfig = (
  projectDetails: ProjectDetails | undefined,
  summaryStats: SummaryStats | undefined
) => {
  const defaultConfig = { 
    billingTypeId: 1, 
    unit: '吨', 
    progressCompleted: 0, 
    progressPlanned: 1 
  };
  
  if (!projectDetails || !summaryStats) return defaultConfig;
  
  const { billing_type_id, planned_total_tons } = projectDetails;
  const typeId = parseInt(billing_type_id as any, 10);
  
  let unitText = '吨';
  if (typeId === 2) unitText = '车';
  if (typeId === 3) unitText = '立方';
  
  return {
    billingTypeId: typeId,
    unit: unitText,
    progressCompleted: typeId === 2 ? summaryStats?.total_trips || 0 : summaryStats?.total_tonnage || 0,
    progressPlanned: planned_total_tons || 1,
  };
};

/**
 * 计算进度百分比的辅助函数
 */
export const calculateProgressPercentage = (unitConfig: ReturnType<typeof calculateUnitConfig>) => {
  return (unitConfig.progressPlanned > 0) 
    ? (unitConfig.progressCompleted / unitConfig.progressPlanned) * 100 
    : 0;
};
