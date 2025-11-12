/**
 * 统一日期处理工具
 * 解决时区不一致问题，确保前端显示的都是中国时间
 */

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 将中国时区的日期转换为 UTC 日期（用于数据库筛选）
 * 例如：前端选择 2025-11-10（中国时间）
 * 中国时间 2025-11-10 00:00:00+08 = UTC 2025-11-09 16:00:00+00
 * 所以应该传递 UTC 日期 2025-11-09 给后端
 * @param date 用户选择的中国时区日期
 * @returns UTC 日期字符串（YYYY-MM-DD格式）
 */
export function convertChinaDateToUTCDate(date: Date): string {
  // 获取用户选择的日期（年、月、日）
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // 创建中国时区的日期字符串并解析（明确指定 +08:00 时区）
  // 例如：'2025-11-10T00:00:00+08:00' 会被解析为 UTC 时间 2025-11-09 16:00:00
  const chinaDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+08:00`;
  const chinaDate = new Date(chinaDateStr);
  
  // 返回 UTC 日期字符串（YYYY-MM-DD）
  // 由于 Date 对象内部存储的是 UTC 时间戳，toISOString() 会返回 UTC 时间
  return chinaDate.toISOString().split('T')[0];
}

/**
 * 将中国时区的结束日期转换为 UTC 日期（用于数据库筛选，包含结束日当天的所有数据）
 * 例如：前端选择 2025-10-06（中国时间）作为结束日期
 * 需要包含 2025-10-06 当天的所有数据，所以传递 UTC 日期 2025-10-07 给后端
 * 后端使用 <= 比较时，就能包含 2025-10-06 当天的所有数据
 * @param date 用户选择的中国时区结束日期
 * @returns UTC 日期字符串（YYYY-MM-DD格式），已加1天
 */
export function convertChinaEndDateToUTCDate(date: Date): string {
  // ✅ 正确的逻辑：
  // 1. 用户选择中国时间 2025-10-06 作为结束日期
  // 2. 中国时间 2025-10-06 23:59:59+08:00 = UTC 2025-10-06 15:59:59+00:00
  // 3. 后端使用 `loading_date <= '2025-10-06'::date` 时：
  //    - 在 UTC 会话中，'2025-10-06'::date = 2025-10-06 00:00:00+00:00
  //    - 比较：loading_date <= 2025-10-06 00:00:00+00:00
  //    - 这会排除 UTC 2025-10-06 00:00:01 及以后的数据
  //    - 即排除中国时间 2025-10-06 08:00:01 到 23:59:59 的数据 ❌
  // 4. 所以我们需要传递 "2025-10-07"，让后端使用 `<= '2025-10-07'::date`
  //    - 比较：loading_date <= 2025-10-07 00:00:00+00:00
  //    - 这会包含 UTC 2025-10-06 15:59:59（中国时间 2025-10-06 23:59:59）
  //    - 即包含中国时间 2025-10-06 的所有数据 ✓
  
  // 获取用户选择的日期（年、月、日）
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // 在本地时区（中国时区）加1天
  const nextDayDate = new Date(year, month, day + 1);
  const nextYear = nextDayDate.getFullYear();
  const nextMonth = nextDayDate.getMonth();
  const nextDay = nextDayDate.getDate();
  
  // 返回加1天后的日期字符串（作为UTC日期传递给后端）
  // 例如：中国时间 2025-10-06 -> 加1天 -> 2025-10-07 -> 返回 "2025-10-07"
  // 后端使用 `loading_date <= '2025-10-07'::date` 时，会包含中国时间 2025-10-06 的所有数据
  return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
}

/**
 * 将单日查询转换为日期范围（用于单日筛选）
 * 例如：用户选择 2025-11-10（中国时间）作为单日查询
 * 需要查询这一天的所有数据，所以转换为日期范围：开始日期=2025-11-09（UTC），结束日期=2025-11-11（UTC，加1天）
 * @param date 用户选择的中国时区单日
 * @returns 包含 startDate 和 endDate 的对象（UTC 日期字符串）
 */
export function convertSingleDateToDateRange(date: Date): { startDate: string; endDate: string } {
  // 获取用户选择的日期（年、月、日）
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // 创建中国时区的日期字符串并解析（明确指定 +08:00 时区）
  const chinaDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+08:00`;
  const chinaDate = new Date(chinaDateStr);
  
  // 开始日期：转换为 UTC 日期
  const startDate = chinaDate.toISOString().split('T')[0];
  
  // 结束日期：加1天，确保包含当天的所有数据
  const nextDay = new Date(chinaDate);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const endDate = nextDay.toISOString().split('T')[0];
  
  return { startDate, endDate };
}

/**
 * 将 UTC 日期字符串转换为中国时区的 Date 对象（用于显示）
 * 例如：UTC 日期 "2025-11-01" 转换为中国时区的 Date 对象，显示为 2025-11-02
 * @param utcDateStr UTC 日期字符串（YYYY-MM-DD格式）
 * @returns 中国时区的 Date 对象
 */
export function convertUTCDateToChinaDate(utcDateStr: string): Date {
  if (!utcDateStr) {
    return new Date();
  }
  
  // 将 UTC 日期字符串解析为 UTC 时间
  // 例如："2025-11-01" -> "2025-11-01T00:00:00.000Z"
  const utcDate = new Date(utcDateStr + 'T00:00:00.000Z');
  
  // 转换为中国时区（加8小时）
  const chinaTime = utcDate.getTime() + 8 * 60 * 60 * 1000;
  const chinaDate = new Date(chinaTime);
  
  // 返回一个代表中国时区日期的 Date 对象
  // 使用本地时区的年、月、日来创建新的 Date 对象
  return new Date(chinaDate.getUTCFullYear(), chinaDate.getUTCMonth(), chinaDate.getUTCDate());
}

/**
 * 格式化中国时区的日期为字符串（用于显示）
 * @param date Date 对象（代表中国时区的日期）
 * @returns 日期字符串（YYYY-MM-DD格式）
 */
export function formatChinaDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 将数据库的UTC时间转换为中国时区的日期字符串（用于前端显示）
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
 * 将数据库的UTC时间转换为中国时区的日期字符串（用于导出Excel/CSV）
 * 确保导出的日期显示为中国时区
 * @param dateValue 数据库UTC时间值（可能是string、Date或null）
 * @param formatStr 格式化字符串，默认 'yyyy-MM-dd'
 * @returns 格式化后的中国时区日期字符串
 */
export function formatChinaDateForExport(
  dateValue: string | Date | null | undefined,
  formatStr: string = 'yyyy-MM-dd'
): string {
  if (!dateValue) return '';
  
  try {
    // 处理Date对象
    let date: Date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      // 如果是ISO格式（包含T），解析为UTC时间
      if (dateValue.includes('T')) {
        date = new Date(dateValue);
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        // 纯日期字符串，假设是UTC日期（数据库返回的timestamptz格式化后可能是这样）
        // 转换为UTC时间：'2025-11-02' -> '2025-11-02T00:00:00.000Z'
        date = new Date(dateValue + 'T00:00:00.000Z');
      } else {
        // 其他格式，尝试直接解析
        date = new Date(dateValue);
      }
    } else {
      return '';
    }
    
    if (isNaN(date.getTime())) return '';
    
    // 将UTC时间转换为中国时区（加8小时）
    const chinaDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    
    // 根据格式字符串格式化
    if (formatStr.includes('HH:mm:ss') || formatStr.includes('HH:mm')) {
      // 包含时间的格式
      const year = chinaDate.getUTCFullYear();
      const month = String(chinaDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(chinaDate.getUTCDate()).padStart(2, '0');
      const hours = String(chinaDate.getUTCHours()).padStart(2, '0');
      const minutes = String(chinaDate.getUTCMinutes()).padStart(2, '0');
      const seconds = String(chinaDate.getUTCSeconds()).padStart(2, '0');
      
      if (formatStr.includes('HH:mm:ss')) {
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      } else {
        return `${year}-${month}-${day} ${hours}:${minutes}`;
      }
    } else {
      // 只包含日期的格式，使用date-fns格式化
      return format(chinaDate, formatStr, { locale: zhCN });
    }
  } catch (error) {
    console.error('导出日期格式化错误:', error);
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
export function parseExcelDateToChina(dateValue: unknown): string {
  if (!dateValue) throw new Error('日期值为空');
  
  // 如果已经是Date对象，直接处理
  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) {
      throw new Error('无效的日期对象');
    }
    return format(dateValue, 'yyyy-MM-dd');
  }
  
  // 如果是数字（Excel日期序列号），转换为Date对象
  if (typeof dateValue === 'number') {
    // Excel日期序列号：1900年1月1日为1
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (dateValue - 2) * 24 * 60 * 60 * 1000);
    if (isNaN(date.getTime())) {
      throw new Error('无效的Excel日期序列号');
    }
    return format(date, 'yyyy-MM-dd');
  }
  
  const dateStr = String(dateValue).trim();
  const currentYear = new Date().getFullYear();
  
  // 处理中文日期格式（如：2025年9月9日、9月9日）
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
  
  // 处理标准格式（如：2025/9/9, 2025-09-09, 2025.9.9）
  const standardMatch = dateStr.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (standardMatch) {
    const year = parseInt(standardMatch[1]);
    const month = parseInt(standardMatch[2]);
    const day = parseInt(standardMatch[3]);
    const date = new Date(year, month - 1, day);
    return format(date, 'yyyy-MM-dd');
  }
  
  // 处理简化格式（如：9/9, 9-9, 9.9）
  const simpleMatch = dateStr.match(/^(\d{1,2})[/\-.](\d{1,2})$/);
  if (simpleMatch) {
    const month = parseInt(simpleMatch[1]);
    const day = parseInt(simpleMatch[2]);
    const date = new Date(currentYear, month - 1, day);
    return format(date, 'yyyy-MM-dd');
  }
  
  // 处理其他可能的格式
  try {
    const dateValueStr = String(dateValue);
    const date = new Date(dateValueStr);
    if (isNaN(date.getTime())) {
      throw new Error('无效的日期格式');
    }
    return format(date, 'yyyy-MM-dd');
  } catch (error) {
    throw new Error(`无法解析日期格式: ${dateStr}。支持的格式：2025/9/9, 2025-09-09, 2025年9月9日, 9/9 等`);
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
