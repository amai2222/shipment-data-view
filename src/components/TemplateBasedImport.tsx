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
  Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  platform_name: string;
  is_active: boolean;
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
}

interface FixedMapping {
  id: string;
  template_id: string;
  target_field: string;
  fixed_value: string;
  description: string;
}

interface ImportResult {
  success_count: number;
  error_count: number;
  errors: any[];
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
  const [previewData, setPreviewData] = useState<any[]>([]);
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
      setTemplates((data || []).map(t => ({
        ...t,
        platform_name: t.platform_type || 'unknown'
      })));
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
          .order('sort_order'),
        supabase
          .from('import_fixed_mappings')
          .select('*')
          .eq('template_id', templateId)
      ]);

      if (fieldMappingsResult.error) throw fieldMappingsResult.error;
      if (fixedMappingsResult.error) throw fixedMappingsResult.error;

      setFieldMappings((fieldMappingsResult.data || []).map(m => ({
        id: m.id,
        template_id: m.template_id,
        source_field: m.excel_column || '',
        target_field: m.database_field || '',
        field_type: m.field_type || 'string',
        is_required: m.is_required || false,
        default_value: m.default_value || '',
        transformation_rule: '',
        sort_order: m.display_order || 0
      })));
      setFixedMappings((fixedMappingsResult.data || []).map(m => ({
        id: m.id,
        template_id: m.template_id,
        target_field: m.mapping_type || '',
        fixed_value: m.database_value || '',
        description: ''
      })));
    } catch (error: unknown) {
      console.error('加载模板映射失败:', error);
      toast({ title: "错误", description: "加载模板映射失败", variant: "destructive" });
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
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { 
        cellDates: true, 
        cellNF: false, 
        cellText: false, 
        dateNF: 'yyyy/m/d' 
      });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        toast({ title: "错误", description: "Excel文件格式错误，至少需要表头和一行数据", variant: "destructive" });
        return;
      }

      // 获取表头
      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1) as string[][];

      // 根据模板映射转换数据
      const mappedData = rows.map((row, index) => {
        const record: Record<string, unknown> = {};
        
        // 应用字段映射
        fieldMappings.forEach(mapping => {
          const sourceIndex = headers.findIndex(h => h === mapping.source_field);
          if (sourceIndex >= 0 && sourceIndex < row.length) {
            let value = row[sourceIndex];
            
            // 数据类型转换
            if (mapping.field_type === 'number' && value !== null && value !== undefined) {
              record[mapping.target_field] = parseFloat(String(value)) || 0;
            } else if (mapping.field_type === 'date' && value) {
              // 日期处理
              if (value instanceof Date) {
                record[mapping.target_field] = value.toISOString().split('T')[0];
              } else if (typeof value === 'string') {
                // 尝试解析日期字符串
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                  record[mapping.target_field] = date.toISOString().split('T')[0];
                } else {
                  record[mapping.target_field] = value;
                }
              }
            } else if (mapping.field_type === 'boolean') {
              record[mapping.target_field] = Boolean(value) ? 'true' : 'false';
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
  const executeImport = async () => {
    if (previewData.length === 0) {
      toast({ title: "错误", description: "没有可导入的数据", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setIsPreviewDialogOpen(false);

    try {
      // 准备导入数据
      const importData = previewData.map(item => item.data);
      
      // 调用导入函数
      const { data, error } = await supabase.rpc('batch_import_logistics_records', {
        p_records: importData
      });

      if (error) throw error;

      const result = data as any;
      setImportResult({
        success_count: Number(result.success_count) || 0,
        error_count: Number(result.error_count) || 0,
        errors: Array.isArray(result.errors) ? result.errors : []
      });

      setIsResultDialogOpen(true);
      
      const result = data as any;
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
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  已选择模板: {templates.find(t => t.id === selectedTemplate)?.name}
                  <br />
                  平台: {templates.find(t => t.id === selectedTemplate)?.platform_name}
                  <br />
                  字段映射: {fieldMappings.length} 个字段
                </AlertDescription>
              </Alert>
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>数据预览</DialogTitle>
            <DialogDescription>
              预览转换后的数据，确认无误后点击导入
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>行号</TableHead>
                  {fieldMappings.map((mapping) => (
                    <TableHead key={mapping.id}>
                      {mapping.source_field} → {mapping.target_field}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.slice(0, 10).map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.row_index}</TableCell>
                    {fieldMappings.map((mapping) => (
                      <TableCell key={mapping.id}>
                        {item.data[mapping.target_field] || '-'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {previewData.length > 10 && (
              <p className="text-sm text-muted-foreground mt-2">
                显示前10条记录，共 {previewData.length} 条记录
              </p>
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
