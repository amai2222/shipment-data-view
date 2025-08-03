// 最终文件路径: src/pages/BusinessEntry/components/FilterBar.tsx

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { LogisticsFilters } from '../hooks/useLogisticsData';
import { Project } from '../types';
import { DateRange } from "react-day-picker";
import { Search } from "lucide-react";

interface FilterBarProps {
  filters: LogisticsFilters;
  onFiltersChange: (newFilters: LogisticsFilters) => void;
  onSearch: () => void;
  onClear: () => void;
  loading: boolean;
  projects: Project[];
}

export function FilterBar({ filters, onFiltersChange, onSearch, onClear, loading, projects }: FilterBarProps) {

  const handleInputChange = (field: keyof Omit<LogisticsFilters, 'startDate' | 'endDate'>, value: string) => {
    onFiltersChange({ ...filters, [field]: value });
  };

  const handleDateChange = (dateRange: DateRange | undefined) => {
    onFiltersChange({
      ...filters,
      startDate: dateRange?.from ? dateRange.from.toISOString().split('T')[0] : '',
      endDate: dateRange?.to ? dateRange.to.toISOString().split('T')[0] : '',
    });
  };

  const dateRangeValue: DateRange | undefined = (filters.startDate || filters.endDate)
    ? {
        from: filters.startDate ? new Date(filters.startDate) : undefined,
        to: filters.endDate ? new Date(filters.endDate) : undefined,
      }
    : undefined;

  return (
    <div className="flex items-end gap-2 p-4 border rounded-lg flex-wrap">
      <div className="grid items-center gap-1.5 flex-1 min-w-[150px]">
        <Label htmlFor="project-id">项目名称</Label>
        <Select
          value={filters.projectId || 'all'}
          onValueChange={(value) => handleInputChange('projectId', value === 'all' ? '' : value)}
          disabled={loading || projects.length === 0}
        >
          <SelectTrigger id="project-id"><SelectValue placeholder="所有项目" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有项目</SelectItem>
            {(projects || []).map(project => (<SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid items-center gap-1.5 flex-1 min-w-[150px]">
        <Label htmlFor="driver-name">司机</Label>
        <Input type="text" id="driver-name" placeholder="司机姓名..." value={filters.driverName} onChange={e => handleInputChange('driverName', e.target.value)} disabled={loading} />
      </div>

      <div className="grid items-center gap-1.5 flex-1 min-w-[150px]">
        <Label htmlFor="license-plate">车牌号</Label>
        <Input type="text" id="license-plate" placeholder="车牌号..." value={filters.licensePlate} onChange={e => handleInputChange('licensePlate', e.target.value)} disabled={loading} />
      </div>

      <div className="grid items-center gap-1.5 flex-1 min-w-[280px]">
        <Label>日期范围</Label>
        <DateRangePicker
          date={dateRangeValue}
          setDate={handleDateChange} // [已修复] 使用了正确的 prop 名称 "setDate"
          disabled={loading}
        />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onClear} disabled={loading}>
          清除筛选
        </Button>
        <Button onClick={onSearch} disabled={loading}>
          <Search className="mr-2 h-4 w-4" />
          搜索
        </Button>
      </div>
    </div>
  );
}
