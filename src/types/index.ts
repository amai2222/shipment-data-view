export interface Driver {
  id: string;
  name: string;
  license_plate: string;
  phone: string;
  user_id?: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  user_id?: string;
  created_at: string;
  auto_code?: string;
  billing_type_id?: number;
  effective_quantity_type?: string;
}

export interface LogisticsRecord {
  id: string;
  auto_number: string;
  project_id: string;
  project_name: string;
  chain_id?: string;
  driver_id: string;
  driver_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  unloading_date?: string;
  loading_weight?: number;
  unloading_weight?: number;
  current_cost?: number;
  extra_cost?: number;
  payable_cost?: number;
  license_plate: string;
  driver_phone: string;
  transport_type: string;
  remarks?: string;
  created_by_user_id: string;
  user_id?: string;
  driver_payable_cost?: number;
  billing_type_id?: number;
  payment_status?: string;
  cargo_type?: string;
  external_tracking_numbers?: string[];
  other_platform_names?: string[];
  loading_location_ids?: string[];
  unloading_location_ids?: string[];
  created_at: string;
}

export interface Partner {
  id: string;
  name: string;
  full_name?: string;
  tax_rate: number;
  user_id?: string;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  user_id?: string;
  created_at: string;
}

export interface PartnerChain {
  id: string;
  project_id: string;
  chain_name: string;
  description?: string;
  billing_type_id?: number;
  is_default: boolean;
  user_id: string;
  created_at: string;
}

export interface BillingType {
  billing_type_id: number;
  type_code?: string;
  type_name?: string;
  user_id?: string;
  created_at?: string;
}

export interface LogisticsPartnerCost {
  id: string;
  logistics_record_id: string;
  partner_id: string;
  level: number;
  base_amount: number;
  payable_amount: number;
  tax_rate: number;
  user_id: string;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  logistics_record_id: string;
  partner_id: string;
  payment_amount: number;
  payment_date: string;
  bank_receipt_number?: string;
  payment_image_urls?: string[];
  remarks?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceRecord {
  id: string;
  logistics_record_id: string;
  partner_id: string;
  invoice_amount: number;
  invoice_date: string;
  invoice_number?: string;
  invoice_image_urls?: string[];
  remarks?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentRequest {
  id: string;
  request_id: string;
  user_id: string;
  record_count: number;
  status: string;
  notes?: string;
  logistics_record_ids?: string[];
  approval_result?: any;
  work_wechat_sp_no?: string;
  created_by?: string;
  created_at: string;
}

export interface PartnerPaymentRequest {
  id: string;
  request_id: string;
  request_date: string;
  total_records: number;
  total_amount: number;
  status: string;
  user_id?: string;
  created_at: string;
}

export interface PartnerPaymentItem {
  payment_request_id: string;
  logistics_record_id: string;
  user_id?: string;
}

export interface PartnerBankDetail {
  partner_id: string;
  bank_name?: string;
  bank_account?: string;
  branch_name?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DriverProject {
  id: string;
  driver_id: string;
  project_id: string;
  user_id: string;
  created_at: string;
}

export interface LocationProject {
  id: string;
  location_id: string;
  project_id: string;
  user_id: string;
  created_at: string;
}

// External tracking number structure for data interchange
export interface ExternalTrackingNumber {
  platform: string;
  trackingNumber?: string;
  waybillId?: string;
  customData?: Record<string, any>;
  id?: string;
  platformCode?: string;
  numbers?: string[];
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

// 运单指纹，用于重复检测
export interface WaybillFingerprint {
  project_name_check: string;
  driver_name_check: string;
  license_plate_check: string;
  loading_location_check: string;
  unloading_location_check: string;
  loading_date_check: string;
  loading_weight_check: number;
}

// 导入结果
export interface ImportResult {
  success_count: number;
  error_count: number;
  insert_count: number;
  update_count: number;
  inserted_ids: string[];
  updated_ids: string[];
  error_details: any[];
}

// 平台选项
export interface PlatformOption {
  id: string;
  name: string;
  code?: string;
}

// 导入模板
export interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  platform_name: string;
  platform_type: string;
  field_mappings: any;
  template_config: any;
  is_system: boolean;
  is_active: boolean;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}