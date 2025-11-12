// 最终文件路径: src/pages/BusinessEntry/hooks/useLogisticsData.ts
// 描述: [最终修正版] 更新了 TotalSummary 接口以接收后端计算好的所有合计数据。

import { useState, useCallback, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogisticsRecord, PaginationState } from '../types';
// ✅ 修改：移除日期转换函数，直接传递中国时区日期字符串给后端

interface LogisticsResponse {
  records: LogisticsRecord[];
  summary: any;
  totalCount: number;
}

export interface LogisticsFilters {
  startDate: string;
  endDate: string;
  projectName: string;
  driverName: string;
  licensePlate: string;
  driverPhone: string;
  otherPlatformName: string; // 其他平台名称筛选
  waybillNumbers: string; // 运单编号筛选（支持多个，逗号分隔）
  hasScaleRecord: string; // 是否有磅单筛选：'yes'有磅单, 'no'无磅单, ''不筛选
}

export const INITIAL_FILTERS: LogisticsFilters = {
  startDate: "",
  endDate: "",
  projectName: "",
  driverName: "",
  licensePlate: "",
  driverPhone: "",
  otherPlatformName: "",
  waybillNumbers: "",
  hasScaleRecord: "",
};

const PAGE_SIZE = 20; // 默认每页显示20条记录

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
  const [pagination, setPagination] = useState<PaginationState>({ 
    page: 1,
    size: PAGE_SIZE,
    currentPage: 1, 
    totalPages: 1, 
    totalCount: 0, 
    pageSize: PAGE_SIZE 
  });
  const [totalSummary, setTotalSummary] = useState<TotalSummary>(INITIAL_SUMMARY);
  const [sortField, setSortField] = useState<string>('auto_number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const loadPaginatedRecords = useCallback(async (
    page: number, 
    filters: LogisticsFilters, 
    currentSortField: string, 
    currentSortDirection: 'asc' | 'desc',
    pageSize: number = PAGE_SIZE
  ) => {
    setLoading(true);
    try {
      // ✅ 修改：直接传递中国时区日期字符串，后端函数会处理时区转换
      const { data, error } = await (supabase.rpc as any)('get_logistics_summary_and_records_enhanced_1113', {
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_project_name: filters.projectName || null,
        p_driver_name: filters.driverName || null,
        p_license_plate: filters.licensePlate || null,
        p_driver_phone: filters.driverPhone || null,
        p_other_platform_name: filters.otherPlatformName || null,
        p_waybill_numbers: filters.waybillNumbers || null,
        p_has_scale_record: filters.hasScaleRecord || null,
        p_page_number: page,
        p_page_size: pageSize,
        p_sort_field: currentSortField,
        p_sort_direction: currentSortDirection
      });

      if (error) throw error;
      
      const responseData = (data as LogisticsResponse) || { records: [], summary: INITIAL_SUMMARY, totalCount: 0 };
      
      // 数据库已经排序，不需要前端再排序
      setRecords(responseData.records || []);
      setTotalSummary(responseData.summary || INITIAL_SUMMARY);
      setPagination(prev => ({ 
        ...prev,
        page: page,
        size: pageSize,
        currentPage: page,
        totalPages: Math.ceil((responseData.totalCount || 0) / pageSize) || 1,
        totalCount: responseData.totalCount || 0,
        pageSize: pageSize
      }));

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '加载运单记录失败';
      toast({ title: "错误", description: `加载运单记录失败: ${errorMessage}`, variant: "destructive" });
      setRecords([]);
      setTotalSummary(INITIAL_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPaginatedRecords(pagination.currentPage, activeFilters, sortField, sortDirection, pagination.pageSize);
  }, [pagination.currentPage, activeFilters, sortField, sortDirection, pagination.pageSize, loadPaginatedRecords]);

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    // 排序时重置到第一页
    setPagination((prev: PaginationState) => ({ 
      ...prev, 
      page: 1, 
      size: prev.size,
      currentPage: 1,
      totalPages: prev.totalPages,
      totalCount: prev.totalCount,
      pageSize: prev.pageSize
    }));
  }, [sortField]);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPagination(prev => ({ 
      ...prev,
      page: 1,
      size: newPageSize,
      pageSize: newPageSize,
      currentPage: 1, // 改变页面大小时重置到第一页
      totalPages: Math.ceil(prev.totalCount / newPageSize) || 1
    }));
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('logistics_records').delete().eq('id', id);
      if (error) throw error;
      
      toast({ title: "成功", description: "运单记录已删除" });
      // 重新加载当前页数据
      await loadPaginatedRecords(pagination.currentPage, activeFilters, sortField, sortDirection, pagination.pageSize);
    } catch (error: any) {
      toast({ title: "删除失败", description: error.message, variant: "destructive" });
    }
  }, [toast, loadPaginatedRecords, pagination.currentPage, activeFilters, sortField, sortDirection, pagination.pageSize]);

  const refetch = useCallback(() => {
    loadPaginatedRecords(pagination.currentPage, activeFilters, sortField, sortDirection, pagination.pageSize);
  }, [loadPaginatedRecords, activeFilters, pagination.currentPage, sortField, sortDirection, pagination.pageSize]);

  return {
    records, loading, activeFilters, setActiveFilters, pagination, setPagination, totalSummary, handleDelete, refetch,
    sortField, sortDirection, handleSort, handlePageSizeChange,
  };
}
