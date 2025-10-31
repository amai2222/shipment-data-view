import { useState, useMemo } from "react";
import { Driver } from "@/types";

export function useDriverFilters(drivers: Driver[]) {
  const [quickFilter, setQuickFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const filteredDrivers = useMemo(() => {
    let filtered = drivers;

    // 项目筛选
    if (projectFilter !== "all") {
      filtered = filtered.filter(driver =>
        driver.projectIds && driver.projectIds.includes(projectFilter)
      );
    }

    // 快速搜索筛选
    if (quickFilter) {
      const query = quickFilter.toLowerCase();
      filtered = filtered.filter(driver =>
        driver.name.toLowerCase().includes(query) ||
        driver.licensePlate.toLowerCase().includes(query) ||
        (driver.phone && driver.phone.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [drivers, projectFilter, quickFilter]);

  const clearFilters = () => {
    setQuickFilter("");
    setProjectFilter("all");
  };

  const activeFiltersCount = (quickFilter ? 1 : 0) + (projectFilter !== "all" ? 1 : 0);

  return {
    quickFilter,
    setQuickFilter,
    projectFilter,
    setProjectFilter,
    showFilters,
    setShowFilters,
    filteredDrivers,
    clearFilters,
    activeFiltersCount,
  };
}

