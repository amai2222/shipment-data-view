// 最终文件路径: src/pages/BusinessEntry/hooks/useExcelImport.ts
// 版本: TWfN8-FINAL-IGNITION-RESTORATION-V2 (增加表头校验)
// 描述: 此版本在原基础上增加了前置的 Excel 表头校验逻辑。
//       在解析数据前，系统会先检查所有必需的列名是否存在，
//       如果缺少关键列，会立即终止并提示用户，
//       从而彻底防止因列名错误导致的静默失败或数据错位问题。

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImportPreviewResult, ImportFailure } from '../types';

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
  const [duplicateActions, setDuplicateActions] = useState<Map<number, {action: 'create' | 'update'}>>(new Map());
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const importLogRef = useRef<HTMLDivElement>(null);

  const closeImportModal = useCallback(() => {
    setIsImportModalOpen(false); setIsImporting(false); setImportStep('idle');
    setImportPreview(null); setApprovedDuplicates(new Set()); setDuplicateActions(new Map()); setImportLogs([]);
  }, []);

  const getImportPreview = async (validRows: any[]) => {
    setImportStep('preview');
    try {
      const recordsToPreview = validRows.map(rowData => {
        const parsedLoadingWeight = parseFloat(rowData['装货数量']);
        const parsedUnloadingWeight = parseFloat(rowData['卸货数量']);
        const parsedCurrentCost = parseFloat(rowData['运费金额']);
        const parsedExtraCost = parseFloat(rowData['额外费用']);

        // 处理其他平台名称和外部运单号
        let externalTrackingNumbers = null;
        let otherPlatformNames = null;
        
        if (rowData['其他平台名称'] || rowData['其他平台运单号']) {
          const platformNames = rowData['其他平台名称']?.toString().split(',').map((name: string) => name.trim()).filter((name: string) => name) || [];
          const trackingNumbers = rowData['其他平台运单号']?.toString().split(',').map((tn: string) => tn.trim()).filter((tn: string) => tn) || [];
          
          // 处理外部运单号（JSONB字符串数组格式）
          // Excel格式：2021615278|2021615821
          // 数据库格式：["2021615278|2021615821"]
          if (trackingNumbers.length > 0) {
            externalTrackingNumbers = trackingNumbers;
          }
          
          // 处理其他平台名称（TEXT[]格式）
          if (platformNames.length > 0) {
            otherPlatformNames = platformNames;
          }
        }

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
          remarks: rowData['备注']?.toString().trim() || null,
          external_tracking_numbers: externalTrackingNumbers,
          other_platform_names: otherPlatformNames
        };
      });

      const { data: previewResult, error } = await (supabase.rpc as any)('preview_import_with_duplicates_check', { 
        p_records: recordsToPreview 
      } as any);
      
      if (error) throw error;

      if (previewResult && typeof previewResult === 'object' && !Array.isArray(previewResult)) {
        const safePreview = previewResult as unknown as ImportPreviewResult;
        setImportPreview(safePreview);
      } else {
        throw new Error('预览数据格式错误');
      }
      
      setApprovedDuplicates(new Set());
      setDuplicateActions(new Map());
      setImportStep('confirmation');
    } catch (error: any) {
      toast({ title: "预览失败", description: error.message, variant: "destructive" });
      closeImportModal();
    }
  };

  // ★★★ 函数已修改 ★★★
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

        // ★★★ 新增：表头校验逻辑开始 ★★★
        const REQUIRED_HEADERS = [
          '项目名称', '司机姓名', '车牌号', '装货地点', '卸货地点', 
          '装货日期', '装货数量', '运费金额'
        ];
        
        const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
        const actualHeaders = new Set(headerRow.map(h => h.trim()));
        
        const missingHeaders = REQUIRED_HEADERS.filter(h => !actualHeaders.has(h));

        if (missingHeaders.length > 0) {
          throw new Error(`文件缺少以下必需的列: ${missingHeaders.join(', ')}。请检查模板后重试。`);
        }
        // ★★★ 新增：表头校验逻辑结束 ★★★

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        const cleanedJsonData = jsonData.map((row: any) => {
          const cleanedRow: { [key: string]: any } = {};
          for (const key in row) {
            if (Object.prototype.hasOwnProperty.call(row, key)) {
              cleanedRow[key.trim()] = row[key];
            }
          }
          
          // 处理多地点：将地点字符串按|分割并清理
          if (cleanedRow['装货地点']) {
            cleanedRow['装货地点'] = cleanedRow['装货地点']
              .split('|')
              .map((loc: string) => loc.trim())
              .filter((loc: string) => loc)
              .join('|');
          }
          
          if (cleanedRow['卸货地点']) {
            cleanedRow['卸货地点'] = cleanedRow['卸货地点']
              .split('|')
              .map((loc: string) => loc.trim())
              .filter((loc: string) => loc)
              .join('|');
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
    
    const finalRecordsToImport = [
      ...importPreview.new_records.map(item => item.record),
      ...importPreview.duplicate_records
        .filter((_, index) => approvedDuplicates.has(index))
        .map(item => item.record)
    ];

    if (finalRecordsToImport.length === 0) {
      toast({ title: "操作完成", description: "没有选中任何需要导入的记录。" });
      setImportStep('confirmation');
      return;
    }

    addLog(`准备导入 ${finalRecordsToImport.length} 条记录...`);
    addLog(`其中新记录 ${importPreview.new_records.length} 条，强制导入重复记录 ${approvedDuplicates.size} 条`);

    try {
      const { data: result, error } = await (supabase.rpc as any)('import_logistics_data', { 
        p_records: finalRecordsToImport 
      } as any);
      
      if (error) throw error;
      
      if (result && typeof result === 'object' && 'success_count' in (result as any) && 'failures' in (result as any)) {
        const safeResult = (result as unknown) as { success_count: number; failures: ImportFailure[] };
        const failure_count = safeResult.failures.length;

        addLog(`导入完成！成功: ${safeResult.success_count}, 失败: ${failure_count}`);

        if (failure_count > 0) {
          addLog("---------------- 失败详情 ----------------");
          safeResult.failures.forEach(failure => {
            const excelRow = failure.excel_row || (failure.row_index + 1);
            const projectInfo = failure.project_name || '未知项目';
            const driverInfo = failure.driver_name || '未知司机';
            const licensePlate = failure.license_plate || '未知车牌';
            
            addLog(`[Excel第 ${excelRow} 行] 项目: ${projectInfo}, 司机: ${driverInfo}, 车牌: ${licensePlate}`);
            addLog(`  错误: ${failure.error}`);
            
            // 显示字段错误详情
            if (failure.field_errors) {
              const fieldErrors = failure.field_errors;
              Object.entries(fieldErrors).forEach(([fieldName, fieldInfo]) => {
                if (fieldInfo && fieldInfo.is_valid === false) {
                  addLog(`  ${fieldName}: "${fieldInfo.value}" (无效格式)`);
                }
              });
            }
            addLog("------------------------------------------");
          });
          
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
    duplicateActions,
    importLogs,
    importLogRef,
    handleExcelImport,
    executeFinalImport,
    closeImportModal,
    setApprovedDuplicates,
    setDuplicateActions,
  };
}
