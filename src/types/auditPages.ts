// 审核页面通用类型定义

export interface ApprovalRequest {
  id: string;
  created_at: string;
  request_number?: string;
  request_id?: string;
  status: string;
  remarks?: string | null;
  notes?: string | null;
  record_count: number;
  total_amount?: number;
  max_amount?: number;
  logistics_record_ids?: string[];
}

export interface SelectionState {
  mode: 'none' | 'all_filtered';
  selectedIds: Set<string>;
}

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

export interface FilterState {
  requestNumber?: string;
  requestId?: string;
  waybillNumber?: string;
  driverName?: string;
  loadingDate?: Date | null;
  status?: string;
  projectId?: string;
  partnerName?: string;
  licensePlate?: string;
  phoneNumber?: string;
  platformName?: string;
}

