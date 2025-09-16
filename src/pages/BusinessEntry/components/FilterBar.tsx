// 最终文件路径: src/pages/BusinessEntry/components/FilterBar.tsx

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { LogisticsFilters } from '../hooks/useLogisticsData';
import { Project } from '../types';
import { DateRange } from "react-day-picker";
import { Search, X } from "lucide-react";
import { useState } from "react";

interface FilterBarProps {
  filters: LogisticsFilters;
  onFiltersChange: (newFilters: LogisticsFilters) => void;
  onSearch: () => void;
  onClear: () => void;
  loading: boolean;
  projects: Project[];
}

export function FilterBar({ filters, onFiltersChange, onSearch, onClear, loading, projects }: FilterBarProps) {
  const [waybillInput, setWaybillInput] = useState(filters.waybillNumbers);

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

  const handleWaybillNumbersChange = (value: string) => {
    setWaybillInput(value);
    onFiltersChange({ ...filters, waybillNumbers: value });
  };

  const handleWaybillKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch();
    }
  };

  const dateRangeValue: DateRange | undefined = (filters.startDate || filters.endDate)
    ? {
        from: filters.startDate ? new Date(filters.startDate) : undefined,
        to: filters.endDate ? new Date(filters.endDate) : undefined,
      }
    : undefined;

  return (
    <div className="space-y-3">
      {/* 主要筛选器 - 紧凑布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
        {/* 项目名称 */}
        <div className="space-y-1">
          <Label htmlFor="project-name" className="text-sm font-medium text-blue-800">项目名称</Label>
          <Select
            value={filters.projectName || 'all'}
            onValueChange={(value) => handleInputChange('projectName', value === 'all' ? '' : value)}
            disabled={loading || projects.length === 0}
          >
            <SelectTrigger id="project-name" className="h-9">
              <SelectValue placeholder="所有项目" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有项目</SelectItem>
              {(projects || []).map(project => (<SelectItem key={project.id} value={project.name}>{project.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        {/* 司机 */}
        <div className="space-y-1">
          <Label htmlFor="driver-name" className="text-sm font-medium text-blue-800">司机</Label>
          <Input 
            type="text" 
            id="driver-name" 
            placeholder="司机姓名..." 
            value={filters.driverName} 
            onChange={e => handleInputChange('driverName', e.target.value)} 
            disabled={loading}
            className="h-9"
          />
        </div>

        {/* 车牌号 */}
        <div className="space-y-1">
          <Label htmlFor="license-plate" className="text-sm font-medium text-blue-800">车牌号</Label>
          <Input 
            type="text" 
            id="license-plate" 
            placeholder="车牌号..." 
            value={filters.licensePlate} 
            onChange={e => handleInputChange('licensePlate', e.target.value)} 
            disabled={loading}
            className="h-9"
          />
        </div>

        {/* 司机电话 */}
        <div className="space-y-1">
          <Label htmlFor="driver-phone" className="text-sm font-medium text-blue-800">司机电话</Label>
          <Input 
            type="text" 
            id="driver-phone" 
            placeholder="司机电话..." 
            value={filters.driverPhone} 
            onChange={e => handleInputChange('driverPhone', e.target.value)} 
            disabled={loading}
            className="h-9"
          />
        </div>

        {/* 日期范围 */}
        <div className="space-y-1">
          <Label className="text-sm font-medium text-blue-800">日期范围</Label>
          <DateRangePicker date={dateRangeValue} setDate={handleDateChange} disabled={loading} />
        </div>

        {/* 操作按钮 */}
        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={onClear} disabled={loading} className="h-9">
            清除
          </Button>
          <Button onClick={onSearch} disabled={loading} className="h-9 bg-blue-600 hover:bg-blue-700">
            <Search className="mr-1 h-4 w-4" />搜索
          </Button>
        </div>
      </div>

      {/* 高级筛选器 - 折叠式布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
        {/* 其他平台名称 */}
        <div className="space-y-1">
          <Label htmlFor="other-platform" className="text-sm font-medium text-purple-800">其他平台名称</Label>
          <Select
            value={filters.otherPlatformName || 'all'}
            onValueChange={(value) => handleInputChange('otherPlatformName', value === 'all' ? '' : value)}
            disabled={loading}
          >
            <SelectTrigger id="other-platform" className="h-9">
              <SelectValue placeholder="选择平台" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有平台</SelectItem>
              <SelectItem value="本平台">本平台</SelectItem>
              <SelectItem value="中科智运">中科智运</SelectItem>
              <SelectItem value="中工智云">中工智云</SelectItem>
              <SelectItem value="可乐公司">可乐公司</SelectItem>
              <SelectItem value="盼盼集团">盼盼集团</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 运单编号 */}
        <div className="space-y-1">
          <Label htmlFor="waybill-numbers" className="text-sm font-medium text-purple-800">运单编号</Label>
          <div className="relative">
            <Input 
              type="text" 
              id="waybill-numbers" 
              placeholder="输入运单编号，多个用逗号分隔..." 
              value={waybillInput} 
              onChange={e => handleWaybillNumbersChange(e.target.value)}
              onKeyDown={handleWaybillKeyDown}
              disabled={loading}
              className="h-9 pr-8"
            />
            {waybillInput && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-6 w-6 p-0 hover:bg-purple-100"
                onClick={() => handleWaybillNumbersChange('')}
              >
                <X className="h-3 w-3 text-purple-600" />
              </Button>
            )}
          </div>
          <div className="text-xs text-purple-600 mt-1">
            💡 支持多个运单编号查询，用逗号分隔，按回车快速搜索
          </div>
        </div>

        {/* 磅单筛选 */}
        <div className="space-y-1">
          <Label htmlFor="has-scale-record" className="text-sm font-medium text-purple-800">磅单状态</Label>
          <Select
            value={filters.hasScaleRecord || 'all'}
            onValueChange={(value) => handleInputChange('hasScaleRecord', value === 'all' ? '' : value)}
            disabled={loading}
          >
            <SelectTrigger id="has-scale-record" className="h-9">
              <SelectValue placeholder="选择磅单状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有运单</SelectItem>
              <SelectItem value="yes">有磅单</SelectItem>
              <SelectItem value="no">无磅单</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-purple-600 mt-1">
            📋 筛选是否有对应磅单记录的运单
          </div>
        </div>
      </div>
    </div>
  );
}
