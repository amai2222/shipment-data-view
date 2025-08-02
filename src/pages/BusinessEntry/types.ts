// src/pages/BusinessEntry/types.ts

// 数据库原始记录类型
export interface LogisticsRecord {
  id: string;
  auto_number: string;
  project_id: string;
  project_name: string;
  chain_id: string | null;
  chain_name: string | null;
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
  license_plate: string | null;
  driver_phone: string | null;
  transport_type: string | null;
  extra_cost: number | null;
  remarks: string | null;
  created_at?: string;
}

// 下拉选项类型
export interface Project { id: string; name: string; start_date: string; }
export interface Driver { id: string; name: string; license_plate: string | null; phone: string | null; }
export interface Location { id: string; name: string; }
export interface PartnerChain { id: string; chain_name: string; }

// 表单数据专用类型，所有可输入字段都用 string | null 以匹配 input value
export type LogisticsFormData = {
  project_id: string;
  chain_id: string | null;
  driver_id: string;
  driver_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  unloading_date: string;
  loading_weight: string | null;
  unloading_weight: string | null;
  current_cost: string | null;
  license_plate: string | null;
  driver_phone: string | null;
  transport_type: string;
  extra_cost: string | null;
  payable_cost: string | null;
  remarks: string | null;
};

// 导入预览的类型
export interface ImportPreviewResult {
  new_records: { record: any }[];
  duplicate_records: { record: any }[];
  error_records: any[];
}
