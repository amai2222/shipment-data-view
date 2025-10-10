// 增强的日期解析工具 - 借鉴数据维护-数据导入的专业处理
// 支持多种Excel日期格式，提供详细的调试信息

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
      // Excel日期从1900年1月1日开始计算，需要减去25569天
      const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
      if (isNaN(date.getTime())) {
        console.warn('Excel数字日期转换失败:', excelDate);
        return null;
      }
      const result = date.toISOString().split('T')[0];
      console.log('Excel数字日期解析成功:', result);
      return result;
    } catch (error) {
      console.error('Excel数字日期解析错误:', error);
      return null;
    }
  }
  
  // 处理Date对象
  if (excelDate instanceof Date) {
    try {
      const result = excelDate.toISOString().split('T')[0];
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
