/**
 * Excel日期处理公共工具
 * 
 * 基于运单维护标准版本的Excel导入中正确的日期处理逻辑
 * 
 * 核心原则：
 * 1. Excel的原始数据已经是中国时区的日期
 * 2. 前端只需要处理Excel的各种日期格式，按中国时区标准进行格式化
 * 3. 返回YYYY-MM-DD格式的字符串，代表中国时区的日期
 * 4. 后端会将此日期字符串转换为UTC存储
 * 
 * 日期处理流程：
 * - Excel中的日期：2025-12-4 或 2025-12-04（中国时区日期）
 * - 前端解析后传递：'2025-12-04'（标准化为YYYY-MM-DD格式）
 * - 后端标准化：确保格式为 YYYY-MM-DD（标准化日期格式）
 * - 后端转换：'2025-12-04' || ' 00:00:00+08:00' → 2025-12-04 00:00:00+08:00
 * - 存储为UTC：PostgreSQL自动转换为UTC → 2025-12-03 16:00:00+00（UTC）
 */

/**
 * 解析Excel日期为中国时区的日期字符串（YYYY-MM-DD格式）
 * 
 * 支持格式：
 * - Excel数字日期序列号（如：44927）
 * - Date对象
 * - YYYY-MM-DD格式字符串（如：'2025-12-04'）
 * - YYYY/MM/DD格式字符串（如：'2025/12/4'）
 * - 其他可被new Date()解析的格式
 * 
 * @param excelDate - Excel日期值（可能是数字、Date对象或字符串）
 * @returns YYYY-MM-DD格式的日期字符串，如果解析失败返回null
 * 
 * @example
 * ```typescript
 * parseExcelDate(44927) // 返回 '2023-01-15'
 * parseExcelDate('2025-12-4') // 返回 '2025-12-04'
 * parseExcelDate('2025/12/4') // 返回 '2025-12-04'
 * parseExcelDate(new Date('2025-12-04')) // 返回 '2025-12-04'
 * ```
 */
export const parseExcelDate = (excelDate: any): string | null => {
  if (excelDate === null || excelDate === undefined || excelDate === '') return null;
  
  let date: Date | null = null;
  
  // 处理Excel数字日期序列号
  if (typeof excelDate === 'number' && excelDate > 0) {
    // ✅ Excel日期序列号正确计算（按中国时区处理）
    // Excel日期序列号：1900年1月1日为1
    // Excel错误地认为1900年是闰年，所以1900年2月29日存在（但实际上不存在）
    // 修正规则：如果序列号 >= 60（1900年2月29日），需要减去1天来修正
    // 注意：Excel中的日期序列号代表的是中国时区的日期，所以我们需要按中国时区计算
    const excelEpoch = new Date(1900, 0, 1); // 1900年1月1日（本地时区，即中国时区）
    let daysToAdd = excelDate - 1; // 序列号1 = 1900-01-01，所以减去1
    if (excelDate >= 60) {
      daysToAdd = daysToAdd - 1; // 修正Excel的闰年错误
    }
    date = new Date(excelEpoch);
    date.setDate(date.getDate() + daysToAdd);
    if (isNaN(date.getTime())) return null;
  }
  // 处理Date对象
  else if (excelDate instanceof Date) {
    date = excelDate;
    if (isNaN(date.getTime())) return null;
  }
  // 处理字符串
  else if (typeof excelDate === 'string') {
    const dateStr = excelDate.split(' ')[0]; // 取日期部分，忽略时间
    // 如果已经是YYYY-MM-DD格式，直接返回（Excel中的日期已经是中国时区）
    // ✅ 支持没有前导零的格式：'2025-12-4' → '2025-12-04'
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        // 验证日期有效性
        if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }
    // 处理YYYY/MM/DD格式
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
      const parts = dateStr.split('/');
      return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    }
    // 尝试解析其他格式（按本地时区解析，因为Excel数据是中国时区）
    date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
  } else {
    return null;
  }
  
  // ✅ 使用本地时区方法获取年月日（因为Excel数据已经是中国时区）
  // Excel数据已经是中国时区的日期，所以使用本地时区方法获取年月日
  // 这样确保：Excel中的 "2025-11-13" → 返回 "2025-11-13" → 后端转换为 "2025-11-13 00:00:00+08:00" → 存储为 "2025-11-12 16:00:00+00" (UTC)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 格式化记录中的日期字段
 * 
 * 用于批量处理导入记录，确保所有日期字段都经过正确的解析和格式化
 * 
 * @param record - 包含日期字段的记录对象
 * @param dateFields - 需要处理的日期字段名数组，默认为 ['loading_date', 'unloading_date']
 * @returns 处理后的记录对象
 * 
 * @example
 * ```typescript
 * const record = {
 *   loading_date: '2025-12-4',
 *   unloading_date: '2025/12/5',
 *   // ... 其他字段
 * };
 * const formatted = formatRecordDates(record);
 * // formatted.loading_date = '2025-12-04'
 * // formatted.unloading_date = '2025-12-05'
 * ```
 */
export const formatRecordDates = (
  record: Record<string, any>,
  dateFields: string[] = ['loading_date', 'unloading_date']
): Record<string, any> => {
  const formatted = { ...record };
  
  for (const field of dateFields) {
    if (formatted[field]) {
      const parsed = parseExcelDate(formatted[field]);
      if (parsed) {
        formatted[field] = parsed;
      } else {
        console.warn(`日期字段 ${field} 解析失败:`, formatted[field]);
        // 如果解析失败，保留原值（让后端处理）
      }
    }
  }
  
  // 如果没有卸货日期，使用装货日期
  if (!formatted.unloading_date && formatted.loading_date) {
    formatted.unloading_date = formatted.loading_date;
  }
  
  return formatted;
};

/**
 * 后端日期处理SQL逻辑说明
 * 
 * 在PostgreSQL函数中，应该使用以下逻辑处理日期：
 * 
 * ```sql
 * -- 1. 标准化日期格式：将 '2025-12-4' 转换为 '2025-12-04'
 * v_loading_date_formatted := to_char(to_date(v_loading_date_formatted, 'YYYY-MM-DD'), 'YYYY-MM-DD');
 * 
 * -- 2. 转换为timestamptz（中国时区）
 * loading_date = ((v_loading_date_formatted::text) || ' 00:00:00+08:00')::timestamptz
 * 
 * -- 3. PostgreSQL自动转换为UTC存储
 * -- '2025-12-04 00:00:00+08:00' → '2025-12-03 16:00:00+00' (UTC)
 * ```
 * 
 * 标准版函数（CTE方式）：
 * ```sql
 * ((to_char(to_date(rec->>'loading_date', 'YYYY-MM-DD'), 'YYYY-MM-DD'))::text || ' 00:00:00+08:00')::timestamptz AS loading_date
 * ```
 * 
 * 增强版函数（循环方式）：
 * ```sql
 * v_loading_date_formatted := NULLIF(TRIM(record_data->>'loading_date'), '');
 * IF v_loading_date_formatted IS NULL OR v_loading_date_formatted = '' THEN
 *     RAISE EXCEPTION '装货日期不能为空';
 * END IF;
 * v_loading_date_formatted := to_char(to_date(v_loading_date_formatted, 'YYYY-MM-DD'), 'YYYY-MM-DD');
 * -- 然后在插入时使用：
 * ((v_loading_date_formatted::text) || ' 00:00:00+08:00')::timestamptz
 * ```
 */
