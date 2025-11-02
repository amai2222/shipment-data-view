import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Location {
  id: string;
  name: string;
}

interface MultiLocationInputProps {
  label: string;
  locations: Location[];
  value: string[]; // 存储选中的地点ID数组
  onChange: (locationIds: string[]) => void;
  placeholder?: string;
  className?: string;
  maxLocations?: number;
  allowCustomInput?: boolean;
  onCustomLocationAdd?: (locationName: string) => void;
}

export function MultiLocationInput({
  label,
  locations,
  value,
  onChange,
  placeholder = "选择或输入地点",
  className,
  maxLocations = 10,
  allowCustomInput = true,
  onCustomLocationAdd
}: MultiLocationInputProps) {
  const [customLocation, setCustomLocation] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // 获取选中的地点信息
  const selectedLocations = value
    .map(id => locations.find(loc => loc.id === id))
    .filter(Boolean) as Location[];

  // 获取未选中的地点
  const availableLocations = locations.filter(loc => !value.includes(loc.id));

  const handleLocationSelect = (locationId: string) => {
    if (value.includes(locationId)) return;
    if (value.length >= maxLocations) return;
    
    onChange([...value, locationId]);
  };

  const handleLocationRemove = (locationId: string) => {
    onChange(value.filter(id => id !== locationId));
  };

  const handleCustomLocationAdd = () => {
    if (!customLocation.trim()) return;
    if (value.length >= maxLocations) return;
    
    if (onCustomLocationAdd) {
      onCustomLocationAdd(customLocation.trim());
    }
    setCustomLocation('');
    setShowCustomInput(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomLocationAdd();
    } else if (e.key === 'Escape') {
      setShowCustomInput(false);
      setCustomLocation('');
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">{label}</Label>
      
      {/* 已选择的地点 */}
      {selectedLocations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedLocations.map((location) => (
            <div
              key={location.id}
              className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm"
            >
              <MapPin className="h-3 w-3" />
              <span>{location.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-primary/20"
                onClick={() => handleLocationRemove(location.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* 添加地点选择器 */}
      {value.length < maxLocations && (
        <div className="space-y-2">
          {availableLocations.length > 0 && (
            <Select
              value=""
              onValueChange={handleLocationSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {availableLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* 自定义地点输入 */}
          {allowCustomInput && (
            <div className="space-y-2">
              {!showCustomInput ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCustomInput(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加自定义地点
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="输入地点名称"
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCustomLocationAdd}
                    disabled={!customLocation.trim()}
                  >
                    添加
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomLocation('');
                    }}
                  >
                    取消
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 提示信息 */}
      <div className="text-xs text-muted-foreground">
        已选择 {selectedLocations.length} / {maxLocations} 个地点
        {value.length >= maxLocations && (
          <span className="text-destructive ml-2">已达到最大数量限制</span>
        )}
      </div>
    </div>
  );
}
