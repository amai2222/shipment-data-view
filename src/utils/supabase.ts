import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { Project, Driver, Location, LogisticsRecord } from '@/types';

// 重新导出supabase
export { supabase };

// 数据库操作工具类
export class SupabaseStorage {
  // 项目相关
  static async getProjects(status?: string): Promise<Project[]> {
    let query = supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== '所有状态') {
      query = query.eq('project_status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data?.map(p => ({
      id: p.id,
      name: p.name,
      startDate: p.start_date,
      endDate: p.end_date,
      manager: p.manager,
      loadingAddress: p.loading_address,
      unloadingAddress: p.unloading_address,
      autoCode: p.auto_code,
      plannedTotalTons: p.planned_total_tons,
      financeManager: p.finance_manager,
      createdAt: p.created_at,
    })) || [];
  }

  static async addProject(project: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert([{
        name: project.name,
        start_date: project.startDate,
        end_date: project.endDate,
        manager: project.manager,
        loading_address: project.loadingAddress,
        unloading_address: project.unloadingAddress,
      }])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      startDate: data.start_date,
      endDate: data.end_date,
      manager: data.manager,
      loadingAddress: data.loading_address,
      unloadingAddress: data.unloading_address,
      autoCode: data.auto_code,
      plannedTotalTons: data.planned_total_tons,
      financeManager: data.finance_manager,
      createdAt: data.created_at,
    };
  }

  static async updateProject(id: string, updates: Partial<Project>): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update({
        name: updates.name,
        start_date: updates.startDate,
        end_date: updates.endDate,
        manager: updates.manager,
        loading_address: updates.loadingAddress,
        unloading_address: updates.unloadingAddress,
      })
      .eq('id', id);

    if (error) throw error;
  }

  static async deleteProject(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static async getDashboardStats(filters: { startDate: string; endDate: string; projectId: string | null; }): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('get_dashboard_stats_with_billing_types', {
        p_start_date: filters.startDate,
        p_end_date: filters.endDate,
        p_project_id: filters.projectId === 'all' ? null : filters.projectId,
      });

      if (error) {
        console.error('RPC call to get_dashboard_stats_with_billing_types failed:', error);
        throw error;
      }

      return (data as any) || {
        overview: {
          totalRecords: 0, totalWeight: 0, totalVolume: 0, totalTrips: 0, totalCost: 0, actualTransportCount: 0, returnCount: 0, weightRecordsCount: 0, tripRecordsCount: 0, volumeRecordsCount: 0
        },
        dailyTransportStats: [], dailyTripStats: [], dailyVolumeStats: [], dailyCostStats: [], dailyCountStats: []
      };
    } catch (error) {
      console.error('Dashboard stats error:', error);
      return {
        overview: {
          totalRecords: 0, totalWeight: 0, totalVolume: 0, totalTrips: 0, totalCost: 0, actualTransportCount: 0, returnCount: 0, weightRecordsCount: 0, tripRecordsCount: 0, volumeRecordsCount: 0
        },
        dailyTransportStats: [], dailyTripStats: [], dailyVolumeStats: [], dailyCostStats: [], dailyCountStats: []
      };
    }
  }

  static async generateAutoNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    
    return `${year}${month}${day}${hour}${minute}${second}${ms}`;
  }
}
