import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Search, Plus } from 'lucide-react';
import { convertChinaDateToUTCDate } from '@/utils/dateUtils';

interface Project {
  id: string;
  name: string;
}

interface FilterState {
  projectId: string;
  startDate: string;
  endDate: string;
  licensePlate: string;
}

interface FilterSectionProps {
  projects: Project[];
  uiFilters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  onSearch: () => void;
  onClear: () => void;
  onAddRecord: () => void;
  isStale: boolean;
  selectedCount: number;
  onBulkDelete: () => void;
  onBulkLink: () => void;
  isBulkLinking: boolean;
}

export function FilterSection({
  projects,
  uiFilters,
  onFiltersChange,
  onSearch,
  onClear,
  onAddRecord,
  isStale,
  selectedCount,
  onBulkDelete,
  onBulkLink,
  isBulkLinking
}: FilterSectionProps) {
  // 格式化中国时区的日期为字符串（用于存储和显示）
  const formatChinaDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateRangeChange = (dateRange: any) => {
    // 存储中国时区的日期字符串（用于显示）
    // 传递给后端时会转换为 UTC 日期
    onFiltersChange({
      startDate: dateRange?.from ? formatChinaDateString(dateRange.from) : '',
      endDate: dateRange?.to ? formatChinaDateString(dateRange.to) : ''
    });
  };

  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div className="flex items-end gap-4 flex-grow">
        <div className="flex-1 min-w-[180px]">
          <Label htmlFor="project">项目</Label>
          <Select 
            value={uiFilters.projectId || "all"} 
            onValueChange={(value) => onFiltersChange({ projectId: value === "all" ? "" : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部项目</SelectItem>
              {projects.filter(p => p.id && p.id.trim() !== '').map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[280px]">
          <Label htmlFor="date-range">日期范围</Label>
          <DateRangePicker 
            date={{ 
              from: uiFilters.startDate ? (() => {
                // 解析中国时区日期字符串为 Date 对象
                const [year, month, day] = uiFilters.startDate.split('-').map(Number);
                return new Date(year, month - 1, day);
              })() : undefined, 
              to: uiFilters.endDate ? (() => {
                const [year, month, day] = uiFilters.endDate.split('-').map(Number);
                return new Date(year, month - 1, day);
              })() : undefined, 
            }} 
            setDate={handleDateRangeChange} 
          />
        </div>

        <div className="flex-1 min-w-[180px]">
          <Label htmlFor="licensePlate">车牌号</Label>
          <Input 
            id="licensePlate" 
            placeholder="输入车牌号" 
            value={uiFilters.licensePlate} 
            onChange={(e) => onFiltersChange({ licensePlate: e.target.value })} 
          />
        </div>
      </div>

      <div className="flex items-end gap-2">
        {selectedCount > 0 && (
          <>
            <Button variant="destructive" onClick={onBulkDelete}>
              删除选中 ({selectedCount})
            </Button>
            <Button onClick={onBulkLink} disabled={isBulkLinking}>
              {isBulkLinking ? '关联中...' : `关联运单 (${selectedCount})`}
            </Button>
          </>
        )}
        <Button variant="outline" onClick={onClear}>清除</Button>
        <Button onClick={onSearch} disabled={!isStale}>
          <Search className="h-4 w-4 mr-2" />搜索
        </Button>
        <Button onClick={onAddRecord}>
          <Plus className="h-4 w-4 mr-2" />添加磅单
        </Button>
      </div>
    </div>
  );
}
