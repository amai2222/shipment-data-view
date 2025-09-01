import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  Filter, 
  X, 
  SortAsc, 
  SortDesc,
  Calendar,
  Building2,
  User,
  Truck
} from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// Date picker will be implemented later
// import { DatePickerWithRange } from '@/components/ui/date-range-picker';

export interface FilterOption {
  key: string;
  label: string;
  type: 'select' | 'date-range' | 'text';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export interface SortOption {
  key: string;
  label: string;
}

interface MobileSearchBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: FilterOption[];
  activeFilters?: Record<string, any>;
  onFiltersChange?: (filters: Record<string, any>) => void;
  sortOptions?: SortOption[];
  activeSortBy?: string;
  activeSortOrder?: 'asc' | 'desc';
  onSortChange?: (sortBy: string, order: 'asc' | 'desc') => void;
  placeholder?: string;
}

export function MobileSearchBar({
  searchValue,
  onSearchChange,
  filters = [],
  activeFilters = {},
  onFiltersChange,
  sortOptions = [],
  activeSortBy = '',
  activeSortOrder = 'desc',
  onSortChange,
  placeholder = '搜索...'
}: MobileSearchBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [tempFilters, setTempFilters] = useState(activeFilters);

  const activeFilterCount = Object.keys(activeFilters).filter(key => {
    const value = activeFilters[key];
    if (!value) return false;
    if (typeof value === 'object' && value.from && value.to) return true;
    if (typeof value === 'string' && value.trim()) return true;
    return false;
  }).length;

  const handleApplyFilters = () => {
    onFiltersChange?.(tempFilters);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    const clearedFilters: Record<string, any> = {};
    filters.forEach(filter => {
      clearedFilters[filter.key] = filter.type === 'date-range' ? { from: undefined, to: undefined } : '';
    });
    setTempFilters(clearedFilters);
    onFiltersChange?.(clearedFilters);
  };

  const handleFilterChange = (key: string, value: any) => {
    setTempFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4"
          />
        </div>

        {/* 筛选和排序 */}
        <div className="flex items-center justify-between">
          {/* 筛选按钮 */}
          {filters.length > 0 && (
            <Drawer open={showFilters} onOpenChange={setShowFilters}>
              <DrawerTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  <Filter className="h-4 w-4 mr-2" />
                  筛选
                  {activeFilterCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>筛选条件</DrawerTitle>
                </DrawerHeader>
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  {filters.map((filter) => (
                    <div key={filter.key}>
                      <label className="text-sm font-medium mb-2 block">
                        {filter.label}
                      </label>
                      
                      {filter.type === 'select' && (
                        <Select 
                          value={tempFilters[filter.key] || ''} 
                          onValueChange={(value) => handleFilterChange(filter.key, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={filter.placeholder || `选择${filter.label}`} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">全部</SelectItem>
                            {filter.options?.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {filter.type === 'text' && (
                        <Input
                          placeholder={filter.placeholder || `输入${filter.label}`}
                          value={tempFilters[filter.key] || ''}
                          onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                        />
                      )}

                      {filter.type === 'date-range' && (
                        <Input
                          placeholder="日期范围功能开发中..."
                          disabled
                        />
                      )}
                    </div>
                  ))}

                  <div className="flex gap-2 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={handleClearFilters}
                    >
                      清除
                    </Button>
                    <Button 
                      className="flex-1"
                      onClick={handleApplyFilters}
                    >
                      确定
                    </Button>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          )}

          {/* 排序控件 */}
          {sortOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <Select 
                value={activeSortBy} 
                onValueChange={(value) => onSortChange?.(value, activeSortOrder)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map(option => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onSortChange?.(activeSortBy, activeSortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {activeSortOrder === 'asc' ? 
                  <SortAsc className="h-4 w-4" /> : 
                  <SortDesc className="h-4 w-4" />
                }
              </Button>
            </div>
          )}
        </div>

        {/* 活跃筛选条件显示 */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(activeFilters).map(([key, value]) => {
              if (!value) return null;
              
              const filter = filters.find(f => f.key === key);
              if (!filter) return null;

              let displayValue = '';
              if (filter.type === 'date-range' && value.from && value.to) {
                displayValue = `${value.from.toLocaleDateString()} - ${value.to.toLocaleDateString()}`;
              } else if (typeof value === 'string' && value.trim()) {
                const option = filter.options?.find(opt => opt.value === value);
                displayValue = option?.label || value;
              } else {
                return null;
              }

              return (
                <Badge key={key} variant="secondary" className="text-xs">
                  {filter.label}: {displayValue}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                    onClick={() => {
                      const newFilters = { ...activeFilters };
                      newFilters[key] = filter.type === 'date-range' ? 
                        { from: undefined, to: undefined } : '';
                      onFiltersChange?.(newFilters);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}