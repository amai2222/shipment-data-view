// /src/excel.worker.ts

import * as XLSX from 'xlsx';

// 监听来自主线程的消息
self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try {
    const data = event.data;
    
    // 在 Worker 线程中执行耗时操作
    const workbook = XLSX.read(data, { type: 'array', cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
    
    // 将处理结果发送回主线程
    self.postMessage({
      success: true,
      data: jsonData,
    });

  } catch (error) {
    // 如果发生错误，将错误信息发回主线程
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred in the worker.',
    });
  }
};

// 导出空对象以符合 TypeScript 的模块规范
export default {};
