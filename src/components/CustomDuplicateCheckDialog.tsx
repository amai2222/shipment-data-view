// 自定义验重对话框组件
// 允许用户选择用于验重的字段（支持多选）

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

// 可用的验重字段配置
export interface DuplicateCheckField {
  key: string;  // 数据库字段名
  label: string;  // 显示名称
  description?: string;  // 字段说明
  category: 'basic' | 'location' | 'date' | 'weight' | 'other';  // 字段分类
}

// 预定义的验重字段列表
export const AVAILABLE_DUPLICATE_CHECK_FIELDS: DuplicateCheckField[] = [
  // 基础字段
  { key: 'project_name', label: '项目名称', description: '运单所属项目', category: 'basic' },
  { key: 'chain_name', label: '合作链路', description: '合作链路名称（可选）', category: 'basic' },
  { key: 'driver_name', label: '司机姓名', description: '司机姓名', category: 'basic' },
  { key: 'license_plate', label: '车牌号', description: '车辆车牌号', category: 'basic' },
  { key: 'driver_phone', label: '司机电话', description: '司机联系电话', category: 'basic' },
  
  // 地点字段
  { key: 'loading_location', label: '装货地点', description: '货物装货地点', category: 'location' },
  { key: 'unloading_location', label: '卸货地点', description: '货物卸货地点', category: 'location' },
  
  // 日期字段
  { key: 'loading_date', label: '装货日期', description: '货物装货日期', category: 'date' },
  { key: 'unloading_date', label: '卸货日期', description: '货物卸货日期（可选）', category: 'date' },
  
  // 重量字段
  { key: 'loading_weight', label: '装货数量', description: '装货重量/数量', category: 'weight' },
  { key: 'unloading_weight', label: '卸货数量', description: '卸货重量/数量（可选）', category: 'weight' },
  
  // 其他字段
  { key: 'transport_type', label: '运输类型', description: '运输方式类型', category: 'other' },
  { key: 'cargo_type', label: '货物类型', description: '货物类别（可选）', category: 'other' },
  { key: 'current_cost', label: '运费金额', description: '运费金额（可选）', category: 'other' },
  { key: 'extra_cost', label: '额外费用', description: '额外费用（可选）', category: 'other' },
  { key: 'external_tracking_numbers', label: '其他平台运单编号', description: '其他平台的运单号（数组字段，有交集即视为重复）', category: 'other' },
];

interface CustomDuplicateCheckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedFields: string[]) => void;
  defaultSelectedFields?: string[];  // 默认选中的字段（标准6个关键字段）
}

export function CustomDuplicateCheckDialog({
  isOpen,
  onClose,
  onConfirm,
  defaultSelectedFields = ['project_name', 'driver_name', 'license_plate', 'loading_location', 'unloading_location', 'loading_date', 'loading_weight']
}: CustomDuplicateCheckDialogProps) {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(defaultSelectedFields)
  );

  // 按分类分组字段
  const fieldsByCategory = AVAILABLE_DUPLICATE_CHECK_FIELDS.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, DuplicateCheckField[]>);

  const categoryLabels: Record<string, string> = {
    basic: '基础信息',
    location: '地点信息',
    date: '日期信息',
    weight: '重量信息',
    other: '其他信息'
  };

  const handleToggleField = (fieldKey: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldKey)) {
      newSelected.delete(fieldKey);
    } else {
      newSelected.add(fieldKey);
    }
    setSelectedFields(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedFields(new Set(AVAILABLE_DUPLICATE_CHECK_FIELDS.map(f => f.key)));
  };

  const handleDeselectAll = () => {
    setSelectedFields(new Set());
  };

  const handleReset = () => {
    setSelectedFields(new Set(defaultSelectedFields));
  };

  const handleConfirm = () => {
    if (selectedFields.size === 0) {
      return; // 至少选择一个字段
    }
    onConfirm(Array.from(selectedFields));
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>自定义验重字段</DialogTitle>
          <DialogDescription>
            选择用于验重的字段。只有所有选中的字段都匹配时，才会被认为是重复记录。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 快捷操作按钮 */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              全选
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
            >
              全不选
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
            >
              恢复默认
            </Button>
            <div className="flex-1" />
            <div className="text-sm text-muted-foreground flex items-center">
              已选择 {selectedFields.size} 个字段
            </div>
          </div>

          {/* 字段选择区域 */}
          <ScrollArea className="h-[400px] border rounded-md p-4">
            <div className="space-y-6">
              {Object.entries(fieldsByCategory).map(([category, fields]) => (
                <div key={category} className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    {categoryLabels[category]}
                  </h4>
                  <div className="space-y-2 pl-4">
                    {fields.map((field) => (
                      <div
                        key={field.key}
                        className="flex items-start space-x-3 p-2 rounded-md hover:bg-muted/50"
                      >
                        <Checkbox
                          id={field.key}
                          checked={selectedFields.has(field.key)}
                          onCheckedChange={() => handleToggleField(field.key)}
                        />
                        <div className="flex-1 space-y-1">
                          <Label
                            htmlFor={field.key}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {field.label}
                          </Label>
                          {field.description && (
                            <p className="text-xs text-muted-foreground">
                              {field.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* 提示信息 */}
          {selectedFields.size === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                请至少选择一个字段用于验重。建议选择项目名称、司机姓名、车牌号、装货地点、卸货地点、装货日期、装货数量等关键字段。
              </AlertDescription>
            </Alert>
          )}

          {selectedFields.size > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                已选择 {selectedFields.size} 个字段。验重时，只有当所有选中的字段都完全匹配时，才会被认为是重复记录。
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={selectedFields.size === 0}
          >
            确认 ({selectedFields.size} 个字段)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

