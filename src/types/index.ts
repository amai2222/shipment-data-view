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
  projectStatus?: string;
  cargoType?: string;
  effectiveQuantityType?: string;
  createdAt: string;
}

// 司机数据类型
export interface Driver {
  id: string;
  name: string;
  licensePlate: string;
  phone: string;
  projectIds?: string[]; // 关联的项目ID数组
  id_card_photos?: string[]; // 身份证照片URL数组
  driver_license_photos?: string[]; // 驾驶证照片URL数组
  qualification_certificate_photos?: string[]; // 从业资格证照片URL数组
  driving_license_photos?: string[]; // 行驶证照片URL数组
  transport_license_photos?: string[]; // 道路运输许可证照片URL数组
  createdAt: string;
}

// 地点数据类型
export interface Location {
  id: string;
  name: string;
  projectIds?: string[]; // 关联的项目ID数组
  createdAt: string;
  // 地理编码相关字段
  address?: string;
  latitude?: number;
  longitude?: number;
  formatted_address?: string;
  province?: string;
  city?: string;
  district?: string;
  township?: string;
  street?: string;
  street_number?: string;
  adcode?: string;
  citycode?: string;
  geocoding_status?: 'pending' | 'success' | 'failed' | 'retry';
  geocoding_updated_at?: string;
  geocoding_error?: string;
}

// 平台运单信息数据类型
export interface PlatformTracking {
  platform: string; // 平台名称
  trackingNumbers: string[]; // 该平台的运单号列表
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
  taxNumber?: string; // 税号
  companyAddress?: string; // 公司地址
  taxRate: number;  // 默认税点
  partnerType?: '货主' | '合作商' | '资方' | '本公司'; // 合作方类型
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

// 外部跟踪号类型
export interface ExternalTrackingNumber {
  platform: string;
  tracking_number: string;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  remarks?: string;
}

// 平台选项类型
export interface PlatformOption {
  platform_code: string;
  primary_name: string;
  aliases: string[];
  description?: string;
  is_custom: boolean;
  sort_order: number;
}

// 用户权限相关类型
export type UserRole = "admin" | "finance" | "business" | "partner" | "operator" | "viewer";

export interface UserPermission {
  id: string;
  user_id: string;
  permission_key: string;
  permission_value: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserWithPermissions {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  permissions?: {
    menu: string[];
    function: string[];
    project: string[];
    data: string[];
  };
  phone?: string;
  work_wechat_userid?: string;
}

export interface RolePermissionTemplate {
  id: string;
  role_name: string;
  permission_key: string;
  permission_value: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
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