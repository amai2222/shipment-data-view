// src/pages/BusinessEntry/hooks/useExcelImport.ts

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImportPreviewResult } from '../types';

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
      setImportPreview(previewResult);
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
        await getImportPreview(validRows);
      } catch (error) {
        toast({ title: "错误", description: "文件读取失败，请检查文件格式。", variant: "destructive" });
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
    const addLog = (message: string) => setImportLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
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
      const { data: result, error } = await supabase.rpc('batch_import_logistics_records', { p_records: finalRecordsToImport });
      if (error) throw error;
      addLog(`导入完成！成功: ${result.success_count}, 失败: ${result.error_count}`);
      if (result.error_count > 0) addLog(`失败详情: ${JSON.stringify(result.errors.slice(0, 5))}`);
      toast({ title: "导入成功", description: `共导入 ${result.success_count} 条记录。` });
      if (result.success_count > 0) {
        onImportSuccess();
      }
    } catch (error: any) {
      addLog(`导入失败: ${error.message}`);
      toast({ title: "导入失败", description: error.message, variant: "destructive" });
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
