import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, ArrowUpDown } from "lucide-react";

interface ProjectFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  sortBy: "status" | "date";
  setSortBy: (sort: "status" | "date") => void;
  clearFilters: () => void;
  activeFiltersCount: number;
  totalCount: number;
  filteredCount: number;
}

export function ProjectFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  showFilters,
  setShowFilters,
  sortBy,
  setSortBy,
  clearFilters,
  activeFiltersCount,
  totalCount,
  filteredCount,
}: ProjectFiltersProps) {
  return (
    <div className="space-y-3">
      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索项目名称、负责人、地址..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {/* 筛选器和排序 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="relative"
        >
          <Filter className="h-4 w-4 mr-2" />
          筛选
          {activeFiltersCount > 0 && (
            <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] px-1">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
        
        <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
          <SelectTrigger className="w-48">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">按状态排序（默认）</SelectItem>
            <SelectItem value="date">按创建时间排序</SelectItem>
          </SelectContent>
        </Select>
        
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
          >
            <X className="h-4 w-4 mr-2" />
            清除筛选
          </Button>
        )}
        
        <span className="text-sm text-muted-foreground">
          显示 {filteredCount} / {totalCount} 条
        </span>
      </div>
      
      {/* 高级筛选面板 */}
      {showFilters && (
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>项目状态</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="进行中">进行中</SelectItem>
                    <SelectItem value="已暂停">已暂停</SelectItem>
                    <SelectItem value="已完成">已完成</SelectItem>
                    <SelectItem value="已取消">已取消</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

