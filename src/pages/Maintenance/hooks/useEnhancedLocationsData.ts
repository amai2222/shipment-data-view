import { useState, useCallback, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { Project } from "@/types";
import { createLocationGeocodingService, LocationWithGeocoding } from '@/services/LocationGeocodingService';

export function useEnhancedLocationsData() {
  const { toast } = useToast();
  const [locations, setLocations] = useState<LocationWithGeocoding[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const geocodingService = createLocationGeocodingService(toast);

  const geocodingStats = useMemo(() => {
    const total = locations.length;
    const success = locations.filter(l => l.geocoding_status === 'success').length;
    const pending = locations.filter(l => l.geocoding_status === 'pending').length;
    const failed = locations.filter(l => l.geocoding_status === 'failed').length;
    const retry = locations.filter(l => l.geocoding_status === 'retry').length;
    
    return { total, success, pending, failed, retry };
  }, [locations]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const loadedLocations = await geocodingService.getAllLocations();
      const loadedProjects = await SupabaseStorage.getProjects();
      setLocations(loadedLocations);
      setProjects(loadedProjects);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "加载失败",
        description: "无法加载数据",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [geocodingService, toast]);

  const deleteLocation = async (locationId: string) => {
    try {
      await geocodingService.deleteLocation(locationId);
      toast({
        title: "删除成功",
        description: "地点已成功删除。",
      });
      loadData();
    } catch (error: any) {
      console.error('Error deleting location:', error);
      toast({
        title: "删除失败",
        description: error.message || "无法删除地点，请重试。",
        variant: "destructive",
      });
    }
  };

  const batchGeocode = async (locationIds: string[]) => {
    const locationsToGeocode = locations.filter(l => locationIds.includes(l.id));
    return await geocodingService.batchGeocode(locationsToGeocode);
  };

  return {
    locations,
    setLocations,
    projects,
    isLoading,
    selectedLocations,
    setSelectedLocations,
    selectAll,
    setSelectAll,
    geocodingStats,
    loadData,
    deleteLocation,
    batchGeocode,
    geocodingService,
  };
}

