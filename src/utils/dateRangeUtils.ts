/**
 * 日期范围处理工具
 * 用于将后端返回的UTC日期范围转换为前端显示的中国时区日期范围
 */

import { format } from 'date-fns';

/**
 * 将UTC日期字符串转换为中国时区日期字符串
 * 
 * 按照详情页的处理方法：
 * - 详情页：format(new Date(rec.loading_date), 'yyyy-MM-dd')
 * - rec.loading_date 是完整的 timestamptz 字符串（如 "2025-10-29T00:00:00+08:00"）
 * - new Date() 能正确解析时区，format() 能正确显示中国时区日期
 * 
 * 列表页的处理：
 * - 后端返回的是 UTC 日期字符串（如 "2025-10-28"）
 * - 我们需要将其转换为完整的中国时区 timestamptz 字符串
 * - 然后像详情页那样使用 new Date() + format()
 * 
 * 转换逻辑：
 * - 将 UTC 日期字符串转换为中国时区的 timestamptz 字符串
 * - 例如："2025-10-28" -> "2025-10-28T00:00:00+08:00"（中国时区）
 * - 然后使用 new Date() 解析，format() 格式化
 * 
 * @param utcDateStr UTC日期字符串（YYYY-MM-DD格式）
 * @returns 中国时区日期字符串（YYYY-MM-DD格式）
 */
export function convertUTCDateStringToChinaDateString(utcDateStr: string): string {
  if (!utcDateStr) return '';
  
  // ✅ 按照详情页的处理方法：将 UTC 日期字符串转换为中国时区的 timestamptz 字符串
  // 例如："2025-10-28" -> "2025-10-28T00:00:00+08:00"
  // 这样 new Date() 就能正确解析时区，format() 就能正确显示中国时区日期
  const chinaTimestamptzStr = `${utcDateStr}T00:00:00+08:00`;
  const chinaDate = new Date(chinaTimestamptzStr);
  
  // 使用 format 函数格式化，与详情页的处理方法完全一致
  return format(chinaDate, 'yyyy-MM-dd');
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

