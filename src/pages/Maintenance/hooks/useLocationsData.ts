import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { Location, Project } from "@/types";

export function useLocationsData() {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [loadedLocations, loadedProjects] = await Promise.all([
        SupabaseStorage.getLocations(),
        SupabaseStorage.getProjects()
      ]);
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
  }, [toast]);

  const deleteLocation = async (locationId: string) => {
    try {
      await SupabaseStorage.deleteLocation(locationId);
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

  return {
    locations,
    projects,
    isLoading,
    loadData,
    deleteLocation,
  };
}

