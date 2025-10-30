// 付款申请页面类型定义

export interface PartnerCost {
  partner_id: string;
  partner_name: string;
  level: number;
  payable_amount: number;
  payment_status?: string;
  full_name?: string;
  bank_account?: string;
  bank_name?: string;
  branch_name?: string;
}

export interface LogisticsRecord {
  id: string;
  auto_number: string;
  project_name: string;
  project_id?: string;
  driver_id: string;
  driver_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  unloading_date: string | null;
  license_plate: string | null;
  driver_phone: string | null;
  payable_cost: number | null;
  partner_costs?: PartnerCost[];
  payment_status: 'Unpaid' | 'Processing' | 'Paid';
  invoice_status?: 'Uninvoiced' | 'Processing' | 'Invoiced' | null;
  cargo_type: string | null;
  loading_weight: number | null;
  unloading_weight: number | null;
  remarks: string | null;
  billing_type_id: number | null;
  current_cost?: number;
  extra_cost?: number;
  chain_name?: string | null;
  chain_id?: string | null;
}

export interface PaymentFilters {
  waybillNumbers: string;
  driverName: string;
  licensePlate: string;
  driverPhone: string;
  projectId: string;
  partnerId: string;
  startDate: string;
  endDate: string;
  paymentStatus: string;
  otherPlatformName: string;
}

export interface SelectionState {
  mode: 'none' | 'current_page' | 'all_filtered';
  selectedIds: Set<string>;
}

export interface PaginationState {
  currentPage: number;
  totalPages: number;
}

export interface Partner {
  id: string;
  name: string;
  level: number;
}

export interface PaymentPreviewData {
  sheets: PaymentSheet[];
  processed_record_ids: string[];
}

export interface PaymentSheet {
  paying_partner_id: string;
  paying_partner_full_name: string;
  paying_partner_bank_account: string;
  paying_partner_bank_name: string;
  paying_partner_branch_name: string;
  record_count: number;
  total_payable: number;
  records: any[];
}

export interface FinalPaymentData {
  sheets: PaymentSheet[];
  all_record_ids: string[];
}

