// 文件路径: src/excel.worker.ts
// 【架构正确版】 - 移除所有数据库连接，只负责文件解析和指纹生成

import * as XLSX from 'xlsx';

// --- 日期解析函数 (保持不变) ---
const parseExcelDate = (excelDate: any): string | null => {
  if (excelDate === null || excelDate === undefined || excelDate === '') return null;
  if (excelDate instanceof Date) {
    if (isNaN(excelDate.getTime())) return null;
    return excelDate.toISOString().split('T')[0];
  }
  if (typeof excelDate === 'number' && excelDate > 0) {
    const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  }
  const date = new Date(excelDate);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  return null;
};

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const file = event.data;
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    const validFormatRows: any[] = [];
    const invalidFormatRows: any[] = [];

    jsonData.forEach((row, index) => {
      const rowData = { ...row, originalRow: index + 2 };
      const projectName = rowData['项目名称']?.trim();
      
      if (!projectName) { // 简化验证
        rowData.error = "缺少必填字段（项目名称）";
        invalidFormatRows.push(rowData);
      } else {
        // 生成指纹
        rowData.fingerprint = `${projectName}-${rowData['司机姓名']?.trim()}-${rowData['装货地点']?.trim()}-${rowData['卸货地点']?.trim()}-${parseExcelDate(rowData['装货日期'])}-${parseFloat(rowData['装货重量']) || 0}`;
        validFormatRows.push(rowData);
      }
    });
    
    // 直接返回解析和格式化后的结果
    self.postMessage({
      success: true,
      data: {
        validRows: validFormatRows,
        invalidRows: invalidFormatRows,
      },
    });

  } catch (error: any) {
    self.postMessage({ success: false, error: `文件处理失败: ${error.message}` });
  }
};

export default {};
