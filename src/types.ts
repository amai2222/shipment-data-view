// FILE: /src/types.ts

// 用于表格展示和编辑，包含了关联表的名称
export interface BusinessData {
  id: string;
  date: string;
  projects_id: string;
  projects_name: string;
  drivers_id: string;
  drivers_name: string;
  loading_location_id: string;
  loading_location_name: string;
  unloading_location_id: string;
  unloading_location_name: string;
  goods_name: string;
  freight_cost: number;
  unit_price: number;
}

// 用于向 Supabase 插入或更新数据，只包含 ID
export interface BusinessDataInsert {
  id?: string;
  date: string;
  project_id: string;
  driver_id: string;
  loading_location_id: string;
  unloading_location_id: string;
  goods_name: string;
  freight_cost: number;
  unit_price: number;
}
