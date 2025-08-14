// 最终文件路径: src/pages/BusinessEntry/hooks/useExcelImport.ts
// 描述: [精准升级] 此版本保留了您原有的完整导入流程（预览、重复项检查），
//       仅将最后一步的数据库调用替换为新的 `process_logistics_import` 函数。
//       这解决了批量导入因单行RLS策略失败而整体中断的问题，并提供更精确的行级错误反馈。

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
// [修改] 引入我们新的错误类型，如果您的 types.ts 中已有 ImportFailure，可以保留或整合
import { ImportPreviewResult, ImportFailure } from '../types';

// =================================================================
// 您原有的代码保持不变
// =================================================================
const parseExcelDate = (excelDate: any): string | null => {
  if (excelDate === null || excelDate === undefined || excelDate === '') return null;
  if (typeof excelDate === 'number' && excelDate > 0) {
    const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  }
  if (excelDate instanceof Date) { return excelDate.toISOString().split('T')[0]; }
  if (typeof excelDate === 'string') {
    const dateStr = excelDate.split(' ')[0];
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

  const closeImportModal = useCallback(() => {
    setIsImportModalOpen(false); setIsImporting(false); setImportStep('idle');
    setImportPreview(null); setApprovedDuplicates(new Set()); setImportLogs([]);
  }, []);

  const getImportPreview = async (validRows: any[]) => {
    setImportStep('preview');
    try {
      const recordsToPreview = validRows.map(rowData => ({
        project_name: rowData['项目名称']?.trim(), chain_name: rowData['合作链路']?.trim() || null,
        driver_name: rowData['司机姓名']?.trim(), license_plate: rowData['车牌号']?.toString().trim() || null,
        driver_phone: rowData['司机电话']?.toString().trim() || null, loading_location: rowData['装货地点']?.trim(),
        unloading_location: rowData['卸货地点']?.trim(), loading_date: rowData.loading_date_parsed,
        unloading_date: rowData.unloading_date_parsed,
        loading_weight: rowData['装货重量'] ? parseFloat(rowData['装货重量']).toString() : null,
        unloading_weight: rowData['卸货重量'] ? parseFloat(rowData['卸货重量']).toString() : null,
        current_cost: rowData['运费金额'] ? parseFloat(rowData['运费金额']).toString() : '0',
        extra_cost: rowData['额外费用'] ? parseFloat(rowData['额外费用']).toString() : '0',
        transport_type: rowData['运输类型']?.trim() || '实际运输', remarks: rowData['备注']?.toString().trim() || null
      }));
      const { data: previewResult, error } = await supabase.rpc('preview_import_with_duplicates_check', { p_records: recordsToPreview });
      if (error) throw error;

      if (previewResult && typeof previewResult === 'object' && !Array.isArray(previewResult)) {
        const safePreview = previewResult as unknown as ImportPreviewResult;
        setImportPreview(safePreview);
      } else {
        throw new Error('预览数据格式错误');
      }
      setApprovedDuplicates(new Set());
      setImportStep('confirmation');
    } catch (error: any) {
      toast({ title: "预览失败", description: error.message, variant: "destructive" });
      closeImportModal();
    }
  };

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
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, header: 1 }); // 使用 header: 1 获取数组的数组
        
        // 动态获取标题行，并创建映射
        const headers: string[] = jsonData[0] as string[];
        const headerMap: { [key: string]: string } = {};
        headers.forEach((h, i) => headerMap[h.trim()] = XLSX.utils.encode_col(i));

        // 将原始数据（除了标题行）转换为JSON对象
        const jsonDataObjects = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        setIsImportModalOpen(true);
        setImportStep('preprocessing');
        
        const validRows: any[] = [];
        // [修改] 使用 jsonDataObjects 进行迭代，保留原始行号
        jsonDataObjects.forEach((row: any, index: number) => {
          const loadingDate = parseExcelDate(row['装货日期']);
          if (loadingDate) {
            validRows.push({ 
              ...row, 
              loading_date_parsed: loadingDate, 
              unloading_date_parsed: row['卸货日期'] ? parseExcelDate(row['卸货日期']) : loadingDate,
              original_row_index: index + 2 // +2 是因为 Excel 行号从1开始，且我们跳过了标题行
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
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };


  // =================================================================
  // [精准修改] 这里是我们需要进行“心脏移植”手术的地方
  // =================================================================
  const executeFinalImport = async () => {
    if (!importPreview) return;
    setImportStep('processing');
    setImportLogs([]);
    const addLog = (message: string) => setImportLogs(prev => [...prev, `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${message}`]);
    
    // 准备最终要导入的记录，这里保持不变，但增加原始行号用于日志
    const finalRecordsToImport = [
      ...importPreview.new_records.map(item => ({ ...item.record, original_row_index: item.original_row_index })),
      ...importPreview.duplicate_records
        .filter((_, index) => approvedDuplicates.has(index))
        .map(item => ({ ...item.record, original_row_index: item.original_row_index }))
    ];

    if (finalRecordsToImport.length === 0) {
      toast({ title: "操作完成", description: "没有选中任何需要导入的记录。" });
      setImportStep('confirmation');
      return;
    }

    addLog(`准备导入 ${finalRecordsToImport.length} 条记录...`);

    try {
      // [心脏移植]
      // 1. 调用新的、更稳定的 `process_logistics_import` 函数
      // 2. 注意参数名从 p_records 变成了 records
      const { data: result, error } = await supabase.rpc('process_logistics_import', { 
        records: finalRecordsToImport 
      });
      
      if (error) throw error; // 处理RPC调用本身的错误
      
      // [心脏移植]
      // 3. 处理新函数返回的结果。新函数直接返回一个失败记录的数组。
      if (Array.isArray(result)) {
        const failures: { line_number: number; error_message: string }[] = result;
        const failure_count = failures.length;
        const success_count = finalRecordsToImport.length - failure_count;

        addLog(`导入完成！成功: ${success_count}, 失败: ${failure_count}`);

        if (failure_count > 0) {
          addLog("---------------- 失败详情 ----------------");
          failures.forEach(failure => {
            // `failure.line_number` 是传入数组的索引(从1开始)，我们可以用它来找回原始数据
            const originalRecord = finalRecordsToImport[failure.line_number - 1];
            const originalRowIndex = originalRecord.original_row_index || failure.line_number; // 获取Excel原始行号
            const driverInfo = originalRecord?.driver_name || '未知司机';
            const dateInfo = originalRecord?.loading_date || '未知日期';
            addLog(`[Excel第 ${originalRowIndex} 行] 司机: ${driverInfo}, 日期: ${dateInfo} => 错误: ${failure.error_message}`);
          });
          addLog("------------------------------------------");
          
          toast({
            title: `导入部分失败 (${failure_count}条)`,
            description: "详情请查看导入日志。请修正Excel后重新导入失败的记录。",
            variant: "destructive",
            duration: 9000
          });
        } else {
          toast({ title: "导入成功", description: `共导入 ${success_count} 条记录。` });
          if (success_count > 0) {
            onImportSuccess(); // 调用回调，刷新主列表
          }
        }
      } else {
        throw new Error('导入结果格式与预期不符，收到了非法的响应。');
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
