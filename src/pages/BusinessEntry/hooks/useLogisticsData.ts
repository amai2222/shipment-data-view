// src/pages/BusinessEntry/hooks/useLogisticsData.ts

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'; // THE FIX IS HERE
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
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

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

  useEffect(() => {
    loadPaginatedRecords(pagination.currentPage, filters);
  }, [pagination.currentPage, filters, loadPaginatedRecords]);


  const handleDelete = async (id: string) => {
    try {
      await supabase.from('logistics_records').delete().eq('id', id);
      toast({ title: "成功", description: "运单记录已删除" });
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
