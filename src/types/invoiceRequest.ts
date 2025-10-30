// 开票申请页面类型定义

export interface PartnerCost {
  partner_id: string;
  partner_name: string;
  level: number;
  payable_amount: number;
  invoice_status?: string;
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

export interface InvoiceFilters {
  waybillNumbers: string;
  driverName: string;
  licensePlate: string;
  driverPhone: string;
  projectId: string;
  partnerId: string;
  startDate: string;
  endDate: string;
  invoiceStatus: string;
  driverReceivable: string;
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

export interface InvoicePreviewData {
  sheets: InvoiceSheet[];
  processed_record_ids: string[];
}

export interface InvoiceSheet {
  invoicing_partner_id: string;
  invoicing_partner_full_name: string;
  invoicing_partner_tax_number: string;
  record_count: number;
  total_invoiceable: number;
  records: any[];
  partner_costs: PartnerCost[];
}

export interface FinalInvoiceData {
  sheets: InvoiceSheet[];
  all_record_ids: string[];
}

