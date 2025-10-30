// 项目相关页面类型定义
export interface Project {
  id: string;
  name: string;
  auto_code?: string;
  start_date?: string;
  end_date?: string | null;
  manager?: string | null;
  loading_address?: string | null;
  unloading_address?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Partner {
  id: string;
  name: string;
  full_name?: string;
  level?: number;
  partner_type?: string;
  contact_person?: string;
  contact_phone?: string;
  tax_number?: string;
  address?: string;
  bank_account?: string;
  bank_name?: string;
  created_at?: string;
}

export interface PartnerHierarchy {
  partner_id: string;
  parent_id?: string | null;
  level: number;
  partner_name?: string;
  parent_name?: string;
}

