import { Project, Driver, Location, LogisticsRecord } from "@/types";

// 本地存储工具类
export class LocalStorage {
  // 项目相关
  static getProjects(): Project[] {
    const data = localStorage.getItem("logistics_projects");
    return data ? JSON.parse(data) : [];
  }

  static saveProjects(projects: Project[]): void {
    localStorage.setItem("logistics_projects", JSON.stringify(projects));
  }

  static addProject(project: Omit<Project, "id" | "createdAt">): Project {
    const projects = this.getProjects();
    const newProject: Project = {
      ...project,
      id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    projects.push(newProject);
    this.saveProjects(projects);
    return newProject;
  }

  static updateProject(id: string, updates: Partial<Project>): void {
    const projects = this.getProjects();
    const index = projects.findIndex(p => p.id === id);
    if (index !== -1) {
      projects[index] = { ...projects[index], ...updates };
      this.saveProjects(projects);
    }
  }

  static deleteProject(id: string): void {
    const projects = this.getProjects().filter(p => p.id !== id);
    this.saveProjects(projects);
  }

  // 司机相关
  static getDrivers(): Driver[] {
    const data = localStorage.getItem("logistics_drivers");
    return data ? JSON.parse(data) : [];
  }

  static saveDrivers(drivers: Driver[]): void {
    localStorage.setItem("logistics_drivers", JSON.stringify(drivers));
  }

  static addDriver(driver: Omit<Driver, "id" | "createdAt">): Driver {
    const drivers = this.getDrivers();
    const newDriver: Driver = {
      ...driver,
      id: `driver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    drivers.push(newDriver);
    this.saveDrivers(drivers);
    return newDriver;
  }

  static updateDriver(id: string, updates: Partial<Driver>): void {
    const drivers = this.getDrivers();
    const index = drivers.findIndex(d => d.id === id);
    if (index !== -1) {
      drivers[index] = { ...drivers[index], ...updates };
      this.saveDrivers(drivers);
    }
  }

  static deleteDriver(id: string): void {
    const drivers = this.getDrivers().filter(d => d.id !== id);
    this.saveDrivers(drivers);
  }

  // 地点相关
  static getLocations(): Location[] {
    const data = localStorage.getItem("logistics_locations");
    return data ? JSON.parse(data) : [];
  }

  static saveLocations(locations: Location[]): void {
    localStorage.setItem("logistics_locations", JSON.stringify(locations));
  }

  static addLocation(location: Omit<Location, "id" | "createdAt">): Location {
    const locations = this.getLocations();
    const newLocation: Location = {
      ...location,
      id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    locations.push(newLocation);
    this.saveLocations(locations);
    return newLocation;
  }

  static updateLocation(id: string, updates: Partial<Location>): void {
    const locations = this.getLocations();
    const index = locations.findIndex(l => l.id === id);
    if (index !== -1) {
      locations[index] = { ...locations[index], ...updates };
      this.saveLocations(locations);
    }
  }

  static deleteLocation(id: string): void {
    const locations = this.getLocations().filter(l => l.id !== id);
    this.saveLocations(locations);
  }

  // 物流记录相关
  static getLogisticsRecords(): LogisticsRecord[] {
    const data = localStorage.getItem("logistics_records");
    return data ? JSON.parse(data) : [];
  }

  static saveLogisticsRecords(records: LogisticsRecord[]): void {
    localStorage.setItem("logistics_records", JSON.stringify(records));
  }

  static addLogisticsRecord(record: Omit<LogisticsRecord, "id" | "autoNumber" | "createdAt">): LogisticsRecord {
    const records = this.getLogisticsRecords();
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const todayRecords = records.filter(r => r.autoNumber.startsWith(dateStr));
    const sequenceNumber = (todayRecords.length + 1).toString().padStart(3, "0");
    
    const newRecord: LogisticsRecord = {
      ...record,
      id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      autoNumber: `${dateStr}-${sequenceNumber}`,
      createdAt: new Date().toISOString(),
    };
    records.push(newRecord);
    this.saveLogisticsRecords(records);
    return newRecord;
  }

  static updateLogisticsRecord(id: string, updates: Partial<LogisticsRecord>): void {
    const records = this.getLogisticsRecords();
    const index = records.findIndex(r => r.id === id);
    if (index !== -1) {
      records[index] = { ...records[index], ...updates };
      this.saveLogisticsRecords(records);
    }
  }

  static deleteLogisticsRecord(id: string): void {
    const records = this.getLogisticsRecords().filter(r => r.id !== id);
    this.saveLogisticsRecords(records);
  }

  // 生成自动编号
  static generateAutoNumber(): string {
    const records = this.getLogisticsRecords();
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const todayRecords = records.filter(r => r.autoNumber.startsWith(dateStr));
    const sequenceNumber = (todayRecords.length + 1).toString().padStart(3, "0");
    return `${dateStr}-${sequenceNumber}`;
  }
}