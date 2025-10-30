// 管理页面通用类型定义

export interface BaseRecord {
  id: string;
  created_at?: string;
  updated_at?: string;
}

export interface Driver extends BaseRecord {
  name: string;
  phone?: string;
  license_plate?: string;
  id_number?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  bank_account?: string;
  photo_url?: string;
}

export interface Location extends BaseRecord {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  contact_person?: string;
  contact_phone?: string;
}

export interface Contract extends BaseRecord {
  contract_number: string;
  title: string;
  party_a?: string;
  party_b?: string;
  start_date?: string;
  end_date?: string;
  amount?: number;
  status?: string;
  file_url?: string;
}

export interface FormDialogState {
  open: boolean;
  mode: 'create' | 'edit';
  data: any | null;
}

