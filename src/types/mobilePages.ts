// 移动端页面通用类型定义
export interface MobileListItem {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  amount?: number;
  date?: string;
  [key: string]: any;
}

export interface MobileCardData {
  id: string;
  header: string;
  content: any;
  footer?: string;
}

export interface MobileFilterState {
  searchTerm: string;
  status: string;
  dateRange: { from?: Date; to?: Date };
}

