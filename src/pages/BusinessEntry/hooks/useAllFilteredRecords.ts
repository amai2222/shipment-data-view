// 获取所有符合筛选条件的记录ID的hook
import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogisticsFilters } from './useLogisticsData';

interface AllFilteredRecordsResult {
  recordIds: string[];
  totalCount: number;
  summary: {
    projectNames: string[];
    driverNames: string[];
    dateRange: {
      earliest: string;
      latest: string;
    };
  };
}

export function useAllFilteredRecords() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getAllFilteredRecordIds = useCallback(async (filters: LogisticsFilters): Promise<AllFilteredRecordsResult | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_all_filtered_record_ids' as any, {
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_project_name: filters.projectName || null,
        p_driver_name: filters.driverName || null,
        p_license_plate: filters.licensePlate || null,
        p_driver_phone: filters.driverPhone || null,
        p_other_platform_name: filters.otherPlatformName || null,
        p_waybill_numbers: filters.waybillNumbers || null,
        p_has_scale_record: filters.hasScaleRecord || null,
      });

      if (error) throw error;

      return data as AllFilteredRecordsResult;
    } catch (error) {
      console.error('获取所有筛选记录失败:', error);
      toast({
        title: "错误",
        description: "获取所有筛选记录失败",
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    getAllFilteredRecordIds,
    loading
  };
}
