// 开票申请页面工具函数
import { format } from 'date-fns';

// 金额格式化
export const formatCurrency = (value: number | null | undefined): string => {
  if (value == null) return '-';
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
};

// 日期格式化 - 中国时区
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const utcDateString = dateString.includes('T') ? dateString : dateString + 'T00:00:00Z';
    const utcDate = new Date(utcDateString);
    const chinaDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
    return format(chinaDate, 'yyyy/MM/dd');
  } catch (error) {
    console.error('日期格式化错误:', error);
    return dateString;
  }
};

// 路线简化
export const simplifyRoute = (loading?: string, unloading?: string): string => {
  const start = (loading || '').substring(0, 2);
  const end = (unloading || '').substring(0, 2);
  return `${start}→${end}`;
};

// 数量格式化
export const formatQuantity = (record: any): string => {
  const loading = record.loading_weight || 0;
  const unloading = record.unloading_weight || 0;
  
  if (loading && unloading) {
    return `${loading} / ${unloading}吨`;
  } else if (loading) {
    return `${loading} / - 吨`;
  } else if (unloading) {
    return `- / ${unloading}吨`;
  }
  return '- / - 吨';
};

// 计费单位
export const getBillingUnit = (record: any): string => {
  if (record.billing_type_id === 1) return '吨';
  if (record.billing_type_id === 2) return '趟';
  if (record.billing_type_id === 3) return '方';
  return '吨';
};

