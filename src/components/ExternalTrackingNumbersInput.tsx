import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { ExternalTrackingNumber } from '@/types';

interface ExternalTrackingNumbersInputProps {
  externalTrackingNumbers: ExternalTrackingNumber[];
  onChange: (trackingNumbers: ExternalTrackingNumber[]) => void;
  disabled?: boolean;
  className?: string;
}

const INITIAL_EXTERNAL_TRACKING: ExternalTrackingNumber = {
  platform: '',
  tracking_number: '',
  status: 'pending',
  remarks: ''
};

const PLATFORM_OPTIONS = [
  { value: '货拉拉', label: '货拉拉' },
  { value: '满帮', label: '满帮' },
  { value: '运满满', label: '运满满' },
  { value: '滴滴货运', label: '滴滴货运' },
  { value: '其他', label: '其他' }
];

const STATUS_OPTIONS = [
  { value: 'pending', label: '待处理' },
  { value: 'in_transit', label: '运输中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' }
];

export function ExternalTrackingNumbersInput({
  externalTrackingNumbers,
  onChange,
  disabled = false,
  className = ''
}: ExternalTrackingNumbersInputProps) {

  // 添加外部运单号
  const addExternalTracking = () => {
    const newTrackingNumbers = [...externalTrackingNumbers, { ...INITIAL_EXTERNAL_TRACKING }];
    onChange(newTrackingNumbers);
  };

  // 删除外部运单号
  const removeExternalTracking = (index: number) => {
    const newTrackingNumbers = externalTrackingNumbers.filter((_, i) => i !== index);
    onChange(newTrackingNumbers);
  };

  // 更新外部运单号
  const updateExternalTracking = (index: number, field: keyof ExternalTrackingNumber, value: string) => {
    const newTrackingNumbers = externalTrackingNumbers.map((tracking, i) => 
      i === index ? { ...tracking, [field]: value } : tracking
    );
    onChange(newTrackingNumbers);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center">
        <Label className="text-base font-medium flex items-center gap-2">
          <ExternalLink className="h-4 w-4" />
          其他平台运单号码
        </Label>
        {!disabled && (
          <Button type="button" onClick={addExternalTracking} size="sm" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            添加运单号
          </Button>
        )}
      </div>

      {externalTrackingNumbers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <ExternalLink className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>暂无外部运单号</p>
          {!disabled && (
            <p className="text-sm">点击上方按钮添加其他平台的运单号</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {externalTrackingNumbers.map((tracking, index) => (
            <Card key={index} className="border-dashed">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">外部运单 {index + 1}</Badge>
                    <Badge variant={
                      tracking.status === 'completed' ? 'default' : 
                      tracking.status === 'in_transit' ? 'secondary' : 
                      tracking.status === 'cancelled' ? 'destructive' : 'outline'
                    }>
                      {STATUS_OPTIONS.find(s => s.value === tracking.status)?.label || '待处理'}
                    </Badge>
                  </div>
                  {!disabled && externalTrackingNumbers.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeExternalTracking(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>平台名称 *</Label>
                    <Select 
                      value={tracking.platform} 
                      onValueChange={(value) => updateExternalTracking(index, 'platform', value)}
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择平台" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORM_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>运单号码 *</Label>
                    <Input
                      value={tracking.tracking_number}
                      onChange={(e) => updateExternalTracking(index, 'tracking_number', e.target.value)}
                      placeholder="请输入运单号码"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <Label>状态</Label>
                    <Select 
                      value={tracking.status} 
                      onValueChange={(value) => updateExternalTracking(index, 'status', value)}
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择状态" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="mt-4">
                  <Label>备注</Label>
                  <Input
                    value={tracking.remarks || ''}
                    onChange={(e) => updateExternalTracking(index, 'remarks', e.target.value)}
                    placeholder="请输入备注信息"
                    disabled={disabled}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExternalTrackingNumbersInput;
