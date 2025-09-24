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

// 外部跟踪号数据类型
export interface ExternalTrackingNumber {
  platform: string;
  tracking_number: string;
  status?: 'pending' | 'in_transit' | 'delivered' | 'failed' | 'completed' | 'cancelled';
  remarks?: string;
  created_at?: string;
}

// 物流记录数据类型
export interface LogisticsRecord {
  id: string;
  auto_number: string;
  project_id: string;
  project_name: string;
  chain_id?: string; // 合作链路ID
  loading_date: string;
  loading_location: string;
  unloading_location: string;
  driver_id: string;
  driver_name: string;
  license_plate: string;
  driver_phone: string;
  loading_weight: number;
  unloading_date?: string;
  unloading_weight?: number;
  transport_type: "实际运输" | "退货";
  current_cost?: number;
  extra_cost?: number;
  payable_cost?: number;
  driver_payable_cost?: number;
  remarks?: string;
  created_at: string;
  created_by_user_id: string;
  billing_type_id?: number;
  payment_status?: 'Unpaid' | 'Processing' | 'Paid';
  cargo_type?: string;
  loading_location_ids?: string[];
  unloading_location_ids?: string[];
  external_tracking_numbers?: PlatformTracking[]; // 其他平台运单号码
  other_platform_names?: string[]; // 其他平台名称
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