/**
 * 日期范围处理工具
 * 用于将后端返回的UTC日期范围转换为前端显示的中国时区日期范围
 */

import { format } from 'date-fns';

/**
 * 将UTC日期字符串转换为中国时区日期字符串
 * 使用 format 和 Date 对象的本地时区（浏览器时区，中国 UTC+8）进行格式化
 * 与详情页的日期显示逻辑一致
 * 
 * @param utcDateStr UTC日期字符串（YYYY-MM-DD格式）
 * @returns 中国时区日期字符串（YYYY-MM-DD格式）
 */
export function convertUTCDateStringToChinaDateString(utcDateStr: string): string {
  if (!utcDateStr) return '';
  
  // 将UTC日期字符串解析为UTC时间
  // 例如："2025-10-28" -> "2025-10-28T00:00:00.000Z"
  const utcDate = new Date(utcDateStr + 'T00:00:00.000Z');
  
  // ✅ 使用 format 函数，它会自动使用 Date 对象的本地时区（浏览器时区，中国 UTC+8）进行格式化
  // 例如：UTC "2025-10-28 00:00:00" -> 中国时区 "2025-10-28 08:00:00" -> 格式化为 "2025-10-28"
  // 如果 UTC 时间是 "2025-10-28 16:00:00"（即中国时间 2025-10-29 00:00:00），format 会显示 "2025-10-29"
  return format(utcDate, 'yyyy-MM-dd');
}

/**
 * 将后端返回的UTC日期范围字符串转换为中国时区日期范围字符串
 * 支持格式：
 * - "2025-10-28" (单日)
 * - "2025-10-28 ~ 2025-10-30" (日期范围)
 * 
 * @param utcDateRangeStr UTC日期范围字符串
 * @returns 中国时区日期范围字符串
 */
export function convertUTCDateRangeToChinaDateRange(utcDateRangeStr: string | null | undefined): string {
  if (!utcDateRangeStr) return '-';
  
  // 检查是否包含日期范围分隔符 " ~ "
  if (utcDateRangeStr.includes(' ~ ')) {
    const [startDate, endDate] = utcDateRangeStr.split(' ~ ');
    const chinaStartDate = convertUTCDateStringToChinaDateString(startDate.trim());
    const chinaEndDate = convertUTCDateStringToChinaDateString(endDate.trim());
    return `${chinaStartDate} ~ ${chinaEndDate}`;
  } else {
    // 单日
    return convertUTCDateStringToChinaDateString(utcDateRangeStr.trim());
  }
}

