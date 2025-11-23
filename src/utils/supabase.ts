import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { Project, Driver, Location, LogisticsRecord } from '@/types';

// 重新导出supabase
export { supabase };

// Dashboard 统计数据接口
interface DashboardStats {
  overview: {
    totalRecords: number;
    totalWeight: number;
    totalVolume: number;
    totalTrips: number;
    totalCost: number;
    actualTransportCount: number;
    returnCount: number;
    weightRecordsCount: number;
    tripRecordsCount: number;
    volumeRecordsCount: number;
  };
  dailyTransportStats: unknown[];
  dailyTripStats: unknown[];
  dailyVolumeStats: unknown[];
  dailyCostStats: unknown[];
  dailyCountStats: unknown[];
}

// RPC 返回的司机原始数据接口
interface DriverRawData {
  id: string;
  name: string;
  license_plate: string | null;
  phone: string | null;
  project_ids: string[] | string | null;
  id_card_photos: string[] | string | null;
  driver_license_photos: string[] | string | null;
  qualification_certificate_photos: string[] | string | null;
  driving_license_photos: string[] | string | null;
  transport_license_photos: string[] | string | null;
  photo_status: 'complete' | 'incomplete' | null;
  created_at: string;
  total_records?: number;
}

// RPC 返回的运单记录原始数据接口
interface LogisticsRecordRawData {
  id: string;
  auto_number: string;
  project_id: string;
  project_name: string;
  chain_id: string | null;
  loading_date: string;
  loading_location: string;
  unloading_location: string;
  driver_id: string;
  driver_name: string;
  license_plate: string | null;
  driver_phone: string | null;
  loading_weight: number | null;
  unloading_date: string | null;
  unloading_weight: number | null;
  transport_type: string | null;
  current_cost: number | null;
  extra_cost: number | null;
  payable_cost: number | null;
  remarks: string | null;
  created_at: string;
  created_by_user_id: string;
}

// RPC 返回的运单记录响应接口
interface LogisticsRecordsRPCResponse {
  records: LogisticsRecordRawData[];
  totalCount: number;
}

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

  static async getDashboardStats(filters: { startDate: string; endDate: string; projectId: string | null; }): Promise<DashboardStats> {
    try {
      // ✅ 修改：使用新的后端函数，直接传递中国时区日期字符串
      const { data, error } = await supabase.rpc('get_dashboard_stats_with_billing_types_1113', {
        p_start_date: filters.startDate,
        p_end_date: filters.endDate,
        p_project_id: filters.projectId === 'all' ? null : filters.projectId,
      });

      if (error) {
        console.error('RPC call to get_dashboard_stats_with_billing_types_1113 failed:', error);
        throw error;
      }

      return (data as DashboardStats) || {
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

  // 地点相关
  static async getLocations(): Promise<Location[]> {
    const { data, error } = await supabase
      .from('locations')
      .select(`*, location_projects(project_id)`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data?.map(l => ({
      id: l.id,
      name: l.name,
      nickname: l.nickname || undefined,
      projectIds: l.location_projects?.map((lp: { project_id: string }) => lp.project_id) || [],
      createdAt: l.created_at,
    })) || [];
  }

  static async addLocation(location: Omit<Location, 'id' | 'createdAt'>): Promise<Location> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('请先登录');

    const { data, error } = await supabase
      .from('locations')
      .insert([{ 
        user_id: user.id, 
        name: location.name,
        nickname: location.nickname || null
      }])
      .select().single();
    if (error) throw error;

    if (location.projectIds && location.projectIds.length > 0) {
      const { error: relationError } = await supabase
        .from('location_projects')
        .insert(location.projectIds.map(projectId => ({ 
          location_id: data.id, 
          project_id: projectId, 
          user_id: user.id 
        })));
      if (relationError) throw relationError;
    }
    return { 
      id: data.id, 
      name: data.name,
      nickname: data.nickname || undefined,
      projectIds: location.projectIds || [], 
      createdAt: data.created_at 
    };
  }

  static async updateLocation(id: string, updates: Partial<Location>): Promise<void> {
    const updateData: { name?: string; nickname?: string | null } = { name: updates.name };
    if (updates.nickname !== undefined) {
      updateData.nickname = updates.nickname || null;
    }
    const { error } = await supabase.from('locations').update(updateData).eq('id', id);
    if (error) throw error;

    if (updates.projectIds !== undefined) {
      await supabase.from('location_projects').delete().eq('location_id', id);
      if (updates.projectIds.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('请先登录');
        const { error: relationError } = await supabase
          .from('location_projects')
          .insert(updates.projectIds.map(projectId => ({ 
            location_id: id, 
            project_id: projectId, 
            user_id: user.id 
          })));
        if (relationError) throw relationError;
      }
    }
  }

  static async deleteLocation(id: string): Promise<void> {
    const { error } = await supabase.from('locations').delete().eq('id', id);
    if (error) throw error;
  }

  // 司机相关
  static async getDrivers(
    filter: string, 
    page: number, 
    pageSize: number,
    filters?: {
      projectId?: string | null;
      photoStatus?: string | null;
      driverNames?: string | null;
      licensePlates?: string | null;
      phoneNumbers?: string | null;
    }
  ): Promise<{ drivers: Driver[], totalCount: number }> {
    const { data, error } = await supabase.rpc('get_drivers_paginated_1122', {
      p_page_number: page,
      p_page_size: pageSize,
      p_search_text: filter || '',
      p_project_id: filters?.projectId || null,
      p_photo_status: filters?.photoStatus || null,
      p_driver_names: filters?.driverNames || null,
      p_license_plates: filters?.licensePlates || null,
      p_phone_numbers: filters?.phoneNumbers || null,
    });

    if (error) {
      console.error('Error fetching drivers:', error);
      throw error;
    }
    
    if (data && Array.isArray(data) && data.length > 0) {
      return {
        drivers: data.map((d: DriverRawData) => {
          // 处理project_ids：确保是数组格式
          let projectIds: string[] = [];
          if (d.project_ids) {
            if (Array.isArray(d.project_ids)) {
              projectIds = d.project_ids;
            } else if (typeof d.project_ids === 'string') {
              // 如果是字符串，尝试解析
              try {
                projectIds = JSON.parse(d.project_ids);
              } catch {
                projectIds = [];
              }
            }
          }
          
          return {
            id: d.id,
            name: d.name,
            licensePlate: d.license_plate,
            phone: d.phone,
            projectIds: projectIds,
            id_card_photos: Array.isArray(d.id_card_photos) ? d.id_card_photos : (d.id_card_photos ? JSON.parse(d.id_card_photos) : []),
            driver_license_photos: Array.isArray(d.driver_license_photos) ? d.driver_license_photos : (d.driver_license_photos ? JSON.parse(d.driver_license_photos) : []),
            qualification_certificate_photos: Array.isArray(d.qualification_certificate_photos) ? d.qualification_certificate_photos : (d.qualification_certificate_photos ? JSON.parse(d.qualification_certificate_photos) : []),
            driving_license_photos: Array.isArray(d.driving_license_photos) ? d.driving_license_photos : (d.driving_license_photos ? JSON.parse(d.driving_license_photos) : []),
            transport_license_photos: Array.isArray(d.transport_license_photos) ? d.transport_license_photos : (d.transport_license_photos ? JSON.parse(d.transport_license_photos) : []),
            photoStatus: d.photo_status, // 新增：照片状态
            createdAt: d.created_at
          };
        }),
        totalCount: data[0]?.total_records || 0,
      };
    }
    
    return { drivers: [], totalCount: 0 };
  }

  static async addDriver(driver: Omit<Driver, 'id' | 'createdAt'>): Promise<Driver> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('请先登录');

    const { data, error } = await supabase
      .from('drivers')
      .insert([{ 
        user_id: user.id, 
        name: driver.name, 
        license_plate: driver.licensePlate, 
        phone: driver.phone,
        id_card_photos: driver.id_card_photos || [],
        driver_license_photos: driver.driver_license_photos || [],
        qualification_certificate_photos: driver.qualification_certificate_photos || [],
        driving_license_photos: driver.driving_license_photos || [],
        transport_license_photos: driver.transport_license_photos || []
      }])
      .select().single();

    if (error) throw error;

    if (driver.projectIds && driver.projectIds.length > 0) {
      const { error: relationError } = await supabase
        .from('driver_projects')
        .insert(driver.projectIds.map(projectId => ({ 
          driver_id: data.id, 
          project_id: projectId, 
          user_id: user.id 
        })));
      if (relationError) throw relationError;
    }

    return {
      id: data.id,
      name: data.name,
      licensePlate: data.license_plate,
      phone: data.phone,
      projectIds: driver.projectIds || [],
      createdAt: data.created_at,
    };
  }

  static async updateDriver(id: string, updates: Partial<Driver>): Promise<void> {
    const { error } = await supabase
      .from('drivers')
      .update({ 
        name: updates.name, 
        license_plate: updates.licensePlate, 
        phone: updates.phone,
        id_card_photos: updates.id_card_photos,
        driver_license_photos: updates.driver_license_photos,
        qualification_certificate_photos: updates.qualification_certificate_photos,
        driving_license_photos: updates.driving_license_photos,
        transport_license_photos: updates.transport_license_photos
      })
      .eq('id', id);
    if (error) throw error;

    if (updates.projectIds !== undefined) {
      await supabase.from('driver_projects').delete().eq('driver_id', id);
      if (updates.projectIds.length > 0) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error('请先登录');
        const { error: relationError } = await supabase
          .from('driver_projects')
          .insert(updates.projectIds.map(projectId => ({ 
            driver_id: id, 
            project_id: projectId, 
            user_id: currentUser.id 
          })));
        if (relationError) throw relationError;
      }
    }
  }

  static async deleteDriver(id: string): Promise<void> {
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    if (error) throw error;
  }

  // 运单相关
  static async getLogisticsRecords(): Promise<LogisticsRecord[]> {
    const result = await this.getFilteredLogisticsRecords(undefined, undefined, undefined, undefined, 1000, 0);
    return result.records;
  }

  static async getFilteredLogisticsRecords(
    projectId?: string,
    driverId?: string,
    startDate?: string,
    endDate?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ records: LogisticsRecord[], totalCount: number }> {
    const { data, error } = await supabase.rpc('get_filtered_logistics_records_fixed', {
      p_project_id: projectId || null,
      p_driver_id: driverId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_limit: limit,
      p_offset: offset
    });

    if (error) throw error;

    if (!data || !(data as LogisticsRecordsRPCResponse).records) {
      return { records: [], totalCount: 0 };
    }

    const response = data as LogisticsRecordsRPCResponse;
    const totalCount = response.totalCount || 0;
    const records: LogisticsRecord[] = response.records.map((record: LogisticsRecordRawData) => ({
      id: record.id,
      auto_number: record.auto_number,
      project_id: record.project_id,
      project_name: record.project_name,
      chain_id: record.chain_id || undefined,
      loading_date: record.loading_date,
      loading_location: record.loading_location,
      unloading_location: record.unloading_location,
      driver_id: record.driver_id,
      driver_name: record.driver_name,
      license_plate: record.license_plate || '',
      driver_phone: record.driver_phone || '',
      loading_weight: record.loading_weight || 0,
      unloading_date: record.unloading_date || undefined,
      unloading_weight: record.unloading_weight || undefined,
      transport_type: (record.transport_type as "实际运输" | "退货") || "实际运输",
      current_cost: record.current_cost || undefined,
      extra_cost: record.extra_cost || undefined,
      payable_cost: record.payable_cost || undefined,
      remarks: record.remarks || undefined,
      created_at: record.created_at,
      created_by_user_id: record.created_by_user_id,
    }));

    return { records, totalCount };
  }

  static async addLogisticsRecord(record: Omit<LogisticsRecord, 'id' | 'auto_number' | 'created_at'>): Promise<LogisticsRecord> {
    const autoNumber = await this.generateAutoNumber();

    const { data, error } = await supabase
      .from('logistics_records')
      .insert([{
        auto_number: autoNumber,
        project_id: record.project_id,
        project_name: record.project_name,
        chain_id: record.chain_id,
        loading_date: record.loading_date,
        loading_location: record.loading_location,
        unloading_location: record.unloading_location,
        driver_id: record.driver_id,
        driver_name: record.driver_name,
        license_plate: record.license_plate,
        driver_phone: record.driver_phone,
        loading_weight: record.loading_weight,
        unloading_date: record.unloading_date,
        unloading_weight: record.unloading_weight,
        transport_type: record.transport_type,
        current_cost: record.current_cost,
        extra_cost: record.extra_cost,
        payable_cost: record.payable_cost,
        remarks: record.remarks,
        created_by_user_id: record.created_by_user_id,
      }])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      auto_number: data.auto_number,
      project_id: data.project_id,
      project_name: data.project_name,
      chain_id: data.chain_id,
      loading_date: data.loading_date,
      loading_location: data.loading_location,
      unloading_location: data.unloading_location,
      driver_id: data.driver_id,
      driver_name: data.driver_name,
      license_plate: data.license_plate,
      driver_phone: data.driver_phone,
      loading_weight: data.loading_weight,
      unloading_date: data.unloading_date,
      unloading_weight: data.unloading_weight,
      transport_type: data.transport_type as "实际运输" | "退货",
      current_cost: data.current_cost,
      extra_cost: data.extra_cost,
      payable_cost: data.payable_cost,
      remarks: data.remarks,
      created_at: data.created_at,
      created_by_user_id: data.created_by_user_id,
    };
  }

  // 合作商链相关
  static async getPartnerChains(projectId: string): Promise<Array<{
    id: string;
    chain_name: string;
    project_id: string;
    billing_type_id: number | null;
    is_default: boolean;
    created_at: string;
  }>> {
    const { data, error } = await supabase
      .from('partner_chains')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
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
