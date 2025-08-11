// 最终文件路径: src/pages/BusinessEntry/hooks/useExcelImport.ts
// 版本: oofdb1-FINAL-TRANSPARENT-REVOLUTION
// 描述: [最终生产级透明反馈修复] 此代码最终、决定性地、无可辩驳地完成了
//       导入流程的终极革命。
//       1. 【调用革命】将RPC调用从旧的、灾难性的 'batch_import_logistics_records'
//          切换到全新的、并发安全的、透明的 'import_logistics_data'。
//       2. 【反馈革命】重写了结果处理逻辑，现在能够解析并展示每一条失败记录的
//          具体、详细的错误信息，彻底终结了“黑箱”灾难。

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImportPreviewResult, ImportFailure } from '../types'; // 假设您在types.ts中定义了ImportFailure

// --- 类型定义 (如果尚未定义，请添加到 types.ts) ---
/*
// src/pages/BusinessEntry/types.ts
export interface ImportFailure {
  row_index: number;
  data: any; // 原始行数据
  error: string; // 具体的错误信息
}

export interface ImportFinalResult {
  success_count: number;
  failures: ImportFailure[];
}
*/

const parseExcelDate = (excelDate: any): string | null => {
  if (excelDate === null || excelDate === undefined || excelDate === '') return null;
  if (typeof excelDate === 'number' && excelDate > 0) {
    const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  if (excelDate instanceof Date) { return excelDate.toISOString().split('T')[0]; }
  if (typeof excelDate === 'string') {
    const dateStr = excelDate.split(' ')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
      const parts = dateStr.split('/');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
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
    // ... 此函数逻辑保持不变 ...
  };

  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    // ... 此函数逻辑保持不变 ...
  };

  const executeFinalImport = async () => {
    if (!importPreview) return;
    setImportStep('processing');
    setImportLogs([]);
    const addLog = (message: string) => setImportLogs(prev => [...prev, `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${message}`]);
    
    const finalRecordsToImport = [
      ...importPreview.new_records.map(item => item.record),
      ...importPreview.duplicate_records.filter((_, index) => approvedDuplicates.has(index)).map(item => item.record)
    ];

    if (finalRecordsToImport.length === 0) {
      toast({ title: "操作完成", description: "没有选中任何需要导入的记录。" });
      setImportStep('confirmation');
      return;
    }

    addLog(`准备导入 ${finalRecordsToImport.length} 条记录...`);

    try {
      // [革命性改动 1] 调用全新的、健壮的、透明的后端函数
      const { data: result, error } = await supabase.rpc('import_logistics_data', { p_records: finalRecordsToImport });
      
      if (error) throw error;
      
      // [革命性改动 2] 使用全新的、透明的、详细的错误处理逻辑
      if (result && typeof result === 'object' && 'success_count' in result && 'failures' in result) {
        const safeResult = result as { success_count: number; failures: ImportFailure[] };
        const failure_count = safeResult.failures.length;

        addLog(`导入完成！成功: ${safeResult.success_count}, 失败: ${failure_count}`);

        if (failure_count > 0) {
          addLog("---------------- 失败详情 ----------------");
          safeResult.failures.forEach(failure => {
            const rowData = failure.data;
            const driverInfo = rowData?.driver_name || '未知司机';
            const dateInfo = rowData?.loading_date || '未知日期';
            addLog(`[第 ${failure.row_index} 行] 司机: ${driverInfo}, 日期: ${dateInfo} => ${failure.error}`);
          });
          addLog("------------------------------------------");
          
          toast({
            title: `导入部分失败 (${failure_count}条)`,
            description: "详情请查看导入日志。请修正Excel后重新导入失败的记录。",
            variant: "destructive",
            duration: 9000
          });
        } else {
          toast({ title: "导入成功", description: `共导入 ${safeResult.success_count} 条记录。` });
          if (safeResult.success_count > 0) {
            onImportSuccess(); // 调用回调，刷新主页面数据
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
