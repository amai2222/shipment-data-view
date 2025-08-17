// 最终文件路径: src/pages/BusinessEntry/types.ts

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
  payable_cost: number | null;
  driver_payable_cost: number | null;
  license_plate: string | null;
  driver_phone: string | null;
  transport_type: string | null;
  extra_cost: number | null;
  remarks: string | null;
  created_at?: string;
}

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

// ★★★ 修改后的导入预览类型 ★★★
// 描述: 此类型已更新以支持新的V2导入流程。
//       - `duplicate_records` 现在包含 `existing_record` 字段，用于在UI中进行并排比较。
//       - `error_records` 的类型更加具体，以提供更好的开发体验。
export interface ImportPreviewResult {
  new_records: { record: any }[];
  duplicate_records: {
    record: any; // 来自Excel的新记录
    existing_record: any; // 数据库中匹配到的现有记录
  }[];
  error_records: {
    record: any; // 导致错误的原始记录
    error: string; // 错误信息
  }[];
}

// 导入失败详情（用于最终导入后的日志展示）
export interface ImportFailure {
  row_index: number;
  data: any;
  error: string;
}
