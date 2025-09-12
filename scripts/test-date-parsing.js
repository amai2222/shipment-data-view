// 测试日期解析功能
// 在浏览器控制台中运行此脚本来测试日期解析

// 模拟parseExcelDateToChina函数
function parseExcelDateToChina(dateValue) {
  if (!dateValue) throw new Error('日期值为空');
  
  // 如果已经是Date对象，直接处理
  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) {
      throw new Error('无效的日期对象');
    }
    return dateValue.toISOString().split('T')[0]; // YYYY-MM-DD格式
  }
  
  // 如果是数字（Excel日期序列号），转换为Date对象
  if (typeof dateValue === 'number') {
    // Excel日期序列号：1900年1月1日为1
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (dateValue - 2) * 24 * 60 * 60 * 1000);
    if (isNaN(date.getTime())) {
      throw new Error('无效的Excel日期序列号');
    }
    return date.toISOString().split('T')[0];
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
      return date.toISOString().split('T')[0];
    }
  }
  
  // 处理标准格式（如：2025/9/9, 2025-09-09, 2025.9.9）
  const standardMatch = dateStr.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (standardMatch) {
    const year = parseInt(standardMatch[1]);
    const month = parseInt(standardMatch[2]);
    const day = parseInt(standardMatch[3]);
    const date = new Date(year, month - 1, day);
    return date.toISOString().split('T')[0];
  }
  
  // 处理简化格式（如：9/9, 9-9, 9.9）
  const simpleMatch = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})$/);
  if (simpleMatch) {
    const month = parseInt(simpleMatch[1]);
    const day = parseInt(simpleMatch[2]);
    const date = new Date(currentYear, month - 1, day);
    return date.toISOString().split('T')[0];
  }
  
  // 处理其他可能的格式
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      throw new Error('无效的日期格式');
    }
    return date.toISOString().split('T')[0];
  } catch (error) {
    throw new Error(`无法解析日期格式: ${dateStr}。支持的格式：2025/9/9, 2025-09-09, 2025年9月9日, 9/9 等`);
  }
}

// 测试各种日期格式
const testDates = [
  '2025/9/9',
  '2025/9/10', 
  '2025/9/11',
  '2025-09-09',
  '2025年9月9日',
  '9/9',
  '09/09',
  new Date('2025-09-09'),
  45285, // Excel日期序列号
  '2025.9.9'
];

console.log('=== 日期解析测试 ===');
testDates.forEach((date, index) => {
  try {
    const result = parseExcelDateToChina(date);
    console.log(`测试 ${index + 1}: ${date} (${typeof date}) -> ${result}`);
  } catch (error) {
    console.error(`测试 ${index + 1}: ${date} (${typeof date}) -> 错误: ${error.message}`);
  }
});

console.log('\n=== 测试完成 ===');
