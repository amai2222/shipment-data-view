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
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';

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

export default function SelectiveFieldUpdate({ selectedProject, onUpdateSuccess }: SelectiveFieldUpdateProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(['unloading_weight'])  // 默认选择卸货数量
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [matchedCount, setMatchedCount] = useState(0);
  const [unmatchedCount, setUnmatchedCount] = useState(0);

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
      const preview: any[] = [];

      for (const row of jsonData) {
        const rowData = row as any;
        
        // 根据定位字段查找运单
        const { data: existingRecords } = await supabase
          .from('logistics_records')
          .select('*')
          .eq('project_name', rowData['项目名称'] || rowData['项目名称*'] || rowData['项目'])
          .eq('driver_name', rowData['司机姓名'] || rowData['司机姓名*'] || rowData['司机'])
          .eq('loading_location', rowData['装货地点'] || rowData['装货地点*'])
          .eq('unloading_location', rowData['卸货地点'] || rowData['卸货地点*'])
          .limit(1);

        if (existingRecords && existingRecords.length > 0) {
          matched++;
          preview.push({
            status: 'matched',
            auto_number: existingRecords[0].auto_number,
            rowData: rowData,
            existingRecord: existingRecords[0]
          });
        } else {
          unmatched++;
          preview.push({
            status: 'unmatched',
            rowData: rowData
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

    } catch (error: any) {
      toast({ title: '处理失败', description: error.message, variant: 'destructive' });
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

    try {
      for (const item of previewData) {
        if (item.status !== 'matched') continue;

        try {
          // 构建更新数据（只更新选中的字段）
          const updateData: any = {};

          if (selectedFields.has('unloading_weight')) {
            const value = item.rowData['卸货数量'] || item.rowData['卸货数量(可选)'] || item.rowData['卸货重量'];
            if (value != null && value !== '') {
              updateData.unloading_weight = parseFloat(value);
            }
          }

          if (selectedFields.has('unloading_date')) {
            const value = item.rowData['卸货日期'] || item.rowData['卸货日期(可选)'];
            if (value) {
              updateData.unloading_date = value;
            }
          }

          if (selectedFields.has('current_cost')) {
            const value = item.rowData['运费金额'] || item.rowData['运费金额(可选)'] || item.rowData['运费'];
            if (value != null && value !== '') {
              updateData.current_cost = parseFloat(value);
            }
          }

          if (selectedFields.has('extra_cost')) {
            const value = item.rowData['额外费用'] || item.rowData['额外费用(可选)'];
            if (value != null && value !== '') {
              updateData.extra_cost = parseFloat(value);
            }
          }

          if (selectedFields.has('remarks')) {
            const value = item.rowData['备注'] || item.rowData['备注(可选)'] || item.rowData['说明'];
            if (value) {
              updateData.remarks = value;
            }
          }

          if (selectedFields.has('cargo_type')) {
            const value = item.rowData['货物类型'] || item.rowData['货类'];
            if (value) {
              updateData.cargo_type = value;
            }
          }

          if (selectedFields.has('license_plate')) {
            const value = item.rowData['车牌号'] || item.rowData['车牌号*'] || item.rowData['车牌'];
            if (value) {
              updateData.license_plate = value;
            }
          }

          if (selectedFields.has('driver_phone')) {
            const value = item.rowData['司机电话'] || item.rowData['司机电话(可选)'];
            if (value) {
              updateData.driver_phone = value;
            }
          }

          if (selectedFields.has('other_platform_names')) {
            const value = item.rowData['其他平台名称'] || item.rowData['其他平台名称(可选)'] || item.rowData['平台名称'];
            if (value) {
              const platforms = value.split(',').map((p: string) => p.trim());
              updateData.other_platform_names = platforms;
            }
          }

          if (selectedFields.has('external_tracking_numbers')) {
            const value = item.rowData['其他平台运单号'] || item.rowData['其他平台运单号(可选)'] || item.rowData['外部运单号'];
            if (value) {
              // 解析格式：运单1|运单2,运单3|运单4
              const platforms = value.split(',').map((p: string) => p.trim());
              updateData.external_tracking_numbers = platforms;
            }
          }

          if (selectedFields.has('transport_type')) {
            const value = item.rowData['运输类型'] || item.rowData['运输类型(可选)'] || item.rowData['类型'];
            if (value) {
              updateData.transport_type = value;
            }
          }

          if (selectedFields.has('chain_name')) {
            const value = item.rowData['合作链路'] || item.rowData['合作链路(可选)'] || item.rowData['链路'];
            if (value) {
              // 需要查找链路ID
              const { data: chainData } = await supabase
                .from('partner_chains')
                .select('id')
                .eq('project_name', selectedProject)
                .eq('chain_name', value)
                .single();
              
              if (chainData) {
                updateData.chain_id = chainData.id;
              }
            }
          }

          // 如果有要更新的数据，执行更新
          if (Object.keys(updateData).length > 0) {
            updateData.updated_at = new Date().toISOString();

            const { error } = await supabase
              .from('logistics_records')
              .update(updateData)
              .eq('id', item.existingRecord.id);

            if (error) throw error;
            successCount++;
          } else {
            // Excel中该运单的选中字段都为空，跳过
            continue;
          }

        } catch (error: any) {
          failedCount++;
          console.error('更新失败:', item.auto_number, error);
        }
      }

      toast({
        title: '更新完成',
        description: `成功更新 ${successCount} 条运单，失败 ${failedCount} 条`
      });

      if (successCount > 0) {
        onUpdateSuccess();
        setPreviewData([]);
        setMatchedCount(0);
        setUnmatchedCount(0);
      }

    } catch (error: any) {
      toast({ title: '批量更新失败', description: error.message, variant: 'destructive' });
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

              <div className="border rounded-md p-4 max-h-64 overflow-y-auto">
                <h4 className="font-semibold mb-2">匹配预览（前10条）</h4>
                <div className="space-y-2 text-sm">
                  {previewData.slice(0, 10).map((item, index) => (
                    <div key={index} className={`p-2 rounded ${item.status === 'matched' ? 'bg-green-50' : 'bg-yellow-50'}`}>
                      {item.status === 'matched' ? (
                        <span className="text-green-800">
                          ✓ {item.auto_number} - 将更新选中的字段
                        </span>
                      ) : (
                        <span className="text-yellow-800">
                          ⚠ 未找到匹配运单（司机：{item.rowData['司机姓名'] || item.rowData['司机']}）
                        </span>
                      )}
                    </div>
                  ))}
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

