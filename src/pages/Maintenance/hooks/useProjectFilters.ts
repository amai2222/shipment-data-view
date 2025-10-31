import { useState, useMemo } from "react";
import { ProjectWithDetails } from "./useProjectsData";

export function useProjectFilters(projects: ProjectWithDetails[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"status" | "date">("status");

  // 筛选和排序逻辑
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = [...projects];

    // 1. 搜索筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project => 
        project.name.toLowerCase().includes(query) ||
        project.manager.toLowerCase().includes(query) ||
        (project.financeManager && project.financeManager.toLowerCase().includes(query)) ||
        project.loadingAddress.toLowerCase().includes(query) ||
        project.unloadingAddress.toLowerCase().includes(query)
      );
    }

    // 2. 状态筛选
    if (statusFilter !== "all") {
      filtered = filtered.filter(project => 
        (project as any).projectStatus === statusFilter
      );
    }

    // 3. 排序
    filtered.sort((a, b) => {
      if (sortBy === "status") {
        // 按状态排序：进行中 > 已暂停 > 已完成 > 已取消
        const statusOrder: Record<string, number> = {
          '进行中': 1,
          '已暂停': 2,
          '已完成': 3,
          '已取消': 4
        };
        const statusA = (a as any).projectStatus || '进行中';
        const statusB = (b as any).projectStatus || '进行中';
        const orderDiff = (statusOrder[statusA] || 999) - (statusOrder[statusB] || 999);
        
        // 如果状态相同，按创建时间降序（最新的在上面）
        if (orderDiff === 0) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return orderDiff;
      } else {
        // 按日期排序：最新的在上面
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [projects, searchQuery, statusFilter, sortBy]);

  // 清除筛选器
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  // 活动筛选器数量
  const activeFiltersCount = (searchQuery ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  return {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    showFilters,
    setShowFilters,
    sortBy,
    setSortBy,
    filteredAndSortedProjects,
    clearFilters,
    activeFiltersCount,
  };
}

