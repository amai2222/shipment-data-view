import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X } from "lucide-react";
import { Project } from "@/types";

interface EnhancedLocationFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  projectFilter: string;
  setProjectFilter: (project: string) => void;
  geocodingStatusFilter: string;
  setGeocodingStatusFilter: (status: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  clearFilters: () => void;
  activeFiltersCount: number;
  projects: Project[];
  totalCount: number;
  filteredCount: number;
}

export function EnhancedLocationFilters({
  searchQuery,
  setSearchQuery,
  projectFilter,
  setProjectFilter,
  geocodingStatusFilter,
  setGeocodingStatusFilter,
  showFilters,
  setShowFilters,
  clearFilters,
  activeFiltersCount,
  projects,
  totalCount,
  filteredCount,
}: EnhancedLocationFiltersProps) {
  return (
    <div className="space-y-3">
      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索地点名称或地址..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* 筛选器工具栏 */}
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

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
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
                <Label>关联项目</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部项目</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>地理编码状态</Label>
                <Select value={geocodingStatusFilter} onValueChange={setGeocodingStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="success">成功</SelectItem>
                    <SelectItem value="pending">待处理</SelectItem>
                    <SelectItem value="failed">失败</SelectItem>
                    <SelectItem value="retry">需重试</SelectItem>
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

