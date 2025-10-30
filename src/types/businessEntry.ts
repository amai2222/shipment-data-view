// 正确路径: src/pages/BusinessEntry/types.ts

// 平台运单信息数据类型
export interface PlatformTracking {
  platform: string; // 平台名称
  trackingNumbers: string[]; // 该平台的运单号列表
}

// 数据库原始记录类型
export interface LogisticsRecord {
  id: string;
  auto_number: string;
  project_id: string;
  project_name: string;
  chain_id: string | null;
  chain_name: string | null;
  billing_type_id: number; // 新增billing_type_id字段
  driver_id: string;
  driver_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  unloading_date: string | null;
  loading_weight: number | null;
  unloading_weight: number | null;
  current_cost: number | null;
  payable_cost: number | null;  // 司机应收金额
  license_plate: string | null;
  driver_phone: string | null;
  transport_type: string | null;
  extra_cost: number | null;
  remarks: string | null;
  loading_weighbridge_image_url?: string | null; // 装货磅单图片URL
  unloading_weighbridge_image_url?: string | null; // 卸货磅单图片URL
  external_tracking_numbers?: string[]; // 外部运单号数组
  other_platform_names?: string[]; // 其他平台名称数组
  created_at?: string;
}

// [核心移除] - LogisticsFormData 类型已不再需要
// export type LogisticsFormData = { ... };

// 根据您提供的完整结构图，更新 Project 类型
export interface Project {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  manager: string | null;
  loading_address: string | null;
  unloading_address: string | null;
  project_status: string | null;
}

// 其他类型保持不变
export interface Driver { id: string; name: string; license_plate: string | null; phone: string | null; }
export interface Location { id: string; name: string; }
export interface PartnerChain { id: string; project_id: string; chain_name: string; }

// 更新合作方类型，添加新字段
export interface Partner {
  id: string;
  name: string;
  full_name?: string; // 合作方全名
  bank_account?: string; // 银行账户
  bank_name?: string; // 开户行名称
  branch_name?: string; // 支行网点
  tax_rate: number;
  created_at: string;
}

// 分页状态类型
export interface PaginationState {
  page: number;
  size: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
}

// 导入预览的类型
export interface ImportPreviewResult {
  new_records: { record: LogisticsRecord }[];
  duplicate_records: { record: LogisticsRecord; existing_record_id?: string; existing_auto_number?: string }[];
  error_records: { record: LogisticsRecord; error: string }[];
}

// 导入失败详情（用于日志展示）
export interface ImportFailure {
  row_index: number;
  excel_row?: number;  // Excel行号（从1开始）
  data: LogisticsRecord;
  error: string;
  field_errors?: Record<string, {
    value: string;
    is_valid: boolean;
    converted_value?: number;
  }>;
  project_name?: string;
  driver_name?: string;
  license_plate?: string;
}

// BusinessEntry筛选器类型
export interface LogisticsFilters {
  startDate: string;
  endDate: string;
  projectName: string;
  driverName: string;
  licensePlate: string;
  driverPhone: string;
  otherPlatformName: string;
  waybillNumbers: string;
  hasScaleRecord: string;
}

// 分页状态类型
export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
}

// 从useLogisticsData.ts提取的筛选器类型
export interface LogisticsFilters {
  startDate: string;
  endDate: string;
  projectName: string;
  driverName: string;
  licensePlate: string;
  driverPhone: string;
  otherPlatformName: string;
  waybillNumbers: string;
  hasScaleRecord: string;
}

// 从useLogisticsData.ts提取的分页状态类型
export interface PaginationState {
  currentPage: number;
  totalPages: number;
}

// 从useAllFilteredRecords.ts提取的结果类型
export interface AllFilteredRecordsResult {
  recordIds: string[];
  totalCount: number;
  summary: {
    projectNames: string[];
    driverNames: string[];
    dateRange: {
      earliest: string;
      latest: string;
    };
  };
}

// 运单筛选条件类型
export interface LogisticsFilters {
  startDate: string;
  endDate: string;
  projectName: string;
  driverName: string;
  licensePlate: string;
  driverPhone: string;
  otherPlatformName: string;
  waybillNumbers: string;
  hasScaleRecord: string;
}