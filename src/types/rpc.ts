// RPC函数类型定义
export interface LogisticsSummaryAndRecordsParams {
  p_start_date?: string | null;
  p_end_date?: string | null;
  p_project_name?: string | null;
  p_driver_name?: string | null;
  p_license_plate?: string | null;
  p_driver_phone?: string | null;
  p_page_number?: number;
  p_page_size?: number;
  p_sort_field?: string;
  p_sort_direction?: string;
}

export interface LogisticsRecord {
  id: string;
  auto_number: string;
  project_id: string;
  project_name: string;
  chain_id: string;
  chain_name: string;
  billing_type_id: number;
  driver_id: string;
  driver_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  unloading_date: string;
  loading_weight: number;
  unloading_weight: number;
  current_cost: number;
  payable_cost: number;
  driver_payable_cost: number;
  license_plate: string;
  driver_phone: string;
  transport_type: string;
  extra_cost: number;
  remarks: string;
  external_tracking_numbers?: string[];
  other_platform_names?: string[];
  payment_status?: string;
  created_at: string;
}

export interface LogisticsSummary {
  totalCurrentCost: number;
  totalExtraCost: number;
  totalDriverPayableCost: number;
  actualCount: number;
  returnCount: number;
  totalWeightLoading: number;
  totalWeightUnloading: number;
  totalTripsLoading: number;
  totalVolumeLoading: number;
  totalVolumeUnloading: number;
}

export interface LogisticsSummaryAndRecordsResponse {
  records: LogisticsRecord[];
  summary: LogisticsSummary;
  totalCount: number;
}

// 分页信息类型
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
}

// 合同类型
export interface Contract {
  id: string;
  contract_number: string | null;
  contract_name: string;
  counterparty_company: string;
  category: '行政合同' | '内部合同' | '业务合同';
  contract_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'expired' | 'terminated';
  attachment_url: string | null;
  contract_original_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string;
  access_count: number;
}
