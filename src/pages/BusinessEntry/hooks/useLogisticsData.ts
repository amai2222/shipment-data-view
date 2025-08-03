// 正确路径: src/pages/BusinessEntry/hooks/useLogisticsData.ts

import { useState, useCallback, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogisticsRecord } from '../types';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

export interface LogisticsFilters {
  dateRange: DateRange | undefined;
  projectName: string;
  driverName: string;
  licensePlate: string;
  driverPhone: string;
}

export const INITIAL_FILTERS: LogisticsFilters = {
  dateRange: undefined,
  projectName: "",
  driverName: "",
  licensePlate: "",
  driverPhone: "",
};

const PAGE_SIZE = 25;

export interface TotalSummary {
  totalLoadingWeight: number;
  totalUnloadingWeight: number;
  totalCurrentCost: number;
  totalExtraCost: number;
  totalDriverPayableCost: number;
  actualCount: number;
  returnCount: number;
}

const INITIAL_SUMMARY: TotalSummary = {
  totalLoadingWeight: 0,
  totalUnloadingWeight: 0,
  totalCurrentCost: 0,
  totalExtraCost: 0,
  totalDriverPayableCost: 0,
  actualCount: 0,
  returnCount: 0,
};

export function useLogisticsData() {
  const { toast } = useToast();
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<LogisticsFilters>(INITIAL_FILTERS);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });
  const [totalSummary, setTotalSummary] = useState<TotalSummary>(INITIAL_SUMMARY);

  const loadPaginatedRecords = useCallback(async (page: number, filters: LogisticsFilters) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_logistics_summary_and_records', {
        p_start_date: filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : null,
        p_end_date: filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : null,
        p_project_name: filters.projectName || null,
        p_driver_name: filters.driverName || null,
        p_license_plate: filters.licensePlate || null,
        p_driver_phone: filters.driverPhone || null,
        p_page_number: page,
        p_page_size: PAGE_SIZE,
      });

      if (error) throw error;

      setRecords(data.records || []);
      setTotalSummary(data.summary || INITIAL_SUMMARY);
      setPagination(prev => ({ ...prev, totalPages: Math.ceil((data.count || 0) / PAGE_SIZE) || 1 }));

    } catch (error: any) {
      toast({ title: "错误", description: `加载运单记录失败: ${error.message}`, variant: "destructive" });
      setRecords([]);
      setTotalSummary(INITIAL_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPaginatedRecords(pagination.currentPage, activeFilters);
  }, [pagination.currentPage, activeFilters, loadPaginatedRecords]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await supabase.from('logistics_records').delete().eq('id', id);
      toast({ title: "成功", description: "运单记录已删除" });
      await loadPaginatedRecords(pagination.currentPage, activeFilters);
    } catch (error: any) {
      toast({ title: "删除失败", description: error.message, variant: "destructive" });
    }
  }, [toast, loadPaginatedRecords, pagination.currentPage, activeFilters]);

  return {
    records,
    loading,
    activeFilters,
    setActiveFilters,
    pagination,
    setPagination,
    totalSummary,
    handleDelete,
    refetch: () => loadPaginatedRecords(pagination.currentPage, activeFilters),
  };
}
