// 增强的运单维护页面 - 集成数据维护-数据导入的专业处理功能
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FileUp, 
  Trash2, 
  AlertTriangle, 
  Database, 
  Download,
  RefreshCw,
  Filter,
  CheckCircle,
  XCircle,
  Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import { Project } from "@/types";
import { UpdateModeImportDialog } from '@/pages/BusinessEntry/components/UpdateModeImportDialog';
import { useExcelImportWithUpdate } from '@/pages/BusinessEntry/hooks/useExcelImportWithUpdate';
import TemplateMappingManager from '@/components/TemplateMappingManager';
import TemplateBasedImport from '@/components/TemplateBasedImport';
import DeleteWaybills from '@/components/DeleteWaybills';
import { PageHeader } from "@/components/PageHeader";
import SelectiveFieldUpdate from '@/components/SelectiveFieldUpdate';
import * as XLSX from 'xlsx';

// 导入增强的工具函数
import { parseExcelDateEnhanced } from '@/utils/enhancedDateUtils';
import { processExternalPlatformData } from '@/utils/externalPlatformUtils';
import { validateBatchData } from '@/utils/enhancedValidationUtils';
import { generateEnhancedWaybillTemplate } from '@/utils/enhancedTemplateUtils';
import { 
  createEnhancedLogger, 
  createImportProgressManager,
  ValidationResultProcessor,
  ExcelParseErrorHandler,
  ImportResultProcessor,
  type LogEntry,
  type ImportProgress
} from '@/utils/enhancedLoggingUtils';

// 增强导入预览结果类型
interface EnhancedImportPreview {
  new_records: Array<{ record: Record<string, unknown>; excelRowNumber?: number }>;
  duplicate_records: Array<{ record: Record<string, unknown> }>;
  total_count: number;
  valid_count: number;
  invalid_count: number;
}

// Excel行数据类型
interface ExcelRowData {
  [key: string]: string | number | null | undefined | string[];
  loading_date_parsed?: string;
  unloading_date_parsed?: string;
  external_tracking_numbers?: string[];
  other_platform_names?: string[];
}

// 项目数据（从数据库返回）
interface ProjectRawData {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  project_status: string;
}

// 解析行数范围字符串（支持格式：2-101, 2,4,6-11, 2-51,61-101）
// 返回一个 Set，包含所有有效的Excel行号（Excel实际行号：表头是第1行，数据从第2行开始）
// maxRows: Excel总行数（包括表头）
function parseRowRange(rangeStr: string, maxRows: number): Set<number> {
  const result = new Set<number>();
  if (!rangeStr.trim()) {
    // 如果为空，返回所有数据行（从第2行开始，因为第1行是表头）
    for (let i = 2; i <= maxRows; i++) {
      result.add(i);
    }
    return result;
  }

  // 按逗号分割
  const parts = rangeStr.split(',').map(part => part.trim()).filter(Boolean);
  
  for (const part of parts) {
    if (part.includes('-')) {
      // 范围格式：2-101
      const [start, end] = part.split('-').map(s => parseInt(s.trim(), 10));
      if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0 && start <= end) {
        // Excel行号范围：最小是2（第1行是表头），最大是maxRows
        const actualStart = Math.max(2, start);
        const actualEnd = Math.min(maxRows, end);
        for (let i = actualStart; i <= actualEnd; i++) {
          result.add(i);
        }
      }
    } else {
      // 单个数字：2
      const num = parseInt(part, 10);
      // Excel行号：最小是2（第1行是表头），最大是maxRows
      if (!isNaN(num) && num >= 2 && num <= maxRows) {
        result.add(num);
      }
    }
  }
  
  return result;
}

export default function EnhancedWaybillMaintenance() {
  const { toast } = useToast();
  const { hasButtonAccess, hasRole } = useUnifiedPermissions();
  const isAdmin = hasRole('admin');
  const isOperator = hasRole('operator');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [waybillCount, setWaybillCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'standard' | 'template' | 'mapping' | 'selective' | 'delete'>('standard');
  
  // 增强的导入状态
  const [isEnhancedImporting, setIsEnhancedImporting] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'confirmation' | 'processing' | 'completed'>('upload');
  const [importPreview, setImportPreview] = useState<EnhancedImportPreview | null>(null);
  const [importLogs, setImportLogs] = useState<LogEntry[]>([]);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [approvedDuplicates, setApprovedDuplicates] = useState<Set<number>>(new Set());
  const [rowRangeInput, setRowRangeInput] = useState<string>('');
  const [totalDataRows, setTotalDataRows] = useState<number>(0);
  const [allValidRecords, setAllValidRecords] = useState<Array<Record<string, unknown>>>([]);
  
  // 创建增强的日志记录器
  const logger = useMemo(() => createEnhancedLogger((logs) => setImportLogs(logs)), []);
  const progressManager = useMemo(() => createImportProgressManager(0, (progress) => setImportProgress(progress)), []);
  const validationProcessor = useMemo(() => new ValidationResultProcessor(logger), [logger]);
  const excelErrorHandler = useMemo(() => new ExcelParseErrorHandler(logger), [logger]);
  const importResultProcessor = useMemo(() => new ImportResultProcessor(logger), [logger]);

  // 加载指定项目的运单数量（延迟加载，不阻塞页面打开）
  const loadWaybillCount = useCallback(async () => {
    if (!selectedProject) {
      setWaybillCount(0);
      return;
    }

    // ✅ 不阻塞UI，使用estimated模式
    try {
      const { count, error } = await supabase
        .from('logistics_records')
        .select('id', { count: 'estimated', head: true })  // ✅ 改为estimated，更快
        .eq('project_name', selectedProject);

      if (error) throw error;
      setWaybillCount(count || 0);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('加载运单数量失败:', errorMessage);
      setWaybillCount(0);  // 失败不提示，避免干扰
    } finally {
      setIsLoading(false);
    }
  }, [selectedProject]);

  // 原有的Excel导入Hook（保持兼容）
  const {
    isImporting, 
    isImportModalOpen, 
    importStep: originalImportStep, 
    importPreview: originalImportPreview, 
    importMode,
    setImportMode,
    importLogs: originalImportLogs, 
    importLogRef, 
    handleExcelImport, 
    executeFinalImport, 
    closeImportModal,
    approvedDuplicates: originalApprovedDuplicates,
    setApprovedDuplicates: setOriginalApprovedDuplicates
  } = useExcelImportWithUpdate(() => { 
    loadWaybillCount(); 
  });

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, start_date, end_date, project_status')
        .order('name');

      if (error) throw error;
      
      // 转换数据库字段名（snake_case）到 TypeScript 类型（camelCase）
      const convertedProjects: Project[] = (data || []).map((p: ProjectRawData) => ({
        id: p.id,
        name: p.name,
        startDate: p.start_date,
        endDate: p.end_date,
        manager: '',
        loadingAddress: '',
        unloadingAddress: '',
        projectStatus: p.project_status,
        createdAt: ''
      }));
      
      setProjects(convertedProjects);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('加载项目失败:', errorMessage);
      toast({ title: "错误", description: "加载项目列表失败", variant: "destructive" });
    }
  }, [toast]);

  // 增强的Excel导入处理
  const handleEnhancedExcelImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsEnhancedImporting(true);
    setImportStep('upload');
    logger.clear();
    progressManager.reset(0);

    try {
      logger.info('开始处理Excel文件', { fileName: file.name, fileSize: file.size });
      
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { 
        type: 'array', 
        cellDates: true,
        cellNF: false,
        cellText: false,
        dateNF: 'yyyy/m/d'
      });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

      if (jsonData.length < 2) {
        throw new Error('Excel文件至少需要包含表头和一行数据');
      }

      const totalExcelRows = jsonData.length; // Excel总行数（包括表头）
      const totalDataRows = jsonData.length - 1; // 数据行数（不包括表头）
      setTotalDataRows(totalExcelRows); // 保存Excel总行数用于范围解析
      
      logger.info('Excel文件解析成功', { 
        totalExcelRows,
        totalDataRows,
        sheetName 
      });

      // 获取表头
      const headers = jsonData[0] as string[];
      const requiredHeaders = ['项目名称', '司机姓名', '车牌号', '装货地点', '卸货地点', '装货日期', '装货数量'];
      
      // 检查必需的表头
      const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
      if (missingHeaders.length > 0) {
        throw new Error(`缺少必需的表头: ${missingHeaders.join(', ')}`);
      }

      logger.info('表头验证通过', { headers, requiredHeaders });

      // 解析行数范围（如果已输入）
      // 注意：使用Excel实际行号（表头是第1行，数据从第2行开始）
      const rowRange = parseRowRange(rowRangeInput, totalExcelRows);
      if (rowRangeInput.trim() && rowRange.size === 0) {
        logger.warn('行数范围无效，将导入所有行', { input: rowRangeInput });
      } else if (rowRangeInput.trim()) {
        logger.info('应用行数范围过滤', { 
          input: rowRangeInput, 
          selectedRows: rowRange.size,
          totalExcelRows,
          totalDataRows 
        });
      }

      // 处理数据行
      const validRows: Array<ExcelRowData & { _excelRowNumber?: number }> = [];
      for (let i = 1; i < jsonData.length; i++) {
        // Excel实际行号：i=1 对应 Excel 第2行（第1条数据），i=2 对应 Excel 第3行（第2条数据）
        const excelRowNumber = i + 1; // Excel行号从2开始（第1行是表头）
        
        // 如果指定了行数范围，检查当前行是否在范围内
        if (rowRangeInput.trim() && !rowRange.has(excelRowNumber)) {
          continue; // 跳过不在范围内的行
        }
        const row = jsonData[i] as unknown[];
        if (row.every(cell => cell === null || cell === undefined || cell === '')) continue;

        const rowData: ExcelRowData = {};
        headers.forEach((header, index) => {
          if (header && row[index] !== undefined) {
            rowData[header] = row[index] as string | number | null | undefined;
          }
        });

        // 使用增强的日期解析
        if (rowData['装货日期']) {
          rowData.loading_date_parsed = parseExcelDateEnhanced(rowData['装货日期']);
          if (!rowData.loading_date_parsed) {
            logger.warn(`第${i + 1}行装货日期解析失败`, { 
              original: rowData['装货日期'],
              rowIndex: i 
            });
            continue;
          }
        }
        
        if (rowData['卸货日期']) {
          rowData.unloading_date_parsed = parseExcelDateEnhanced(rowData['卸货日期']);
          if (!rowData.unloading_date_parsed) {
            rowData.unloading_date_parsed = rowData.loading_date_parsed;
            logger.info(`第${i + 1}行卸货日期解析失败，使用装货日期`, { 
              original: rowData['卸货日期'],
              fallback: rowData.loading_date_parsed 
            });
          }
        } else {
          rowData.unloading_date_parsed = rowData.loading_date_parsed;
        }

        // 处理平台字段 - 参考正常版本的逻辑
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

        // 映射字段名 - 参考正常版本的逻辑，保持中文字段名用于验证
        // ✅ 修复：确保合作链路字段正确映射（支持多种字段名）
        const chainName = rowData['合作链路(可选)'] || rowData['合作链路'] || '';
        if (chainName) {
          logger.info(`第${excelRowNumber}行合作链路: ${chainName}`);
        }
        
        const mappedData = {
          '项目名称': rowData['项目名称'],
          '合作链路': chainName, // 使用处理后的值
          '司机姓名': rowData['司机姓名'],
          '车牌号': rowData['车牌号'],
          '司机电话': rowData['司机电话(可选)'] || rowData['司机电话'],
          '装货地点': rowData['装货地点'],
          '卸货地点': rowData['卸货地点'],
          '装货日期': rowData.loading_date_parsed,
          '卸货日期': rowData.unloading_date_parsed,
          '装货数量': rowData['装货数量'],
          '卸货数量': rowData['卸货数量(可选)'] || rowData['卸货数量'],
          '运费金额': rowData['运费金额(可选)'] || rowData['运费金额'],
          '额外费用': rowData['额外费用(可选)'] || rowData['额外费用'],
          '运输类型': rowData['运输类型(可选)'] || rowData['运输类型'] || '实际运输',
          '备注': rowData['备注(可选)'] || rowData['备注'],
          'external_tracking_numbers': rowData['external_tracking_numbers'] || [],
          'other_platform_names': rowData['other_platform_names'] || [],
          '_excelRowNumber': excelRowNumber // 保存Excel行号用于预览显示
        };

        validRows.push(mappedData);
      }

      if (validRows.length === 0) {
        throw new Error('没有找到有效的数据行');
      }

      logger.info('数据预处理完成', { validRows: validRows.length });

      // 使用增强的验证
      const validationResult = validateBatchData(validRows);
      const processedResult = validationProcessor.processValidationResults(
        validationResult.validRows, 
        validationResult.invalidRows
      );

      if (processedResult.processedRows.length === 0) {
        throw new Error('没有有效的数据可以导入');
      }

      // 将中文字段名转换为英文字段名，用于数据库导入
      const recordsForImport = processedResult.processedRows.map((record, index) => {
        // 从原始数据中获取Excel行号
        const originalRow = validRows.find((r, idx) => {
          // 通过比较关键字段找到对应的原始行
          return r['项目名称'] === record['项目名称'] &&
                 r['司机姓名'] === record['司机姓名'] &&
                 r['车牌号'] === record['车牌号'] &&
                 r['装货日期'] === record['装货日期'];
        });
        const excelRowNumber = originalRow?._excelRowNumber || (index + 2); // 默认使用索引+2（第1行是表头）
        
        // ✅ 修复：确保合作链路字段正确提取（支持多种字段名）
        const chainName = record['合作链路(可选)'] || record['合作链路'] || null;
        if (chainName) {
          logger.info(`准备导入第${excelRowNumber}行，合作链路: ${chainName}`);
        } else {
          logger.warn(`第${excelRowNumber}行合作链路为空，将使用null`);
        }
        
        return {
          project_name: record['项目名称'],
          chain_name: chainName,
          driver_name: record['司机姓名'],
          license_plate: record['车牌号'],
          driver_phone: record['司机电话'],
          loading_location: record['装货地点'],
          unloading_location: record['卸货地点'],
          // ✅ 修复：使用解析后的日期字符串，而不是原始的Excel日期
          // 标准版使用 rowData['loading_date']（解析后的），增强版应该使用 record['装货日期']（已通过验证，是解析后的字符串）
          // 但为了明确，我们检查是否有解析后的日期字段
          loading_date: record['装货日期'], // 这个已经是 parseExcelDateEnhanced 解析后的 YYYY-MM-DD 字符串
          unloading_date: record['卸货日期'] || record['装货日期'], // 这个已经是 parseExcelDateEnhanced 解析后的 YYYY-MM-DD 字符串
          loading_weight: record['装货数量'],
          unloading_weight: record['卸货数量'],
          current_cost: record['运费金额'],
          extra_cost: record['额外费用'],
          transport_type: record['运输类型'],
          remarks: record['备注'],
          external_tracking_numbers: record['external_tracking_numbers'],
          other_platform_names: record['other_platform_names'],
          _excelRowNumber: excelRowNumber // 保存Excel行号
        };
      });

      // 保存所有有效记录（用于行数范围过滤）
      setAllValidRecords(recordsForImport);

      // 如果指定了行数范围，应用过滤
      let filteredRecords = recordsForImport;
      if (rowRangeInput.trim()) {
        const rowRange = parseRowRange(rowRangeInput, totalDataRows);
        // 根据行数范围过滤记录（注意：这里我们只能根据处理顺序来过滤）
        // 由于验证可能改变了数据顺序，我们尽量保持原始顺序
        filteredRecords = recordsForImport.filter((_, index) => {
          // index + 2 对应Excel行号（index=0对应Excel第2行，index=1对应Excel第3行...）
          return rowRange.has(index + 2);
        });
        logger.info('行数范围过滤已应用', { 
          input: rowRangeInput,
          originalCount: recordsForImport.length,
          filteredCount: filteredRecords.length 
        });
      }

      // 设置预览数据（包含Excel行号）
      setImportPreview({
        new_records: filteredRecords.map(record => ({ 
          record: (() => {
            // 移除内部字段_excelRowNumber，只保留数据库需要的字段
            const { _excelRowNumber, ...dbRecord } = record as Record<string, unknown> & { _excelRowNumber?: number };
            return dbRecord;
          })(),
          excelRowNumber: (record as Record<string, unknown> & { _excelRowNumber?: number })._excelRowNumber
        })),
        duplicate_records: [],
        total_count: filteredRecords.length,
        valid_count: filteredRecords.length,
        invalid_count: validationResult.invalidRows.length
      });

      setImportStep('preview');
      logger.success('数据验证完成，准备导入');

    } catch (error: unknown) {
      excelErrorHandler.handleParseError(error, 'Excel文件处理');
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast({ 
        title: "文件处理失败", 
        description: errorMessage, 
        variant: "destructive" 
      });
      setImportStep('upload');
    } finally {
      setIsEnhancedImporting(false);
      event.target.value = '';
    }
  }, [logger, progressManager, validationProcessor, excelErrorHandler, toast, rowRangeInput]);

  // 执行增强的导入
  const executeEnhancedImport = useCallback(async () => {
    if (!importPreview) return;

    setImportStep('processing');
    progressManager.reset(importPreview.new_records.length);

    try {
      logger.info('开始执行导入', { 
        totalRecords: importPreview.new_records.length 
      });

      const recordsToImport = importPreview.new_records.map((item) => item.record);
      
      progressManager.updateProgress(0, '准备导入数据...');
      
      // ✅ 修复：使用与标准版相同的RPC函数，支持自动创建地点并关联项目
      const { data: result, error } = await supabase.rpc('batch_import_logistics_records_with_update_1123', {
        p_records: recordsToImport,
        p_update_mode: false  // 增强版目前只支持创建模式
      });

      if (error) throw error;

      progressManager.updateProgress(importPreview.new_records.length, '导入完成');

      const importResult = importResultProcessor.processImportResult(result);
      
      logger.success('导入完成', importResult);
      
      toast({
        title: "导入成功",
        description: importResult.summary,
        variant: "default"
      });

      setImportStep('completed');
      loadWaybillCount();

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error('导入失败', { error: errorMessage });
      progressManager.addError(errorMessage);
      
      toast({
        title: "导入失败",
        description: errorMessage,
        variant: "destructive"
      });
      
      setImportStep('preview');
    }
  }, [importPreview, logger, progressManager, importResultProcessor, toast, loadWaybillCount]);

  // 关闭增强导入对话框
  const closeEnhancedImportModal = useCallback(() => {
    setImportStep('upload');
    setImportPreview(null);
    setApprovedDuplicates(new Set());
    setRowRangeInput('');
    setTotalDataRows(0);
    setAllValidRecords([]);
    logger.clear();
    progressManager.reset(0);
  }, [logger, progressManager]);

  // 当行数范围改变时，重新应用过滤
  useEffect(() => {
    if (importStep === 'preview' && allValidRecords.length > 0 && totalDataRows > 0) {
      let filteredRecords = allValidRecords;
      if (rowRangeInput.trim()) {
        const rowRange = parseRowRange(rowRangeInput, totalDataRows);
        filteredRecords = allValidRecords.filter((record, index) => {
          // 从记录中获取Excel行号，如果没有则使用索引+2
          const excelRowNumber = (record as Record<string, unknown> & { _excelRowNumber?: number })._excelRowNumber || (index + 2);
          return rowRange.has(excelRowNumber);
        });
        logger.info('行数范围已更新，重新应用过滤', { 
          input: rowRangeInput,
          filteredCount: filteredRecords.length 
        });
      }

      setImportPreview({
        new_records: filteredRecords.map(record => {
          const { _excelRowNumber, ...dbRecord } = record as Record<string, unknown> & { _excelRowNumber?: number };
          return {
            record: dbRecord,
            excelRowNumber: _excelRowNumber || 0
          };
        }),
        duplicate_records: [],
        total_count: filteredRecords.length,
        valid_count: filteredRecords.length,
        invalid_count: 0
      });
    }
  }, [rowRangeInput, allValidRecords, totalDataRows, importStep, logger]);

  // 下载增强模板
  const handleEnhancedTemplateDownload = useCallback(() => {
    try {
      generateEnhancedWaybillTemplate();
      logger.success('模板下载成功');
      toast({
        title: "模板下载成功",
        description: "请按照模板格式填写数据后重新导入",
        variant: "default"
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error('模板下载失败', { error: errorMessage });
      toast({
        title: "模板下载失败",
        description: errorMessage,
        variant: "destructive"
      });
    }
  }, [logger, toast]);

  // 删除项目运单
  const handleDeleteProjectWaybills = useCallback(async () => {
    if (!selectedProject) {
      toast({ title: "请先选择项目", variant: "destructive" });
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('logistics_records')
        .delete()
        .eq('project_name', selectedProject);

      if (error) throw error;

      toast({ 
        title: "删除成功", 
        description: `已删除项目"${selectedProject}"的所有运单记录` 
      });
      
      loadWaybillCount();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('删除运单失败:', errorMessage);
      toast({ 
        title: "删除失败", 
        description: "删除运单记录时发生错误", 
        variant: "destructive" 
      });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedProject, toast, loadWaybillCount]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadWaybillCount();
  }, [loadWaybillCount]);

  // 检查权限
  if (!isAdmin && !isOperator) {
    return (
      <div className="container mx-auto p-4">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>权限不足</AlertTitle>
          <AlertDescription>
            您没有权限访问此页面。只有系统管理员和操作员可以访问数据维护功能。
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="运单维护（增强版）"
        description="专业的运单数据导入和维护管理 - 支持多种日期格式、详细日志和实时进度"
        icon={Database}
        iconColor="text-green-600"
      />

      <div className="grid gap-6">
        <div className="bg-card rounded-lg border p-6 space-y-6">
        <Alert className="border-blue-200 bg-blue-50">
          <Database className="h-4 w-4" />
          <AlertTitle>增强版功能</AlertTitle>
          <AlertDescription>
            支持6种日期格式、复杂外部平台数据、详细日志系统和实时进度显示。
          </AlertDescription>
        </Alert>

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'standard' | 'template' | 'mapping' | 'selective' | 'delete')}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger 
              value="standard"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              标准导入
            </TabsTrigger>
            <TabsTrigger 
              value="template"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              模板导入
            </TabsTrigger>
            <TabsTrigger 
              value="mapping"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              模板管理
            </TabsTrigger>
            <TabsTrigger 
              value="selective"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              选择性更新
            </TabsTrigger>
            <TabsTrigger 
              value="delete"
              className="data-[state=active]:bg-red-600 data-[state=active]:text-white"
            >
              删除运单
            </TabsTrigger>
          </TabsList>

          {/* 标准导入标签页 */}
          <TabsContent value="standard" className="space-y-6">
            {/* 项目筛选器 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span className="font-medium">项目筛选</span>
              </div>
              <div className="flex items-center gap-4">
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.name}>
                        <div className="flex items-center gap-2">
                          <span>{project.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {project.projectStatus || '进行中'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadWaybillCount}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
              </div>
            </div>

            {/* 运单统计 */}
            {selectedProject && (
              <div className="p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">项目运单统计</h3>
                    <p className="text-sm text-muted-foreground">
                      项目: {selectedProject}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {isLoading ? '...' : waybillCount}
                    </div>
                    <div className="text-sm text-muted-foreground">条运单记录</div>
                  </div>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* 增强Excel导入 */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileUp className="h-8 w-8 text-green-600" />
                  <div>
                    <h3 className="font-semibold">增强Excel导入</h3>
                    <p className="text-sm text-muted-foreground">支持多种日期格式和外部平台数据</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button onClick={handleEnhancedTemplateDownload} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    模板
                  </Button>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleEnhancedExcelImport}
                      disabled={isEnhancedImporting}
                      className="hidden"
                      id="enhanced-waybill-import"
                    />
                    <Button asChild disabled={isEnhancedImporting}>
                      <label htmlFor="enhanced-waybill-import" className="cursor-pointer">
                        {isEnhancedImporting ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            处理中...
                          </>
                        ) : (
                          <>
                            <FileUp className="h-4 w-4 mr-2" />
                            导入
                          </>
                        )}
                      </label>
                    </Button>
                  </div>
                </div>
              </div>

              {/* 删除运单 */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Trash2 className="h-8 w-8 text-red-600" />
                  <div>
                    <h3 className="font-semibold">删除运单</h3>
                    <p className="text-sm text-muted-foreground">删除选中项目的所有运单</p>
                  </div>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleDeleteProjectWaybills}
                  disabled={!selectedProject || isDeleting || waybillCount === 0}
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      删除中...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* 模板导入标签页 */}
          <TabsContent value="template" className="space-y-6">
            <TemplateBasedImport />
          </TabsContent>

          {/* 模板管理标签页 */}
          <TabsContent value="mapping" className="space-y-6">
            <TemplateMappingManager />
          </TabsContent>

          <TabsContent value="selective" className="space-y-6">
            <SelectiveFieldUpdate 
              selectedProject={selectedProject}
              onUpdateSuccess={loadWaybillCount}
            />
          </TabsContent>

          {/* 删除运单标签页 */}
          <TabsContent value="delete" className="space-y-6">
            <DeleteWaybills onDeleteSuccess={loadWaybillCount} />
          </TabsContent>
        </Tabs>
        </div>
      </div>
      
      {/* 增强导入对话框 */}
      {importStep !== 'upload' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">增强Excel导入</h2>
                <Button variant="ghost" onClick={closeEnhancedImportModal}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>

              {/* 进度显示 */}
              {importProgress && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{importProgress.currentStep}</span>
                    <span className="text-sm text-muted-foreground">
                      {importProgress.current}/{importProgress.total} ({importProgress.percentage}%)
                    </span>
                  </div>
                  <Progress value={importProgress.percentage} className="w-full" />
                </div>
              )}

              {/* 导入日志 */}
              {importLogs.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2">导入日志</h3>
                  <div className="bg-gray-100 rounded p-3 max-h-40 overflow-y-auto">
                    {importLogs.map((log, index) => (
                      <div key={index} className={`text-xs mb-1 ${
                        log.level === 'error' ? 'text-red-600' :
                        log.level === 'warn' ? 'text-yellow-600' :
                        log.level === 'success' ? 'text-green-600' :
                        'text-gray-600'
                      }`}>
                        [{log.timestamp}] {log.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 行数范围输入 */}
              {importStep === 'preview' && totalDataRows > 0 && (
                <div className="mb-4">
                  <Label htmlFor="row-range-input" className="text-sm font-medium mb-2 block">
                    指定导入行数范围（可选）
                  </Label>
                  <div className="space-y-2">
                    <Input
                      id="row-range-input"
                      type="text"
                      placeholder="例如：1-100 或 1,3,5-10 或 1-50,60-100（留空则导入全部）"
                      value={rowRangeInput}
                      onChange={(e) => setRowRangeInput(e.target.value)}
                      className="w-full"
                    />
                    <div className="text-xs text-muted-foreground">
                      <Info className="h-3 w-3 inline mr-1" />
                      支持格式：单个数字（2）、范围（2-101）、多个范围（2-51,61-101）。Excel总行数：{totalDataRows} 行（第1行是表头，数据从第2行开始）
                    </div>
                    {rowRangeInput.trim() && (
                      <div className="text-xs text-blue-600">
                        将导入行数：{parseRowRange(rowRangeInput, totalDataRows).size} 行
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 预览数据 */}
              {importStep === 'preview' && importPreview && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2">导入预览</h3>
                  <div className="bg-blue-50 rounded p-3 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-800">
                        准备导入 {importPreview.new_records.length} 条记录
                        {rowRangeInput.trim() && (
                          <span className="text-xs text-blue-600 ml-2">
                            （已应用行数范围过滤）
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-blue-600">
                      • 支持多种日期格式解析<br/>
                      • 自动处理外部平台数据<br/>
                      • 智能字段验证和清理
                    </div>
                  </div>
                  
                  {/* 预览记录列表（显示Excel行号） */}
                  {importPreview.new_records.length > 0 && (
                    <div className="border rounded-lg max-h-64 overflow-y-auto">
                      <div className="p-2 bg-gray-50 border-b sticky top-0">
                        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-700">
                          <div className="col-span-1">行号</div>
                          <div className="col-span-2">项目</div>
                          <div className="col-span-2">司机</div>
                          <div className="col-span-2">车牌</div>
                          <div className="col-span-2">装货地点</div>
                          <div className="col-span-2">装货日期</div>
                          <div className="col-span-1">数量</div>
                        </div>
                      </div>
                      <div className="divide-y">
                        {importPreview.new_records.map((item, index) => (
                          <div key={index} className="p-2 hover:bg-gray-50">
                            <div className="grid grid-cols-12 gap-2 text-xs">
                              <div className="col-span-1 font-medium text-blue-600">
                                {item.excelRowNumber || index + 2}
                              </div>
                              <div className="col-span-2 truncate" title={String(item.record.project_name || '')}>
                                {String(item.record.project_name || '')}
                              </div>
                              <div className="col-span-2 truncate" title={String(item.record.driver_name || '')}>
                                {String(item.record.driver_name || '')}
                              </div>
                              <div className="col-span-2 truncate" title={String(item.record.license_plate || '')}>
                                {String(item.record.license_plate || '')}
                              </div>
                              <div className="col-span-2 truncate" title={String(item.record.loading_location || '')}>
                                {String(item.record.loading_location || '')}
                              </div>
                              <div className="col-span-2">
                                {/* ✅ 修复：与运单管理页面保持一致，使用相同的日期显示逻辑 */}
                                {/* 预览中的 loading_date 是 YYYY-MM-DD 格式字符串（从Excel解析后的中国时区日期） */}
                                {/* 运单管理页面使用：new Date(record.loading_date).toLocaleDateString('zh-CN', ...) */}
                                {/* 但预览中的日期已经是字符串格式，如果直接显示即可，如果需要格式化则使用 formatChinaDate */}
                                {item.record.loading_date 
                                  ? (() => {
                                      const dateValue = item.record.loading_date;
                                      // 如果已经是 YYYY-MM-DD 格式字符串，直接显示（与标准版预览保持一致）
                                      if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                                        return dateValue;
                                      }
                                      // 否则尝试格式化为日期（兼容其他格式）
                                      try {
                                        const date = new Date(dateValue as string);
                                        if (!isNaN(date.getTime())) {
                                          return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                        }
                                      } catch (error) {
                                        console.error('日期格式化错误:', error);
                                      }
                                      return String(dateValue);
                                    })()
                                  : ''}
                              </div>
                              <div className="col-span-1">
                                {String(item.record.loading_weight || '')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex justify-end gap-2">
                {importStep === 'preview' && (
                  <Button onClick={executeEnhancedImport} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    确认导入
                  </Button>
                )}
                {importStep === 'completed' && (
                  <Button onClick={closeEnhancedImportModal} className="bg-blue-600 hover:bg-blue-700">
                    完成
                  </Button>
                )}
                <Button variant="outline" onClick={closeEnhancedImportModal}>
                  取消
                </Button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
