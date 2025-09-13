// Excel import hook with update mode support
import { useState, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

export interface ImportPreviewResultWithUpdate {
  success_count: number;
  error_count: number;
  inserted_count: number;
  updated_count: number;
  error_details: any[];
  duplicate_records: any[];
}

export type ImportStep = 'idle' | 'preprocessing' | 'preview' | 'confirmation' | 'processing';

export function useExcelImportWithUpdate(onSuccess?: () => void) {
  const [importStep, setImportStep] = useState<ImportStep>('idle');
  const [validatedRows, setValidatedRows] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState<ImportPreviewResultWithUpdate | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [updateMode, setUpdateMode] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'create' | 'update'>('create');
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importLogRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // 添加日志
  const addLog = useCallback((message: string) => {
    setImportLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  }, []);

  // 处理文件选择
  const handleExcelImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportStep('preprocessing');
    setIsImportModalOpen(true);
    addLog('开始处理Excel文件...');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error('Excel文件至少需要包含标题行和数据行');
      }

      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1) as any[][];

      addLog(`检测到 ${rows.length} 行数据`);

      // 验证必填字段 - 统一为8个必填字段
      const requiredFields = ['项目名称', '司机姓名', '车牌号', '装货地点', '卸货地点', '装货日期', '装货数量', '运费金额'];
      const missingFields = requiredFields.filter(field => !headers.includes(field));
      
      if (missingFields.length > 0) {
        throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
      }

      // 转换数据格式
      const processedRows = rows.map((row, index) => {
        const rowData: any = {};
        headers.forEach((header, colIndex) => {
          rowData[header] = row[colIndex] || '';
        });
        return { ...rowData, _rowIndex: index + 2 };
      }).filter(row => row['项目名称'] && row['司机姓名']);

      setValidatedRows(processedRows);
      addLog(`验证通过 ${processedRows.length} 行数据`);

      // 调用预览函数
      const previewResult = await previewImport(processedRows);
      setImportPreview(previewResult);
      setImportStep('preview');
      addLog('预览完成，请确认导入模式');

    } catch (error: any) {
      console.error('Excel处理错误:', error);
      addLog(`处理失败: ${error.message}`);
      toast({
        title: "导入失败",
        description: error.message,
        variant: "destructive",
      });
      setImportStep('idle');
    }
  }, [addLog, toast]);

  // 预览导入
  const previewImport = async (rows: any[]) => {
    try {
      const { data, error } = await supabase.rpc('preview_import_with_update_mode', {
        p_records: rows
      });

      if (error) throw error;

      return {
        success_count: data?.success_count || 0,
        error_count: data?.error_count || 0,
        inserted_count: data?.inserted_count || 0,
        updated_count: data?.updated_count || 0,
        error_details: data?.error_details || [],
        duplicate_records: data?.duplicate_records || []
      };
    } catch (error: any) {
      console.error('预览导入失败:', error);
      throw new Error(`预览失败: ${error.message}`);
    }
  };

  // 执行最终导入
  const executeFinalImport = async () => {
    if (!validatedRows.length) return;

    setImportStep('processing');
    setIsImporting(true);
    addLog('开始执行导入...');

    try {
      const { data, error } = await supabase.rpc('batch_import_logistics_records_with_update', {
        p_records: validatedRows,
        p_update_mode: importMode === 'update'
      });

      if (error) throw error;

      const result = {
        success_count: data?.success_count || 0,
        error_count: data?.error_count || 0,
        inserted_count: data?.inserted_count || 0,
        updated_count: data?.updated_count || 0,
        error_details: data?.error_details || [],
        duplicate_records: data?.duplicate_records || []
      };

      addLog(`导入完成: 成功 ${result.success_count} 条，失败 ${result.error_count} 条`);

      if (result.error_details?.length > 0) {
        addLog('错误详情:');
        result.error_details.forEach((error: any, index: number) => {
          addLog(`  第${error.record_index}行: ${error.error_message}`);
        });
      }

      toast({
        title: "导入完成",
        description: `成功导入 ${result.success_count} 条记录`,
        variant: result.error_count > 0 ? "destructive" : "default",
      });

      if (onSuccess) {
        onSuccess();
      }

      resetImport();

    } catch (error: any) {
      console.error('导入失败:', error);
      addLog(`导入失败: ${error.message}`);
      toast({
        title: "导入失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetImport = () => {
    setImportStep('idle');
    setValidatedRows([]);
    setImportPreview(null);
    setSelectedFile(null);
    setIsImporting(false);
    setUpdateMode(false);
    setIsImportModalOpen(false);
    setImportMode('create');
    setImportLogs([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    resetImport();
  };

  return {
    importStep,
    validatedRows,
    importPreview,
    selectedFile,
    isImporting,
    updateMode,
    fileInputRef,
    handleFileSelect: handleExcelImport,
    resetImport,
    performImport: executeFinalImport,
    setUpdateMode,
    isImportModalOpen,
    importMode,
    setImportMode,
    importLogs,
    importLogRef,
    handleExcelImport,
    executeFinalImport,
    closeImportModal,
  };
}