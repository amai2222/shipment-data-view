// 最终文件路径: src/pages/BusinessEntry/hooks/useLogisticsData.ts
// 描述: [最终修正版] 更新了 TotalSummary 接口以接收后端计算好的所有合计数据。

import { useState, useCallback, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogisticsRecord } from '../types';

export interface LogisticsFilters {
  startDate: string;
  endDate: string;
  projectName: string;
  driverName: string;
  licensePlate: string;
  driverPhone: string;
}

export const INITIAL_FILTERS: LogisticsFilters = {
  startDate: "",
  endDate: "",
  projectName: "",
  driverName: "",
  licensePlate: "",
  driverPhone: "",
};

const PAGE_SIZE = 25;

// [核心修正] 接口定义与后端函数返回的 summary 对象完全匹配
export interface TotalSummary {
  totalCurrentCost: number;
  totalExtraCost: number;
  totalDriverPayableCost: number;
  actualCount: number;
  returnCount: number;
  totalWeightLoading: number;
  totalWeightUnloading: number;
  totalTripsLoading: number;
  totalVolumeLoading: number;
  totalVolumeUnloading: number;
}

// [核心修正] 初始值也包含所有新字段
const INITIAL_SUMMARY: TotalSummary = {
  totalCurrentCost: 0,
  totalExtraCost: 0,
  totalDriverPayableCost: 0,
  actualCount: 0,
  returnCount: 0,
  totalWeightLoading: 0,
  totalWeightUnloading: 0,
  totalTripsLoading: 0,
  totalVolumeLoading: 0,
  totalVolumeUnloading: 0,
};

export function useLogisticsData() {
  const { toast } = useToast();
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<LogisticsFilters>(INITIAL_FILTERS);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0, pageSize: PAGE_SIZE });
  const [totalSummary, setTotalSummary] = useState<TotalSummary>(INITIAL_SUMMARY);
  const [sortField, setSortField] = useState<string>('auto_number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const loadPaginatedRecords = useCallback(async (page: number, filters: LogisticsFilters, currentSortField: string, currentSortDirection: 'asc' | 'desc') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_logistics_summary_and_records' as any, {
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_project_name: filters.projectName || null,
        p_driver_name: filters.driverName || null,
        p_license_plate: filters.licensePlate || null,
        p_driver_phone: filters.driverPhone || null,
        p_page_number: page,
        p_page_size: PAGE_SIZE,
      });

      if (error) throw error;
      
      const responseData = (data as any) || {};
      
      const sortedRecords = (responseData.records || []).sort((a: any, b: any) => {
        const aVal = a[currentSortField] || '';
        const bVal = b[currentSortField] || '';
        if (currentSortDirection === 'asc') {
          return String(aVal).localeCompare(String(bVal));
        } else {
          return String(bVal).localeCompare(String(aVal));
        }
      });
      
      setRecords(sortedRecords);
      setTotalSummary(responseData.summary || INITIAL_SUMMARY);
      setPagination(prev => ({ 
        ...prev, 
        currentPage: page,
        totalPages: Math.ceil((responseData.count || 0) / PAGE_SIZE) || 1,
        totalCount: responseData.count || 0
      }));

    } catch (error: any) {
      toast({ title: "错误", description: `加载运单记录失败: ${error.message}`, variant: "destructive" });
      setRecords([]);
      setTotalSummary(INITIAL_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPaginatedRecords(pagination.currentPage, activeFilters, sortField, sortDirection);
  }, [pagination.currentPage, activeFilters, sortField, sortDirection, loadPaginatedRecords]);

  const handleSort = useCallback((field: string) => {
    setSortDirection(prevDirection => sortField === field ? (prevDirection === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortField(field);
  }, [sortField]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('logistics_records').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "成功", description: "运单记录已删除" });
      await loadPaginatedRecords(pagination.currentPage, activeFilters, sortField, sortDirection);
    } catch (error: any) {
      toast({ title: "删除失败", description: error.message, variant: "destructive" });
    }
  }, [toast, loadPaginatedRecords, pagination.currentPage, activeFilters, sortField, sortDirection]);

  const refetch = useCallback(() => {
    loadPaginatedRecords(pagination.currentPage, activeFilters, sortField, sortDirection);
  }, [loadPaginatedRecords, activeFilters, pagination.currentPage, sortField, sortDirection]);

  return {
    records, loading, activeFilters, setActiveFilters, pagination, setPagination, totalSummary, handleDelete, refetch,
    sortField, sortDirection, handleSort,
  };
}
