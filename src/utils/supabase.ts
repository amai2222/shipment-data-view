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
      autoCode: p.auto_code,
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
      projectId: d.project_id,
      createdAt: d.created_at,
    })) || [];
  }

  static async getDriversByProject(projectId: string): Promise<Driver[]> {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data?.map(d => ({
      id: d.id,
      name: d.name,
      licensePlate: d.license_plate,
      phone: d.phone,
      projectId: d.project_id,
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
        project_id: driver.projectId,
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      name: data.name,
      licensePlate: data.license_plate,
      phone: data.phone,
      projectId: data.project_id,
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
        project_id: updates.projectId,
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
      projectId: l.project_id,
      createdAt: l.created_at,
    })) || [];
  }

  static async getLocationsByProject(projectId: string): Promise<Location[]> {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data?.map(l => ({
      id: l.id,
      name: l.name,
      projectId: l.project_id,
      createdAt: l.created_at,
    })) || [];
  }

  static async addLocation(location: Omit<Location, 'id' | 'createdAt'>): Promise<Location> {
    const { data, error } = await supabase
      .from('locations')
      .insert([{ 
        name: location.name,
        project_id: location.projectId,
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      name: data.name,
      projectId: data.project_id,
      createdAt: data.created_at,
    };
  }

  static async updateLocation(id: string, updates: Partial<Location>): Promise<void> {
    const { error } = await supabase
      .from('locations')
      .update({ 
        name: updates.name,
        project_id: updates.projectId,
      })
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

    // 如果有运费金额，自动生成合作方成本
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
    // 先删除现有的合作方成本记录
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

    // 如果有运费金额，重新生成合作方成本
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
    // 先删除相关的合作方成本记录
    await supabase
      .from('logistics_partner_costs')
      .delete()
      .eq('logistics_record_id', id);

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
  static async findOrCreateLocation(name: string, projectId?: string): Promise<Location> {
    // 先查找是否存在（如果有项目ID，则在该项目内查找）
    let query = supabase
      .from('locations')
      .select('*')
      .eq('name', name);
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    const { data: existing } = await query.single();
    
    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        projectId: existing.project_id,
        createdAt: existing.created_at,
      };
    }
    
    // 不存在则创建
    return await this.addLocation({ name, projectId });
  }

  // 获取项目的合作链路
  static async getPartnerChains(projectId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('partner_chains')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  // 获取项目的默认合作链路ID
  static async getDefaultChainId(projectId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('partner_chains')
      .select('id')
      .eq('project_id', projectId)
      .eq('is_default', true)
      .single();
    
    if (error) {
      // 如果没有默认链路，获取第一个链路
      const { data: firstChain } = await supabase
        .from('partner_chains')
        .select('id')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      
      return firstChain?.id || null;
    }
    
    return data?.id || null;
  }

  // 生成合作方成本记录
  static async generatePartnerCosts(logisticsRecordId: string, baseCost: number, projectId: string, loadingWeight?: number, unloadingWeight?: number): Promise<void> {
    try {
      // 使用新的数据库函数计算合作方成本
      const { data: partnerCosts, error } = await supabase
        .rpc('calculate_partner_costs_v2', {
          p_base_amount: baseCost,
          p_project_id: projectId,
          p_loading_weight: loadingWeight || null,
          p_unloading_weight: unloadingWeight || null
        });

      if (error) throw error;

      if (partnerCosts && partnerCosts.length > 0) {
        // 插入合作方成本记录
        const costRecords = partnerCosts.map((cost: any) => ({
          logistics_record_id: logisticsRecordId,
          partner_id: cost.partner_id,
          level: cost.level,
          base_amount: cost.base_amount,
          payable_amount: cost.payable_amount,
          tax_rate: cost.tax_rate
        }));

        const { error: insertError } = await supabase
          .from('logistics_partner_costs')
          .insert(costRecords);

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error generating partner costs:', error);
      // 不阻断主流程，只记录错误
    }
  }

  // 一次性修复现有运单的合作方成本（仅在开发期间使用）
  static async fixExistingRecordsPartnerCosts(): Promise<void> {
    try {
      // 先清除所有现有的合作方成本记录
      const { error: deleteError } = await supabase
        .from('logistics_partner_costs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // 删除所有记录

      if (deleteError) throw deleteError;
      console.log('已清除所有现有合作方成本记录');

      // 获取所有有运费的运单
      const { data: records, error } = await supabase
        .from('logistics_records')
        .select('id, current_cost, project_id, auto_number, loading_weight, unloading_weight')
        .not('current_cost', 'is', null)
        .gt('current_cost', 0);

      if (error) throw error;

      console.log(`找到 ${records?.length || 0} 条需要重新生成的记录`);

      for (const record of records || []) {
        // 重新生成合作方成本
        await this.generatePartnerCosts(
          record.id, 
          record.current_cost, 
          record.project_id,
          record.loading_weight,
          record.unloading_weight
        );
        console.log(`为运单 ${record.auto_number} 重新生成了合作方成本`);
      }

      console.log('修复完成 - 所有合作方成本已按正确公式重新计算');
    } catch (error) {
      console.error('修复现有记录时出错:', error);
    }
  }
}