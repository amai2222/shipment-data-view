// 增强的日期解析工具 - 借鉴数据维护-数据导入的专业处理
// 支持多种Excel日期格式，提供详细的调试信息
// 
// 说明：
// 1. Excel的原始数据已经是中国时区的日期
// 2. 此函数只需要处理Excel的各种日期格式，按中国时区标准进行格式化
// 3. 返回YYYY-MM-DD格式的字符串，代表中国时区的日期
// 4. 后端会将此日期字符串转换为UTC存储

export const parseExcelDateEnhanced = (excelDate: string | number | Date | null | undefined): string | null => {
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
      // ✅ 终极修复：使用UTC时间戳进行纯数学计算
      // 彻底避开 "1900年上海LMT时区(+8:05:43)" 导致的 "少一天/23:54" 问题
      
      // 1. 修正Excel的闰年错误 (Excel 错误地认为1900是闰年)
      let daysToAdd = excelDate - 1; 
      if (excelDate >= 60) {
        daysToAdd = daysToAdd - 1;
      }

      // 2. 核心修改：使用 UTC 时间戳作为绝对基准 (1900-01-01 00:00:00 UTC)
      const excelEpochUTC = Date.UTC(1900, 0, 1); 
      
      // 3. 计算目标日期的毫秒数 (一天的毫秒数 = 86400000)
      // Math.floor 确保扔掉 Excel 可能自带的小数时间，只保留整天，防止时间干扰
      const targetTimestamp = excelEpochUTC + (Math.floor(daysToAdd) * 24 * 60 * 60 * 1000);
      
      // 4. 创建日期对象
      const date = new Date(targetTimestamp);

      // 5. ⚠️ 关键：必须使用 getUTC... 方法获取年月日
      // 因为我们是在 UTC 轴上算的，必须按 UTC 取值拼成字符串
      // 这样生成的 "2025-11-28" 就是纯粹的日期字符串，没有时区偏移
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      
      const result = `${year}-${month}-${day}`;
      console.log('Excel数字日期解析成功(UTC修正版):', { excelDate, result });
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
      
      // 标准格式：2025-01-15 或 2025-1-15（支持没有前导零）
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
        // 手动解析，避免 new Date() 的时区问题
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const day = parseInt(parts[2], 10);
          // 验证日期有效性
          if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const result = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            console.log('标准格式日期解析成功:', { original: dateStr, result });
            return result;
          }
        }
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
      
      // ✅ 修复：尝试使用 new Date() 解析其他格式
      // 注意：new Date() 可能会因为时区问题导致日期偏移
      // 优先使用手动解析，避免时区问题
      // 注意：这个逻辑应该与 parseExcelDate 保持一致，避免行为差异
      try {
        // 如果手动解析失败，尝试使用 new Date()（作为最后的备选方案）
        // 使用本地时区方法获取年月日（因为Excel数据是中国时区）
        // ✅ 修复：与 parseExcelDate 保持一致，直接使用 new Date() 解析，不使用灵活匹配
        // 这样可以确保与标准版行为一致
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          // ✅ 使用本地时区方法获取年月日（因为Excel数据已经是中国时区）
          // Excel数据已经是中国时区的日期，所以使用本地时区方法获取年月日
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const result = `${year}-${month}-${day}`;
          console.log('其他格式日期解析成功（使用new Date）:', { original: dateStr, result });
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
  return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
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
