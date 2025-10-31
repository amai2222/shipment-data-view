import { useState, useMemo } from "react";
import { Location } from "@/types";

export function useLocationFilters(locations: Location[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const filteredLocations = useMemo(() => {
    let filtered = locations;

    // 搜索筛选
    if (searchQuery) {
      filtered = filtered.filter(location =>
        location.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 项目筛选
    if (projectFilter !== "all") {
      filtered = filtered.filter(location =>
        location.projectIds && location.projectIds.includes(projectFilter)
      );
    }

    return filtered;
  }, [locations, searchQuery, projectFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setProjectFilter("all");
  };

  const activeFiltersCount = (searchQuery ? 1 : 0) + (projectFilter !== "all" ? 1 : 0);

  return {
    searchQuery,
    setSearchQuery,
    projectFilter,
    setProjectFilter,
    showFilters,
    setShowFilters,
    filteredLocations,
    clearFilters,
    activeFiltersCount,
  };
}

