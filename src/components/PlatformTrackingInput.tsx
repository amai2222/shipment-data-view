import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ExternalLink } from 'lucide-react';

interface PlatformTracking {
  platform: string;
  trackingNumbers: string[];
}

interface PlatformTrackingInputProps {
  platformTrackings: PlatformTracking[];
  onChange: (platformTrackings: PlatformTracking[]) => void;
  disabled?: boolean;
  className?: string;
}

export function PlatformTrackingInput({
  platformTrackings,
  onChange,
  disabled = false,
  className = ''
}: PlatformTrackingInputProps) {

  // 添加新平台
  const addPlatform = () => {
    const newPlatformTrackings = [...platformTrackings, { platform: '', trackingNumbers: [''] }];
    onChange(newPlatformTrackings);
  };

  // 删除平台
  const removePlatform = (platformIndex: number) => {
    const newPlatformTrackings = platformTrackings.filter((_, i) => i !== platformIndex);
    onChange(newPlatformTrackings);
  };

  // 更新平台名称
  const updatePlatformName = (platformIndex: number, platformName: string) => {
    const newPlatformTrackings = platformTrackings.map((platform, i) => 
      i === platformIndex ? { ...platform, platform: platformName } : platform
    );
    onChange(newPlatformTrackings);
  };

  // 添加运单号到指定平台
  const addTrackingNumber = (platformIndex: number) => {
    const newPlatformTrackings = platformTrackings.map((platform, i) => 
      i === platformIndex 
        ? { ...platform, trackingNumbers: [...platform.trackingNumbers, ''] }
        : platform
    );
    onChange(newPlatformTrackings);
  };

  // 删除运单号
  const removeTrackingNumber = (platformIndex: number, trackingIndex: number) => {
    const newPlatformTrackings = platformTrackings.map((platform, i) => 
      i === platformIndex 
        ? { 
            ...platform, 
            trackingNumbers: platform.trackingNumbers.filter((_, j) => j !== trackingIndex)
          }
        : platform
    );
    onChange(newPlatformTrackings);
  };

  // 更新运单号
  const updateTrackingNumber = (platformIndex: number, trackingIndex: number, trackingNumber: string) => {
    const newPlatformTrackings = platformTrackings.map((platform, i) => 
      i === platformIndex 
        ? {
            ...platform,
            trackingNumbers: platform.trackingNumbers.map((tracking, j) => 
              j === trackingIndex ? trackingNumber : tracking
            )
          }
        : platform
    );
    onChange(newPlatformTrackings);
  };

  // 过滤有效的平台和运单号
  const validPlatformTrackings = platformTrackings.filter(platform => 
    platform.platform.trim() !== '' && 
    platform.trackingNumbers.some(tracking => tracking.trim() !== '')
  );

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center">
        <Label className="text-base font-medium flex items-center gap-2">
          <ExternalLink className="h-4 w-4" />
          其他平台运单信息
        </Label>
        {!disabled && (
          <Button type="button" onClick={addPlatform} size="sm" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            添加平台
          </Button>
        )}
      </div>

      {platformTrackings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <ExternalLink className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>暂无其他平台运单信息</p>
          {!disabled && (
            <p className="text-sm">点击上方按钮添加其他平台</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {platformTrackings.map((platform, platformIndex) => (
            <Card key={platformIndex} className="border-dashed">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="outline">平台 {platformIndex + 1}</Badge>
                    <span className="text-muted-foreground">其他平台运单信息</span>
                  </CardTitle>
                  {!disabled && platformTrackings.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removePlatform(platformIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 平台名称输入 */}
                <div>
                  <Label>平台名称 *</Label>
                  <Input
                    value={platform.platform}
                    onChange={(e) => updatePlatformName(platformIndex, e.target.value)}
                    placeholder="请输入平台名称，如：货拉拉、满帮等"
                    disabled={disabled}
                  />
                </div>

                {/* 运单号列表 */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium">运单号码</Label>
                    {!disabled && (
                      <Button 
                        type="button" 
                        onClick={() => addTrackingNumber(platformIndex)} 
                        size="sm" 
                        variant="outline"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        添加运单号
                      </Button>
                    )}
                  </div>

                  {platform.trackingNumbers.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground border border-dashed rounded-md">
                      <p className="text-sm">暂无运单号</p>
                      {!disabled && (
                        <p className="text-xs">点击上方按钮添加运单号</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {platform.trackingNumbers.map((trackingNumber, trackingIndex) => (
                        <div key={trackingIndex} className="flex gap-2 items-center">
                          <Input
                            value={trackingNumber}
                            onChange={(e) => updateTrackingNumber(platformIndex, trackingIndex, e.target.value)}
                            placeholder="请输入运单号码"
                            disabled={disabled}
                            className="flex-1"
                          />
                          {!disabled && platform.trackingNumbers.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTrackingNumber(platformIndex, trackingIndex)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 显示有效的平台和运单号 */}
      {validPlatformTrackings.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">已添加的平台运单信息：</Label>
          <div className="space-y-2">
            {validPlatformTrackings.map((platform, index) => (
              <div key={index} className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  {platform.platform}
                </Badge>
                <span className="text-muted-foreground text-sm">:</span>
                <div className="flex flex-wrap gap-1">
                  {platform.trackingNumbers
                    .filter(tracking => tracking.trim() !== '')
                    .map((tracking, trackingIndex) => (
                      <Badge key={trackingIndex} variant="outline" className="text-xs">
                        {tracking}
                      </Badge>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PlatformTrackingInput;
