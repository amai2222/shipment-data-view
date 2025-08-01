import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BusinessEntryFiltersProps {
  filters: {
    startDate: string;
    endDate: string;
    searchQuery: string;
  };
  onFiltersChange: (filters: { startDate: string; endDate: string; searchQuery: string }) => void;
}

export function BusinessEntryFilters({ filters, onFiltersChange }: BusinessEntryFiltersProps) {
  const handleFilterChange = (field: string, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value
    });
  };

  return (
    <div className="bg-card p-4 rounded-lg border space-y-4">
      <h3 className="text-lg font-semibold">筛选条件</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start-date">开始日期</Label>
          <Input
            id="start-date"
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date">结束日期</Label>
          <Input
            id="end-date"
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="search">搜索</Label>
          <Input
            id="search"
            placeholder="搜索运单号、项目、司机等..."
            value={filters.searchQuery}
            onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}