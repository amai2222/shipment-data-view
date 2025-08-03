// 正确路径: src/pages/BusinessEntry/components/FilterBar.tsx

import { useState, useEffect } from "react"; // [核心修复] - 重新引入 useEffect
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { LogisticsFilters } from '../hooks/useLogisticsData';
import { Project } from '../types';
import { DateRange } from "react-day-picker";

interface FilterBarProps {
  filters: LogisticsFilters;
  onFiltersChange: (filters: LogisticsFilters) => void;
  onSearch: () => void;
  onClear: () => void;
  loading: boolean;
  projects: Project[];
}

export function FilterBar({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
  loading,
  projects
}: FilterBarProps) {

  // [核心修复] - 我们需要一个本地状态来与父组件同步，以避免不必要的渲染循环
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleInputChange = (field: keyof Omit<LogisticsFilters, 'dateRange'>, value: string) => {
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleDateChange = (dateRange: DateRange | undefined) => {
    const newFilters = { ...localFilters, dateRange };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  return (
    <div className="flex items-end gap-2 p-4 border rounded-lg">
      <div className="grid items-center gap-1.5 flex-1 min-w-[150px]">
        <Label htmlFor="project-name">项目名称</Label>
        <Select
          value={localFilters.projectName || 'all'}
          onValueChange={(value) => handleInputChange('projectName', value === 'all' ? '' : value)}
          disabled={loading || projects.length === 0}
        >
          <SelectTrigger id="project-name"><SelectValue placeholder="选择项目..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有项目</SelectItem>
            {(projects || []).map(project => (<SelectItem key={project.id} value={project.name}>{project.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid items-center gap-1.5 flex-1 min-w-[150px]">
        <Label htmlFor="driver-name">司机</Label>
        <Input type="text" id="driver-name" placeholder="司机姓名..." value={localFilters.driverName} onChange={e => handleInputChange('driverName', e.target.value)} disabled={loading} />
      </div>

      <div className="grid items-center gap-1.5 flex-1 min-w-[150px]">
        <Label htmlFor="license-plate">车牌号</Label>
        <Input type="text" id="license-plate" placeholder="车牌号..." value={localFilters.licensePlate} onChange={e => handleInputChange('licensePlate', e.target.value)} disabled={loading} />
      </div>

      <div className="grid items-center gap-1.5 flex-1 min-w-[150px]">
        <Label htmlFor="driver-phone">司机电话</Label>
        <Input type="text" id="driver-phone" placeholder="司机电话..." value={localFilters.driverPhone} onChange={e => handleInputChange('driverPhone', e.target.value)} disabled={loading} />
      </div>

      <div className="grid items-center gap-1.5 flex-1 min-w-[280px]">
        <Label>日期范围</Label>
        <DateRangePicker
          date={localFilters.dateRange}
          setDate={handleDateChange}
          disabled={loading}
        />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onClear} disabled={loading}>
          清除筛选
        </Button>
        <Button onClick={onSearch} disabled={loading}>
          搜索
        </Button>
      </div>
    </div>
  );
}
