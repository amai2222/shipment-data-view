import { supabase } from '@/integrations/supabase/client';
import { Project, Driver, Location, LogisticsRecord } from '@/types';

// 数据库操作工具类
export class SupabaseStorage {
  // 项目相关
  static async getProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data?.map(p => ({
      id: p.id,
      name: p.name,
      startDate: p.start_date,
      endDate: p.end_date,
      manager: p.manager,
      loadingAddress: p.loading_address,
      unloadingAddress: p.unloading_address,
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

  // 司机相关
  static async getDrivers(): Promise<Driver[]> {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data?.map(d => ({
      id: d.id,
      name: d.name,
      licensePlate: d.license_plate,
      phone: d.phone,
      createdAt: d.created_at,
    })) || [];
  }

  static async addDriver(driver: Omit<Driver, 'id' | 'createdAt'>): Promise<Driver> {
    const { data, error } = await supabase
      .from('drivers')
      .insert([{
        name: driver.name,
        license_plate: driver.licensePlate,
        phone: driver.phone,
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      name: data.name,
      licensePlate: data.license_plate,
      phone: data.phone,
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
      })
      .eq('id', id);
    
    if (error) throw error;
  }

  static async deleteDriver(id: string): Promise<void> {
    const { error } = await supabase
      .from('drivers')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // 地点相关
  static async getLocations(): Promise<Location[]> {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data?.map(l => ({
      id: l.id,
      name: l.name,
      createdAt: l.created_at,
    })) || [];
  }

  static async addLocation(location: Omit<Location, 'id' | 'createdAt'>): Promise<Location> {
    const { data, error } = await supabase
      .from('locations')
      .insert([{ name: location.name }])
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      name: data.name,
      createdAt: data.created_at,
    };
  }

  static async updateLocation(id: string, updates: Partial<Location>): Promise<void> {
    const { error } = await supabase
      .from('locations')
      .update({ name: updates.name })
      .eq('id', id);
    
    if (error) throw error;
  }

  static async deleteLocation(id: string): Promise<void> {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // 物流记录相关
  static async getLogisticsRecords(): Promise<LogisticsRecord[]> {
    const { data, error } = await supabase
      .from('logistics_records')
      .select('*')
      .order('auto_number', { ascending: false });
    
    if (error) throw error;
    return data?.map(record => ({
      id: record.id,
      autoNumber: record.auto_number,
      projectId: record.project_id,
      projectName: record.project_name,
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
    })) || [];
  }

  static async addLogisticsRecord(record: Omit<LogisticsRecord, 'id' | 'autoNumber' | 'createdAt'>): Promise<LogisticsRecord> {
    // 生成自动编号
    const autoNumber = await this.generateAutoNumber();
    
    const { data, error } = await supabase
      .from('logistics_records')
      .insert([{
        auto_number: autoNumber,
        project_id: record.projectId,
        project_name: record.projectName,
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
    
    return {
      id: data.id,
      autoNumber: data.auto_number,
      projectId: data.project_id,
      projectName: data.project_name,
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
  }

  static async updateLogisticsRecord(id: string, updates: Partial<LogisticsRecord>): Promise<void> {
    const { error } = await supabase
      .from('logistics_records')
      .update({
        project_id: updates.projectId,
        project_name: updates.projectName,
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
  }

  static async deleteLogisticsRecord(id: string): Promise<void> {
    const { error } = await supabase
      .from('logistics_records')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // 生成自动编号
  static async generateAutoNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    
    const { data, error } = await supabase
      .from('logistics_records')
      .select('auto_number')
      .like('auto_number', `${dateStr}%`);
    
    if (error) throw error;
    
    const todayRecords = data || [];
    const sequenceNumber = (todayRecords.length + 1).toString().padStart(3, "0");
    return `${dateStr}-${sequenceNumber}`;
  }

  // 查找或创建地点
  static async findOrCreateLocation(name: string): Promise<Location> {
    // 先查找是否存在
    const { data: existing } = await supabase
      .from('locations')
      .select('*')
      .eq('name', name)
      .single();
    
    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        createdAt: existing.created_at,
      };
    }
    
    // 不存在则创建
    return await this.addLocation({ name });
  }
}