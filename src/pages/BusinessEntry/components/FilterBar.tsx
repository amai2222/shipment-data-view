// src/pages/BusinessEntry/components/FilterBar.tsx

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FilterBarProps {
  filters: { startDate: string; endDate: string; searchQuery: string; };
  setFilters: React.Dispatch<React.SetStateAction<{ startDate: string; endDate: string; searchQuery: string; }>>;
  loading: boolean;
}

const getInitialDefaultDates = () => {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  return { startDate: formatDate(firstDayOfMonth), endDate: formatDate(today) };
};

export function FilterBar({ filters, setFilters, loading }: FilterBarProps) {
  return (
    <div className="flex items-end gap-4 p-4 border rounded-lg">
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label htmlFor="search-query">快速搜索</Label>
        <Input type="text" id="search-query" placeholder="搜索运单号、项目、司机..." value={filters.searchQuery} onChange={e => setFilters(f => ({ ...f, searchQuery: e.target.value }))} disabled={loading} />
      </div>
      <div className="grid items-center gap-1.5">
        <Label htmlFor="start-date">开始日期</Label>
        <Input type="date" id="start-date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} disabled={loading} />
      </div>
      <div className="grid items-center gap-1.5">
        <Label htmlFor="end-date">结束日期</Label>
        <Input type="date" id="end-date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} disabled={loading} />
      </div>
      <Button variant="outline" onClick={() => setFilters({ ...getInitialDefaultDates(), searchQuery: "" })} disabled={loading}>
        清除筛选
      </Button>
    </div>
  );
}
