import { supabase } from '@/integrations/supabase/client';
import { Project, Driver, Location, LogisticsRecord } from '@/types';

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

  static async getFilteredLogisticsRecordsWithBilling(
    projectId?: string, 
    driverName?: string, 
    startDate?: string, 
    endDate?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{records: any[], totalCount: number}> {
    const { data, error } = await supabase
      .rpc('get_filtered_logistics_with_billing', {
        p_project_id: projectId || null,
        p_driver_name: driverName || null,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_limit: limit,
        p_offset: offset
      });
    
    if (error) throw error;
    
    if (!data) {
      return { records: [], totalCount: 0 };
    }
    
    return { 
      records: (data as any)?.records || [], 
      totalCount: (data as any)?.totalCount || 0 
    };
  }

  static async getDrivers(filter: string, page: number, pageSize: number): Promise<{ drivers: Driver[], totalCount: number }> {
    const { data, error } = await supabase.rpc('get_drivers_paginated', {
      p_page_number: page,
      p_page_size: pageSize,
      p_search_text: filter,
    });

    if (error) {
      console.error('Error fetching paginated drivers:', error);
      throw error;
    }
    
    if (data && Array.isArray(data) && data.length > 0) {
      return {
        drivers: data.map((d: any) => ({
          id: d.id,
          name: d.name,
          licensePlate: d.license_plate,
          phone: d.phone,
          projectIds: d.project_ids,
          createdAt: d.created_at
        })),
        totalCount: data[0].total_records || 0,
      };
    }
    
    return {
      drivers: [],
      totalCount: 0,
    };
  }

  static async getDriversByProject(projectId: string): Promise<Driver[]> {
    const { data, error } = await supabase
      .from('drivers')
      .select(`*, driver_projects!inner(project_id)`)
      .eq('driver_projects.project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data?.map(d => ({
      id: d.id, name: d.name, licensePlate: d.license_plate, phone: d.phone,
      projectIds: d.driver_projects?.map((dp: any) => dp.project_id) || [],
      createdAt: d.created_at,
    })) || [];
  }
  
  static async addDriver(driver: Omit<Driver, 'id' | 'createdAt'>): Promise<Driver> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('无法获取用户信息，请重新登录后重试。');

    const { data, error } = await supabase
      .from('drivers')
      .insert([{ user_id: user.id, name: driver.name, license_plate: driver.licensePlate, phone: driver.phone }])
      .select().single();

    if (error) throw error;

    if (driver.projectIds && driver.projectIds.length > 0) {
      const { error: relationError } = await supabase
        .from('driver_projects')
        .insert(driver.projectIds.map(projectId => ({ driver_id: data.id, project_id: projectId, user_id: user.id })));
      if (relationError) throw relationError;
    }

    return {
      id: data.id, name: data.name, licensePlate: data.license_plate, phone: data.phone,
      projectIds: driver.projectIds || [], createdAt: data.created_at,
    };
  }

  static async updateDriver(id: string, updates: Partial<Driver>): Promise<void> {
    const { error } = await supabase
      .from('drivers')
      .update({ name: updates.name, license_plate: updates.licensePlate, phone: updates.phone })
      .eq('id', id);
    if (error) throw error;

    if (updates.projectIds !== undefined) {
      await supabase.from('driver_projects').delete().eq('driver_id', id);
      if (updates.projectIds.length > 0) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error('无法获取用户信息，请重新登录后重试。');
        const { error: relationError } = await supabase
          .from('driver_projects')
          .insert(updates.projectIds.map(projectId => ({ driver_id: id, project_id: projectId, user_id: currentUser.id })));
        if (relationError) throw relationError;
      }
    }
  }

  static async deleteDriver(id: string): Promise<void> {
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    if (error) throw error;
  }

  static async getLocations(): Promise<Location[]> {
    const { data, error } = await supabase
      .from('locations')
      .select(`*, location_projects(project_id)`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data?.map(l => ({
      id: l.id, name: l.name,
      projectIds: l.location_projects?.map((lp: any) => lp.project_id) || [],
      createdAt: l.created_at,
    })) || [];
  }

  static async getLocationsByProject(projectId: string): Promise<Location[]> {
    const { data, error } = await supabase
      .from('locations')
      .select(`*, location_projects!inner(project_id)`)
      .eq('location_projects.project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data?.map(l => ({
      id: l.id, name: l.name,
      projectIds: l.location_projects?.map((lp: any) => lp.project_id) || [],
      createdAt: l.created_at,
    })) || [];
  }

  static async addLocation(location: Omit<Location, 'id' | 'createdAt'>): Promise<Location> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('无法获取用户信息，请重新登录后重试。');

    const { data, error } = await supabase
      .from('locations')
      .insert([{ user_id: user.id, name: location.name }])
      .select().single();
    if (error) throw error;

    if (location.projectIds && location.projectIds.length > 0) {
      const { error: relationError } = await supabase
        .from('location_projects')
        .insert(location.projectIds.map(projectId => ({ location_id: data.id, project_id: projectId, user_id: user.id })));
      if (relationError) throw relationError;
    }
    return { id: data.id, name: data.name, projectIds: location.projectIds || [], createdAt: data.created_at };
  }

  static async updateLocation(id: string, updates: Partial<Location>): Promise<void> {
    const { error } = await supabase.from('locations').update({ name: updates.name }).eq('id', id);
    if (error) throw error;

    if (updates.projectIds !== undefined) {
      await supabase.from('location_projects').delete().eq('location_id', id);
      if (updates.projectIds.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('无法获取用户信息，请重新登录后重试。');
        const { error: relationError } = await supabase
          .from('location_projects')
          .insert(updates.projectIds.map(projectId => ({ location_id: id, project_id: projectId, user_id: user.id })));
        if (relationError) throw relationError;
      }
    }
  }

  static async deleteLocation(id: string): Promise<void> {
    const { error } = await supabase.from('locations').delete().eq('id', id);
    if (error) throw error;
  }

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
    offset: number = 0,
    billingTypeId?: number
  ): Promise<{records: LogisticsRecord[], totalCount: number}> {
    const { data, error } = await supabase.rpc('get_filtered_logistics_records_fixed', {
      p_project_id: projectId || null,
      p_driver_id: driverId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_limit: limit,
      p_offset: offset
    });

    if (error) throw error;
    
    if (!data || !(data as any).records) {
      return { records: [], totalCount: 0 };
    }
    
    const totalCount = (data as any).totalCount || 0;
    const records = (data as any).records.map((record: any) => ({
      id: record.id,
      autoNumber: record.auto_number,
      projectId: record.project_id,
      projectName: record.project_name,
      chainId: record.chain_id,
      loadingDate: record.loading_date,
      loadingLocation: record.loading_location,
      unloadingLocation: record.unloading_location,
      driverId: record.driver_id,
      driverName: record.driver_name,
      licensePlate: record.license_plate,
      driverPhone: record.driver_phone,
      loadingWeight: record.loading_weight,
      unloadingDate: record.unloading_date,
      unloadingWeight: record.unloading_weight,
      transportType: record.transport_type as "实际运输" | "退货",
      currentFee: record.current_cost,
      extraFee: record.extra_cost,
      payableFee: record.payable_cost,
      remarks: record.remarks,
      createdAt: record.created_at,
      createdByUserId: record.created_by_user_id,
      billing_type_id: record.billing_type_id,
    }));
    
    return { records, totalCount };
  }

  static async getFilteredLogisticsRecordsFixed(
    projectId?: string, 
    driverId?: string, 
    startDate?: string, 
    endDate?: string, 
    limit: number = 1000, 
    offset: number = 0
  ): Promise<{ records: any[], totalCount: number }> {
    const { data, error } = await supabase.rpc('get_filtered_logistics_records_fixed', {
      p_project_id: projectId || null,
      p_driver_id: driverId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_limit: limit,
      p_offset: offset
    });

    if (error) throw error;
    
    return {
      records: (data as any)?.records || [],
      totalCount: (data as any)?.totalCount || 0
    };
  }

  static async addLogisticsRecord(record: Omit<LogisticsRecord, 'id' | 'autoNumber' | 'createdAt'>): Promise<LogisticsRecord> {
    const autoNumber = await this.generateAutoNumber();
    
    const { data, error } = await supabase
      .from('logistics_records')
      .insert([{
        auto_number: autoNumber,
        project_id: record.projectId,
        project_name: record.projectName,
        chain_id: record.chainId,
        loading_date: record.loadingDate,
        loading_location: record.loadingLocation,
        unloading_location: record.unloadingLocation,
        driver_id: record.driverId,
        driver_name: record.driverName,
        license_plate: record.licensePlate,
        driver_phone: record.driverPhone,
        loading_weight: record.loadingWeight,
        unloading_date: record.unloadingDate,
        unloading_weight: record.unloadingWeight,
        transport_type: record.transportType,
        current_cost: record.currentFee,
        extra_cost: record.extraFee,
        payable_cost: record.payableFee,
        remarks: record.remarks,
        created_by_user_id: record.createdByUserId,
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    const newRecord = {
      id: data.id,
      autoNumber: data.auto_number,
      projectId: data.project_id,
      projectName: data.project_name,
      chainId: data.chain_id,
      loadingDate: data.loading_date,
      loadingLocation: data.loading_location,
      unloadingLocation: data.unloading_location,
      driverId: data.driver_id,
      driverName: data.driver_name,
      licensePlate: data.license_plate,
      driverPhone: data.driver_phone,
      loadingWeight: data.loading_weight,
      unloadingDate: data.unloading_date,
      unloadingWeight: data.unloading_weight,
      transportType: data.transport_type as "实际运输" | "退货",
      currentFee: data.current_cost,
      extraFee: data.extra_cost,
      payableFee: data.payable_cost,
      remarks: data.remarks,
      createdAt: data.created_at,
      createdByUserId: data.created_by_user_id,
    };

    if (record.currentFee && record.currentFee > 0 && record.projectId) {
      await this.generatePartnerCosts(
        data.id, 
        record.currentFee, 
        record.projectId,
        record.loadingWeight,
        record.unloadingWeight
      );
    }
    
    return newRecord;
  }

  static async updateLogisticsRecord(id: string, updates: Partial<LogisticsRecord>): Promise<void> {
    await supabase
      .from('logistics_partner_costs')
      .delete()
      .eq('logistics_record_id', id);

    const { error } = await supabase
      .from('logistics_records')
      .update({
        project_id: updates.projectId,
        project_name: updates.projectName,
        chain_id: updates.chainId,
        loading_date: updates.loadingDate,
        loading_location: updates.loadingLocation,
        unloading_location: updates.unloadingLocation,
        driver_id: updates.driverId,
        driver_name: updates.driverName,
        license_plate: updates.licensePlate,
        driver_phone: updates.driverPhone,
        loading_weight: updates.loadingWeight,
        unloading_date: updates.unloadingDate,
        unloading_weight: updates.unloadingWeight,
        transport_type: updates.transportType,
        current_cost: updates.currentFee,
        extra_cost: updates.extraFee,
        payable_cost: updates.payableFee,
        remarks: updates.remarks,
      })
      .eq('id', id);
    
    if (error) throw error;

    if (updates.currentFee && updates.currentFee > 0 && updates.projectId) {
      await this.generatePartnerCosts(
        id, 
        updates.currentFee, 
        updates.projectId,
        updates.loadingWeight,
        updates.unloadingWeight
      );
    }
  }

  static async deleteLogisticsRecord(id: string): Promise<void> {
    const { error } = await supabase
      .from('logistics_records')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
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

  private static async generatePartnerCosts(
    recordId: string, 
    baseCost: number, 
    projectId: string,
    loadingWeight?: number,
    unloadingWeight?: number
  ): Promise<void> {
    try {
      const { data, error } = await supabase.rpc('calculate_partner_costs_for_project_v2', {
        p_base_amount: baseCost,
        p_project_id: projectId,
        p_loading_weight: loadingWeight || null,
        p_unloading_weight: unloadingWeight || null
      });

      if (error) throw error;

      if (data && Array.isArray(data) && data.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('无法获取用户信息，请重新登录后重试。');

        const costInserts = data.map((cost: any) => ({
          logistics_record_id: recordId,
          partner_id: cost.partner_id,
          level: cost.level,
          base_amount: cost.base_amount,
          payable_amount: cost.payable_amount,
          tax_rate: cost.tax_rate,
          user_id: user.id
        }));

        const { error: insertError } = await supabase
          .from('logistics_partner_costs')
          .insert(costInserts);

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error generating partner costs:', error);
      throw error;
    }
  }

  static async getPartnerChains(projectId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('partner_chains')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}