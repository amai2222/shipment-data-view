import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, ExternalLink, Search, Settings, CheckCircle } from '@/components/icons-placeholder';
import { ExternalTrackingNumber, PlatformOption } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface EnhancedExternalTrackingNumbersInputProps {
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

const STATUS_OPTIONS = [
  { value: 'pending', label: '待处�? },
  { value: 'in_transit', label: '运输�? },
  { value: 'completed', label: '已完�? },
  { value: 'cancelled', label: '已取�? }
];

export function EnhancedExternalTrackingNumbersInput({
  externalTrackingNumbers,
  onChange,
  disabled = false,
  className = ''
}: EnhancedExternalTrackingNumbersInputProps) {
  const { toast } = useToast();
  const [platforms, setPlatforms] = useState<PlatformOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCustomDialog, setShowAddCustomDialog] = useState(false);
  const [customPlatformName, setCustomPlatformName] = useState('');
  const [customPlatformCode, setCustomPlatformCode] = useState('');
  const [customPlatformDescription, setCustomPlatformDescription] = useState('');

  // 获取平台列表 - 使用静态数据替代不存在的数据库�?
  useEffect(() => {
    const defaultPlatforms: PlatformOption[] = [
      {
        platform_code: 'SF',
        primary_name: '顺丰速运',
        aliases: ['顺丰', 'SF Express'],
        description: '顺丰速运物流平台',
        is_custom: false,
        sort_order: 1
      },
      {
        platform_code: 'YTO',
        primary_name: '圆通速�?,
        aliases: ['圆�?, 'YTO Express'],
        description: '圆通速递物流平�?,
        is_custom: false,
        sort_order: 2
      },
      {
        platform_code: 'STO',
        primary_name: '申通快�?,
        aliases: ['申�?, 'STO Express'],
        description: '申通快递物流平�?,
        is_custom: false,
        sort_order: 3
      },
      {
        platform_code: 'ZTO',
        primary_name: '中通快�?,
        aliases: ['中�?, 'ZTO Express'],
        description: '中通快递物流平�?,
        is_custom: false,
        sort_order: 4
      },
      {
        platform_code: 'YUNDA',
        primary_name: '韵达速�?,
        aliases: ['韵达', 'Yunda Express'],
        description: '韵达速递物流平�?,
        is_custom: false,
        sort_order: 5
      }
    ];
    
    setPlatforms(defaultPlatforms);
  }, []);

  // 搜索过滤平台
  const filteredPlatforms = useMemo(() => {
    if (!searchTerm.trim()) return platforms;
    
    const term = searchTerm.toLowerCase();
    return platforms.filter(platform => 
      platform.primary_name.toLowerCase().includes(term) ||
      platform.aliases.some(alias => alias.toLowerCase().includes(term)) ||
      platform.platform_code.toLowerCase().includes(term)
    );
  }, [platforms, searchTerm]);

  // 智能平台匹配
  const smartMatchPlatforms = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    return platforms.filter(platform => {
      const name = platform.primary_name.toLowerCase();
      const term = searchTerm.toLowerCase();
      
      // 精确匹配
      if (name === term) return true;
      
      // 别名精确匹配
      if (platform.aliases.some(alias => alias.toLowerCase() === term)) return true;
      
      // 包含匹配
      if (name.includes(term) || term.includes(name)) return true;
      
      return false;
    });
  }, [platforms, searchTerm]);

  // 添加外部运单�?
  const addExternalTracking = () => {
    const newTrackingNumbers = [...externalTrackingNumbers, { ...INITIAL_EXTERNAL_TRACKING }];
    onChange(newTrackingNumbers);
  };

  // 删除外部运单�?
  const removeExternalTracking = (index: number) => {
    const newTrackingNumbers = externalTrackingNumbers.filter((_, i) => i !== index);
    onChange(newTrackingNumbers);
  };

  // 更新外部运单�?
  const updateExternalTracking = (index: number, field: keyof ExternalTrackingNumber, value: string) => {
    const newTrackingNumbers = externalTrackingNumbers.map((tracking, i) => 
      i === index ? { ...tracking, [field]: value } : tracking
    );
    onChange(newTrackingNumbers);
  };

  // 添加自定义平�?
  const addCustomPlatform = async () => {
    if (!customPlatformName.trim()) {
      toast({
        title: "平台名称不能为空",
        variant: "destructive",
      });
      return;
    }

    try {
      // 由于add_custom_platform函数不存在，我们直接在本地添�?
      // 在实际应用中，这里应该调用真正的API来保存到数据�?
      console.log('添加自定义平�?', customPlatformName, customPlatformCode, customPlatformDescription);

      toast({
        title: "添加成功",
        description: `自定义平�?"${customPlatformName}" 已添加`,
      });

      // 添加自定义平台到现有列表
      const newPlatform: PlatformOption = {
        platform_code: customPlatformCode,
        primary_name: customPlatformName,
        aliases: [customPlatformName],
        description: customPlatformDescription,
        is_custom: true,
        sort_order: platforms.length + 1
      };
      setPlatforms([...platforms, newPlatform]);

      // 重置表单
      setCustomPlatformName('');
      setCustomPlatformCode('');
      setCustomPlatformDescription('');
      setShowAddCustomDialog(false);
    } catch (error) {
      console.error('添加自定义平台异�?', error);
      toast({
        title: "添加失败",
        description: "网络错误，请重试",
        variant: "destructive",
      });
    }
  };

  // 平台选择组件
  const PlatformSelector = ({ value, onChange: onPlatformChange, index }: { 
    value: string; 
    onChange: (value: string) => void;
    index: number;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);

    const handlePlatformSelect = (platform: PlatformOption) => {
      onPlatformChange(platform.primary_name);
      setInputValue(platform.primary_name);
      setIsOpen(false);
    };

    const handleInputChange = (newValue: string) => {
      setInputValue(newValue);
      onPlatformChange(newValue);
    };

    return (
      <div className="relative">
        <div className="flex gap-1">
          <Input
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="搜索或输入平台名�?
            disabled={disabled}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
        
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {filteredPlatforms.length > 0 ? (
              <div className="p-2 space-y-1">
                {filteredPlatforms.map((platform) => (
                  <div
                    key={platform.platform_code}
                    className="p-2 hover:bg-gray-100 cursor-pointer rounded"
                    onClick={() => handlePlatformSelect(platform)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{platform.primary_name}</div>
                        {platform.aliases.length > 0 && (
                          <div className="text-sm text-gray-500">
                            别名: {platform.aliases.join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {platform.platform_code}
                        </Badge>
                        {platform.is_custom && (
                          <Badge variant="secondary" className="text-xs">
                            自定�?
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                <div>未找到匹配的平台</div>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setShowAddCustomDialog(true)}
                  className="mt-2"
                >
                  添加自定义平�?
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center">
        <Label className="text-base font-medium flex items-center gap-2">
          <ExternalLink className="h-4 w-4" />
          其他平台运单号码
        </Label>
        <div className="flex gap-2">
          <Dialog open={showAddCustomDialog} onOpenChange={setShowAddCustomDialog}>
            <DialogTrigger asChild>
              <Button type="button" size="sm" variant="outline" disabled={disabled}>
                <Settings className="mr-2 h-4 w-4" />
                管理平台
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加自定义平�?/DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>平台名称 *</Label>
                  <Input
                    value={customPlatformName}
                    onChange={(e) => setCustomPlatformName(e.target.value)}
                    placeholder="请输入平台名�?
                  />
                </div>
                <div>
                  <Label>平台代码</Label>
                  <Input
                    value={customPlatformCode}
                    onChange={(e) => setCustomPlatformCode(e.target.value)}
                    placeholder="请输入平台代码（可选）"
                  />
                </div>
                <div>
                  <Label>描述</Label>
                  <Input
                    value={customPlatformDescription}
                    onChange={(e) => setCustomPlatformDescription(e.target.value)}
                    placeholder="请输入平台描述（可选）"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAddCustomDialog(false)}>
                    取消
                  </Button>
                  <Button onClick={addCustomPlatform}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    添加
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          {!disabled && (
            <Button type="button" onClick={addExternalTracking} size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              添加运单�?
            </Button>
          )}
        </div>
      </div>

      {externalTrackingNumbers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <ExternalLink className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>暂无外部运单�?/p>
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
                      {STATUS_OPTIONS.find(s => s.value === tracking.status)?.label || '待处�?}
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
                    <PlatformSelector
                      value={tracking.platform}
                      onChange={(value) => updateExternalTracking(index, 'platform', value)}
                      index={index}
                    />
                  </div>
                  <div>
                    <Label>运单号码 *</Label>
                    <Input
                      value={tracking.tracking_number}
                      onChange={(e) => updateExternalTracking(index, 'tracking_number', e.target.value)}
                      placeholder="请输入运单号�?
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <Label>状�?/Label>
                    <Select 
                      value={tracking.status} 
                      onValueChange={(value) => updateExternalTracking(index, 'status', value)}
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择状�? />
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
                    placeholder="请输入备注信�?
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

export default EnhancedExternalTrackingNumbersInput;
