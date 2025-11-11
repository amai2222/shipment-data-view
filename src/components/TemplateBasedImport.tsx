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
  AlertCircle,
  Plus,
  Siren,
  Loader2
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

interface ImportPreviewResult {
  new_records: Array<{ record: Record<string, unknown> }>;
  update_records: Array<{ 
    record: Record<string, unknown>; 
    existing_record_id: string; 
    existing_auto_number: string 
  }>;
  error_records: Array<{ record: Record<string, unknown>; error: string }>;
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
  
  // 导入预览和模式选择相关状态
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [importStep, setImportStep] = useState<'preview' | 'confirmation' | 'processing' | 'completed'>('preview');
  const [importMode, setImportMode] = useState<'create' | 'update'>('create');
  const [approvedDuplicates, setApprovedDuplicates] = useState<Set<number>>(new Set());

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
            if (mapping.target_field === 'external_tracking_numbers' || mapping.target_field === 'other_platform_names') {
              // 数组字段处理：将字符串转换为字符串数组
              if (value === null || value === undefined || value === '') {
                record[mapping.target_field] = [];
              } else if (Array.isArray(value)) {
                // 如果已经是数组，确保所有元素都是字符串
                record[mapping.target_field] = value.map(v => String(v).trim()).filter(v => v);
              } else {
                // 字符串转数组：支持逗号分隔
                const strValue = String(value).trim();
                if (strValue) {
                  record[mapping.target_field] = strValue.split(',').map(v => v.trim()).filter(v => v);
                } else {
                  record[mapping.target_field] = [];
                }
              }
            } else if (mapping.field_type === 'number' && value !== null && value !== undefined) {
              record[mapping.target_field] = parseFloat(String(value)) || 0;
            } else if (mapping.field_type === 'date' && value) {
              // 日期处理：解析Excel日期为中国时区的日期字符串（YYYY-MM-DD格式）
              // Excel中的日期应该被理解为中国时区的日期，然后发送到后端转换为UTC存储
              let date: Date | null = null;
              
              // 检查是否为 Date 对象
              if (Object.prototype.toString.call(value) === '[object Date]') {
                date = value as unknown as Date;
                if (isNaN(date.getTime())) {
                  record[mapping.target_field] = String(value);
                } else {
                  // 使用本地时区格式化日期（不使用toISOString，避免UTC转换）
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  record[mapping.target_field] = `${year}-${month}-${day}`;
                }
              } else if (typeof value === 'string') {
                const dateStr = value.split(' ')[0];
                // 如果已经是YYYY-MM-DD格式，直接使用
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                  record[mapping.target_field] = dateStr;
                } else {
                  // 尝试解析日期字符串
                  date = new Date(value);
                  if (!isNaN(date.getTime())) {
                    // 使用本地时区格式化日期（不使用toISOString，避免UTC转换）
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    record[mapping.target_field] = `${year}-${month}-${day}`;
                  } else {
                    record[mapping.target_field] = value;
                  }
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
          // 如果是数组字段，需要将固定值转换为数组
          if (mapping.target_field === 'external_tracking_numbers' || mapping.target_field === 'other_platform_names') {
            const strValue = String(mapping.fixed_value).trim();
            record[mapping.target_field] = strValue 
              ? strValue.split(',').map(v => v.trim()).filter(v => v)
              : [];
          } else {
            record[mapping.target_field] = mapping.fixed_value;
          }
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
      
      // 准备数据用于预览（转换为标准格式）
      const recordsForPreview = mappedData.map(item => item.data);
      
      // 调用预览函数检查重复数据
      await getImportPreview(recordsForPreview);
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

  // 获取导入预览（检查重复数据）
  const getImportPreview = async (records: Record<string, unknown>[]) => {
    setImportStep('preview');
    setIsLoading(true);
    
    try {
      interface PreviewImportResult {
        new_records: Array<{ record: Record<string, unknown> }>;
        update_records: Array<{ 
          record: Record<string, unknown>; 
          existing_record_id: string; 
          existing_auto_number: string 
        }>;
        error_records: Array<{ record: Record<string, unknown>; error: string }>;
      }
      
      const { data, error } = await supabase.rpc<PreviewImportResult>('preview_import_with_update_mode', {
        p_records: records
      });

      if (error) throw error;

      setImportPreview(data);
      setApprovedDuplicates(new Set());
      setImportStep('confirmation');
      setIsPreviewDialogOpen(true);
    } catch (error: unknown) {
      console.error('获取导入预览失败:', error);
      toast({
        title: "预览失败",
        description: error instanceof Error ? error.message : "无法预览导入数据",
        variant: "destructive"
      });
      setImportStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  // 执行导入
  // 注意：此函数与标准导入使用完全相同的逻辑
  // - 使用相同的 RPC 函数 batch_import_logistics_records_with_update
  // - 支持创建模式和更新模式
  const executeImport = async () => {
    if (!importPreview) {
      toast({ title: "错误", description: "没有可导入的数据", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportStep('processing');
    // 保持预览对话框打开，显示导入进度
    // setIsPreviewDialogOpen(false);

    try {
      // 准备导入数据 - 根据选择的模式组合记录
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
        // 保持对话框打开
        setIsImporting(false);
        return;
      }

      // 格式化数据 - 确保字段格式与标准导入完全一致
      const importData = recordsToImport.map(record => {
        
        // 确保日期格式正确（YYYY-MM-DD）
        // 确保日期格式正确（已经是YYYY-MM-DD格式，不需要转换）
        // 如果日期字段不是标准格式，尝试解析并格式化为YYYY-MM-DD
        if (record.loading_date) {
          const loadingDateStr = String(record.loading_date);
          // 如果已经是YYYY-MM-DD格式，直接使用
          if (!/^\d{4}-\d{2}-\d{2}$/.test(loadingDateStr)) {
            const loadingDate = new Date(loadingDateStr);
            if (!isNaN(loadingDate.getTime())) {
              // 使用本地时区格式化日期（不使用toISOString，避免UTC转换）
              const year = loadingDate.getFullYear();
              const month = String(loadingDate.getMonth() + 1).padStart(2, '0');
              const day = String(loadingDate.getDate()).padStart(2, '0');
              record.loading_date = `${year}-${month}-${day}`;
            }
          }
        }
        
        if (record.unloading_date) {
          const unloadingDateStr = String(record.unloading_date);
          // 如果已经是YYYY-MM-DD格式，直接使用
          if (!/^\d{4}-\d{2}-\d{2}$/.test(unloadingDateStr)) {
            const unloadingDate = new Date(unloadingDateStr);
            if (!isNaN(unloadingDate.getTime())) {
              // 使用本地时区格式化日期（不使用toISOString，避免UTC转换）
              const year = unloadingDate.getFullYear();
              const month = String(unloadingDate.getMonth() + 1).padStart(2, '0');
              const day = String(unloadingDate.getDate()).padStart(2, '0');
              record.unloading_date = `${year}-${month}-${day}`;
            }
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
        
        // 处理数组字段：如果为空则不传递，避免类型转换错误
        // 数据库函数期望 text[] 类型，但通过 RPC 传递时会被序列化为 JSONB
        // 如果数组为空，不传递该字段，让数据库函数使用默认值
        if (record.external_tracking_numbers !== undefined && record.external_tracking_numbers !== null) {
          if (!Array.isArray(record.external_tracking_numbers)) {
            // 如果不是数组，尝试转换为数组
            const strValue = String(record.external_tracking_numbers).trim();
            const arr = strValue 
              ? strValue.split(',').map(v => v.trim()).filter(v => v)
              : [];
            if (arr.length > 0) {
              record.external_tracking_numbers = arr;
            } else {
              // 如果数组为空，删除该字段，不传递给数据库
              delete record.external_tracking_numbers;
            }
          } else {
            // 确保数组中的元素都是字符串
            const arr = record.external_tracking_numbers
              .map(v => String(v).trim())
              .filter(v => v);
            if (arr.length > 0) {
              record.external_tracking_numbers = arr;
            } else {
              // 如果数组为空，删除该字段
              delete record.external_tracking_numbers;
            }
          }
        } else {
          // 如果字段不存在或为 null，不传递该字段
          delete record.external_tracking_numbers;
        }
        
        if (record.other_platform_names !== undefined && record.other_platform_names !== null) {
          if (!Array.isArray(record.other_platform_names)) {
            // 如果不是数组，尝试转换为数组
            const strValue = String(record.other_platform_names).trim();
            const arr = strValue 
              ? strValue.split(',').map(v => v.trim()).filter(v => v)
              : [];
            if (arr.length > 0) {
              record.other_platform_names = arr;
            } else {
              // 如果数组为空，删除该字段
              delete record.other_platform_names;
            }
          } else {
            // 确保数组中的元素都是字符串
            const arr = record.other_platform_names
              .map(v => String(v).trim())
              .filter(v => v);
            if (arr.length > 0) {
              record.other_platform_names = arr;
            } else {
              // 如果数组为空，删除该字段
              delete record.other_platform_names;
            }
          }
        } else {
          // 如果字段不存在或为 null，不传递该字段
          delete record.other_platform_names;
        }
        
        return record;
      });
      
      // 调用支持更新模式的 RPC 函数
      interface BatchImportResult {
        success_count: number;
        error_count: number;
        inserted_count?: number;
        updated_count?: number;
        errors?: ImportError[];
      }
      
      const { data, error } = await supabase.rpc<BatchImportResult>('batch_import_logistics_records_with_update', {
        p_records: importData,
        p_update_mode: importMode === 'update'
      });

      if (error) throw error;

      const result = data;
      const insertedCount = Number(result.inserted_count) || 0;
      const updatedCount = Number(result.updated_count) || 0;
      
      setImportResult({
        success_count: Number(result.success_count) || 0,
        error_count: Number(result.error_count) || 0,
        errors: Array.isArray(result.errors) ? result.errors : []
      });

      setImportStep('completed');
      // 先关闭预览对话框，再打开结果对话框
      setIsPreviewDialogOpen(false);
      setIsResultDialogOpen(true);
      
      if (Number(result.success_count) > 0) {
        const description = importMode === 'update' && updatedCount > 0
          ? `成功导入 ${result.success_count} 条记录（其中创建 ${insertedCount} 条，更新 ${updatedCount} 条）`
          : `成功导入 ${result.success_count} 条记录`;
        toast({ 
          title: "导入成功", 
          description
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
      // 导入失败时，回到确认步骤，保持对话框打开
      setImportStep('confirmation');
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
            <DialogTitle>导入预览</DialogTitle>
            <DialogDescription>
              {importStep === 'preview' && '正在检查重复数据...'}
              {importStep === 'confirmation' && '请选择导入模式并确认要导入的记录'}
              {importStep === 'processing' && '正在导入数据...'}
              {importStep === 'completed' && '导入完成'}
            </DialogDescription>
          </DialogHeader>
          
          {/* 预览阶段 */}
          {importStep === 'preview' && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-lg font-medium">正在分析数据...</p>
                <p className="text-sm text-muted-foreground">系统正在检查重复记录和验证数据</p>
              </div>
            </div>
          )}

          {/* 确认阶段 */}
          {importStep === 'confirmation' && importPreview && (
            <div className="flex-1 overflow-y-auto space-y-6">
              {/* 导入模式选择 */}
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <h3 className="font-semibold text-lg mb-4">选择导入模式</h3>
                <RadioGroup value={importMode} onValueChange={(value) => setImportMode(value as 'create' | 'update')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="create" id="create-mode" />
                    <Label htmlFor="create-mode" className="flex-1">
                      <div className="font-medium">全部创建新记录 (生成新运单号)</div>
                      <div className="text-sm text-muted-foreground">
                        为所有记录创建新的运单，即使存在重复记录也会强制创建
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="update" id="update-mode" />
                    <Label htmlFor="update-mode" className="flex-1">
                      <div className="font-medium">更新现有记录 (保留运单号,更新其他字段)</div>
                      <div className="text-sm text-muted-foreground">
                        对于重复记录，更新现有记录的其他字段，保留原有运单号
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 数据统计 */}
              <div className="grid gap-4 md:grid-cols-3">
                {/* 新记录统计 */}
                <div className="p-4 border border-green-200 rounded-md bg-green-50 dark:bg-green-900/20 dark:border-green-700">
                  <h4 className="font-semibold text-lg text-green-800 dark:text-green-300 flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    {importPreview.new_records.length} 条新记录
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    这些记录在数据库中不存在，将被直接导入。
                  </p>
                </div>

                {/* 更新记录统计 */}
                {importPreview.update_records.length > 0 && (
                  <div className="p-4 border border-yellow-300 rounded-md bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600">
                    <h4 className="font-semibold text-lg text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                      <RefreshCw className="h-5 w-5" />
                      {importPreview.update_records.length} 条重复记录
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      这些记录在数据库中已存在，将根据选择的模式处理。
                    </p>
                  </div>
                )}

                {/* 错误记录统计 */}
                {importPreview.error_records.length > 0 && (
                  <div className="p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20 dark:border-red-600">
                    <h4 className="font-semibold text-lg text-red-800 dark:text-red-300 flex items-center gap-2">
                      <Siren className="h-5 w-5" />
                      {importPreview.error_records.length} 条错误记录
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      这些记录存在数据错误，无法导入。
                    </p>
                  </div>
                )}
              </div>

              {/* 重复记录详情（支持逐条勾选） */}
              {importPreview.update_records.length > 0 && (
                <div className="p-4 border border-yellow-300 rounded-md bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600">
                  <h4 className="font-semibold text-lg text-yellow-800 dark:text-yellow-300 mb-4">
                    重复记录详情
                  </h4>
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <div>
                      <label className="inline-flex items-center gap-2">
                        <Checkbox
                          checked={approvedDuplicates.size === importPreview.update_records.length && importPreview.update_records.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setApprovedDuplicates(new Set(importPreview.update_records.map((_, i) => i)));
                            } else {
                              setApprovedDuplicates(new Set());
                            }
                          }}
                        />
                        <span>全选重复记录</span>
                      </label>
                    </div>
                    <div className="text-muted-foreground">
                      已选择 {approvedDuplicates.size} / {importPreview.update_records.length}
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {importPreview.update_records.map((item, index) => (
                      <div key={index} className="p-3 bg-white dark:bg-gray-800 rounded border border-yellow-200 dark:border-yellow-700">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-sm">
                            {item.record.project_name as string} - {item.record.driver_name as string}
                          </div>
                          <div className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            现有运单号: {item.existing_auto_number}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {String(item.record.loading_location || '')} → {String(item.record.unloading_location || '')} | {String(item.record.loading_date || '')} | {item.record.loading_weight ? String(item.record.loading_weight) : 'N/A'}吨
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-yellow-700 dark:text-yellow-300">
                            处理方式: {importMode === 'create' ? '已跳过(创建模式不导入重复)' : (approvedDuplicates.has(index) ? '更新现有记录' : '跳过此记录')}
                          </div>
                          {importMode === 'update' && (
                            <label className="inline-flex items-center gap-2 text-xs">
                              <Checkbox
                                checked={approvedDuplicates.has(index)}
                                onCheckedChange={(checked) => {
                                  const next = new Set(approvedDuplicates);
                                  if (checked) {
                                    next.add(index);
                                  } else {
                                    next.delete(index);
                                  }
                                  setApprovedDuplicates(next);
                                }}
                              />
                              <span>更新此记录</span>
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 错误记录详情 */}
              {importPreview.error_records.length > 0 && (
                <div className="p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20 dark:border-red-600">
                  <h4 className="font-semibold text-lg text-red-800 dark:text-red-300 mb-4">
                    错误记录详情
                  </h4>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {importPreview.error_records.map((item, index) => (
                      <div key={index} className="p-3 bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-700">
                        <div className="font-medium text-sm text-red-800 dark:text-red-300 mb-1">
                          {item.record.project_name as string} - {item.record.driver_name as string}
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400">
                          错误: {item.error}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 处理阶段 */}
          {importStep === 'processing' && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-lg font-medium">正在导入数据...</p>
                <p className="text-sm text-muted-foreground">请稍候，系统正在处理您的数据</p>
              </div>
            </div>
          )}

          {/* 原始预览表格（仅在确认阶段显示，用于查看数据详情） */}
          {importStep === 'confirmation' && previewData.length > 0 && (
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="text-sm font-medium">数据预览（前10条）</div>
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
            </div>
          )}

          {/* 对话框底部按钮 */}
          <DialogFooter>
            {importStep === 'confirmation' && (
              <>
                <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
                  取消
                </Button>
                <Button 
                  onClick={executeImport} 
                  disabled={isImporting || (importMode === 'update' && approvedDuplicates.size === 0 && importPreview?.update_records.length > 0)}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      导入中...
                    </>
                  ) : (
                    '确认导入'
                  )}
                </Button>
              </>
            )}
            {importStep === 'processing' && (
              <Button variant="outline" disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                正在导入...
              </Button>
            )}
            {importStep === 'completed' && (
              <Button onClick={() => {
                setIsPreviewDialogOpen(false);
                setImportPreview(null);
                setPreviewData([]);
                setApprovedDuplicates(new Set());
                setImportStep('preview');
              }}>
                关闭
              </Button>
            )}
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
