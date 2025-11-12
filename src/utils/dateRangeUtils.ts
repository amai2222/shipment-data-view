/**
 * 日期范围处理工具
 * 用于将后端返回的UTC日期范围转换为前端显示的中国时区日期范围
 */

/**
 * 将UTC日期字符串转换为中国时区日期字符串
 * @param utcDateStr UTC日期字符串（YYYY-MM-DD格式）
 * @returns 中国时区日期字符串（YYYY-MM-DD格式）
 */
export function convertUTCDateStringToChinaDateString(utcDateStr: string): string {
  if (!utcDateStr) return '';
  
  // 将UTC日期字符串解析为UTC时间
  // 例如："2025-10-28" -> "2025-10-28T00:00:00.000Z"
  const utcDate = new Date(utcDateStr + 'T00:00:00.000Z');
  
  // 转换为中国时区（加8小时）
  const chinaTime = utcDate.getTime() + 8 * 60 * 60 * 1000;
  const chinaDate = new Date(chinaTime);
  
  // 提取中国时区的年、月、日
  const year = chinaDate.getUTCFullYear();
  const month = String(chinaDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(chinaDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
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

