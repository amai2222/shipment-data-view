// 基于模板映射的导入组件
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  FileUp, 
  Download, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Settings,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

// 系统字段定义（用于显示中文名称）
const SYSTEM_FIELDS = [
  { key: 'project_name', label: '项目名称', required: true },
  { key: 'chain_name', label: '合作链路', required: false },
  { key: 'driver_name', label: '司机姓名', required: true },
  { key: 'license_plate', label: '车牌号', required: true },
  { key: 'driver_phone', label: '司机电话', required: false },
  { key: 'loading_location', label: '装货地点', required: true },
  { key: 'unloading_location', label: '卸货地点', required: true },
  { key: 'loading_date', label: '装货日期', required: true },
  { key: 'unloading_date', label: '卸货日期', required: false },
  { key: 'loading_weight', label: '装货数量', required: true },
  { key: 'unloading_weight', label: '卸货数量', required: false },
  { key: 'current_cost', label: '运费金额', required: false },
  { key: 'extra_cost', label: '额外费用', required: false },
  { key: 'transport_type', label: '运输类型', required: false },
  { key: 'remarks', label: '备注', required: false },
  { key: 'other_platform_names', label: '其他平台名称', required: false },
  { key: 'other_platform_waybills', label: '其他平台运单号', required: false }
];

interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  platform_name: string;
  is_active: boolean;
  header_row?: number;      // 表头所在行号
  data_start_row?: number;  // 数据开始行号
  template_config?: {       // 模板配置对象
    header_row?: number;
    data_start_row?: number;
  };
}

interface FieldMapping {
  id: string;
  template_id: string;
  source_field: string;
  target_field: string;
  field_type: string;
  is_required: boolean;
  default_value: string;
  transformation_rule: string;
  sort_order: number;
  value_mappings?: Record<string, string>; // 值转换规则
}

interface FixedMapping {
  id: string;
  template_id: string;
  target_field: string;
  fixed_value: string;
  description: string;
}

interface ImportError {
  row?: number;
  message?: string;
  field?: string;
  [key: string]: unknown;
}

interface ImportResult {
  success_count: number;
  error_count: number;
  errors: ImportError[];
}

export default function TemplateBasedImport() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [fixedMappings, setFixedMappings] = useState<FixedMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isResultDialogOpen, setIsResultDialogOpen] = useState(false);
  interface PreviewDataItem {
    row_index: number;
    data: Record<string, unknown>;
  }
  const [previewData, setPreviewData] = useState<PreviewDataItem[]>([]);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);

  // 加载模板列表
  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('import_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTemplates((data || []).map(t => {
        const config = t.template_config || {};
        return {
          ...t,
          platform_name: t.platform_type || 'unknown',
          header_row: config.header_row || 1,
          data_start_row: config.data_start_row || 2,
          template_config: config
        };
      }));
    } catch (error: unknown) {
      console.error('加载模板失败:', error);
      toast({ title: "错误", description: "加载模板列表失败", variant: "destructive" });
    }
  };

  // 加载模板映射
  const loadTemplateMappings = async (templateId: string) => {
    try {
      const [fieldMappingsResult, fixedMappingsResult] = await Promise.all([
        supabase
          .from('import_field_mappings')
          .select('*')
          .eq('template_id', templateId)
          .order('display_order'), // 修复：使用 display_order 而不是 sort_order
        supabase
          .from('import_fixed_mappings')
          .select('*')
          .eq('template_id', templateId)
      ]);

      if (fieldMappingsResult.error) throw fieldMappingsResult.error;
      if (fixedMappingsResult.error) throw fixedMappingsResult.error;

      setFieldMappings((fieldMappingsResult.data || []).map(m => {
        // 从 validation_rules 中读取值转换规则
        const validationRules = m.validation_rules || {};
        const valueMappings = validationRules.value_mappings || {};
        
        return {
          id: m.id,
          template_id: m.template_id,
          source_field: m.excel_column || '',
          target_field: m.database_field || '',
          field_type: m.field_type || 'string',
          is_required: m.is_required || false,
          default_value: m.default_value || '',
          transformation_rule: '',
          sort_order: m.display_order || 0,
          value_mappings: valueMappings
        };
      }));
      setFixedMappings((fixedMappingsResult.data || []).map(m => ({
        id: m.id,
        template_id: m.template_id,
        // 修复：字段名存储在 database_value 中，固定值存储在 excel_value 中
        target_field: m.database_value || '',
        fixed_value: m.excel_value || '',
        description: ''
      })));
    } catch (error: unknown) {
      console.error('加载模板映射失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast({ 
        title: "错误", 
        description: `加载模板映射失败: ${errorMessage}`,
        variant: "destructive" 
      });
    }
  };

  // 选择模板
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (templateId) {
      loadTemplateMappings(templateId);
    } else {
      setFieldMappings([]);
      setFixedMappings([]);
    }
  };

  // 处理Excel文件
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedTemplate) {
      toast({ title: "错误", description: "请先选择导入模板", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // 获取当前模板配置
      const currentTemplate = templates.find(t => t.id === selectedTemplate);
      const headerRow = currentTemplate?.header_row || 1;      // 默认第1行
      const dataStartRow = currentTemplate?.data_start_row || 2;  // 默认第2行
      
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { 
        cellDates: true, 
        cellNF: false, 
        cellText: false, 
        dateNF: 'yyyy/m/d' 
      });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // 读取所有数据（从第1行开始）
      const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

      if (allData.length < dataStartRow) {
        toast({ 
          title: "错误", 
          description: `Excel文件数据不足，配置的数据开始行为第${dataStartRow}行，但文件只有${allData.length}行`, 
          variant: "destructive" 
        });
        return;
      }

      // 根据配置获取表头（注意：数组索引从0开始，所以要减1）
      const headers = allData[headerRow - 1] as string[];
      // 获取数据行（从配置的数据开始行读取）
      const rows = allData.slice(dataStartRow - 1) as string[][];

      // 根据模板映射转换数据
      const mappedData = rows.map((row, index) => {
        const record: Record<string, unknown> = {};
        
        // 应用字段映射
        fieldMappings.forEach(mapping => {
          const sourceIndex = headers.findIndex(h => h === mapping.source_field);
          if (sourceIndex >= 0 && sourceIndex < row.length) {
            let value = row[sourceIndex];
            
            // 应用值转换规则（如果存在）
            if (mapping.value_mappings && value !== null && value !== undefined) {
              const valueStr = String(value).trim();
              // 先查找精确匹配
              if (mapping.value_mappings[valueStr]) {
                value = mapping.value_mappings[valueStr];
              } else if (mapping.value_mappings['default']) {
                // 如果没有精确匹配，使用默认值
                value = mapping.value_mappings['default'];
              }
              // 如果没有匹配的规则，保持原值
            }
            
            // 数据类型转换
            if (mapping.field_type === 'number' && value !== null && value !== undefined) {
              record[mapping.target_field] = parseFloat(String(value)) || 0;
            } else if (mapping.field_type === 'date' && value) {
              // 日期处理
              // 检查是否为 Date 对象
              if (Object.prototype.toString.call(value) === '[object Date]') {
                const dateValue = value as unknown as Date;
                record[mapping.target_field] = dateValue.toISOString().split('T')[0];
              } else if (typeof value === 'string') {
                // 尝试解析日期字符串
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                  record[mapping.target_field] = date.toISOString().split('T')[0];
                } else {
                  record[mapping.target_field] = value;
                }
              } else {
                record[mapping.target_field] = String(value);
              }
            } else if (mapping.field_type === 'boolean') {
              record[mapping.target_field] = value ? 'true' : 'false';
            } else {
              record[mapping.target_field] = String(value || '');
            }
          } else if (mapping.default_value) {
            // 使用默认值
            record[mapping.target_field] = mapping.default_value;
          }
        });

        // 应用固定值映射
        fixedMappings.forEach(mapping => {
          record[mapping.target_field] = mapping.fixed_value;
        });

        return {
          row_index: index + 2, // Excel行号（从2开始，因为第1行是表头）
          data: record
        };
      }).filter(item => {
        // 过滤掉空记录
        return Object.keys(item.data).length > 0;
      });

      setPreviewData(mappedData);
      setIsPreviewDialogOpen(true);
    } catch (error: unknown) {
      console.error('处理Excel文件失败:', error);
      toast({ 
        title: "错误", 
        description: `处理Excel文件失败: ${error instanceof Error ? error.message : "未知错误"}`, 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 执行导入
  // 注意：此函数与标准导入使用完全相同的逻辑
  // - 使用相同的 RPC 函数 batch_import_logistics_records
  // - 该函数内部包含：验重、自动运单编号、保存数据库、触发器等所有逻辑
  const executeImport = async () => {
    if (previewData.length === 0) {
      toast({ title: "错误", description: "没有可导入的数据", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setIsPreviewDialogOpen(false);

    try {
      // 准备导入数据 - 确保字段格式与标准导入完全一致
      // batch_import_logistics_records 函数期望的字段格式：
      // - project_name, chain_name, driver_name, license_plate, driver_phone
      // - loading_location, unloading_location
      // - loading_date, unloading_date (日期字符串，格式：YYYY-MM-DD)
      // - loading_weight, unloading_weight (数字)
      // - current_cost, extra_cost (数字，可为空)
      // - transport_type (字符串，默认'实际运输')
      // - remarks (字符串，可为空)
      // - external_tracking_numbers (字符串数组，可为空)
      // - other_platform_names (字符串数组，可为空)
      const importData = previewData.map(item => {
        const record = item.data;
        
        // 确保日期格式正确（YYYY-MM-DD）
        if (record.loading_date) {
          const loadingDate = new Date(record.loading_date as string);
          if (!isNaN(loadingDate.getTime())) {
            record.loading_date = loadingDate.toISOString().split('T')[0];
          }
        }
        
        if (record.unloading_date) {
          const unloadingDate = new Date(record.unloading_date as string);
          if (!isNaN(unloadingDate.getTime())) {
            record.unloading_date = unloadingDate.toISOString().split('T')[0];
          }
        } else if (record.loading_date) {
          // 如果没有卸货日期，使用装货日期
          record.unloading_date = record.loading_date;
        }
        
        // 确保数字字段为数字类型
        if (record.loading_weight !== undefined && record.loading_weight !== null) {
          record.loading_weight = parseFloat(String(record.loading_weight)) || 0;
        }
        if (record.unloading_weight !== undefined && record.unloading_weight !== null) {
          record.unloading_weight = parseFloat(String(record.unloading_weight)) || null;
        }
        if (record.current_cost !== undefined && record.current_cost !== null) {
          record.current_cost = parseFloat(String(record.current_cost)) || 0;
        } else {
          record.current_cost = 0;
        }
        if (record.extra_cost !== undefined && record.extra_cost !== null) {
          record.extra_cost = parseFloat(String(record.extra_cost)) || 0;
        } else {
          record.extra_cost = 0;
        }
        
        // 确保 transport_type 有默认值
        if (!record.transport_type) {
          record.transport_type = '实际运输';
        }
        
        // 确保数组字段格式正确
        if (record.external_tracking_numbers && !Array.isArray(record.external_tracking_numbers)) {
          record.external_tracking_numbers = [];
        }
        if (record.other_platform_names && !Array.isArray(record.other_platform_names)) {
          record.other_platform_names = [];
        }
        
        return record;
      });
      
      // 调用与标准导入相同的 RPC 函数
      // 该函数内部包含：
      // 1. 验重逻辑（基于8个关键字段）
      // 2. 自动生成运单编号（调用 generate_auto_number）
      // 3. 保存到数据库（logistics_records 表）
      // 4. 触发数据库触发器（自动处理关联数据）
      interface BatchImportResult {
        success_count: number;
        error_count: number;
        errors?: ImportError[];
      }
      
      const { data, error } = await supabase.rpc<BatchImportResult>('batch_import_logistics_records', {
        p_records: importData
      });

      if (error) throw error;

      const result = data;
      setImportResult({
        success_count: Number(result.success_count) || 0,
        error_count: Number(result.error_count) || 0,
        errors: Array.isArray(result.errors) ? result.errors : []
      });

      setIsResultDialogOpen(true);
      if (Number(result.success_count) > 0) {
        toast({ 
          title: "导入成功", 
          description: `成功导入 ${result.success_count} 条记录` 
        });
      }
      
      if (Number(result.error_count) > 0) {
        toast({ 
          title: "部分失败", 
          description: `${result.error_count} 条记录导入失败`, 
          variant: "destructive" 
        });
      }

    } catch (error: unknown) {
      console.error('导入失败:', error);
      toast({ 
        title: "导入失败", 
        description: error instanceof Error ? error.message : "导入过程中发生错误", 
        variant: "destructive" 
      });
    } finally {
      setIsImporting(false);
      setImportProgress(100);
    }
  };

  // 下载模板示例
  const downloadTemplateExample = () => {
    if (!selectedTemplate || fieldMappings.length === 0) {
      toast({ title: "错误", description: "请先选择模板", variant: "destructive" });
      return;
    }

    const selectedTemplateData = templates.find(t => t.id === selectedTemplate);
    if (!selectedTemplateData) return;

    const wb = XLSX.utils.book_new();
    
    // 创建表头
    const headers = fieldMappings.map(mapping => mapping.source_field);
    const sampleData = fieldMappings.map(mapping => {
      // 根据字段类型生成示例数据
      switch (mapping.target_field) {
        case 'auto_number':
          return 'YDN20250101-001';
        case 'project_name':
          return '示例项目';
        case 'driver_name':
          return '张三';
        case 'license_plate':
          return '京A12345';
        case 'loading_location':
          return '北京仓库';
        case 'unloading_location':
          return '上海仓库';
        case 'loading_date':
          return '2025-01-15';
        case 'loading_weight':
          return '10.5';
        case 'current_cost':
          return '5000';
        default:
          return '示例数据';
      }
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, sampleData]);
    XLSX.utils.book_append_sheet(wb, ws, "导入模板");
    XLSX.writeFile(wb, `${selectedTemplateData.platform_name}_导入模板.xlsx`);
  };

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            基于模板的导入
          </CardTitle>
          <CardDescription>
            使用预配置的模板映射来导入不同平台的数据
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 模板选择 */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">选择导入模板</label>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择要使用的导入模板" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <span>{template.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {template.platform_name}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate && (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div>
                        <strong>已选择模板:</strong> {templates.find(t => t.id === selectedTemplate)?.name}
                      </div>
                      <div>
                        <strong>平台:</strong> {templates.find(t => t.id === selectedTemplate)?.platform_name}
                      </div>
                      <div>
                        <strong>字段映射:</strong> {fieldMappings.length} 个字段
                      </div>
                      <div className="text-blue-600 font-medium">
                        📌 Excel表头在第{templates.find(t => t.id === selectedTemplate)?.header_row || 1}行，
                        数据从第{templates.find(t => t.id === selectedTemplate)?.data_start_row || 2}行开始读取
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* 字段映射详情 */}
                {fieldMappings.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">字段映射关系</CardTitle>
                      <CardDescription className="text-xs">
                        显示数据库字段与Excel字段的对应关系
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {fieldMappings.map((mapping) => {
                          const fieldInfo = SYSTEM_FIELDS.find(f => f.key === mapping.target_field);
                          const fieldLabel = fieldInfo?.label || mapping.target_field;
                          const isRequired = fieldInfo?.required || mapping.is_required;
                          
                          return (
                            <div 
                              key={mapping.id} 
                              className="flex items-center justify-between p-2 border rounded-md hover:bg-gray-50"
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <div className={`font-medium ${isRequired ? 'text-red-600' : 'text-gray-700'}`}>
                                  {fieldLabel}
                                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                                </div>
                                <span className="text-xs text-gray-400">
                                  ({mapping.target_field})
                                </span>
                                <span className="text-gray-400">→</span>
                                <div className="text-sm text-gray-600">
                                  {mapping.source_field}
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {mapping.field_type}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 固定值映射 */}
                {fixedMappings.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">固定值映射</CardTitle>
                      <CardDescription className="text-xs">
                        这些字段将使用固定值，不从Excel读取
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {fixedMappings.map((mapping) => {
                          const fieldInfo = SYSTEM_FIELDS.find(f => f.key === mapping.target_field);
                          const fieldLabel = fieldInfo?.label || mapping.target_field;
                          
                          return (
                            <div 
                              key={mapping.id} 
                              className="flex items-center justify-between p-2 border rounded-md bg-blue-50"
                            >
                              <div className="flex items-center gap-2">
                                <div className="font-medium text-gray-700">
                                  {fieldLabel}
                                </div>
                                <span className="text-xs text-gray-400">
                                  ({mapping.target_field})
                                </span>
                                <span className="text-gray-400">=</span>
                                <div className="text-sm font-semibold text-blue-600">
                                  {mapping.fixed_value}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={!selectedTemplate || isLoading}
                className="hidden"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedTemplate || isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4 mr-2" />
                    选择Excel文件
                  </>
                )}
              </Button>
            </div>

            <Button 
              variant="outline" 
              onClick={downloadTemplateExample}
              disabled={!selectedTemplate}
            >
              <Download className="h-4 w-4 mr-2" />
              下载模板示例
            </Button>
          </div>

          {/* 导入进度 */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>导入进度</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 预览对话框 */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>数据预览</DialogTitle>
            <DialogDescription>
              预览转换后的数据，确认无误后点击导入
            </DialogDescription>
          </DialogHeader>
          {/* 可横向滚动的表格容器 */}
          <div className="overflow-auto max-h-[60vh] border rounded-md">
            <div className="overflow-x-auto min-w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[60px]">行号</TableHead>
                    {/* 字段映射列 */}
                    {fieldMappings.map((mapping) => {
                      const fieldInfo = SYSTEM_FIELDS.find(f => f.key === mapping.target_field);
                      const fieldLabel = fieldInfo?.label || mapping.target_field;
                      return (
                        <TableHead key={mapping.id} className="min-w-[150px] whitespace-nowrap">
                          {fieldLabel} ({mapping.source_field})
                        </TableHead>
                      );
                    })}
                    {/* 固定值映射列 */}
                    {fixedMappings.map((mapping) => {
                      const fieldInfo = SYSTEM_FIELDS.find(f => f.key === mapping.target_field);
                      const fieldLabel = fieldInfo?.label || mapping.target_field;
                      return (
                        <TableHead key={`fixed-${mapping.id}`} className="bg-blue-50 min-w-[150px] whitespace-nowrap">
                          {fieldLabel} <span className="text-xs text-blue-600">(固定值)</span>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.slice(0, 10).map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">{item.row_index}</TableCell>
                      {/* 字段映射数据 */}
                      {fieldMappings.map((mapping) => (
                        <TableCell key={mapping.id} className="min-w-[150px]">
                          {item.data[mapping.target_field] !== undefined && item.data[mapping.target_field] !== null
                            ? String(item.data[mapping.target_field])
                            : '-'}
                        </TableCell>
                      ))}
                      {/* 固定值映射数据 */}
                      {fixedMappings.map((mapping) => (
                        <TableCell key={`fixed-${mapping.id}`} className="bg-blue-50 font-semibold text-blue-600 min-w-[150px]">
                          {mapping.fixed_value}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          {/* 固定值映射说明和记录数提示 */}
          <div className="mt-4 space-y-2">
            {previewData.length > 10 && (
              <p className="text-sm text-muted-foreground">
                显示前10条记录，共 {previewData.length} 条记录
              </p>
            )}
            {/* 固定值映射说明 */}
            {fixedMappings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>固定值映射说明：</strong>
                  {fixedMappings.map((mapping, idx) => {
                    const fieldInfo = SYSTEM_FIELDS.find(f => f.key === mapping.target_field);
                    const fieldLabel = fieldInfo?.label || mapping.target_field;
                    return (
                      <span key={mapping.id}>
                        {idx > 0 && '、'}
                        {fieldLabel} = {mapping.fixed_value}
                      </span>
                    );
                  })}
                  （这些字段使用固定值，不从Excel读取）
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={executeImport} disabled={isImporting}>
              {isImporting ? '导入中...' : '确认导入'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入结果对话框 */}
      <Dialog open={isResultDialogOpen} onOpenChange={setIsResultDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>导入结果</DialogTitle>
            <DialogDescription>
              导入操作已完成
            </DialogDescription>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 p-4 border rounded-lg">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {importResult.success_count}
                    </div>
                    <div className="text-sm text-muted-foreground">成功导入</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-4 border rounded-lg">
                  <XCircle className="h-8 w-8 text-red-600" />
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {importResult.error_count}
                    </div>
                    <div className="text-sm text-muted-foreground">导入失败</div>
                  </div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">错误详情:</h4>
                  <div className="max-h-40 overflow-auto space-y-2">
                    {importResult.errors.map((error, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          {typeof error === 'string' ? error : JSON.stringify(error)}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsResultDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
