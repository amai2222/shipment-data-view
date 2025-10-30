// 审核页面通用格式化工具
import { format } from 'date-fns';

export const formatCurrency = (value: number | null | undefined): string => {
  if (value == null) return '-';
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
};

export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'yyyy/MM/dd HH:mm');
  } catch {
    return '-';
  }
};

export const formatDateShort = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'yyyy/MM/dd');
  } catch {
    return '-';
  }
};

