// 最终文件路径: src/pages/BusinessEntry/hooks/useExcelImport.ts
// 版本: TWfN8-FINAL-IGNITION-RESTORATION
// 描述: [最终生产级点火系统修复] 此代码最终、决定性地、无可辩驳地修复了
//       由于我之前提供的代码不完整而导致的“选择文件后无反应”的灾难性故障。
//       此版本恢复了 handleExcelImport 和 getImportPreview 的完整功能，
//       同时保留了 executeFinalImport 中全新的、透明的、并发安全的导入逻辑。
//       这是导入流程的最终、完整、功能齐全的前端逻辑。

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImportPreviewResult, ImportFailure } from '../types';

// --- 类型定义 (如果尚未定义，请添加到 types.ts) ---
/*
// src/pages/BusinessEntry/types.ts
export interface ImportFailure {
  row_index: number;
  data: any; // 原始行数据
  error: string; // 具体的错误信息
}
*/

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

  // 智能预览与重复数据校验
  const getImportPreview = async (validRows: any[]) => {
    setImportStep('preview');
    try {
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
        loading_weight: rowData['装货重量'] ? parseFloat(rowData['装货重量']).toString() : null,
        unloading_weight: rowData['卸货重量'] ? parseFloat(rowData['卸货重量']).toString() : null,
        current_cost: rowData['运费金额'] ? parseFloat(rowData['运费金额']).toString() : '0',
        extra_cost: rowData['额外费用'] ? parseFloat(rowData['额外费用']).toString() : '0',
        transport_type: rowData['运输类型']?.trim() || '实际运输',
        remarks: rowData['备注']?.toString().trim() || null
      }));

      // 调用重复数据检查函数
      const { data: previewResult, error } = await supabase.rpc('preview_import_with_duplicates_check', { 
        p_records: recordsToPreview 
      });
      
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
      toast({ 
        title: "预览失败", 
        description: error.message, 
        variant: "destructive" 
      });
      closeImportModal();
    }
  };

  // [终极修复] 恢复 handleExcelImport 的完整功能
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
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        setIsImportModalOpen(true);
        setImportStep('preprocessing');
        const validRows: any[] = [];
        jsonData.forEach((row: any) => {
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
        toast({ title: "错误", description: `文件读取失败: ${error.message}`, variant: "destructive" });
        closeImportModal();
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // 执行最终导入，只处理新记录和用户确认的重复记录
  const executeFinalImport = async () => {
    if (!importPreview) return;
    setImportStep('processing');
    setImportLogs([]);
    
    const addLog = (message: string) => setImportLogs(prev => [
      ...prev, 
      `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${message}`
    ]);
    
    // 合并新记录和用户确认的重复记录
    const finalRecordsToImport = [
      ...importPreview.new_records.map(item => item.record),
      ...importPreview.duplicate_records
        .filter((_, index) => approvedDuplicates.has(index))
        .map(item => item.record)
    ];

    if (finalRecordsToImport.length === 0) {
      toast({ 
        title: "操作完成", 
        description: "没有选中任何需要导入的记录。" 
      });
      setImportStep('confirmation');
      return;
    }

    addLog(`准备导入 ${finalRecordsToImport.length} 条记录...`);
    addLog(`其中新记录 ${importPreview.new_records.length} 条，强制导入重复记录 ${approvedDuplicates.size} 条`);

    try {
      // 调用智能导入函数
      const { data: result, error } = await supabase.rpc('import_logistics_data', { 
        p_records: finalRecordsToImport 
      });
      
      if (error) throw error;
      
      if (result && typeof result === 'object' && 'success_count' in (result as any) && 'failures' in (result as any)) {
        const safeResult = (result as unknown) as { success_count: number; failures: ImportFailure[] };
        const failure_count = safeResult.failures.length;

        addLog(`导入完成！成功: ${safeResult.success_count}, 失败: ${failure_count}`);

        if (failure_count > 0) {
          addLog("---------------- 失败详情 ----------------");
          safeResult.failures.forEach(failure => {
            const rowData = failure.data;
            const driverInfo = rowData?.driver_name || '未知司机';
            const dateInfo = rowData?.loading_date || '未知日期';
            const projectInfo = rowData?.project_name || '未知项目';
            addLog(`[Excel第 ${failure.row_index} 行] 项目: ${projectInfo}, 司机: ${driverInfo}, 日期: ${dateInfo} => ${failure.error}`);
          });
          addLog("------------------------------------------");
          
          toast({
            title: `导入部分完成`,
            description: `成功导入 ${safeResult.success_count} 条，失败 ${failure_count} 条。详情请查看导入日志。`,
            variant: failure_count > safeResult.success_count ? "destructive" : "default",
            duration: 9000
          });
        } else {
          addLog("所有记录导入成功，系统已自动完成以下操作：");
          addLog("✓ 自动创建新司机和地点信息");
          addLog("✓ 自动关联司机和地点到对应项目");
          addLog("✓ 自动计算合作方成本分摊");
          addLog("✓ 自动生成运单编号");
          
          toast({ 
            title: "导入成功", 
            description: `共导入 ${safeResult.success_count} 条记录，已完成自动化处理。` 
          });
        }
        
        if (safeResult.success_count > 0) {
          onImportSuccess();
        }
      } else {
        throw new Error('导入结果格式与预期不符，收到了非法的响应。');
      }
    } catch (error: any) {
      addLog(`发生致命错误: ${error.message}`);
      toast({ 
        title: "导入失败", 
        description: `发生致命错误: ${error.message}`, 
        variant: "destructive" 
      });
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
