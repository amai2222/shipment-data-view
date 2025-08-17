// 最终文件路径: src/pages/BusinessEntry/hooks/useExcelImport.ts
// 描述: 此版本调用新的V2后端函数，实现了更优的性能和更强的用户交互。

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImportPreviewResult } from '../types';

// ★★★ 新增：定义用户对重复记录的处理决策 ★★★
export type DuplicateResolution = 'overwrite' | 'skip' | 'new';
export interface DuplicateResolutions {
  [index: number]: DuplicateResolution;
}

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
  const [duplicateResolutions, setDuplicateResolutions] = useState<DuplicateResolutions>({});
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const importLogRef = useRef<HTMLDivElement>(null);

  const closeImportModal = useCallback(() => {
    setIsImportModalOpen(false); setIsImporting(false); setImportStep('idle');
    setImportPreview(null); 
    setDuplicateResolutions({}); 
    setImportLogs([]);
  }, []);

  const getImportPreview = async (validRows: any[]) => {
    setImportStep('preview');
    try {
      const recordsToPreview = validRows.map(rowData => {
        const parsedLoadingWeight = parseFloat(rowData['装货重量']);
        const parsedUnloadingWeight = parseFloat(rowData['卸货重量']);
        const parsedCurrentCost = parseFloat(rowData['运费金额']);
        const parsedExtraCost = parseFloat(rowData['额外费用']);

        return {
          project_name: rowData['项目名称']?.trim(),
          chain_name: rowData['合作链路']?.trim() || null,
          driver_name: rowData['司机姓名']?.trim(),
          license_plate: rowData['车牌号']?.toString().trim() || null,
          driver_phone: rowData['司机电话']?.toString().trim() || null,
          loading_location: rowData['装货地点']?.trim(),
          unloading_location: rowData['卸货地点']?.trim(),
          loading_date: rowData.loading_date_parsed,
          unloading_date: rowData.unloading_date_parsed,
          loading_weight: !isNaN(parsedLoadingWeight) ? parsedLoadingWeight.toString() : null,
          unloading_weight: !isNaN(parsedUnloadingWeight) ? parsedUnloadingWeight.toString() : null,
          current_cost: !isNaN(parsedCurrentCost) ? parsedCurrentCost.toString() : '0',
          extra_cost: !isNaN(parsedExtraCost) ? parsedExtraCost.toString() : '0',
          transport_type: rowData['运输类型']?.trim() || '实际运输',
          remarks: rowData['备注']?.toString().trim() || null
        };
      });

      // ★★★ 修改：调用新的 preview_import_v2 函数 ★★★
      const { data: previewResult, error } = await supabase.rpc('preview_import_v2', { 
        p_records: recordsToPreview 
      });
      
      if (error) throw error;

      if (previewResult && typeof previewResult === 'object' && !Array.isArray(previewResult)) {
        const safePreview = previewResult as unknown as ImportPreviewResult;
        setImportPreview(safePreview);
        
        if (safePreview.duplicate_records) {
          const initialResolutions: DuplicateResolutions = {};
          safePreview.duplicate_records.forEach((_, index) => {
            initialResolutions[index] = 'skip'; // 默认跳过
          });
          setDuplicateResolutions(initialResolutions);
        }

      } else {
        throw new Error('预览数据格式错误');
      }
      
      setImportStep('confirmation');
    } catch (error: any) {
      toast({ title: "预览失败", description: error.message, variant: "destructive" });
      closeImportModal();
    }
  };

  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    // ... (此函数逻辑保持不变，因为它只负责读取和初步解析文件) ...
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const REQUIRED_HEADERS = [
          '项目名称', '司机姓名', '车牌号', '装货地点', '卸货地点', 
          '装货日期', '卸货日期', '装货重量', '卸货重量', '运费金额'
        ];
        const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
        const actualHeaders = new Set(headerRow.map(h => h.trim()));
        const missingHeaders = REQUIRED_HEADERS.filter(h => !actualHeaders.has(h));
        if (missingHeaders.length > 0) {
          throw new Error(`文件缺少以下必需的列: ${missingHeaders.join(', ')}。请检查模板后重试。`);
        }
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        const cleanedJsonData = jsonData.map((row: any) => {
          const cleanedRow: { [key: string]: any } = {};
          for (const key in row) {
            if (Object.prototype.hasOwnProperty.call(row, key)) {
              cleanedRow[key.trim()] = row[key];
            }
          }
          return cleanedRow;
        });
        setIsImportModalOpen(true);
        setImportStep('preprocessing');
        const validRows: any[] = [];
        cleanedJsonData.forEach((row: any) => {
          const loadingDate = parseExcelDate(row['装货日期']);
          if (loadingDate) {
            validRows.push({ ...row, loading_date_parsed: loadingDate, unloading_date_parsed: row['卸货日期'] ? parseExcelDate(row['卸货日期']) : loadingDate });
          }
        });
        if (validRows.length === 0) {
          throw new Error("文件中没有找到任何包含有效“装货日期”的行。");
        }
        await getImportPreview(validRows);
      } catch (error: any) {
        toast({ title: "文件格式错误", description: `${error.message}`, variant: "destructive" });
        closeImportModal();
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const executeFinalImport = async () => {
    if (!importPreview) return;
    setImportStep('processing');
    setImportLogs([]);
    
    const addLog = (message: string) => setImportLogs(prev => [
      ...prev, 
      `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${message}`
    ]);

    const recordsToInsert: any[] = [...importPreview.new_records.map(item => item.record)];
    const recordsToUpdate: any[] = [];

    importPreview.duplicate_records.forEach((dup, index) => {
      const resolution = duplicateResolutions[index];
      const { record: newRecord, existing_record: existingRecord } = dup;

      if (resolution === 'new') {
        recordsToInsert.push(newRecord);
      } else if (resolution === 'overwrite') {
        if (existingRecord && existingRecord.id) {
          // 将现有记录的ID附加到新记录数据上，以便后端识别
          recordsToUpdate.push({ ...newRecord, id: existingRecord.id });
        }
      }
    });

    const totalToProcess = recordsToInsert.length + recordsToUpdate.length;
    if (totalToProcess === 0) {
      toast({ title: "操作完成", description: "没有需要导入或覆盖的记录。" });
      setImportStep('confirmation');
      return;
    }

    addLog(`准备处理 ${totalToProcess} 条记录...`);
    addLog(`其中新增 ${recordsToInsert.length} 条，覆盖 ${recordsToUpdate.length} 条。`);

    try {
      // ★★★ 修改：调用新的 execute_import_v2 函数 ★★★
      const { data, error } = await supabase.rpc('execute_import_v2', {
        p_records_to_insert: recordsToInsert,
        p_records_to_update: recordsToUpdate
      });

      if (error) throw error;

      const { inserted_count, updated_count } = data;
      const successCount = (inserted_count || 0) + (updated_count || 0);
      const failureCount = totalToProcess - successCount;

      addLog("---------------- 导入总结 ----------------");
      addLog(`处理完成！成功: ${successCount}, 失败: ${failureCount}`);
      toast({
        title: `导入完成`,
        description: `成功处理 ${successCount} 条记录，失败 ${failureCount} 条。`,
        variant: failureCount > 0 ? "destructive" : "default",
      });
      if (successCount > 0) onImportSuccess();

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
    duplicateResolutions,
    setDuplicateResolutions,
    importLogs,
    importLogRef,
    handleExcelImport,
    executeFinalImport,
    closeImportModal,
  };
}
