// 正确路径: src/pages/BusinessEntry/components/FilterBar.tsx

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { LogisticsFilters } from '../hooks/useLogisticsData';
import { Project } from '../types';
import { DateRange } from "react-day-picker";

interface FilterBarProps {
  filters: LogisticsFilters; // [核心重构] - 接收父组件的筛选器状态
  onFiltersChange: (filters: LogisticsFilters) => void; // [核心重构] - 接收父组件的状态更新函数
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

  const handleInputChange = (field: keyof Omit<LogisticsFilters, 'dateRange'>, value: string) => {
    onFiltersChange({ ...filters, [field]: value });
  };

  const handleDateChange = (dateRange: DateRange | undefined) => {
    onFiltersChange({ ...filters, dateRange });
  };

  return (
    <div className="flex items-end gap-2 p-4 border rounded-lg">
      <div className="grid items-center gap-1.5 flex-1 min-w-[150px]">
        <Label htmlFor="project-name">项目名称</Label>
        <Select
          value={filters.projectName || 'all'}
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
        <Input type="text" id="driver-name" placeholder="司机姓名..." value={filters.driverName} onChange={e => handleInputChange('driverName', e.target.value)} disabled={loading} />
      </div>

      <div className="grid items-center gap-1.5 flex-1 min-w-[150px]">
        <Label htmlFor="license-plate">车牌号</Label>
        <Input type="text" id="license-plate" placeholder="车牌号..." value={filters.licensePlate} onChange={e => handleInputChange('licensePlate', e.target.value)} disabled={loading} />
      </div>

      <div className="grid items-center gap-1.5 flex-1 min-w-[150px]">
        <Label htmlFor="driver-phone">司机电话</Label>
        <Input type="text" id="driver-phone" placeholder="司机电话..." value={filters.driverPhone} onChange={e => handleInputChange('driverPhone', e.target.value)} disabled={loading} />
      </div>

      <div className="grid items-center gap-1.5 flex-1 min-w-[280px]">
        <Label>日期范围</Label>
        <DateRangePicker
          date={filters.dateRange}
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
