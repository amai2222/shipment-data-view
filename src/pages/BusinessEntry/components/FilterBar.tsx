// 正确路径: src/pages/BusinessEntry/components/FilterBar.tsx

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogisticsFilters } from '../hooks/useLogisticsData';
import { Project } from '../types';

interface FilterBarProps {
  onSearch: (filters: LogisticsFilters) => void;
  onClear: () => void;
  initialFilters: LogisticsFilters;
  loading: boolean;
  projects: Project[];
}

export function FilterBar({ onSearch, onClear, initialFilters, loading, projects }: FilterBarProps) {
  const [localFilters, setLocalFilters] = useState<LogisticsFilters>(initialFilters);

  useEffect(() => {
    setLocalFilters(initialFilters);
  }, [initialFilters]);

  const handleInputChange = (field: keyof LogisticsFilters, value: string) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    onSearch(localFilters);
  };

  const handleClear = () => {
    onClear();
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="grid items-center gap-1.5">
          <Label htmlFor="start-date">开始日期</Label>
          <Input type="date" id="start-date" value={localFilters.startDate} onChange={e => handleInputChange('startDate', e.target.value)} disabled={loading} />
        </div>
        <div className="grid items-center gap-1.5">
          <Label htmlFor="end-date">结束日期</Label>
          <Input type="date" id="end-date" value={localFilters.endDate} onChange={e => handleInputChange('endDate', e.target.value)} disabled={loading} />
        </div>
        
        <div className="grid items-center gap-1.5">
          <Label htmlFor="project-name">项目名称</Label>
          <Select
            value={localFilters.projectName || 'all'}
            onValueChange={(value) => handleInputChange('projectName', value === 'all' ? '' : value)}
            disabled={loading || projects.length === 0}
          >
            <SelectTrigger id="project-name">
              <SelectValue placeholder="选择项目..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有项目</SelectItem>
              {(projects || []).map(project => (
                <SelectItem key={project.id} value={project.name}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid items-center gap-1.5">
          <Label htmlFor="driver-name">司机</Label>
          <Input type="text" id="driver-name" placeholder="输入司机姓名..." value={localFilters.driverName} onChange={e => handleInputChange('driverName', e.target.value)} disabled={loading} />
        </div>
        <div className="grid items-center gap-1.5">
          <Label htmlFor="license-plate">车牌号</Label>
          <Input type="text" id="license-plate" placeholder="输入车牌号..." value={localFilters.licensePlate} onChange={e => handleInputChange('licensePlate', e.target.value)} disabled={loading} />
        </div>
        <div className="grid items-center gap-1.5">
          <Label htmlFor="driver-phone">司机电话</Label>
          <Input type="text" id="driver-phone" placeholder="输入司机电话..." value={localFilters.driverPhone} onChange={e => handleInputChange('driverPhone', e.target.value)} disabled={loading} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleClear} disabled={loading}>
          清除筛选
        </Button>
        <Button onClick={handleSearch} disabled={loading}>
          搜索
        </Button>
      </div>
    </div>
  );
}
