/**
 * 统一日期处理工具
 * 解决时区不一致问题，确保前端显示的都是中国时间
 */

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 将数据库的UTC时间转换为中国时区的日期字符串
 * @param dateValue 数据库UTC时间值（可能是string、Date或null）
 * @param formatStr 格式化字符串，默认 'yyyy-MM-dd'
 * @returns 格式化后的中国时区日期字符串
 */
export function formatChinaDate(
  dateValue: string | Date | null | undefined, 
  formatStr: string = 'yyyy-MM-dd'
): string {
  if (!dateValue) return '';
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    
    // 数据库存储的是UTC时间，直接格式化即可（JavaScript会自动处理时区）
    // 或者显式转换为中国时区显示
    return format(date, formatStr, { locale: zhCN });
  } catch (error) {
    console.error('日期格式化错误:', error);
    return '';
  }
}

/**
 * 将中国时区的日期转换为UTC ISO字符串（用于发送到后端）
 * @param dateValue 中国时区的日期
 * @returns UTC ISO字符串，用于数据库存储
 */
export function toUTCISOString(dateValue: Date | string): string {
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    
    // 直接返回UTC时间（标准做法）
    return date.toISOString();
  } catch (error) {
    console.error('日期转换错误:', error);
    return '';
  }
}

/**
 * 获取中国时区的今天日期字符串
 * @param formatStr 格式化字符串，默认 'yyyy-MM-dd'
 * @returns 今天的中国时区日期字符串
 */
export function getChinaToday(formatStr: string = 'yyyy-MM-dd'): string {
  const now = new Date();
  const chinaNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return format(chinaNow, formatStr, { locale: zhCN });
}

/**
 * 解析Excel日期为中国时区日期字符串（用于验重比较）
 * @param dateValue Excel中的日期值
 * @returns 中国时区的日期字符串（YYYY-MM-DD格式）
 */
export function parseExcelDateToChina(dateValue: any): string {
  if (!dateValue) throw new Error('日期值为空');
  
  const dateStr = String(dateValue).trim();
  const currentYear = new Date().getFullYear();
  
  // 处理中文日期格式
  if (dateStr.includes('月') && dateStr.includes('日')) {
    const match = dateStr.match(/(\d{4})?年?(\d{1,2})月(\d{1,2})日/);
    if (match) {
      const year = match[1] ? parseInt(match[1]) : currentYear;
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      const date = new Date(year, month - 1, day);
      return format(date, 'yyyy-MM-dd');
    }
  }
  
  // 处理简化格式（如 5/20, 5-20, 5.20）
  const simpleMatch = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})$/);
  if (simpleMatch) {
    const month = parseInt(simpleMatch[1]);
    const day = parseInt(simpleMatch[2]);
    const date = new Date(currentYear, month - 1, day);
    return format(date, 'yyyy-MM-dd');
  }
  
  // 处理标准格式
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      throw new Error('无效的日期格式');
    }
    return format(date, 'yyyy-MM-dd');
  } catch (error) {
    throw new Error(`无法解析日期格式: ${dateStr}`);
  }
}

/**
 * 比较两个日期是否为同一天（忽略时区）
 * @param date1 第一个日期
 * @param date2 第二个日期
 * @returns 是否为同一天
 */
export function isSameDay(date1: string | Date, date2: string | Date): boolean {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  } catch (error) {
    return false;
  }
}

/**
 * 获取日期范围（中国时区）
 * @param days 天数
 * @returns 日期范围对象
 */
export function getChinaDateRange(days: number): { from: string; to: string } {
  const today = new Date();
  const fromDate = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  
  return {
    from: formatChinaDate(fromDate),
    to: formatChinaDate(today)
  };
}

/**
 * 验证日期格式是否正确
 * @param dateStr 日期字符串
 * @returns 是否为有效日期
 */
export function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  
  try {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  } catch (error) {
    return false;
  }
}
