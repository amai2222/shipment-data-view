import { useState, useMemo } from "react";
import { LocationWithGeocoding } from '@/services/LocationGeocodingService';

export function useEnhancedLocationFilters(locations: LocationWithGeocoding[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [geocodingStatusFilter, setGeocodingStatusFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const filteredLocations = useMemo(() => {
    let filtered = locations;

    // 搜索筛选
    if (searchQuery) {
      filtered = filtered.filter(location =>
        location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (location.address && location.address.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // 项目筛选
    if (projectFilter !== "all") {
      filtered = filtered.filter(location =>
        location.projectIds && location.projectIds.includes(projectFilter)
      );
    }

    // 地理编码状态筛选
    if (geocodingStatusFilter !== "all") {
      filtered = filtered.filter(location =>
        location.geocoding_status === geocodingStatusFilter
      );
    }

    return filtered;
  }, [locations, searchQuery, projectFilter, geocodingStatusFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setProjectFilter("all");
    setGeocodingStatusFilter("all");
  };

  const activeFiltersCount = 
    (searchQuery ? 1 : 0) + 
    (projectFilter !== "all" ? 1 : 0) + 
    (geocodingStatusFilter !== "all" ? 1 : 0);

  return {
    searchQuery,
    setSearchQuery,
    projectFilter,
    setProjectFilter,
    geocodingStatusFilter,
    setGeocodingStatusFilter,
    showFilters,
    setShowFilters,
    filteredLocations,
    clearFilters,
    activeFiltersCount,
  };
}

