// src/pages/BusinessEntry/hooks/useLogisticsData.ts

import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogisticsRecord } from '../types';

const getInitialDefaultDates = () => {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  return { startDate: formatDate(firstDayOfMonth), endDate: formatDate(today) };
};

const PAGE_SIZE = 15;

export function useLogisticsData() {
  const { toast } = useToast();
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: getInitialDefaultDates().startDate,
    endDate: getInitialDefaultDates().endDate,
    searchQuery: ""
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
  });

  // The single source of truth for fetching data.
  const loadPaginatedRecords = useCallback(async (page: number, currentFilters: typeof filters) => {
    setLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const { data, error, count } = await supabase
        .from('logistics_records_view')
        .select('*', { count: 'exact' })
        .ilike('any_text', `%${currentFilters.searchQuery}%`)
        .gte('loading_date', currentFilters.startDate)
        .lte('loading_date', currentFilters.endDate)
        .order('loading_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      
      setRecords(data || []);
      setPagination(prev => ({ ...prev, totalPages: Math.ceil((count || 0) / PAGE_SIZE) || 1 }));
    } catch (error: any) {
      toast({ title: "错误", description: `加载运单记录失败: ${error.message}`, variant: "destructive" });
      setRecords([]); // On error, clear records to avoid showing stale data
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Effect 1: Reset to page 1 when filters change.
  // We use a ref to prevent this from running on the initial mount.
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      if (pagination.currentPage !== 1) {
        setPagination(p => ({ ...p, currentPage: 1 }));
      }
    }
  }, [filters]);

  // Effect 2: The ONLY effect that triggers data loading.
  // It runs when the page changes OR when the filters change (which will eventually lead to a page change or already be on page 1).
  useEffect(() => {
    loadPaginatedRecords(pagination.currentPage, filters);
  }, [pagination.currentPage, filters, loadPaginatedRecords]);


  const handleDelete = async (id: string) => {
    try {
      await supabase.from('logistics_records').delete().eq('id', id);
      toast({ title: "成功", description: "运单记录已删除" });
      // After deletion, refetch the current page
      loadPaginatedRecords(pagination.currentPage, filters);
    } catch (error: any) {
      toast({ title: "删除失败", description: error.message, variant: "destructive" });
    }
  };

  const summary = useMemo(() => {
    return (records || []).reduce((acc, record) => {
      acc.totalLoadingWeight += record.loading_weight || 0;
      acc.totalUnloadingWeight += record.unloading_weight || 0;
      acc.totalCurrentCost += record.current_cost || 0;
      acc.totalExtraCost += record.extra_cost || 0;
      acc.totalDriverPayableCost += record.payable_cost || 0;
      if (record.transport_type === '实际运输') acc.actualCount += 1;
      else if (record.transport_type === '退货') acc.returnCount += 1;
      return acc;
    }, { totalLoadingWeight: 0, totalUnloadingWeight: 0, totalCurrentCost: 0, totalExtraCost: 0, totalDriverPayableCost: 0, actualCount: 0, returnCount: 0 });
  }, [records]);

  return {
    records,
    loading,
    filters,
    setFilters,
    pagination,
    setPagination,
    summary,
    handleDelete,
    refetch: () => loadPaginatedRecords(pagination.currentPage, filters),
  };
}
