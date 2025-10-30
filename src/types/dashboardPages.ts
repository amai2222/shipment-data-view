// 仪表盘/看板页面类型定义
export interface DashboardStats {
  total_records?: number;
  total_amount?: number;
  pending_count?: number;
  completed_count?: number;
  [key: string]: any;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string[];
  }[];
}

export interface OverviewData {
  period: string;
  value: number;
  trend?: 'up' | 'down' | 'stable';
}

