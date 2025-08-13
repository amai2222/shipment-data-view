import { LocalStorage } from './storage';
import { SupabaseStorage } from './supabase';

export class DataMigration {
  // 迁移所有数据到Supabase
  static async migrateAllData() {
    
    try {
      console.log('开始数据迁移...');

      // 1. 迁移地点数据
      const localLocations = LocalStorage.getLocations();
      console.log('Migrating locations:', localLocations.length);
      
      for (const location of localLocations) {
        try {
          await SupabaseStorage.addLocation({
            name: location.name,
          });
        } catch (error) {
          console.warn('Location already exists:', location.name);
        }
      }

      // 2. 迁移司机数据
      const localDrivers = LocalStorage.getDrivers();
      console.log('Migrating drivers:', localDrivers.length);
      
      for (const driver of localDrivers) {
        try {
          await SupabaseStorage.addDriver({
            name: driver.name,
            licensePlate: driver.licensePlate,
            phone: driver.phone,
          });
        } catch (error) {
          console.warn('Driver already exists:', driver.name);
        }
      }

      // 3. 迁移项目数据
      const localProjects = LocalStorage.getProjects();
      console.log('Migrating projects:', localProjects.length);
      
      for (const project of localProjects) {
        try {
          await SupabaseStorage.addProject({
            name: project.name,
            startDate: project.startDate,
            endDate: project.endDate,
            manager: project.manager,
            loadingAddress: project.loadingAddress,
            unloadingAddress: project.unloadingAddress,
          });
        } catch (error) {
          console.warn('Project already exists:', project.name);
        }
      }

      // 4. 迁移物流记录（最复杂，需要重新关联）
      const localRecords = LocalStorage.getLogisticsRecords();
      console.log('Migrating logistics records:', localRecords.length);
      
      // 获取Supabase中的项目和司机数据来进行关联
      const supabaseProjects = await SupabaseStorage.getProjects();
      const supabaseDrivers = await SupabaseStorage.getDrivers();
      
      for (const record of localRecords) {
        try {
          // 通过名称找到对应的项目和司机
          const project = supabaseProjects.find(p => p.name === record.projectName);
          const driver = supabaseDrivers.find(d => d.name === record.driverName);
          
          if (project && driver) {
            await SupabaseStorage.addLogisticsRecord({
              projectId: project.id,
              projectName: record.projectName,
              loadingDate: record.loadingDate,
              loadingLocation: record.loadingLocation,
              unloadingLocation: record.unloadingLocation,
              driverId: driver.id,
              driverName: record.driverName,
              licensePlate: record.licensePlate,
              driverPhone: record.driverPhone,
              loadingWeight: record.loadingWeight,
              unloadingDate: record.unloadingDate,
              unloadingWeight: record.unloadingWeight,
              transportType: record.transportType,
              currentFee: record.currentFee,
              extraFee: record.extraFee,
              payableFee: record.payableFee,
              remarks: record.remarks,
              createdByUserId: 'migrated-user', // 迁移用户标识
            });
          } else {
            console.warn('Could not find project or driver for record:', record.autoNumber);
          }
        } catch (error) {
          console.warn('Record already exists:', record.autoNumber);
        }
      }

      console.log('数据迁移完成！');
      return true;
    } catch (error) {
      console.error('Migration error:', error);
      return false;
    }
  }

  // 检查数据迁移状态
  static async checkMigrationStatus() {
    try {
      const supabaseRecords = await SupabaseStorage.getFilteredLogisticsRecordsFixed();
      const localRecords = LocalStorage.getLogisticsRecords();
      
      return {
        supabaseCount: supabaseRecords.records.length,
        localCount: localRecords.length,
        isMigrated: supabaseRecords.records.length > 0,
      };
    } catch (error) {
      console.error('Error checking migration status:', error);
      return {
        supabaseCount: 0,
        localCount: LocalStorage.getLogisticsRecords().length,
        isMigrated: false,
      };
    }
  }
}