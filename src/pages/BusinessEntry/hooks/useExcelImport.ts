// 文件路径: src/pages/BusinessEntry/hooks/useExcelImport.ts
// 描述: [最终方案] 此版本将调用新的 `resolve_and_preview_import` 函数，
//       以实现后端的“智能预览与即时创建”功能，并与最终的导入逻辑完全对接。

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImportPreviewResult } from '../types';

// 日期解析函数，用于处理Excel中各种格式的日期
const parseExcelDate = (excelDate: any): string | null => {
  if (excelDate === null || excelDate === undefined || excelDate === '') return null;
  // 处理Excel的数字日期格式
  if (typeof excelDate === 'number' && excelDate > 0) {
    const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  }
  // 处理JS Date对象
  if (excelDate instanceof Date) { return excelDate.toISOString().split('T')[0]; }
  // 处理常见的字符串日期格式
  if (typeof excelDate === 'string') {
    const dateStr = excelDate.split(' ')[0]; // 忽略时间部分
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
      const parts = dateStr.split('/');
      return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    }
  }
  return null;
};

export function useExcelImport(onImportSuccess: () => void) {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<'idle' | 'preprocessing' | 'preview' | 'confirmation' | 'processing'>('idle');
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [approvedDuplicates, setApprovedDuplicates] = useState<Set<number>>(new Set());
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const importLogRef = useRef<HTMLDivElement>(null);

  // 重置所有状态并关闭对话框
  const closeImportModal = useCallback(() => {
    setIsImportModalOpen(false);
    setIsImporting(false);
    setImportStep('idle');
    setImportPreview(null);
    setApprovedDuplicates(new Set());
    setImportLogs([]);
  }, []);

  // 步骤2: 调用后端的智能预览函数
  const getImportPreview = async (validRows: any[]) => {
    setImportStep('preview');
    try {
      // 准备发送给RPC函数的数据
      const recordsToPreview = validRows.map(rowData => ({
        project_name: rowData['项目名称']?.trim(),
        chain_name: rowData['合作链路']?.trim() || null,
        driver_name: rowData['司机姓名']?.trim(),
        license_plate: rowData['车牌号']?.toString().trim() || null,
        driver_phone: rowData['司机电话']?.toString().trim() || null,
        loading_location: rowData['装货地点']?.trim(),
        unloading_location: rowData['卸货地点']?.trim(),
        loading_date: rowData.loading_date_parsed,
        unloading_date: rowData.unloading_date_parsed,
        loading_weight: rowData['装货重量'] ? parseFloat(rowData['装货重量']) : null,
        unloading_weight: rowData['卸货重量'] ? parseFloat(rowData['卸货重量']) : null,
        current_cost: rowData['运费金额'] ? parseFloat(rowData['运费金额']) : 0,
        extra_cost: rowData['额外费用'] ? parseFloat(rowData['额外费用']) : 0,
        transport_type: rowData['运输类型']?.trim() || '实际运输',
        remarks: rowData['备注']?.toString().trim() || null,
        original_row_index: rowData.original_row_index
      }));

      // [核心对接点] 调用新的“智能预览”函数
      const { data: previewResult, error } = await supabase.rpc('resolve_and_preview_import', { p_records: recordsToPreview });
      
      if (error) throw error;

      if (previewResult && typeof previewResult === 'object' && !Array.isArray(previewResult)) {
        setImportPreview(previewResult as unknown as ImportPreviewResult);
      } else {
        throw new Error('预览数据格式错误');
      }
      setApprovedDuplicates(new Set());
      setImportStep('confirmation'); // 进入确认步骤
    } catch (error: any) {
      toast({ title: "预览失败", description: error.message, variant: "destructive" });
      closeImportModal();
    }
  };

  // 步骤1: 处理用户选择的Excel文件
  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonDataObjects = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        setIsImportModalOpen(true);
        setImportStep('preprocessing');
        
        const validRows: any[] = [];
        jsonDataObjects.forEach((row: any, index: number) => {
          const loadingDate = parseExcelDate(row['装货日期']);
          if (loadingDate) { // 只处理包含有效装货日期的行
            validRows.push({ 
              ...row, 
              loading_date_parsed: loadingDate, 
              unloading_date_parsed: row['卸货日期'] ? parseExcelDate(row['卸货日期']) : loadingDate,
              original_row_index: index + 2 // Excel行号从1开始, 且有1行标题
            });
          }
        });
        
        if (validRows.length === 0) {
          throw new Error("文件中没有找到任何包含有效“装货日期”的行。");
        }
        await getImportPreview(validRows);
      } catch (error: any) {
        toast({ title: "错误", description: `文件读取失败: ${error.message}`, variant: "destructive" });
        closeImportModal();
      } finally {
        // 清空input的值，确保下次选择相同文件能触发onChange
        if (event.target) event.target.value = ''; 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 步骤3: 执行最终的导入操作
  const executeFinalImport = async () => {
    if (!importPreview) return;
    setImportStep('processing');
    setImportLogs([]);
    const addLog = (message: string) => setImportLogs(prev => [...prev, `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${message}`]);
    
    // 组合所有新记录和用户批准的重复记录
    const finalRecordsToImport = [
      ...importPreview.new_records.map(item => ({ ...item.record, original_row_index: item.original_row_index })),
      ...importPreview.duplicate_records.filter((_, index) => approvedDuplicates.has(index)).map(item => ({ ...item.record, original_row_index: item.original_row_index }))
    ];

    if (finalRecordsToImport.length === 0) {
      toast({ title: "操作完成", description: "没有选中任何需要导入的记录。" });
      setImportStep('confirmation');
      return;
    }

    addLog(`准备导入 ${finalRecordsToImport.length} 条记录...`);

    try {
      // 调用最终的安全插入函数，只传递record部分
      const { data: result, error } = await supabase.rpc('process_logistics_import', { records: finalRecordsToImport.map(r => r.record) });
      
      if (error) throw error;
      
      if (Array.isArray(result)) {
        const failures: { line_number: number; error_message: string }[] = result;
        const failure_count = failures.length;
        const success_count = finalRecordsToImport.length - failure_count;

        addLog(`导入完成！成功: ${success_count}, 失败: ${failure_count}`);

        if (failure_count > 0) {
          addLog("---------------- 失败详情 ----------------");
          failures.forEach(failure => {
            const originalRecord = finalRecordsToImport[failure.line_number - 1];
            const originalRowIndex = originalRecord.original_row_index || `第${failure.line_number}条选中记录`;
            addLog(`[Excel第 ${originalRowIndex} 行] => ${failure.error_message}`);
          });
          addLog("------------------------------------------");
          
          toast({
            title: `导入部分失败 (${failure_count}条)`,
            description: "详情请查看导入日志。请修正Excel后重新导入失败的记录。",
            variant: "destructive",
            duration: 9000
          });
        }
        
        if (success_count > 0) {
            toast({ title: "导入成功", description: `共导入 ${success_count} 条记录。` });
            onImportSuccess(); // 调用回调，刷新主列表
        }

      } else {
        throw new Error('导入结果格式与预期不符。');
      }
    } catch (error: any) {
      addLog(`发生致命错误: ${error.message}`);
      toast({ title: "导入失败", description: `发生致命错误: ${error.message}`, variant: "destructive" });
    }
  };

  return {
    isImporting,
    isImportModalOpen,
    importStep,
    importPreview,
    approvedDuplicates,
    importLogs,
    importLogRef,
    handleExcelImport,
    executeFinalImport,
    closeImportModal,
    setApprovedDuplicates,
  };
}
