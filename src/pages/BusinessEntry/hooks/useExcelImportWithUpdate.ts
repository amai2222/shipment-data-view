// 支持更新模式的Excel导入Hook
import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

export interface ImportPreviewResultWithUpdate {
  new_records: Array<{ record: any }>;
  update_records: Array<{ record: any; existing_record_id: string; existing_auto_number: string }>;
  error_records: Array<{ record: any; error: string }>;
}

export function useExcelImportWithUpdate(onImportSuccess: () => void) {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<'idle' | 'preprocessing' | 'preview' | 'confirmation' | 'processing'>('idle');
  const [importPreview, setImportPreview] = useState<ImportPreviewResultWithUpdate | null>(null);
  const [importMode, setImportMode] = useState<'create' | 'update'>('create');
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const importLogRef = useRef<HTMLDivElement>(null);

  const closeImportModal = useCallback(() => {
    setIsImportModalOpen(false);
    setIsImporting(false);
    setImportStep('idle');
    setImportPreview(null);
    setImportMode('create');
    setImportLogs([]);
  }, []);

  const getImportPreview = async (validRows: any[]) => {
    setImportStep('preview');
    
    try {
      const { data, error } = await supabase.rpc('preview_import_with_update_mode', {
        p_records: validRows
      });

      if (error) throw error;

      setImportPreview(data);
      setImportStep('confirmation');
    } catch (error: any) {
      console.error('获取导入预览失败:', error);
      toast({
        title: "预览失败",
        description: error.message || "无法预览导入数据",
        variant: "destructive"
      });
      setImportStep('idle');
    }
  };

  const handleExcelImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setIsImportModalOpen(true);
    setImportStep('preprocessing');
    setImportLogs([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error('Excel文件至少需要包含表头和一行数据');
      }

      // 获取表头
      const headers = jsonData[0] as string[];
      const requiredHeaders = ['项目名称', '司机姓名', '车牌号', '装货地点', '卸货地点', '装货日期', '装货数量'];
      
      // 检查必需的表头
      const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
      if (missingHeaders.length > 0) {
        throw new Error(`缺少必需的表头: ${missingHeaders.join(', ')}`);
      }

      // 处理数据行
      const validRows: any[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (row.every(cell => cell === null || cell === undefined || cell === '')) continue;

        const rowData: any = {};
        headers.forEach((header, index) => {
          if (header && row[index] !== undefined) {
            rowData[header] = row[index];
          }
        });

        // 处理日期字段
        if (rowData['装货日期']) {
          rowData['loading_date'] = parseExcelDate(rowData['装货日期']);
        }
        if (rowData['卸货日期']) {
          rowData['unloading_date'] = parseExcelDate(rowData['卸货日期']);
        }

        // 处理平台字段
        if (rowData['其他平台名称']) {
          const platformNames = String(rowData['其他平台名称']).split(',').map((name: string) => name.trim()).filter(Boolean);
          rowData['other_platform_names'] = platformNames;
        }

        if (rowData['其他平台运单号']) {
          const trackingNumbers = String(rowData['其他平台运单号']).split(',').map((tracking: string) => {
            const parts = tracking.trim().split('|');
            return {
              platform: parts[0]?.trim() || '未知平台',
              tracking_number: parts[1]?.trim() || parts[0]?.trim() || '',
              status: 'pending',
              created_at: new Date().toISOString()
            };
          }).filter((item: any) => item.tracking_number);
          rowData['external_tracking_numbers'] = trackingNumbers;
        }

        // 映射字段名
        const mappedData = {
          project_name: rowData['项目名称'],
          chain_name: rowData['合作链路(可选)'] || rowData['合作链路'],
          driver_name: rowData['司机姓名'],
          license_plate: rowData['车牌号'],
          driver_phone: rowData['司机电话(可选)'] || rowData['司机电话'],
          loading_location: rowData['装货地点'],
          unloading_location: rowData['卸货地点'],
          loading_date: rowData['loading_date'],
          unloading_date: rowData['unloading_date'],
          loading_weight: rowData['装货数量'],
          unloading_weight: rowData['卸货数量(可选)'] || rowData['卸货数量'],
          current_cost: rowData['运费金额(可选)'] || rowData['运费金额'],
          extra_cost: rowData['额外费用(可选)'] || rowData['额外费用'],
          transport_type: rowData['运输类型(可选)'] || rowData['运输类型'] || '实际运输',
          remarks: rowData['备注(可选)'] || rowData['备注'],
          external_tracking_numbers: rowData['external_tracking_numbers'] || [],
          other_platform_names: rowData['other_platform_names'] || []
        };

        validRows.push(mappedData);
      }

      if (validRows.length === 0) {
        throw new Error('没有找到有效的数据行');
      }

      await getImportPreview(validRows);
    } catch (error: any) {
      console.error('Excel导入失败:', error);
      toast({
        title: "导入失败",
        description: error.message || "无法解析Excel文件",
        variant: "destructive"
      });
      setImportStep('idle');
    } finally {
      setIsImporting(false);
    }
  }, [getImportPreview, toast]);

  const executeFinalImport = async () => {
    if (!importPreview) return;
    
    setImportStep('processing');
    setImportLogs([]);
    
    const addLog = (message: string) => setImportLogs(prev => [
      ...prev, 
      `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${message}`
    ]);

    const recordsToImport = [
      ...importPreview.new_records.map(item => item.record),
      ...importPreview.update_records.map(item => item.record)
    ];

    if (recordsToImport.length === 0) {
      toast({ title: "操作完成", description: "没有需要导入的记录。" });
      setImportStep('confirmation');
      return;
    }

    addLog(`准备导入 ${recordsToImport.length} 条记录...`);
    addLog(`其中新记录 ${importPreview.new_records.length} 条，更新记录 ${importPreview.update_records.length} 条`);
    addLog(`导入模式: ${importMode === 'create' ? '创建新记录' : '更新现有记录'}`);

    try {
      const { data: result, error } = await supabase.rpc('batch_import_logistics_records_with_update', { 
        p_records: recordsToImport,
        p_update_mode: importMode === 'update'
      });
      
      if (error) throw error;
      
      if (result && typeof result === 'object' && 'success_count' in result) {
        const successCount = result.success_count || 0;
        const errorCount = result.error_count || 0;
        const insertedCount = result.inserted_count || 0;
        const updatedCount = result.updated_count || 0;

        addLog(`导入完成！成功: ${successCount}, 失败: ${errorCount}`);
        addLog(`其中创建: ${insertedCount} 条，更新: ${updatedCount} 条`);

        if (errorCount > 0) {
          // 显示详细错误信息
          const errorDetails = result.error_details || [];
          addLog(`详细错误信息:`);
          errorDetails.forEach((error: any, index: number) => {
            addLog(`  记录 ${error.record_index}: ${error.error_message}`);
            if (error.record_data) {
              addLog(`    项目: ${error.record_data.project_name || 'N/A'}`);
              addLog(`    司机: ${error.record_data.driver_name || 'N/A'}`);
              addLog(`    车牌: ${error.record_data.license_plate || 'N/A'}`);
            }
          });
          
          toast({
            title: `导入部分完成`,
            description: `成功导入 ${successCount} 条，失败 ${errorCount} 条。详情请查看导入日志。`,
            variant: errorCount > successCount ? "destructive" : "default",
            duration: 9000
          });
        } else {
          addLog("所有记录导入成功，系统已自动完成以下操作：");
          addLog("✓ 自动创建新司机和地点信息");
          addLog("✓ 自动关联司机和地点到对应项目");
          addLog("✓ 自动计算合作方成本分摊");
          if (importMode === 'create') {
            addLog("✓ 自动生成运单编号");
          } else {
            addLog("✓ 保留现有运单编号");
          }
          
          toast({ 
            title: "导入成功", 
            description: `共处理 ${successCount} 条记录，其中创建 ${insertedCount} 条，更新 ${updatedCount} 条。` 
          });
        }
        
        if (successCount > 0) {
          onImportSuccess();
        }
      } else {
        throw new Error('导入结果格式与预期不符');
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
    importMode,
    setImportMode,
    importLogs,
    importLogRef,
    handleExcelImport,
    executeFinalImport,
    closeImportModal,
  };
}
