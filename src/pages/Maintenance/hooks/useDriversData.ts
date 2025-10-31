import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { supabase } from "@/integrations/supabase/client";
import { Driver, Project } from "@/types";

export function useDriversData() {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(30);

  const loadData = useCallback(async (page: number, filter: string, currentPageSize: number = pageSize) => {
    setIsLoading(true);
    try {
      if (projects.length === 0) {
        try {
          const loadedProjects = await SupabaseStorage.getProjects();
          setProjects(loadedProjects);
        } catch (projectError) {
          console.warn('项目数据加载失败，继续加载司机数据:', projectError);
          setProjects([]);
        }
      }
      
      try {
        const { drivers: loadedDrivers, totalCount: loadedTotalCount } = await SupabaseStorage.getDrivers(filter, page, currentPageSize);
        
        setDrivers(loadedDrivers || []);
        setTotalCount(loadedTotalCount);
        setTotalPages(Math.ceil(loadedTotalCount / currentPageSize));
        setCurrentPage(page);
      } catch (rpcError) {
        console.warn('RPC函数调用失败，尝试直接查询:', rpcError);
        
        const { data: directData, error: directError } = await supabase
          .from('drivers')
          .select('id, name, license_plate, phone, created_at')
          .limit(currentPageSize)
          .range((page - 1) * currentPageSize, page * currentPageSize - 1);
        
        if (directError) throw directError;
        
        const convertedDrivers = (directData || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          licensePlate: d.license_plate,
          phone: d.phone,
          projectIds: [],
          id_card_photos: d.id_card_photos || [],
          driver_license_photos: d.driver_license_photos || [],
          qualification_certificate_photos: d.qualification_certificate_photos || [],
          driving_license_photos: d.driving_license_photos || [],
          transport_license_photos: d.transport_license_photos || [],
          createdAt: d.created_at
        }));
        
        setDrivers(convertedDrivers);
        setTotalCount(convertedDrivers.length);
        setTotalPages(1);
        setCurrentPage(1);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      
      let errorMessage = "无法加载司机数据";
      if (error?.message) {
        if (error.message.includes('permission')) {
          errorMessage = "权限不足，无法访问司机数据";
        } else if (error.message.includes('function')) {
          errorMessage = "数据库函数不存在，请联系管理员";
        }
      }
      
      toast({
        title: "数据加载失败",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [pageSize, projects.length, toast]);

  const deleteDriver = async (driverId: string) => {
    try {
      await SupabaseStorage.deleteDriver(driverId);
      toast({
        title: "删除成功",
        description: "司机已成功删除。",
      });
      loadData(currentPage, "", pageSize);
    } catch (error: any) {
      console.error('Error deleting driver:', error);
      toast({
        title: "删除失败",
        description: error.message || "无法删除司机，请重试。",
        variant: "destructive",
      });
    }
  };

  return {
    drivers,
    setDrivers,
    projects,
    isLoading,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    setPageSize,
    loadData,
    deleteDriver,
  };
}

