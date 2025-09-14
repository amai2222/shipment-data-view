// 移动端运单管理Hook - 支持排序和分页
// 文件路径: src/pages/mobile/hooks/useMobileLogisticsData.ts

import { useState, useCallback, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogisticsSummaryAndRecordsParams, LogisticsSummaryAndRecordsResponse, LogisticsRecord, LogisticsSummary } from '@/types/rpc';

export interface MobileLogisticsFilters {
  startDate: string;
  endDate: string;
  projectName: string;
  driverName: string;
  licensePlate: string;
  driverPhone: string;
  paymentStatus: string;
}

// 使用统一的接口定义
export type MobileLogisticsRecord = LogisticsRecord;
export type MobileTotalSummary = LogisticsSummary;

const INITIAL_FILTERS: MobileLogisticsFilters = {
  startDate: '',
  endDate: '',
  projectName: '',
  driverName: '',
  licensePlate: '',
  driverPhone: '',
  paymentStatus: '',
};

const INITIAL_SUMMARY: MobileTotalSummary = {
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

export function useMobileLogisticsData() {
  const { toast } = useToast();
  const [records, setRecords] = useState<MobileLogisticsRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<MobileLogisticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<MobileLogisticsFilters>(INITIAL_FILTERS);
  const [totalSummary, setTotalSummary] = useState<MobileTotalSummary>(INITIAL_SUMMARY);
  
  // 排序状态
  const [sortField, setSortField] = useState('auto_number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const loadRecords = useCallback(async (
    page: number = 1,
    filters: MobileLogisticsFilters = INITIAL_FILTERS,
    currentSortField: string = 'auto_number',
    currentSortDirection: 'asc' | 'desc' = 'desc',
    currentPageSize: number = 20,
    loadMore: boolean = false
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_logistics_summary_and_records', {
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_project_name: filters.projectName || null,
        p_driver_name: filters.driverName || null,
        p_license_plate: filters.licensePlate || null,
        p_driver_phone: filters.driverPhone || null,
        p_page_number: page,
        p_page_size: currentPageSize,
        p_sort_field: currentSortField,
        p_sort_direction: currentSortDirection
      } as LogisticsSummaryAndRecordsParams);

      if (error) throw error;
      
      const responseData = (data as LogisticsSummaryAndRecordsResponse) || {
        records: [],
        summary: INITIAL_SUMMARY,
        totalCount: 0
      };
      const newRecords = responseData.records || [];
      
      if (loadMore && page > 1) {
        // 加载更多时追加数据
        setRecords(prev => [...prev, ...newRecords]);
      } else {
        // 首次加载或刷新时替换数据
        setRecords(newRecords);
      }
      
      setTotalSummary(responseData.summary || INITIAL_SUMMARY);
      setTotalCount(responseData.totalCount || 0);
      setHasMore(newRecords.length === currentPageSize && (page * currentPageSize) < (responseData.totalCount || 0));
      
      // 应用客户端过滤
      applyClientFilters(newRecords, filters);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast({ title: "错误", description: `加载运单记录失败: ${errorMessage}`, variant: "destructive" });
      setRecords([]);
      setTotalSummary(INITIAL_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const applyClientFilters = useCallback((records: MobileLogisticsRecord[], filters: MobileLogisticsFilters) => {
    let filtered = [...records];

    // 付款状态过滤
    if (filters.paymentStatus && filters.paymentStatus !== 'all') {
      filtered = filtered.filter(record => record.payment_status === filters.paymentStatus);
    }

    setFilteredRecords(filtered);
  }, []);

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    // 排序时重置到第一页
    setCurrentPage(1);
  }, [sortField]);

  const handleFilterChange = useCallback((newFilters: Partial<MobileLogisticsFilters>) => {
    const updatedFilters = { ...activeFilters, ...newFilters };
    setActiveFilters(updatedFilters);
    setCurrentPage(1);
  }, [activeFilters]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      loadRecords(nextPage, activeFilters, sortField, sortDirection, pageSize, true);
    }
  }, [hasMore, loading, currentPage, activeFilters, sortField, sortDirection, pageSize, loadRecords]);

  const handleRefresh = useCallback(() => {
    setCurrentPage(1);
    loadRecords(1, activeFilters, sortField, sortDirection, pageSize, false);
  }, [activeFilters, sortField, sortDirection, pageSize, loadRecords]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('logistics_records').delete().eq('id', id);
      if (error) throw error;
      
      toast({ title: "成功", description: "运单记录已删除" });
      // 重新加载数据
      handleRefresh();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast({ title: "错误", description: `删除失败: ${errorMessage}`, variant: "destructive" });
    }
  }, [toast, handleRefresh]);

  // 初始加载
  useEffect(() => {
    loadRecords(1, activeFilters, sortField, sortDirection, pageSize, false);
  }, []);

  // 当筛选条件、排序或页面大小改变时重新加载
  useEffect(() => {
    if (currentPage === 1) {
      loadRecords(1, activeFilters, sortField, sortDirection, pageSize, false);
    }
  }, [activeFilters, sortField, sortDirection, pageSize, loadRecords]);

  // 当筛选条件改变时应用客户端过滤
  useEffect(() => {
    applyClientFilters(records, activeFilters);
  }, [records, activeFilters, applyClientFilters]);

  return {
    records,
    filteredRecords,
    loading,
    activeFilters,
    setActiveFilters,
    totalSummary,
    sortField,
    sortDirection,
    currentPage,
    pageSize,
    totalCount,
    hasMore,
    handleSort,
    handleFilterChange,
    handleLoadMore,
    handleRefresh,
    handleDelete,
    setPageSize
  };
}
