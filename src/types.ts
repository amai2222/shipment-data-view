// 新建文件：src/types.ts

// 根据 ER 图和新需求，定义最核心的运单记录类型
export interface LogisticsRecord {
  id: string; // uuid
  project_name: string;
  loading_date: string; // timestamptz -> string
  loading_location: string;
  unloading_location: string;
  license_plate: string; // 新增显示字段
  driver_name: string; // 新增显示字段
  driver_phone: string; // 新增显示字段
  transport_type: string; // 新增显示字段
  payable_cost: number;
  created_at: string; // timestamptz -> string
  // ... 其他可能需要的字段
}

// 定义项目类型（用于筛选器）
export interface Project {
  id: string;
  name: string;
}

// 定义司机类型（用于筛选器）
export interface Driver {
  id: string;
  name: string;
}

// 定义地点类型（用于筛选器）
export interface Location {
  id: string;
  name: string;
}
