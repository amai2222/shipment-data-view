// 选择性字段更新组件
// 允许用户选择要更新的字段，其他字段作为定位依据

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertTriangle,
  Info,
  Loader2,
  Download,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
// 导入日期解析工具函数（符合主流规范：Excel数据是中国时区，解析为YYYY-MM-DD格式，后端转换为UTC存储）
import { parseExcelDateEnhanced } from '@/utils/enhancedDateUtils';

interface SelectiveFieldUpdateProps {
  selectedProject: string;
  onUpdateSuccess: () => void;
}

// 可更新的字段列表（包含所有运单字段）
const UPDATABLE_FIELDS = [
  // 基础信息
  { key: 'chain_name', label: '合作链路', description: '合作方链路名称', category: '基础' },
  { key: 'license_plate', label: '车牌号', description: '车辆牌照', category: '基础' },
  { key: 'driver_phone', label: '司机电话', description: '司机联系电话', category: '基础' },
  
  // 日期时间
  { key: 'unloading_date', label: '卸货日期', description: '卸货完成日期', category: '日期' },
  
  // 重量数量
  { key: 'unloading_weight', label: '卸货数量', description: '卸货重量/数量/次数/体积', category: '数量' },
  
  // 费用金额
  { key: 'current_cost', label: '运费金额', description: '司机应收运费', category: '费用' },
  { key: 'extra_cost', label: '额外费用', description: '额外的费用', category: '费用' },
  
  // 类型分类
  { key: 'transport_type', label: '运输类型', description: '实际运输/退货', category: '分类' },
  { key: 'cargo_type', label: '货物类型', description: '货物分类', category: '分类' },
  
  // 备注信息
  { key: 'remarks', label: '备注', description: '运单备注信息', category: '备注' },
  
  // 外部平台
  { key: 'other_platform_names', label: '其他平台名称', description: '外部平台名称（逗号分隔）', category: '平台' },
  { key: 'external_tracking_numbers', label: '其他平台运单号', description: '外部平台运单号（|和逗号分隔）', category: '平台' }
];

// 定位字段（用于查找运单）
const IDENTIFICATION_FIELDS = [
  '项目名称*',
  '司机姓名*',
  '装货地点*',
  '卸货地点*',
  '装货日期*',
  '装货数量*'
];

// Excel行数据类型
interface ExcelRowData {
  [key: string]: unknown;
}

// 字段值提取函数（支持模糊匹配）
const extractFieldValue = (rowData: ExcelRowData, fieldKey: string): unknown => {
  const field = UPDATABLE_FIELDS.find(f => f.key === fieldKey);
  if (!field) return null;

  switch (fieldKey) {
    case 'unloading_weight':
      return rowData['卸货数量'] || rowData['卸货数量(可选)'] || rowData['卸货重量'] || null;
    case 'unloading_date':
      return rowData['卸货日期'] || rowData['卸货日期(可选)'] || null;
    case 'current_cost':
      return rowData['运费金额'] || rowData['运费金额(可选)'] || rowData['运费'] || null;
    case 'extra_cost':
      return rowData['额外费用'] || rowData['额外费用(可选)'] || null;
    case 'remarks':
      return rowData['备注'] || rowData['备注(可选)'] || rowData['说明'] || null;
    case 'cargo_type':
      return rowData['货物类型'] || rowData['货类'] || null;
    case 'license_plate':
      return rowData['车牌号'] || rowData['车牌号*'] || rowData['车牌'] || null;
    case 'driver_phone':
      return rowData['司机电话'] || rowData['司机电话(可选)'] || null;
    case 'transport_type':
      return rowData['运输类型'] || rowData['运输类型(可选)'] || rowData['类型'] || null;
    case 'chain_name':
      return rowData['合作链路'] || rowData['合作链路(可选)'] || rowData['链路'] || null;
    case 'other_platform_names':
      return rowData['其他平台名称'] || rowData['其他平台名称(可选)'] || rowData['平台名称'] || null;
    case 'external_tracking_numbers':
      return rowData['其他平台运单号'] || rowData['其他平台运单号(可选)'] || rowData['外部运单号'] || null;
    default:
      return null;
  }
};

// 格式化字段值显示
const formatFieldValue = (value: unknown, fieldKey: string): string => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  
  // 日期字段：使用日期解析函数处理Excel日期格式（数字序列号、Date对象、各种字符串格式）
  if (fieldKey === 'unloading_date' || fieldKey === 'loading_date') {
    const parsedDate = parseExcelDateEnhanced(value);
    if (parsedDate) {
      return parsedDate; // 返回YYYY-MM-DD格式
    }
    // 如果解析失败，尝试其他方式显示
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toLocaleDateString('zh-CN');
    return String(value);
  }
  
  if (fieldKey === 'other_platform_names' && Array.isArray(value)) {
    return value.join(', ');
  }
  
  if (fieldKey === 'external_tracking_numbers' && Array.isArray(value)) {
    return value.join(', ');
  }
  
  if (typeof value === 'number') {
    return value.toLocaleString('zh-CN');
  }
  
  return String(value);
};

export default function SelectiveFieldUpdate({ selectedProject, onUpdateSuccess }: SelectiveFieldUpdateProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(['unloading_weight'])  // 默认选择卸货数量
  );
  const [isProcessing, setIsProcessing] = useState(false);
  interface PreviewDataItem {
    row_index: number;
    auto_number: string;
    rowData: ExcelRowData;
    existingRecord: {
      id: string;
      [key: string]: unknown;
    };
    status: 'matched' | 'unmatched';
    fieldChanges?: Array<{
      fieldKey: string;
      fieldLabel: string;
      oldValue: unknown;
      newValue: unknown;
      willUpdate: boolean;
    }>;
  }
  const [previewData, setPreviewData] = useState<PreviewDataItem[]>([]);
  const [matchedCount, setMatchedCount] = useState(0);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [expandedPreview, setExpandedPreview] = useState<Set<number>>(new Set());
  const [updateResult, setUpdateResult] = useState<{
    successCount: number;
    failedCount: number;
    skippedCount: number;
    failedItems: Array<{ autoNumber: string; error: string }>;
    updatedFields: Set<string>;
  } | null>(null);

  const toggleField = (fieldKey: string) => {
    const next = new Set(selectedFields);
    if (next.has(fieldKey)) {
      next.delete(fieldKey);
    } else {
      next.add(fieldKey);
    }
    setSelectedFields(next);
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedFields(new Set(UPDATABLE_FIELDS.map(f => f.key)));
    } else {
      setSelectedFields(new Set());
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedProject) {
      toast({ title: '请先选择项目', variant: 'destructive' });
      return;
    }

    if (selectedFields.size === 0) {
      toast({ title: '请至少选择一个要更新的字段', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      // 读取Excel
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error('Excel文件为空');
      }

      // 预览和匹配
      let matched = 0;
      let unmatched = 0;
      const preview: PreviewDataItem[] = [];

      for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
        const row = jsonData[rowIndex];
        const rowData = row as ExcelRowData;
        
        // 根据定位字段查找运单
        const { data: existingRecords } = await supabase
          .from('logistics_records')
          .select('*')
          .eq('project_name', String(rowData['项目名称'] || rowData['项目名称*'] || rowData['项目'] || ''))
          .eq('driver_name', String(rowData['司机姓名'] || rowData['司机姓名*'] || rowData['司机'] || ''))
          .eq('loading_location', String(rowData['装货地点'] || rowData['装货地点*'] || ''))
          .eq('unloading_location', String(rowData['卸货地点'] || rowData['卸货地点*'] || ''))
          .limit(1);

        if (existingRecords && existingRecords.length > 0) {
          const existingRecord = existingRecords[0];
          // 计算字段更新对比
          const fieldChanges: Array<{
            fieldKey: string;
            fieldLabel: string;
            oldValue: unknown;
            newValue: unknown;
            willUpdate: boolean;
          }> = [];

          // 遍历所有可更新字段
          UPDATABLE_FIELDS.forEach(field => {
            const newValue = extractFieldValue(rowData, field.key);
            // 获取原值（从数据库记录中）
            let oldValue = existingRecord[field.key];
            if (field.key === 'chain_name') {
              // 合作链路需要特殊处理，可能需要从chain_id查找
              oldValue = existingRecord.chain_id ? existingRecord.chain_name || existingRecord.chain_id : null;
            }
            const isSelected = selectedFields.has(field.key);
            const hasNewValue = newValue !== null && newValue !== undefined && newValue !== '';

            fieldChanges.push({
              fieldKey: field.key,
              fieldLabel: field.label,
              oldValue: oldValue, // 总是显示原值
              newValue: isSelected && hasNewValue ? newValue : null, // 只有选中且有新值才显示
              willUpdate: isSelected && hasNewValue && String(oldValue) !== String(newValue)
            });
          });

          matched++;
          preview.push({
            row_index: rowIndex,
            status: 'matched',
            auto_number: String(existingRecord.auto_number || ''),
            rowData: rowData,
            existingRecord: existingRecord as { id: string; [key: string]: unknown },
            fieldChanges: fieldChanges
          });
        } else {
          unmatched++;
          preview.push({
            row_index: rowIndex,
            status: 'unmatched',
            auto_number: '',
            rowData: rowData,
            existingRecord: { id: '' },
            fieldChanges: []
          });
        }
      }

      setMatchedCount(matched);
      setUnmatchedCount(unmatched);
      setPreviewData(preview);

      toast({
        title: '预览完成',
        description: `找到 ${matched} 条匹配的运单，${unmatched} 条未匹配`
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '处理失败';
      toast({ title: '处理失败', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const executeUpdate = async () => {
    if (matchedCount === 0) {
      toast({ title: '没有匹配的运单可更新', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const failedItems: Array<{ autoNumber: string; error: string }> = [];
    const updatedFields = new Set<string>();

    try {
      // 性能优化：批量处理，避免逐条更新导致超时
      // 先批量获取所有需要的合作链路ID
      const chainNames = new Set<string>();
      const matchedItems = previewData.filter(item => item.status === 'matched');
      
      for (const item of matchedItems) {
        if (selectedFields.has('chain_name')) {
          const value = item.rowData['合作链路'] || item.rowData['合作链路(可选)'] || item.rowData['链路'];
          if (value) {
            chainNames.add(String(value));
          }
        }
      }

      // 批量查询所有合作链路ID
      const chainIdMap = new Map<string, string>();
      if (chainNames.size > 0) {
        const { data: chainsData, error: chainsError } = await supabase
          .from('partner_chains')
          .select('id, chain_name')
          .eq('project_name', selectedProject)
          .in('chain_name', Array.from(chainNames));
        
        if (chainsError) {
          throw new Error(`批量查询合作链路失败：${chainsError.message}`);
        }
        
        if (chainsData) {
          chainsData.forEach(chain => {
            chainIdMap.set(chain.chain_name, chain.id);
          });
        }
      }

      // 构建批量更新数据（一次性构建所有更新）
      const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
      
      for (const item of matchedItems) {
        try {
          // 构建更新数据（只更新选中的字段）
          const updateData: Record<string, unknown> = {};

          if (selectedFields.has('unloading_weight')) {
            const value = item.rowData['卸货数量'] || item.rowData['卸货数量(可选)'] || item.rowData['卸货重量'];
            if (value != null && value !== '') {
              updateData.unloading_weight = parseFloat(String(value));
              updatedFields.add('unloading_weight');
            }
          }

          if (selectedFields.has('unloading_date')) {
            const value = item.rowData['卸货日期'] || item.rowData['卸货日期(可选)'];
            if (value) {
              // 使用日期解析函数处理Excel日期（支持数字序列号、Date对象、各种字符串格式）
              // 返回YYYY-MM-DD格式的字符串（中国时区），后端会自动转换为UTC存储
              const parsedDate = parseExcelDateEnhanced(value);
              if (parsedDate) {
                updateData.unloading_date = parsedDate;
                updatedFields.add('unloading_date');
              } else {
                throw new Error(`卸货日期格式不正确: ${value}`);
              }
            }
          }

          if (selectedFields.has('current_cost')) {
            const value = item.rowData['运费金额'] || item.rowData['运费金额(可选)'] || item.rowData['运费'];
            if (value != null && value !== '') {
              updateData.current_cost = parseFloat(String(value));
              updatedFields.add('current_cost');
            }
          }

          if (selectedFields.has('extra_cost')) {
            const value = item.rowData['额外费用'] || item.rowData['额外费用(可选)'];
            if (value != null && value !== '') {
              updateData.extra_cost = parseFloat(String(value));
              updatedFields.add('extra_cost');
            }
          }

          if (selectedFields.has('remarks')) {
            const value = item.rowData['备注'] || item.rowData['备注(可选)'] || item.rowData['说明'];
            if (value) {
              updateData.remarks = value;
              updatedFields.add('remarks');
            }
          }

          if (selectedFields.has('cargo_type')) {
            const value = item.rowData['货物类型'] || item.rowData['货类'];
            if (value) {
              updateData.cargo_type = value;
              updatedFields.add('cargo_type');
            }
          }

          if (selectedFields.has('license_plate')) {
            const value = item.rowData['车牌号'] || item.rowData['车牌号*'] || item.rowData['车牌'];
            if (value) {
              updateData.license_plate = value;
              updatedFields.add('license_plate');
            }
          }

          if (selectedFields.has('driver_phone')) {
            const value = item.rowData['司机电话'] || item.rowData['司机电话(可选)'];
            if (value) {
              updateData.driver_phone = value;
              updatedFields.add('driver_phone');
            }
          }

          if (selectedFields.has('other_platform_names')) {
            const value = item.rowData['其他平台名称'] || item.rowData['其他平台名称(可选)'] || item.rowData['平台名称'];
            if (value) {
              const platforms = String(value).split(',').map((p: string) => p.trim()).filter(p => p);
              updateData.other_platform_names = platforms;
              updatedFields.add('other_platform_names');
            }
          }

          if (selectedFields.has('external_tracking_numbers')) {
            const value = item.rowData['其他平台运单号'] || item.rowData['其他平台运单号(可选)'] || item.rowData['外部运单号'];
            if (value) {
              const platforms = String(value).split(',').map((p: string) => p.trim()).filter(p => p);
              updateData.external_tracking_numbers = platforms;
              updatedFields.add('external_tracking_numbers');
            }
          }

          if (selectedFields.has('transport_type')) {
            const value = item.rowData['运输类型'] || item.rowData['运输类型(可选)'] || item.rowData['类型'];
            if (value) {
              updateData.transport_type = value;
              updatedFields.add('transport_type');
            }
          }

          if (selectedFields.has('chain_name')) {
            const value = item.rowData['合作链路'] || item.rowData['合作链路(可选)'] || item.rowData['链路'];
            if (value) {
              const chainId = chainIdMap.get(String(value));
              if (chainId) {
                updateData.chain_id = chainId;
                updatedFields.add('chain_name');
              } else {
                throw new Error(`未找到合作链路"${value}"`);
              }
            }
          }

          // 如果有要更新的数据，添加到批量更新列表
          if (Object.keys(updateData).length > 0) {
            updates.push({
              id: item.existingRecord.id,
              data: updateData
            });
          } else {
            // Excel中该运单的选中字段都为空，跳过
            skippedCount++;
          }

        } catch (error: unknown) {
          failedCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          failedItems.push({
            autoNumber: item.auto_number,
            error: errorMessage
          });
          console.error('更新失败:', item.auto_number, error);
        }
      }

      // 一次性批量更新所有记录（使用数据库函数）
      // 注意：预览阶段已经验重并找到了匹配的运单，这里直接更新即可，不需要再次验重
      // 不需要分批，因为只是简单的 UPDATE 操作，性能足够
      if (updates.length > 0) {
        const { data: result, error: batchError } = await supabase.rpc('batch_update_logistics_records', {
          p_updates: updates
        });
        
        if (batchError) {
          throw new Error(`批量更新失败: ${batchError.message || JSON.stringify(batchError)}`);
        }
        
        if (result) {
          successCount = result.success_count || 0;
          const batchFailedCount = result.error_count || 0;
          failedCount += batchFailedCount;
          
          // 处理批量更新返回的错误详情
          if (Array.isArray(result.error_details) && result.error_details.length > 0) {
            result.error_details.forEach((err: { record_id?: string; error_message?: string }) => {
              if (err.record_id) {
                const item = matchedItems.find(i => i.existingRecord.id === err.record_id);
                if (item) {
                  failedItems.push({
                    autoNumber: item.auto_number,
                    error: err.error_message || '更新失败'
                  });
                }
              }
            });
          }
        }
      }

      // 保存更新结果
      setUpdateResult({
        successCount,
        failedCount,
        skippedCount,
        failedItems,
        updatedFields
      });

      // 显示详细的成功/失败提示
      if (failedCount === 0 && skippedCount === 0) {
        toast({
          title: '✅ 更新成功',
          description: `成功更新 ${successCount} 条运单，共更新 ${updatedFields.size} 个字段`,
          duration: 5000
        });
      } else if (failedCount === 0) {
        toast({
          title: '✅ 更新完成',
          description: `成功更新 ${successCount} 条运单，跳过 ${skippedCount} 条（Excel中字段为空），共更新 ${updatedFields.size} 个字段`,
          duration: 5000
        });
      } else {
        toast({
          title: '⚠️ 更新部分完成',
          description: `成功 ${successCount} 条，失败 ${failedCount} 条，跳过 ${skippedCount} 条。请查看下方详细报告。`,
          variant: 'destructive',
          duration: 7000
        });
      }

      if (successCount > 0) {
        onUpdateSuccess();
        // 不清空预览数据，让用户查看结果
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '更新过程中发生未知错误';
      toast({ 
        title: '❌ 批量更新失败', 
        description: errorMessage, 
        variant: 'destructive',
        duration: 7000
      });
      setUpdateResult({
        successCount: 0,
        failedCount: matchedCount,
        skippedCount: 0,
        failedItems: previewData
          .filter(item => item.status === 'matched')
          .map(item => ({
            autoNumber: item.auto_number,
            error: (error instanceof Error ? error.message : String(error)) || '未知错误'
          })),
        updatedFields: new Set()
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [
        '项目名称*', '司机姓名*', '装货地点*', '卸货地点*', '装货日期*', '装货数量*',
        '合作链路', '车牌号', '司机电话', '卸货数量', '卸货日期', '运费金额', '额外费用', '运输类型', '货物类型', '备注', '其他平台名称', '其他平台运单号'
      ],
      [
        '必填-定位', '必填-定位', '必填-定位', '必填-定位', '必填-定位', '必填-定位',
        '可选-更新', '可选-更新', '可选-更新', '可选-更新', '可选-更新', '可选-更新', '可选-更新', '可选-更新', '可选-更新', '可选-更新', '可选-更新', '可选-更新'
      ],
      [
        '天兴芦花', '张三', '北京仓库', '上海仓库', '2025-11-01', '10.5',
        '默认链路', '云F97310', '13800138000', '10.2', '2025-11-02', '5000', '200', '实际运输', '煤炭', '正常运输', '平台A,平台B', '运单1|运单2,运单3'
      ]
    ]);

    ws['!cols'] = [
      { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 12 },
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, '选择性更新模板');
    XLSX.writeFile(wb, `运单选择性更新模板.xlsx`);

    toast({ title: '模板下载成功', description: '请按照模板填写数据' });
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>选择性字段更新</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Excel中必须包含6个定位字段（项目、司机、装货地、卸货地、装货日期、装货数量）</li>
            <li>勾选要更新的字段，只有这些字段会被更新</li>
            <li>Excel中留空的字段不会更新数据库原值</li>
            <li>未勾选的字段保持数据库原值不变</li>
          </ul>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>第1步：选择要更新的字段</CardTitle>
          <CardDescription>勾选在导入时要更新的字段</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedFields.size === UPDATABLE_FIELDS.length}
                onCheckedChange={toggleAll}
              />
              <Label className="font-semibold">全选/全不选</Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-6">
              {UPDATABLE_FIELDS.map(field => (
                <div key={field.key} className="flex items-start gap-2">
                  <Checkbox
                    checked={selectedFields.has(field.key)}
                    onCheckedChange={() => toggleField(field.key)}
                    id={`field-${field.key}`}
                  />
                  <div className="flex-1">
                    <Label htmlFor={`field-${field.key}`} className="cursor-pointer">
                      {field.label}
                      <span className="text-xs text-muted-foreground ml-1">-{field.key}</span>
                    </Label>
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>已选择 {selectedFields.size} 个字段</strong>将被更新：
                {Array.from(selectedFields).map(key => {
                  const field = UPDATABLE_FIELDS.find(f => f.key === key);
                  return field?.label;
                }).join('、')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>第2步：上传Excel文件</CardTitle>
          <CardDescription>
            包含定位字段和要更新的字段值
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={downloadTemplate}
            >
              <Download className="h-4 w-4 mr-2" />
              下载模板
            </Button>

            <Button
              variant="default"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || selectedFields.size === 0}
            >
              <Upload className="h-4 w-4 mr-2" />
              选择Excel文件
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {previewData.length > 0 && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  匹配：{matchedCount}条
                </Badge>
                <Badge className="bg-yellow-100 text-yellow-800">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  未匹配：{unmatchedCount}条
                </Badge>
              </div>

              <div className="border rounded-md p-4 max-h-[600px] overflow-y-auto">
                <h4 className="font-semibold mb-3">更新预览（共 {previewData.length} 条）</h4>
                <div className="space-y-3">
                  {previewData.map((item, index) => {
                    const isExpanded = expandedPreview.has(index);
                    const isMatched = item.status === 'matched';
                    
                    return (
                      <div 
                        key={index} 
                        className={`border rounded-lg overflow-hidden ${
                          isMatched ? 'border-green-200 bg-green-50/50' : 'border-yellow-200 bg-yellow-50/50'
                        }`}
                      >
                        {/* 运单头部 */}
                        <div 
                          className={`p-3 cursor-pointer hover:bg-opacity-80 transition-colors ${
                            isMatched ? 'bg-green-100' : 'bg-yellow-100'
                          }`}
                          onClick={() => {
                            if (!isMatched) return;
                            const next = new Set(expandedPreview);
                            if (next.has(index)) {
                              next.delete(index);
                            } else {
                              next.add(index);
                            }
                            setExpandedPreview(next);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isMatched ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span className="font-semibold text-green-800">
                                    {item.auto_number}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {item.fieldChanges?.filter(f => f.willUpdate).length || 0} 个字段将更新
                                  </Badge>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                  <span className="text-yellow-800">
                                    未找到匹配运单
                                  </span>
                                  <span className="text-xs text-yellow-600 ml-2">
                                    （司机：{String(item.rowData['司机姓名'] || item.rowData['司机姓名*'] || item.rowData['司机'] || '')}）
                                  </span>
                                </>
                              )}
                            </div>
                            {isMatched && (
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-500" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 字段更新详情 */}
                        {isMatched && isExpanded && item.fieldChanges && (
                          <div className="p-4 bg-white border-t">
                            <div className="space-y-3">
                              <div className="text-xs font-semibold text-gray-600 mb-2">
                                字段更新对比（仅显示勾选的字段）
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {item.fieldChanges
                                  .filter(f => selectedFields.has(f.fieldKey))
                                  .map((change, idx) => {
                                    const field = UPDATABLE_FIELDS.find(f => f.key === change.fieldKey);
                                    const hasNewValue = change.newValue !== null && change.newValue !== undefined && change.newValue !== '';
                                    const isChanged = hasNewValue && String(change.oldValue) !== String(change.newValue);
                                    
                                    return (
                                      <div 
                                        key={idx} 
                                        className={`p-3 rounded-md border ${
                                          isChanged ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1">
                                            <div className="font-medium text-sm text-gray-700 mb-1">
                                              {change.fieldLabel}
                                              <span className="text-xs text-gray-500 ml-1">
                                                ({change.fieldKey})
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                              <div>
                                                <div className="text-gray-500 mb-1">原值：</div>
                                                <div className={`font-mono ${
                                                  isChanged ? 'text-orange-600' : 'text-gray-700'
                                                }`}>
                                                  {formatFieldValue(change.oldValue, change.fieldKey)}
                                                </div>
                                              </div>
                                              <div>
                                                <div className="text-gray-500 mb-1">新值：</div>
                                                <div className={`font-mono ${
                                                  hasNewValue 
                                                    ? (isChanged ? 'text-green-600 font-semibold' : 'text-gray-700')
                                                    : 'text-gray-400'
                                                }`}>
                                                  {hasNewValue 
                                                    ? formatFieldValue(change.newValue, change.fieldKey)
                                                    : '（Excel中为空，保持原值）'
                                                  }
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                          {isChanged && (
                                            <Badge className="ml-2 bg-green-100 text-green-700 border-green-300">
                                              将更新
                                            </Badge>
                                          )}
                                          {!hasNewValue && (
                                            <Badge variant="outline" className="ml-2">
                                              保持原值
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                              {item.fieldChanges.filter(f => selectedFields.has(f.fieldKey) && f.newValue === null).length > 0 && (
                                <div className="mt-3 p-2 bg-gray-100 rounded text-xs text-gray-600">
                                  <Info className="h-3 w-3 inline mr-1" />
                                  提示：未勾选的字段将保持数据库原值不变
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={executeUpdate}
                disabled={isProcessing || matchedCount === 0}
                className="w-full"
              >
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />处理中...</>
                ) : (
                  <><FileSpreadsheet className="h-4 w-4 mr-2" />确认更新 {matchedCount} 条运单</>
                )}
              </Button>
            </div>
          )}

          {/* 更新结果报告 */}
          {updateResult && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg">
                  {updateResult.failedCount === 0 ? '✅ 更新结果' : '⚠️ 更新结果'}
                </CardTitle>
                <CardDescription>
                  更新操作已完成，详情如下
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 统计摘要 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-600">{updateResult.successCount}</div>
                    <div className="text-sm text-green-700">成功更新</div>
                  </div>
                  <div className={`p-3 rounded-lg border ${
                    updateResult.failedCount > 0 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className={`text-2xl font-bold ${
                      updateResult.failedCount > 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {updateResult.failedCount}
                    </div>
                    <div className={`text-sm ${
                      updateResult.failedCount > 0 ? 'text-red-700' : 'text-gray-700'
                    }`}>
                      更新失败
                    </div>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="text-2xl font-bold text-yellow-600">{updateResult.skippedCount}</div>
                    <div className="text-sm text-yellow-700">跳过（字段为空）</div>
                  </div>
                </div>

                {/* 更新的字段列表 */}
                {updateResult.updatedFields.size > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-sm font-semibold text-blue-700 mb-2">已更新的字段：</div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(updateResult.updatedFields).map(fieldKey => {
                        const field = UPDATABLE_FIELDS.find(f => f.key === fieldKey);
                        return (
                          <Badge key={fieldKey} variant="outline" className="bg-white">
                            {field?.label || fieldKey}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 失败详情 */}
                {updateResult.failedItems.length > 0 && (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      失败运单详情（{updateResult.failedItems.length} 条）
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {updateResult.failedItems.map((item, idx) => (
                        <div key={idx} className="p-2 bg-white rounded border border-red-200">
                          <div className="font-medium text-sm text-red-800 mb-1">
                            运单号：{item.autoNumber}
                          </div>
                          <div className="text-xs text-red-600 font-mono">
                            错误：{item.error}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUpdateResult(null);
                      setPreviewData([]);
                      setMatchedCount(0);
                      setUnmatchedCount(0);
                      setExpandedPreview(new Set());
                    }}
                    className="flex-1"
                  >
                    关闭报告
                  </Button>
                  {updateResult.successCount > 0 && (
                    <Button
                      onClick={() => {
                        setUpdateResult(null);
                        setPreviewData([]);
                        setMatchedCount(0);
                        setUnmatchedCount(0);
                        setExpandedPreview(new Set());
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="flex-1"
                    >
                      继续更新
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Alert className="bg-yellow-50 border-yellow-200">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle>使用说明</AlertTitle>
        <AlertDescription>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>勾选要更新的字段</li>
            <li>下载模板或准备Excel（必须包含6个定位字段）</li>
            <li>只填写要更新的字段，不更新的字段可以留空</li>
            <li>上传Excel，系统会自动匹配运单</li>
            <li>预览匹配结果，确认后执行更新</li>
          </ol>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>支持的模糊语法</CardTitle>
          <CardDescription>Excel列名支持以下多种写法，系统会自动识别（按优先级顺序匹配）</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-3 text-gray-700 border-b pb-2">定位字段（必填，用于查找运单）：</h4>
              <div className="space-y-3 text-sm">
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">项目名称：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">项目名称</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">项目名称*</code> （带星号）</div>
                    <div>• <code className="bg-white px-1 rounded">项目</code> （简化写法）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">司机姓名：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">司机姓名</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">司机姓名*</code> （带星号）</div>
                    <div>• <code className="bg-white px-1 rounded">司机</code> （简化写法）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">装货地点：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">装货地点</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">装货地点*</code> （带星号）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">卸货地点：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">卸货地点</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">卸货地点*</code> （带星号）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">装货日期：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">装货日期</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">装货日期*</code> （带星号）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">装货数量：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">装货数量</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">装货数量*</code> （带星号）</div>
                    <div>• <code className="bg-white px-1 rounded">装货重量</code> （同义词）</div>
                    <div>• <code className="bg-white px-1 rounded">装货重量*</code> （同义词带星号）</div>
                    <div>• <code className="bg-white px-1 rounded">装货吨数</code> （同义词）</div>
                    <div>• <code className="bg-white px-1 rounded">装货吨数*</code> （同义词带星号）</div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3 text-gray-700 border-b pb-2">可更新字段（可选，勾选后才会更新）：</h4>
              <div className="space-y-3 text-sm">
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">卸货数量 (unloading_weight)：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">卸货数量</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">卸货数量(可选)</code> （带可选标记）</div>
                    <div>• <code className="bg-white px-1 rounded">卸货重量</code> （同义词）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">卸货日期 (unloading_date)：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">卸货日期</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">卸货日期(可选)</code> （带可选标记）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">运费金额 (current_cost)：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">运费金额</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">运费金额(可选)</code> （带可选标记）</div>
                    <div>• <code className="bg-white px-1 rounded">运费</code> （简化写法）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">额外费用 (extra_cost)：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">额外费用</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">额外费用(可选)</code> （带可选标记）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">备注 (remarks)：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">备注</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">备注(可选)</code> （带可选标记）</div>
                    <div>• <code className="bg-white px-1 rounded">说明</code> （同义词）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">货物类型 (cargo_type)：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">货物类型</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">货类</code> （简化写法）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">车牌号 (license_plate)：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">车牌号</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">车牌号*</code> （带星号）</div>
                    <div>• <code className="bg-white px-1 rounded">车牌</code> （简化写法）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">司机电话 (driver_phone)：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">司机电话</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">司机电话(可选)</code> （带可选标记）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">运输类型 (transport_type)：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">运输类型</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">运输类型(可选)</code> （带可选标记）</div>
                    <div>• <code className="bg-white px-1 rounded">类型</code> （简化写法）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">合作链路 (chain_name)：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">合作链路</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">合作链路(可选)</code> （带可选标记）</div>
                    <div>• <code className="bg-white px-1 rounded">链路</code> （简化写法）</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">其他平台名称 (other_platform_names)：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">其他平台名称</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">其他平台名称(可选)</code> （带可选标记）</div>
                    <div>• <code className="bg-white px-1 rounded">平台名称</code> （简化写法）</div>
                    <div className="text-xs text-orange-600 mt-1">⚠️ 多个平台用逗号分隔，如：平台A,平台B</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md">
                  <strong className="text-blue-600 block mb-1">其他平台运单号 (external_tracking_numbers)：</strong>
                  <div className="text-muted-foreground ml-2 space-y-1">
                    <div>• <code className="bg-white px-1 rounded">其他平台运单号</code> （标准写法）</div>
                    <div>• <code className="bg-white px-1 rounded">其他平台运单号(可选)</code> （带可选标记）</div>
                    <div>• <code className="bg-white px-1 rounded">外部运单号</code> （简化写法）</div>
                    <div className="text-xs text-orange-600 mt-1">⚠️ 格式：运单1|运单2,运单3|运单4（逗号和竖线分隔）</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

