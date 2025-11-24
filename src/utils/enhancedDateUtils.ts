// 增强的日期解析工具 - 借鉴数据维护-数据导入的专业处理
// 支持多种Excel日期格式，提供详细的调试信息
// 
// 说明：
// 1. Excel的原始数据已经是中国时区的日期
// 2. 此函数只需要处理Excel的各种日期格式，按中国时区标准进行格式化
// 3. 返回YYYY-MM-DD格式的字符串，代表中国时区的日期
// 4. 后端会将此日期字符串转换为UTC存储

export const parseExcelDateEnhanced = (excelDate: any): string | null => {
  if (excelDate === null || excelDate === undefined || excelDate === '') return null;
  
  // 调试信息
  console.log('日期解析开始:', {
    original: excelDate,
    type: typeof excelDate,
    value: excelDate
  });
  
  // 处理Excel数字日期格式
  if (typeof excelDate === 'number' && excelDate > 0) {
    try {
      // ✅ 修复：Excel日期序列号正确计算
      // Excel日期序列号：1900年1月1日为1
      // Excel错误地认为1900年是闰年（实际上不是），所以1900年2月29日存在（但实际上不存在）
      // 修正规则：
      // - 如果序列号 >= 60（1900年2月29日），需要减去1天来修正
      // - 如果序列号 < 60（1900年1月1日到2月28日），不需要修正
      // 但更简单的方法是：使用 UTC 日期计算，避免时区问题
      // Excel日期序列号从1900-01-01开始，序列号1 = 1900-01-01
      // 使用UTC日期计算，确保日期准确
      const excelEpochUTC = Date.UTC(1900, 0, 1); // 1900年1月1日 UTC
      let daysToAdd = excelDate - 1; // 序列号1 = 1900-01-01，所以减去1
      
      // 如果序列号 >= 60（1900年2月29日），需要减去1天来修正Excel的闰年错误
      if (excelDate >= 60) {
        daysToAdd = daysToAdd - 1;
      }
      
      const dateUTC = excelEpochUTC + daysToAdd * 24 * 60 * 60 * 1000;
      const date = new Date(dateUTC);
      
      if (isNaN(date.getTime())) {
        console.warn('Excel数字日期转换失败:', excelDate);
        return null;
      }
      
      // ✅ 修复：使用UTC方法获取年月日，确保日期准确（不受系统时区影响）
      // Excel数据已经是中国时区的日期，但我们需要确保解析的日期准确
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const result = `${year}-${month}-${day}`;
      console.log('Excel数字日期解析成功:', { excelDate, result });
      return result;
    } catch (error) {
      console.error('Excel数字日期解析错误:', error);
      return null;
    }
  }
  
  // 处理Date对象
  if (excelDate instanceof Date) {
    try {
      if (isNaN(excelDate.getTime())) {
        console.warn('无效的Date对象');
        return null;
      }
      // ✅ 修复：xlsx库解析的Date对象是本地时区的，应该使用本地时区方法
      // Excel显示：2025-08-12（中国时区）
      // xlsx解析为：2025-08-12 00:00:00+08:00（本地时区）
      // 如果使用UTC方法，会得到：2025-08-11（错误！）
      // 应该使用本地时区方法，得到：2025-08-12（正确！）
      // 预览显示：2025-08-12（直接显示原始的中国时区日期）
      const year = excelDate.getFullYear();
      const month = String(excelDate.getMonth() + 1).padStart(2, '0');
      const day = String(excelDate.getDate()).padStart(2, '0');
      const result = `${year}-${month}-${day}`;
      console.log('Date对象解析成功:', result);
      return result;
    } catch (error) {
      console.error('Date对象解析错误:', error);
      return null;
    }
  }
  
  // 处理字符串日期
  if (typeof excelDate === 'string') {
    try {
      const dateStr = excelDate.split(' ')[0]; // 取日期部分，忽略时间
      
      // 标准格式：2025-01-15
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        console.log('标准格式日期解析成功:', dateStr);
        return dateStr;
      }
      
      // 斜杠格式：2025/1/15 或 2025/01/15
      if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const result = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
        console.log('斜杠格式日期解析成功:', result);
        return result;
      }
      
      // 中文格式：2025年1月15日 或 1月15日
      if (/^\d{4}年\d{1,2}月\d{1,2}日$/.test(dateStr)) {
        const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (match) {
          const result = `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
          console.log('中文格式日期解析成功:', result);
          return result;
        }
      }
      
      // 中文格式：1月15日（当年）
      if (/^\d{1,2}月\d{1,2}日$/.test(dateStr)) {
        const match = dateStr.match(/(\d{1,2})月(\d{1,2})日/);
        if (match) {
          const currentYear = new Date().getFullYear();
          const result = `${currentYear}-${String(match[1]).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`;
          console.log('中文格式日期解析成功（当年）:', result);
          return result;
        }
      }
      
      // 短格式：1/15 或 01/15（当年）
      if (/^\d{1,2}\/\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const currentYear = new Date().getFullYear();
        const result = `${currentYear}-${String(parts[0]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}`;
        console.log('短格式日期解析成功（当年）:', result);
        return result;
      }
      
      // ✅ 修复：与标准版保持一致，尝试使用 new Date() 解析其他格式
      // 标准版会尝试解析其他格式，然后使用UTC方法获取年月日
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(date.getUTCDate()).padStart(2, '0');
          const result = `${year}-${month}-${day}`;
          console.log('其他格式日期解析成功:', result);
          return result;
        }
      } catch (error) {
        console.warn('日期解析失败:', dateStr, error);
      }
      
      console.warn('未识别的日期格式:', dateStr);
      return null;
    } catch (error) {
      console.error('字符串日期解析错误:', error);
      return null;
    }
  }
  
  console.warn('不支持的日期类型:', typeof excelDate);
  return null;
};

// 验证日期格式
export const validateDate = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
};

// 格式化日期显示
export const formatDateForDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    console.error('日期格式化错误:', error);
    return dateStr;
  }
};
