// 模板映射管理器组件
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
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
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Settings, 
  FileText,
  AlertCircle
} from "lucide-react";
import { relaxedSupabase } from '@/lib/supabase-helpers';
import { useToast } from "@/hooks/use-toast";

interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  platform_name: string;
  is_active: boolean;
  header_row?: number;      // 表头所在行号
  data_start_row?: number;  // 数据开始行号
  created_at: string;
  updated_at: string;
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
  value_mappings?: Record<string, string>; // 值转换规则：{ "正常": "成丰6", "default": "不合规" }
}

interface FixedMapping {
  id: string;
  template_id: string;
  target_field: string;
  fixed_value: string;
  description: string;
}

// 系统字段定义（用于字段映射）
// 注意：运单号（auto_number）是自动生成的，不应该从Excel导入，所以不包含在字段映射选项中
const SYSTEM_FIELDS = [
  { key: 'project_name', label: '项目名称', type: 'text', required: true },
  { key: 'chain_name', label: '合作链路', type: 'text', required: false },
  { key: 'driver_name', label: '司机姓名', type: 'text', required: true },
  { key: 'license_plate', label: '车牌号', type: 'text', required: true },
  { key: 'driver_phone', label: '司机电话', type: 'text', required: false },
  { key: 'loading_location', label: '装货地点', type: 'text', required: true },
  { key: 'unloading_location', label: '卸货地点', type: 'text', required: true },
  { key: 'loading_date', label: '装货日期', type: 'date', required: true },
  { key: 'unloading_date', label: '卸货日期', type: 'date', required: false },
  { key: 'loading_weight', label: '装货数量', type: 'number', required: true },
  { key: 'unloading_weight', label: '卸货数量', type: 'number', required: false },
  { key: 'current_cost', label: '运费金额', type: 'number', required: false },
  { key: 'extra_cost', label: '额外费用', type: 'number', required: false },
  { key: 'transport_type', label: '运输类型', type: 'text', required: false },
  { key: 'remarks', label: '备注', type: 'text', required: false },
  { key: 'other_platform_names', label: '其他平台名称', type: 'text', required: false },
  { key: 'other_platform_waybills', label: '其他平台运单号', type: 'text', required: false }
];

// 所有系统字段（包括运单号，用于固定值映射等其他场景）
const ALL_SYSTEM_FIELDS = [
  { key: 'auto_number', label: '运单号', type: 'text', required: true },
  ...SYSTEM_FIELDS
];

const FIELD_TYPES = [
  { value: 'text', label: '文本' },
  { value: 'number', label: '数字' },
  { value: 'date', label: '日期' },
  { value: 'boolean', label: '布尔值' }
];

export default function TemplateMappingManager() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ImportTemplate | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [fixedMappings, setFixedMappings] = useState<FixedMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingField, setEditingField] = useState<FieldMapping | null>(null);
  const [editingFixed, setEditingFixed] = useState<FixedMapping | null>(null);

  // 表单状态
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    platform_name: '',
    is_active: true,
    header_row: 1,      // 表头所在行号，默认第1行
    data_start_row: 2   // 数据开始行号，默认第2行
  });

  const [fieldForm, setFieldForm] = useState({
    excel_column: '',
    database_field: '',
    field_type: 'text',
    is_required: false,
    default_value: '',
    display_order: 0,
    value_mappings: {} as Record<string, string> // 值转换规则
  });
  
  // 值转换规则编辑状态
  const [valueMappingRows, setValueMappingRows] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' }
  ]);

  const [fixedForm, setFixedForm] = useState({
    excel_value: '',
    database_value: '',
    mapping_type: '',
    is_case_sensitive: false,
    description: ''
  });

  // 加载模板列表
  const loadTemplates = async () => {
    try {
      const { data, error } = await relaxedSupabase
        .from('import_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data || []).map(t => {
        // 从template_config中读取配置
        const config = t.template_config || {};
        return {
          id: t.id,
          name: t.name,
          description: t.description || '',
          platform_name: t.platform_type || '',
          is_active: t.is_active !== undefined ? t.is_active : true,
          header_row: config.header_row || 1,
          data_start_row: config.data_start_row || 2,
          created_at: t.created_at || new Date().toISOString(),
          updated_at: t.updated_at || new Date().toISOString()
        };
      }));
    } catch (error: any) {
      console.error('加载模板失败:', error);
      toast({ title: "错误", description: "加载模板列表失败", variant: "destructive" });
    }
  };

  // 加载字段映射
  const loadFieldMappings = async (templateId: string) => {
    try {
      const { data, error } = await relaxedSupabase
        .from('import_field_mappings')
        .select('*')
        .eq('template_id', templateId)
        .order('display_order'); // 修复：使用 display_order 而不是 sort_order

      if (error) throw error;
      setFieldMappings((data || []).map(m => {
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
    } catch (error: any) {
      console.error('加载字段映射失败:', error);
      toast({ 
        title: "错误", 
        description: `加载字段映射失败: ${error.message || '未知错误'}`,
        variant: "destructive" 
      });
    }
  };

  // 加载固定映射
  const loadFixedMappings = async (templateId: string) => {
    try {
      const { data, error } = await relaxedSupabase
        .from('import_fixed_mappings')
        .select('*')
        .eq('template_id', templateId);

      if (error) throw error;
      setFixedMappings((data || []).map(m => ({
        id: m.id,
        template_id: m.template_id,
        // 字段名存储在 database_value 中，固定值存储在 excel_value 中
        target_field: m.database_value || '',
        fixed_value: m.excel_value || '',
        description: ''
      })));
    } catch (error: any) {
      console.error('加载固定映射失败:', error);
      toast({ title: "错误", description: "加载固定映射失败", variant: "destructive" });
    }
  };

  // 选择模板
  const handleSelectTemplate = (template: ImportTemplate) => {
    setSelectedTemplate(template);
    loadFieldMappings(template.id);
    loadFixedMappings(template.id);
  };

  // 保存模板
  const handleSaveTemplate = async () => {
    if (!templateForm.name || !templateForm.platform_name) {
      toast({ title: "错误", description: "请填写模板名称和平台名称", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data: userData } = await relaxedSupabase.auth.getUser();
      
      const templateData = {
        ...(selectedTemplate?.id && { id: selectedTemplate.id }),
        name: templateForm.name,
        platform_type: templateForm.platform_name,
        description: templateForm.description || null,
        is_active: templateForm.is_active,
        template_config: {
          header_row: templateForm.header_row || 1,
          data_start_row: templateForm.data_start_row || 2
        },
        created_by_user_id: userData.user?.id || null,
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await relaxedSupabase
        .from('import_templates')
        .upsert(templateData)
        .select()
        .single();

      if (error) throw error;

      toast({ title: "成功", description: "模板保存成功" });
      setIsDialogOpen(false);
      resetForms();
      loadTemplates();
    } catch (error: any) {
      console.error('保存模板失败:', error);
      toast({ title: "错误", description: "保存模板失败", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // 保存字段映射
  const handleSaveFieldMapping = async () => {
    if (!selectedTemplate || !fieldForm.excel_column || !fieldForm.database_field) {
      toast({ title: "错误", description: "请填写源字段和目标字段", variant: "destructive" });
      return;
    }

    try {
      // 构建值转换规则
      const valueMappings: Record<string, string> = {};
      valueMappingRows.forEach(row => {
        if (row.key && row.value) {
          valueMappings[row.key] = row.value;
        }
      });
      
      const validationRules = Object.keys(valueMappings).length > 0 
        ? { value_mappings: valueMappings }
        : {};

      const { error } = await relaxedSupabase
        .from('import_field_mappings')
        .upsert({
          ...(editingField?.id && { id: editingField.id }),
          template_id: selectedTemplate.id,
          excel_column: fieldForm.excel_column,
          database_field: fieldForm.database_field,
          field_type: fieldForm.field_type,
          is_required: fieldForm.is_required,
          default_value: fieldForm.default_value,
          display_order: fieldForm.display_order,
          validation_rules: validationRules
        });

      if (error) throw error;

      toast({ title: "成功", description: "字段映射保存成功" });
      setEditingField(null);
      resetFieldForm();
      setValueMappingRows([{ key: '', value: '' }]);
      loadFieldMappings(selectedTemplate.id);
    } catch (error: any) {
      console.error('保存字段映射失败:', error);
      toast({ title: "错误", description: "保存字段映射失败", variant: "destructive" });
    }
  };

  // 保存固定映射
  const handleSaveFixedMapping = async () => {
    if (!selectedTemplate || !fixedForm.database_value || !fixedForm.excel_value) {
      toast({ title: "错误", description: "请填写目标字段和固定值", variant: "destructive" });
      return;
    }

    try {
      const { error } = await relaxedSupabase
        .from('import_fixed_mappings')
        .upsert({
          ...(editingFixed?.id && { id: editingFixed.id }),
          template_id: selectedTemplate.id,
          excel_value: fixedForm.excel_value,
          database_value: fixedForm.database_value,
          mapping_type: fixedForm.mapping_type,
          is_case_sensitive: fixedForm.is_case_sensitive
        });

      if (error) throw error;

      toast({ title: "成功", description: "固定映射保存成功" });
      setEditingFixed(null);
      resetFixedForm();
      loadFixedMappings(selectedTemplate.id);
    } catch (error: any) {
      console.error('保存固定映射失败:', error);
      toast({ title: "错误", description: "保存固定映射失败", variant: "destructive" });
    }
  };

  // 删除字段映射
  const handleDeleteFieldMapping = async (id: string) => {
    try {
      const { error } = await relaxedSupabase
        .from('import_field_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: "成功", description: "字段映射删除成功" });
      if (selectedTemplate) {
        loadFieldMappings(selectedTemplate.id);
      }
    } catch (error: any) {
      console.error('删除字段映射失败:', error);
      toast({ title: "错误", description: "删除字段映射失败", variant: "destructive" });
    }
  };

  // 删除固定映射
  const handleDeleteFixedMapping = async (id: string) => {
    try {
      const { error } = await relaxedSupabase
        .from('import_fixed_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: "成功", description: "固定映射删除成功" });
      if (selectedTemplate) {
        loadFixedMappings(selectedTemplate.id);
      }
    } catch (error: any) {
      console.error('删除固定映射失败:', error);
      toast({ title: "错误", description: "删除固定映射失败", variant: "destructive" });
    }
  };

  // 重置表单
  const resetForms = () => {
    setTemplateForm({
      name: '',
      description: '',
      platform_name: '',
      is_active: true,
      header_row: 1,
      data_start_row: 2
    });
    setSelectedTemplate(null);
    setFieldMappings([]);
    setFixedMappings([]);
  };

  const resetFieldForm = () => {
    setFieldForm({
      excel_column: '',
      database_field: '',
      field_type: 'text',
      is_required: false,
      default_value: '',
      display_order: 0,
      value_mappings: {}
    });
    setValueMappingRows([{ key: '', value: '' }]);
  };

  const resetFixedForm = () => {
    setFixedForm({
      excel_value: '',
      database_value: '',
      mapping_type: '',
      is_case_sensitive: false,
      description: ''
    });
  };

  // 编辑字段映射
  const handleEditFieldMapping = (mapping: FieldMapping) => {
    setEditingField(mapping);
    setFieldForm({
      excel_column: mapping.source_field,
      database_field: mapping.target_field,
      field_type: mapping.field_type,
      is_required: mapping.is_required,
      default_value: mapping.default_value || '',
      display_order: mapping.sort_order,
      value_mappings: mapping.value_mappings || {}
    });
    
    // 加载值转换规则
    if (mapping.value_mappings && Object.keys(mapping.value_mappings).length > 0) {
      const rows = Object.entries(mapping.value_mappings).map(([key, value]) => ({
        key,
        value
      }));
      setValueMappingRows(rows.length > 0 ? rows : [{ key: '', value: '' }]);
    } else {
      setValueMappingRows([{ key: '', value: '' }]);
    }
  };

  // 编辑固定映射
  const handleEditFixedMapping = (mapping: FixedMapping) => {
    setEditingFixed(mapping);
    setFixedForm({
      excel_value: mapping.fixed_value,
      database_value: mapping.target_field,
      mapping_type: 'fixed',
      is_case_sensitive: false,
      description: mapping.description || ''
    });
  };

  // 新增字段映射
  const handleAddFieldMapping = () => {
    setEditingField({} as FieldMapping); // 设置为空对象而不是null，这样对话框会打开
    resetFieldForm();
    setFieldForm(prev => ({ ...prev, sort_order: fieldMappings.length + 1 }));
  };

  // 新增固定映射
  const handleAddFixedMapping = () => {
    setEditingFixed({} as FixedMapping); // 设置为空对象而不是null，这样对话框会打开
    resetFixedForm();
  };

  // 新增模板
  const handleAddTemplate = () => {
    setSelectedTemplate(null);
    resetForms();
    setIsDialogOpen(true);
  };

  // 编辑模板
  const handleEditTemplate = (template: ImportTemplate) => {
    setSelectedTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      platform_name: template.platform_name,
      is_active: template.is_active,
      header_row: template.header_row || 1,
      data_start_row: template.data_start_row || 2
    });
    setIsDialogOpen(true);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  return (
    <div className="space-y-6">
      {/* 模板列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                导入模板管理
              </CardTitle>
              <CardDescription>
                管理不同平台的导入模板和字段映射
              </CardDescription>
            </div>
            <Button onClick={handleAddTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              新增模板
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card 
                key={template.id} 
                className={`cursor-pointer transition-colors ${
                  selectedTemplate?.id === template.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => handleSelectTemplate(template)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{template.name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={template.is_active ? "default" : "secondary"}>
                        {template.is_active ? "启用" : "禁用"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTemplate(template);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    平台: {template.platform_name}
                  </p>
                  <div className="flex gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      表头: 第{template.header_row || 1}行
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      数据: 第{template.data_start_row || 2}行
                    </Badge>
                  </div>
                  {template.description && (
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 字段映射配置 */}
      {selectedTemplate && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 字段映射 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">字段映射</CardTitle>
                <Button onClick={handleAddFieldMapping} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  添加映射
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>目标字段</TableHead>
                    <TableHead>Excel字段</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>必填</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fieldMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-medium">
                        {SYSTEM_FIELDS.find(f => f.key === mapping.target_field)?.label || mapping.target_field}
                      </TableCell>
                      <TableCell>
                        {mapping.source_field}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{mapping.field_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {mapping.is_required ? (
                          <Badge variant="destructive">必填</Badge>
                        ) : (
                          <Badge variant="secondary">可选</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditFieldMapping(mapping)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFieldMapping(mapping.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 固定值映射 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">固定值映射</CardTitle>
                <Button onClick={handleAddFixedMapping} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  添加固定值
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>目标字段</TableHead>
                    <TableHead>固定值</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fixedMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-medium">
                        {SYSTEM_FIELDS.find(f => f.key === mapping.target_field)?.label || mapping.target_field}
                      </TableCell>
                      <TableCell>{mapping.fixed_value}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditFixedMapping(mapping)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFixedMapping(mapping.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 模板编辑对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? '编辑模板' : '新增模板'}
            </DialogTitle>
            <DialogDescription>
              配置导入模板的基本信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">模板名称</Label>
              <Input
                id="name"
                value={templateForm.name}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="输入模板名称"
              />
            </div>
            <div>
              <Label htmlFor="platform_name">平台名称</Label>
              <Input
                id="platform_name"
                value={templateForm.platform_name}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, platform_name: e.target.value }))}
                placeholder="输入平台名称"
              />
            </div>
            <div>
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={templateForm.description}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="输入模板描述"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="header_row">表头行号</Label>
                <Input
                  id="header_row"
                  type="number"
                  min="1"
                  value={templateForm.header_row}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, header_row: parseInt(e.target.value) || 1 }))}
                  placeholder="默认第1行"
                />
                <p className="text-xs text-muted-foreground mt-1">Excel中字段名所在的行号</p>
              </div>
              <div>
                <Label htmlFor="data_start_row">数据开始行号</Label>
                <Input
                  id="data_start_row"
                  type="number"
                  min="1"
                  value={templateForm.data_start_row}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, data_start_row: parseInt(e.target.value) || 2 }))}
                  placeholder="默认第2行"
                />
                <p className="text-xs text-muted-foreground mt-1">实际数据从第几行开始</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={templateForm.is_active}
                onCheckedChange={(checked) => setTemplateForm(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">启用模板</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isLoading}>
              {isLoading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 字段映射编辑对话框 */}
      <Dialog open={editingField !== null} onOpenChange={() => setEditingField(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingField && editingField.id ? '编辑字段映射' : '新增字段映射'}
            </DialogTitle>
            <DialogDescription>
              配置Excel字段到系统字段的映射关系
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="target_field">目标字段</Label>
              <Select
                value={fieldForm.database_field}
                onValueChange={(value) => {
                  // 检查选择的字段是否为必填字段，如果是则自动开启必填开关
                  const selectedField = SYSTEM_FIELDS.find(f => f.key === value);
                  setFieldForm(prev => ({ 
                    database_field: value,
                    is_required: selectedField?.required || prev.is_required
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择目标字段" />
                </SelectTrigger>
                <SelectContent>
                  {SYSTEM_FIELDS.map((field) => (
                    <SelectItem key={field.key} value={field.key}>
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="source_field">Excel字段</Label>
              <Input
                id="source_field"
                value={fieldForm.excel_column}
                onChange={(e) => setFieldForm(prev => ({ ...prev, excel_column: e.target.value }))}
                placeholder="如：运输单号"
              />
            </div>
            <div>
              <Label htmlFor="field_type">字段类型</Label>
              <Select
                value={fieldForm.field_type}
                onValueChange={(value) => setFieldForm(prev => ({ ...prev, field_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="default_value">默认值</Label>
              <Input
                id="default_value"
                value={fieldForm.default_value}
                onChange={(e) => setFieldForm(prev => ({ ...prev, default_value: e.target.value }))}
                placeholder="可选，当源字段为空时使用"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_required"
                checked={fieldForm.is_required}
                onCheckedChange={(checked) => setFieldForm(prev => ({ ...prev, is_required: checked }))}
              />
              <Label htmlFor="is_required">必填字段</Label>
            </div>
            
            {/* 值转换规则 */}
            <div className="space-y-2">
              <Label>值转换规则（可选）</Label>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  配置Excel值与数据库值的转换关系。例如：Excel中的"正常"转换为"成丰6"，其他值转换为"不合规"
                </AlertDescription>
              </Alert>
              <div className="space-y-2 border rounded-md p-3">
                <div className="grid grid-cols-2 gap-2 text-xs font-medium text-gray-600 mb-2">
                  <div>Excel值</div>
                  <div>转换为</div>
                </div>
                {valueMappingRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Excel中的值，如：正常"
                      value={row.key}
                      onChange={(e) => {
                        const newRows = [...valueMappingRows];
                        newRows[index].key = e.target.value;
                        setValueMappingRows(newRows);
                      }}
                      className="text-sm"
                    />
                    <div className="flex gap-1">
                      <Input
                        placeholder="转换后的值，如：成丰6"
                        value={row.value}
                        onChange={(e) => {
                          const newRows = [...valueMappingRows];
                          newRows[index].value = e.target.value;
                          setValueMappingRows(newRows);
                        }}
                        className="text-sm flex-1"
                      />
                      {valueMappingRows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setValueMappingRows(valueMappingRows.filter((_, i) => i !== index));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setValueMappingRows([...valueMappingRows, { key: '', value: '' }])}
                  className="w-full"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  添加转换规则
                </Button>
              </div>
              <div className="text-xs text-gray-500">
                <strong>说明：</strong>如果Excel值不在转换规则中，将使用原值。如需设置默认转换，添加一个空Excel值（留空）的规则。
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingField(null);
              resetFieldForm();
            }}>
              取消
            </Button>
            <Button onClick={handleSaveFieldMapping}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 固定值映射编辑对话框 */}
      <Dialog open={editingFixed !== null} onOpenChange={() => setEditingFixed(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingFixed && editingFixed.id ? '编辑固定值映射' : '新增固定值映射'}
            </DialogTitle>
            <DialogDescription>
              为某些字段设置固定值
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fixed_target_field">目标字段</Label>
              <Select
                value={fixedForm.database_value}
                onValueChange={(value) => setFixedForm(prev => ({ ...prev, database_value: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择目标字段" />
                </SelectTrigger>
                <SelectContent>
                  {SYSTEM_FIELDS.map((field) => (
                    <SelectItem key={field.key} value={field.key}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fixed_value">固定值</Label>
              <Input
                id="fixed_value"
                value={fixedForm.excel_value}
                onChange={(e) => setFixedForm(prev => ({ ...prev, excel_value: e.target.value }))}
                placeholder="输入固定值"
              />
            </div>
            <div>
              <Label htmlFor="fixed_description">说明</Label>
              <Input
                id="fixed_description"
                value={fixedForm.description}
                onChange={(e) => setFixedForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="可选，输入说明"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFixed(null)}>
              取消
            </Button>
            <Button onClick={handleSaveFixedMapping}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
