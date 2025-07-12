// 项目数据类型
export interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  manager: string;
  loadingAddress: string;
  unloadingAddress: string;
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
  loadingDate: string;
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
  currentFee?: number;
  extraFee?: number;
  payableFee?: number;
  remarks?: string;
  createdAt: string;
  createdByUserId: string;
}

// 合作方数据类型
export interface Partner {
  id: string;
  name: string;
  level: number;
  taxRate: number;
  createdAt: string;
}

// 项目合作方关联
export interface ProjectPartner {
  id: string;
  projectId: string;
  partnerId: string;
  level: number;
  createdAt: string;
}

// 物流记录合作方费用
export interface LogisticsPartnerCost {
  id: string;
  logisticsRecordId: string;
  partnerId: string;
  level: number;
  baseAmount: number;
  payableAmount: number;
  taxRate: number;
  createdAt: string;
}

// 合作方费用计算结果
export interface PartnerCostCalculation {
  partnerId: string;
  partnerName: string;
  level: number;
  baseAmount: number;
  payableAmount: number;
  taxRate: number;
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