// 增强的运单维护页面 - 集成数据维护-数据导入的专业处理功能
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  const [activeTab, setActiveTab] = useState<'standard' | 'template' | 'mapping' | 'selective'>('standard');
  
  // 增强的导入状态
  const [isEnhancedImporting, setIsEnhancedImporting] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'confirmation' | 'processing' | 'completed'>('upload');
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importLogs, setImportLogs] = useState<LogEntry[]>([]);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [approvedDuplicates, setApprovedDuplicates] = useState<Set<number>>(new Set());
  
  // 创建增强的日志记录器
  const logger = createEnhancedLogger((logs) => setImportLogs(logs));
  const progressManager = createImportProgressManager(0, (progress) => setImportProgress(progress));
  const validationProcessor = new ValidationResultProcessor(logger);
  const excelErrorHandler = new ExcelParseErrorHandler(logger);
  const importResultProcessor = new ImportResultProcessor(logger);

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

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, start_date, end_date, project_status')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error('加载项目失败:', error);
      toast({ title: "错误", description: "加载项目列表失败", variant: "destructive" });
    }
  }, [toast]);

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
    } catch (error: any) {
      console.error('加载运单数量失败:', error);
      setWaybillCount(0);  // 失败不提示，避免干扰
    } finally {
      setIsLoading(false);
    }
  }, [selectedProject, toast]);

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
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error('Excel文件至少需要包含表头和一行数据');
      }

      logger.info('Excel文件解析成功', { 
        totalRows: jsonData.length - 1,
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
        const mappedData = {
          '项目名称': rowData['项目名称'],
          '合作链路': rowData['合作链路(可选)'] || rowData['合作链路'],
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
          'other_platform_names': rowData['other_platform_names'] || []
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
      const recordsForImport = processedResult.processedRows.map(record => ({
        project_name: record['项目名称'],
        chain_name: record['合作链路'],
        driver_name: record['司机姓名'],
        license_plate: record['车牌号'],
        driver_phone: record['司机电话'],
        loading_location: record['装货地点'],
        unloading_location: record['卸货地点'],
        loading_date: record['装货日期'],
        unloading_date: record['卸货日期'],
        loading_weight: record['装货数量'],
        unloading_weight: record['卸货数量'],
        current_cost: record['运费金额'],
        extra_cost: record['额外费用'],
        transport_type: record['运输类型'],
        remarks: record['备注'],
        external_tracking_numbers: record['external_tracking_numbers'],
        other_platform_names: record['other_platform_names']
      }));

      // 设置预览数据
      setImportPreview({
        new_records: recordsForImport.map(record => ({ record })),
        duplicate_records: [],
        total_count: recordsForImport.length,
        valid_count: recordsForImport.length,
        invalid_count: validationResult.invalidRows.length
      });

      setImportStep('preview');
      logger.success('数据验证完成，准备导入');

    } catch (error: any) {
      excelErrorHandler.handleParseError(error, 'Excel文件处理');
      toast({ 
        title: "文件处理失败", 
        description: error.message, 
        variant: "destructive" 
      });
      setImportStep('upload');
    } finally {
      setIsEnhancedImporting(false);
      event.target.value = '';
    }
  }, [logger, progressManager, validationProcessor, excelErrorHandler, toast]);

  // 执行增强的导入
  const executeEnhancedImport = useCallback(async () => {
    if (!importPreview) return;

    setImportStep('processing');
    progressManager.reset(importPreview.new_records.length);

    try {
      logger.info('开始执行导入', { 
        totalRecords: importPreview.new_records.length 
      });

      const recordsToImport = importPreview.new_records.map((item: any) => item.record);
      
      progressManager.updateProgress(0, '准备导入数据...');
      
      const { data: result, error } = await supabase.rpc('batch_import_logistics_records', {
        p_records: recordsToImport
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

    } catch (error: any) {
      logger.error('导入失败', { error: error.message });
      progressManager.addError(error.message);
      
      toast({
        title: "导入失败",
        description: error.message,
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
    logger.clear();
    progressManager.reset(0);
  }, [logger, progressManager]);

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
    } catch (error: any) {
      logger.error('模板下载失败', { error: error.message });
      toast({
        title: "模板下载失败",
        description: error.message,
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
    } catch (error: any) {
      console.error('删除运单失败:', error);
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
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-4">
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
                            {project.project_status || '进行中'}
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

              {/* 预览数据 */}
              {importStep === 'preview' && importPreview && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2">导入预览</h3>
                  <div className="bg-blue-50 rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-blue-800">
                        准备导入 {importPreview.new_records.length} 条记录
                      </span>
                    </div>
                    <div className="text-xs text-blue-600">
                      • 支持多种日期格式解析<br/>
                      • 自动处理外部平台数据<br/>
                      • 智能字段验证和清理
                    </div>
                  </div>
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
