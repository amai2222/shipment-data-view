// 项目数据类型
export interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  manager: string;
  loadingAddress: string;
  unloadingAddress: string;
  autoCode?: string;
  plannedTotalTons?: number;
  financeManager?: string;
  createdAt: string;
}

// 司机数据类型
export interface Driver {
  id: string;
  name: string;
  licensePlate: string;
  phone: string;
  projectIds?: string[]; // 关联的项目ID数组
  createdAt: string;
}

// 地点数据类型
export interface Location {
  id: string;
  name: string;
  projectIds?: string[]; // 关联的项目ID数组
  createdAt: string;
}

// 平台运单信息数据类型
export interface PlatformTracking {
  platform: string; // 平台名称
  trackingNumbers: string[]; // 该平台的运单号列表
}

// 物流记录数据类型
export interface LogisticsRecord {
  id: string;
  autoNumber: string;
  projectId: string;
  projectName: string;
  chainId?: string; // 合作链路ID
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
  billing_type_id?: number;
  platform_trackings?: PlatformTracking[]; // 其他平台运单信息
}

// 合作方数据类型
export interface Partner {
  id: string;
  name: string;
  fullName?: string; // 合作方全名
  bankAccount?: string; // 银行账户
  bankName?: string; // 开户行名称
  branchName?: string; // 支行网点
  taxRate: number;  // 默认税点
  createdAt: string;
}

// 合作链路配置
export interface PartnerChain {
  id: string;
  projectId: string;
  chainName: string;
  description?: string;
  isDefault: boolean;
  createdAt: string;
}

// 项目合作方关联
export interface ProjectPartner {
  id: string;
  projectId: string;
  partnerId: string;
  chainId: string;
  level: number;
  taxRate: number;  // 项目特定税点
  calculationMethod: "tax" | "profit";  // 计算方法：税点或利润
  profitRate?: number;  // 利润率（仅当计算方法为利润时使用）
  createdAt: string;
  partnerName?: string;
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