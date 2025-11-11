// 支持更新模式的Excel导入Hook
import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// 解析Excel日期为中国时区的日期字符串（YYYY-MM-DD格式）
// Excel中的日期应该被理解为中国时区的日期，然后发送到后端转换为UTC存储
const parseExcelDate = (excelDate: any): string | null => {
  if (excelDate === null || excelDate === undefined || excelDate === '') return null;
  
  let date: Date | null = null;
  
  // 处理Excel数字日期序列号
  if (typeof excelDate === 'number' && excelDate > 0) {
    // Excel日期序列号：1900年1月1日为1，但Excel错误地认为1900是闰年
    // 所以需要减去2天来修正
    const excelEpoch = new Date(1900, 0, 1);
    date = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
    if (isNaN(date.getTime())) return null;
  }
  // 处理Date对象
  else if (excelDate instanceof Date) {
    date = excelDate;
    if (isNaN(date.getTime())) return null;
  }
  // 处理字符串
  else if (typeof excelDate === 'string') {
    const dateStr = excelDate.split(' ')[0];
    // 如果已经是YYYY-MM-DD格式，直接返回
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // 处理YYYY/MM/DD格式
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
      const parts = dateStr.split('/');
      return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    }
    // 尝试解析其他格式
    date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
  } else {
    return null;
  }
  
  // 使用本地时区格式化日期（不使用toISOString，避免UTC转换）
  // 这样Excel中的日期会被理解为中国时区的日期
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [importStep, setImportStep] = useState<'idle' | 'preprocessing' | 'preview' | 'confirmation' | 'processing' | 'completed'>('idle');
  const [importPreview, setImportPreview] = useState<ImportPreviewResultWithUpdate | null>(null);
  const [importMode, setImportMode] = useState<'create' | 'update'>('create');
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const importLogRef = useRef<HTMLDivElement>(null);
  // 勾选要更新的重复记录（按预览列表索引）
  const [approvedDuplicates, setApprovedDuplicates] = useState<Set<number>>(new Set());

  const closeImportModal = useCallback(() => {
    setIsImportModalOpen(false);
    setIsImporting(false);
    setImportStep('idle');
    setImportPreview(null);
    setImportMode('create');
    setImportLogs([]);
    setApprovedDuplicates(new Set());
  }, []);

  const getImportPreview = async (validRows: any[]) => {
    setImportStep('preview');
    
    try {
      const { data, error } = await (supabase.rpc as any)('preview_import_with_update_mode', {
        p_records: validRows
      } as any);

      if (error) throw error;

      setImportPreview(data);
      // 预览生成后，默认不勾选任何重复记录
      setApprovedDuplicates(new Set());
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
          // 处理运单号：同一平台的多个运单号用|分隔，存储为TEXT[]数组
          // Excel格式：2021615278|2021615821
          // 数据库格式：{"2021615278|2021615821"} (TEXT[]数组)
          const trackingNumbers = String(rowData['其他平台运单号'])
            .split(',')
            .map((tracking: string) => tracking.trim())
            .filter((tracking: string) => tracking);
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
      // 新记录始终导入
      ...importPreview.new_records.map(item => item.record),
      // 仅在更新模式下导入"被勾选"的重复记录（作为更新）
      ...(importMode === 'update'
        ? importPreview.update_records
            .filter((_, index) => approvedDuplicates.has(index))
            .map(item => item.record)
        : [])
    ];

    if (recordsToImport.length === 0) {
      const message = importMode === 'update' && importPreview.update_records.length > 0
        ? "没有勾选任何重复记录进行更新，请勾选要更新的记录或切换到创建模式。"
        : "没有需要导入的记录。";
      toast({ 
        title: "操作提示", 
        description: message,
        variant: "default"
      });
      setImportStep('confirmation');
      return;
    }

    addLog(`准备导入 ${recordsToImport.length} 条记录...`);
    addLog(`导入模式: ${importMode === 'create' ? '创建新记录(跳过重复)' : '更新现有记录(仅勾选的重复)'}`);
    addLog(`其中新记录 ${importPreview.new_records.length} 条，`
      + `${importMode === 'update' ? `将更新重复记录 ${approvedDuplicates.size} 条` : '重复记录已跳过'}`);

    try {
      const { data: result, error } = await (supabase.rpc as any)('batch_import_logistics_records_with_update', { 
        p_records: recordsToImport,
        p_update_mode: importMode === 'update'
      } as any);
      
      if (error) throw error;
      
      if (result && typeof result === 'object' && 'success_count' in result) {
        const successCount = (result as any).success_count || 0;
        const errorCount = (result as any).error_count || 0;
        const insertedCount = (result as any).inserted_count || 0;
        const updatedCount = (result as any).updated_count || 0;

        addLog(`导入完成！成功: ${successCount}, 失败: ${errorCount}`);
        addLog(`其中创建: ${insertedCount} 条，更新: ${updatedCount} 条`);

        if (errorCount > 0) {
          // 显示详细错误信息
          const errorDetails = (result as any).error_details || [];
          addLog(`详细错误信息:`);
          errorDetails.forEach((error: any, index: number) => {
            const excelRow = error.record_index + 1; // Excel行号从1开始
            addLog(`  Excel第 ${excelRow} 行: ${error.error_message}`);
            if (error.record_data) {
              addLog(`    项目: ${error.record_data.project_name || 'N/A'}`);
              addLog(`    司机: ${error.record_data.driver_name || 'N/A'}`);
              addLog(`    车牌: ${error.record_data.license_plate || 'N/A'}`);
            }
            
            // 显示字段错误详情（如果存在）
            if (error.field_errors) {
              Object.entries(error.field_errors).forEach(([fieldName, fieldInfo]: [string, any]) => {
                if (fieldInfo && fieldInfo.is_valid === false) {
                  addLog(`    ${fieldName}: "${fieldInfo.value}" (无效格式)`);
                }
              });
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
        
        // 导入完成后，更新状态为完成
        setImportStep('completed');
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
      
      // 导入失败后，也更新状态
      setImportStep('completed');
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
    approvedDuplicates,
    setApprovedDuplicates,
    handleExcelImport,
    executeFinalImport,
    closeImportModal,
  };
}
