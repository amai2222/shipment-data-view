// 最终文件路径: src/pages/BusinessEntry/hooks/useLogisticsData.ts

import { useState, useCallback, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogisticsRecord } from '../types';

// [核心修复] 1. 统一整个应用的数据筛选接口
export interface LogisticsFilters {
  startDate: string;
  endDate: string;
  projectId: string;
  driverName: string;
  licensePlate: string;
}

// [核心修复] 2. 更新初始筛选器以匹配新接口
export const INITIAL_FILTERS: LogisticsFilters = {
  startDate: "",
  endDate: "",
  projectId: "",
  driverName: "",
  licensePlate: "",
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
      // [核心修复] 3. 在调用数据库函数时，直接使用 filters 中的 startDate 和 endDate
      const { data, error } = await supabase.rpc('get_logistics_summary_and_records', {
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_project_id: filters.projectId || null,
        p_driver_name: filters.driverName || null,
        p_license_plate: filters.licensePlate || null,
        p_page_number: page,
        p_page_size: PAGE_SIZE,
      });

      if (error) throw error;
      
      const responseData = data[0] || {};
      
      setRecords(responseData.records || []);
      setTotalSummary(responseData.summary || INITIAL_SUMMARY);
      setPagination(prev => ({ ...prev, totalPages: Math.ceil((responseData.total_count || 0) / PAGE_SIZE) || 1 }));

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
      const { error } = await supabase.from('logistics_records').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "成功", description: "运单记录已删除" });
      await loadPaginatedRecords(pagination.currentPage, activeFilters);
    } catch (error: any) {
      toast({ title: "删除失败", description: error.message, variant: "destructive" });
    }
  }, [toast, loadPaginatedRecords, pagination.currentPage, activeFilters]);

  const refetch = useCallback(() => {
    if (pagination.currentPage !== 1) {
      setPagination(p => ({ ...p, currentPage: 1 }));
    } else {
      loadPaginatedRecords(1, activeFilters);
    }
  }, [loadPaginatedRecords, activeFilters, pagination.currentPage]);

  return {
    records,
    loading,
    activeFilters,
    setActiveFilters,
    pagination,
    setPagination,
    totalSummary,
    handleDelete,
    refetch,
  };
}
