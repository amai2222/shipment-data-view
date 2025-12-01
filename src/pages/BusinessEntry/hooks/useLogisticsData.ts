// 最终文件路径: src/pages/BusinessEntry/hooks/useLogisticsData.ts
// 描述: [最终修正版] 更新了 TotalSummary 接口以接收后端计算好的所有合计数据。

import { useState, useCallback, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogisticsRecord, PaginationState } from '../types';
// ✅ 修改：移除日期转换函数，直接传递中国时区日期字符串给后端

interface LogisticsResponse {
  records: LogisticsRecord[];
  summary: TotalSummary;
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
  invoiceStatus: string; // 开票状态筛选
  paymentStatus: string; // 付款状态筛选
  receiptStatus: string; // 收款状态筛选
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
  invoiceStatus: "",
  paymentStatus: "",
  receiptStatus: "",
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
  totalPiecesLoading: number;
  totalPiecesUnloading: number;
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
  totalPiecesLoading: 0,
  totalPiecesUnloading: 0,
};

export function useLogisticsData() {
  const { toast } = useToast();
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set()); // ✅ 新增：跟踪正在删除的记录ID
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
      const { data, error } = await supabase.rpc<LogisticsResponse>('get_logistics_summary_and_records_enhanced_1201', {
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_project_name: filters.projectName || null,
        p_driver_name: filters.driverName || null,
        p_license_plate: filters.licensePlate || null,
        p_driver_phone: filters.driverPhone || null,
        p_other_platform_name: filters.otherPlatformName || null,
        p_waybill_numbers: filters.waybillNumbers || null,
        p_has_scale_record: filters.hasScaleRecord || null,
        p_invoice_status: filters.invoiceStatus || null,
        p_payment_status: filters.paymentStatus || null,
        p_receipt_status: filters.receiptStatus || null,
        p_page_number: page,
        p_page_size: pageSize,
        p_sort_field: currentSortField,
        p_sort_direction: currentSortDirection
      });

      if (error) throw error;
      
      const responseData = (data as LogisticsResponse) || { records: [], summary: INITIAL_SUMMARY, totalCount: 0 };
      
      // 调试：检查返回的数据是否包含 unit_price
      if (responseData.records && responseData.records.length > 0) {
        const firstRecord = responseData.records[0];
        console.log('查询返回的第一条记录:', {
          id: firstRecord.id,
          auto_number: firstRecord.auto_number,
          unit_price: firstRecord.unit_price,
          effective_quantity: firstRecord.effective_quantity,
          calculation_mode: firstRecord.calculation_mode,
          has_unit_price: 'unit_price' in firstRecord,
          all_keys: Object.keys(firstRecord)
        });
      }
      
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
    // ✅ 防重复点击：如果正在删除该记录，直接返回
    if (deletingIds.has(id)) {
      return;
    }

    // 标记为正在删除
    setDeletingIds(prev => new Set(prev).add(id));

    try {
      // ✅ 使用数据库函数安全删除运单（确保所有关联数据都被正确处理）
      const { data, error } = await supabase.rpc<{
        success: boolean;
        message?: string;
        error?: string;
        auto_number?: string;
        deleted_dispatch_count?: number;
        deleted_cost_count?: number;
      }>('delete_single_logistics_record', {
        p_record_id: id
      });
      
      if (error) {
        // ✅ 特殊处理 409 冲突错误
        if (error.code === '409' || error.message?.includes('409') || error.message?.includes('conflict')) {
          // 409 通常表示资源已被删除或状态冲突，尝试刷新数据
          toast({ 
            title: "提示", 
            description: "该运单可能已被删除，正在刷新数据...", 
            variant: "default" 
          });
          await loadPaginatedRecords(pagination.currentPage, activeFilters, sortField, sortDirection, pagination.pageSize);
          return;
        }
        throw error;
      }
      
      // 检查函数返回结果
      if (data && !data.success) {
        throw new Error(data.error || '删除失败');
      }
      
      // 构建成功消息
      const dispatchCount = data?.deleted_dispatch_count || 0;
      const costCount = data?.deleted_cost_count || 0;
      let description = "运单记录已删除";
      if (dispatchCount > 0 || costCount > 0) {
        const parts: string[] = [];
        if (dispatchCount > 0) parts.push(`${dispatchCount}条派单`);
        if (costCount > 0) parts.push(`${costCount}条成本记录`);
        description += `（同时删除了${parts.join('和')}）`;
      }
      
      toast({ title: "成功", description });
      // 重新加载当前页数据
      await loadPaginatedRecords(pagination.currentPage, activeFilters, sortField, sortDirection, pagination.pageSize);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast({ title: "删除失败", description: errorMessage, variant: "destructive" });
    } finally {
      // 清除删除标记
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [toast, loadPaginatedRecords, pagination.currentPage, activeFilters, sortField, sortDirection, pagination.pageSize, deletingIds]);

  const refetch = useCallback(() => {
    loadPaginatedRecords(pagination.currentPage, activeFilters, sortField, sortDirection, pagination.pageSize);
  }, [loadPaginatedRecords, activeFilters, pagination.currentPage, sortField, sortDirection, pagination.pageSize]);

  return {
    records, loading, deletingIds, activeFilters, setActiveFilters, pagination, setPagination, totalSummary, handleDelete, refetch,
    sortField, sortDirection, handleSort, handlePageSizeChange,
  };
}
