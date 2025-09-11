import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ExternalLink } from 'lucide-react';

interface OtherPlatformNamesInputProps {
  platformNames: string[];
  onChange: (platformNames: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export function OtherPlatformNamesInput({
  platformNames,
  onChange,
  disabled = false,
  className = ''
}: OtherPlatformNamesInputProps) {

  // 添加平台名称
  const addPlatformName = () => {
    const newPlatformNames = [...platformNames, ''];
    onChange(newPlatformNames);
  };

  // 删除平台名称
  const removePlatformName = (index: number) => {
    const newPlatformNames = platformNames.filter((_, i) => i !== index);
    onChange(newPlatformNames);
  };

  // 更新平台名称
  const updatePlatformName = (index: number, value: string) => {
    const newPlatformNames = platformNames.map((name, i) => 
      i === index ? value : name
    );
    onChange(newPlatformNames);
  };

  // 过滤空字符串
  const validPlatformNames = platformNames.filter(name => name.trim() !== '');

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex justify-between items-center">
        <Label className="text-base font-medium flex items-center gap-2">
          <ExternalLink className="h-4 w-4" />
          其他平台名称
        </Label>
        {!disabled && (
          <Button type="button" onClick={addPlatformName} size="sm" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            添加平台
          </Button>
        )}
      </div>

      {platformNames.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
          <ExternalLink className="h-6 w-6 mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无其他平台</p>
          {!disabled && (
            <p className="text-xs">点击上方按钮添加其他平台名称</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {platformNames.map((platform, index) => (
            <div key={index} className="flex gap-2 items-center">
              <Input
                value={platform}
                onChange={(e) => updatePlatformName(index, e.target.value)}
                placeholder="输入平台名称"
                disabled={disabled}
                className="flex-1"
              />
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePlatformName(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 显示有效的平台名称 */}
      {validPlatformNames.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">已添加的平台：</Label>
          <div className="flex flex-wrap gap-2">
            {validPlatformNames.map((platform, index) => (
              <Badge key={index} variant="secondary" className="text-sm">
                {platform}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default OtherPlatformNamesInput;
