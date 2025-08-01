// 文件路径: src/excel.worker.ts

import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

// --- 安全警告 ---
// 为了让 Worker 能够独立工作，我们在这里初始化 Supabase 客户端。
// 在生产环境中，强烈建议通过 postMessage 从主线程安全地传递这些密钥，
// 而不是将它们硬编码在代码中。
// 请务必将下面的 'YOUR_SUPABASE_URL' 和 'YOUR_SUPABASE_ANON_KEY' 替换为您自己的真实密钥！
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing. Make sure they are set in your .env file and exposed to Vite with VITE_ prefix.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 解析各种可能的日期格式，返回 YYYY-MM-DD 或 null
 * @param excelDate - 从 Excel 中读取的日期值
 * @returns - 格式化后的日期字符串或 null
 */
const parseExcelDate = (excelDate: any): string | null => {
  if (excelDate === null || excelDate === undefined || excelDate === '') return null;
 
  // 处理 Excel 的数字日期
  if (typeof excelDate === 'number' && excelDate > 0) {
    const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
 
  // 处理 JS Date 对象
  if (excelDate instanceof Date) {
    if (isNaN(excelDate.getTime())) return null;
    const year = excelDate.getFullYear();
    const month = String(excelDate.getMonth() + 1).padStart(2, '0');
    const day = String(excelDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
 
  // 处理字符串日期
  if (typeof excelDate === 'string') {
    const dateStr = excelDate.split(' ')[0].trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
      const parts = dateStr.split('/');
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
 
  // 无法处理的格式
  return null;
};

// 监听主线程消息
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const data = event.data;
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    // 1. 本地格式验证和初步分类
    const validFormatRows: any[] = [];
    const invalidFormatRows: any[] = [];

    jsonData.forEach((row, index) => {
      const rowData = { ...row, originalRow: index + 2 }; // 记录原始行号
      const projectName = rowData['项目名称']?.trim();
      const driverName = rowData['司机姓名']?.trim();
      const loadingLocation = rowData['装货地点']?.trim();
      const unloadingLocation = rowData['卸货地点']?.trim();

      if (!projectName || !driverName || !loadingLocation || !unloadingLocation) {
        rowData.error = "缺少必填字段（项目/司机/装卸地点）";
        invalidFormatRows.push(rowData);
      } else if (!parseExcelDate(rowData['装货日期'])) {
        rowData.error = "装货日期格式无效 (请使用 YYYY-MM-DD 或 YYYY/MM/DD)";
        invalidFormatRows.push(rowData);
      } else {
        validFormatRows.push(rowData);
      }
    });

    // 2. 如果没有格式有效的行，直接返回
    if (validFormatRows.length === 0) {
      self.postMessage({ success: true, data: { valid: [], invalid: invalidFormatRows, duplicates: [] } });
      return;
    }
    
    // 3. 对格式有效的行进行数据库重复检查
    const fingerprints = validFormatRows.map(row => ({
      project_name_check: row['项目名称']?.trim(),
      driver_name_check: row['司机姓名']?.trim(),
      loading_location_check: row['装货地点']?.trim(),
      unloading_location_check: row['卸货地点']?.trim(),
      loading_date_check: parseExcelDate(row['装货日期']),
      loading_weight_check: parseFloat(row['装货重量']) || 0,
    }));

    const { data: existingRecords, error: checkError } = await supabase.rpc(
      'check_existing_waybills',
      { p_fingerprints: fingerprints }
    );

    if (checkError) throw checkError;

    const existingSet = new Set(
      (existingRecords || []).map(fp => 
          `${fp.project_name_check}-${fp.driver_name_check}-${fp.loading_location_check}-${fp.unloading_location_check}-${fp.loading_date_check}-${fp.loading_weight_check}`
      )
    );

    // 4. 最终分类
    const finalValidRows: any[] = [];
    const duplicateRows: any[] = [];

    validFormatRows.forEach(row => {
      const key = `${row['项目名称']?.trim()}-${row['司机姓名']?.trim()}-${row['装货地点']?.trim()}-${row['卸货地点']?.trim()}-${parseExcelDate(row['装货日期'])}-${parseFloat(row['装货重量']) || 0}`;
      if (existingSet.has(key)) {
        duplicateRows.push(row);
      } else {
        finalValidRows.push(row);
      }
    });

    // 5. 将最终分类结果发送回主线程
    self.postMessage({
      success: true,
      data: {
        valid: finalValidRows,
        invalid: invalidFormatRows,
        duplicates: duplicateRows,
      },
    });

  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : '在 Worker 中发生未知错误。',
    });
  }
};

export default {};
