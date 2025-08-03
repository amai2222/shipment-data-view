// 正确路径: src/pages/BusinessEntry/hooks/useLogisticsData.ts

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogisticsRecord } from '../types';

const getInitialDefaultDates = () => {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  return { startDate: formatDate(firstDayOfMonth), endDate: formatDate(today) };
};

// [核心重构] - 定义新的、结构化的筛选器类型
export interface LogisticsFilters {
  startDate: string;
  endDate: string;
  projectName: string;
  driverName: string;
  licensePlate: string;
  driverPhone: string;
}

// [核心重构] - 初始筛选器现在为空，以实现默认加载所有数据
const INITIAL_FILTERS: LogisticsFilters = {
  ...getInitialDefaultDates(),
  projectName: "",
  driverName: "",
  licensePlate: "",
  driverPhone: "",
};

const PAGE_SIZE = 15;

export function useLogisticsData() {
  const { toast } = useToast();
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeFilters, setActiveFilters] = useState<LogisticsFilters>(INITIAL_FILTERS);
  
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
  });

  const loadPaginatedRecords = useCallback(async (page: number, filters: LogisticsFilters) => {
    setLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      
      let query = supabase
        .from('logistics_records')
        .select('*', { count: 'exact' });

      // [核心重构] - 根据新的筛选器动态构建查询
      query = query.gte('loading_date', filters.startDate);
      query = query.lte('loading_date', filters.endDate);

      if (filters.projectName) {
        query = query.eq('project_name', filters.projectName); // 使用精确匹配
      }
      if (filters.driverName) {
        query = query.ilike('driver_name', `%${filters.driverName}%`);
      }
      if (filters.licensePlate) {
        query = query.ilike('license_plate', `%${filters.licensePlate}%`);
      }
      if (filters.driverPhone) {
        query = query.ilike('driver_phone', `%${filters.driverPhone}%`);
      }

      query = query
        .order('loading_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      const { data, error, count } = await query;

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
    activeFilters,
    setActiveFilters,
    pagination,
    setPagination,
    summary,
    handleDelete,
    refetch: () => loadPaginatedRecords(pagination.currentPage, activeFilters),
    INITIAL_FILTERS,
  };
}
