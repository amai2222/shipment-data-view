// 项目数据类型
export interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  manager: string;
  createdAt: string;
}

// 司机数据类型
export interface Driver {
  id: string;
  name: string;
  licensePlate: string;
  phone: string;
  createdAt: string;
}

// 地点数据类型
export interface Location {
  id: string;
  name: string;
  createdAt: string;
}

// 物流记录数据类型
export interface LogisticsRecord {
  id: string;
  autoNumber: string;
  projectId: string;
  projectName: string;
  loadingTime: string;
  loadingLocation: string;
  unloadingLocation: string;
  driverId: string;
  driverName: string;
  licensePlate: string;
  driverPhone: string;
  loadingWeight: number;
  unloadingDate?: string;
  unloadingWeight?: number;
  transportType: "实际运输" | "退货";
  currentCost?: number;
  extraCost?: number;
  payableCost?: number;
  remarks?: string;
  createdAt: string;
  createdByUserId: string;
}

// 统计数据类型
export interface DailyTransportStats {
  date: string;
  actualTransport: number;
  returns: number;
}

export interface DailyCostStats {
  date: string;
  totalCost: number;
}