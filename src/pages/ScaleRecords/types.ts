export interface Project {
  id: string;
  name: string;
}

export interface Driver {
  id: string;
  name: string;
  license_plate: string;
}

export interface BillingType {
  billing_type_id: number;
  type_name: string;
  type_code?: string;
}

export interface ScaleRecord {
  id: string;
  project_id: string;
  project_name: string;
  loading_date: string;
  trip_number: number;
  valid_quantity: number | null;
  billing_type_id: number;
  image_urls: string[];
  license_plate: string | null;
  driver_name: string | null;
  created_at: string;
  logistics_number: string | null;
}

export interface FilterState {
  projectId: string;
  startDate: string;
  endDate: string;
  licensePlate: string;
}

export interface WaybillDetail {
  id: string;
  auto_number: string;
  project_name: string;
  driver_name: string;
  license_plate: string | null;
  driver_phone: string | null;
  transport_type: string;
  loading_location: string;
  unloading_location: string;
  loading_weight: number | null;
  unloading_weight: number | null;
  current_cost: number | null;
  extra_cost: number | null;
  payable_cost: number | null;
  loading_date: string;
  unloading_date: string;
  remarks: string | null;
  partner_chains?: {
    chain_name: string;
  };
  projects?: {
    name: string;
  };
}

export interface NamingParams {
  date: string;
  licensePlate: string;
  tripNumber: number;
  projectName: string;
}

export interface ScaleRecordFormData {
  projectId: string;
  loadingDate: string;
  licensePlate: string;
  tripNumber: number;
  validQuantity: string;
  billingTypeId: string;
}
