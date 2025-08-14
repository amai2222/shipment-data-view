// 最终文件路径: src/pages/BusinessEntry/hooks/useLogisticsData.ts

import { useState, useCallback, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogisticsRecord } from '../types';

// =================================================================
// [新增功能] 导入功能所需的数据结构定义
// =================================================================

/**
 * 定义从Excel文件中解析出的单行数据结构。
 * !!! 重要: 这里的字段和类型必须与您的Excel列和数据库函数匹配。
 */
export interface LogisticsDataRow {
  project_id: string;
  order_id: string;
  customer_name: string;
  ship_date: string;
  estimated_delivery: string;
  actual_delivery: string | null;
  carrier_name: string;
  tracking_number: string;
}

/**
 * 定义从数据库函数返回的单个错误对象的结构。
 */
export interface ImportError {
  line_number: number;
  error_message: string;
}

/**
 * 定义导入函数调用后返回的完整报告结构。
 */
export interface ImportReport {
  success: boolean;
  processed: number;
  successful: number;
  failures: number;
  errors: ImportError[];
}

// =================================================================
// 您原来的代码保持不变
// =================================================================

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

// =================================================================
// 主 Hook 函数
// =================================================================

export function useLogisticsData() {
  const { toast } = useToast();
  // 您原有的所有 state 保持不变
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<LogisticsFilters>(INITIAL_FILTERS);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0, pageSize: PAGE_SIZE });
  const [totalSummary, setTotalSummary] = useState<TotalSummary>(INITIAL_SUMMARY);
  const [sortField, setSortField] = useState<string>('auto_number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // [新增功能] 增加一个专门用于导入过程的加载状态，避免与主列表的加载状态冲突
  const [isImporting, setIsImporting] = useState(false);


  // 您原有的所有函数 (loadPaginatedRecords, handleSort, handleDelete, refetch) 保持不变
  const loadPaginatedRecords = useCallback(async (page: number, filters: LogisticsFilters) => {
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
        const aVal = a[sortField] || '';
        const bVal = b[sortField] || '';
        if (sortDirection === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
      
      setRecords(sortedRecords);
      setTotalSummary(responseData.summary || INITIAL_SUMMARY);
      setPagination(prev => ({ 
        ...prev, 
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
  }, [toast, sortField, sortDirection]); // 移除了 loadPaginatedRecords 自身作为依赖

  useEffect(() => {
    loadPaginatedRecords(pagination.currentPage, activeFilters);
  }, [pagination.currentPage, activeFilters, loadPaginatedRecords]); // 简化依赖项

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const handleDelete = useCallback(async (id: string) => {
    // 这里使用 setLoading(true) 来显示主加载动画
    setLoading(true);
    try {
      const { error } = await supabase.from('logistics_records').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "成功", description: "运单记录已删除" });
      await loadPaginatedRecords(pagination.currentPage, activeFilters); // 直接调用，无需等待
    } catch (error: any) {
      toast({ title: "删除失败", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, loadPaginatedRecords, pagination.currentPage, activeFilters]);

  const refetch = useCallback(() => {
    if (pagination.currentPage !== 1) {
      setPagination(p => ({ ...p, currentPage: 1 }));
    } else {
      loadPaginatedRecords(1, activeFilters);
    }
  }, [loadPaginatedRecords, activeFilters, pagination.currentPage]);

  // =================================================================
  // [新增功能] 这是新添加的导入函数，它将与您现有的功能并存
  // =================================================================
  const importRecords = async (data: LogisticsDataRow[]): Promise<ImportReport | null> => {
    if (!data || data.length === 0) return null;
    
    setIsImporting(true); // 使用独立的加载状态
    try {
        const { data: errorReport, error: rpcError } = await supabase.rpc(
            'process_logistics_import', // 调用我们之前创建的、名字不会冲突的函数
            { records: data }
        );

        if (rpcError) {
            toast({ title: "导入失败", description: `数据库调用错误: ${rpcError.message}`, variant: "destructive" });
            return {
                success: false, processed: data.length, successful: 0, failures: data.length,
                errors: [{ line_number: 0, error_message: `数据库调用失败: ${rpcError.message}` }]
            };
        }

        const failedImports: ImportError[] = errorReport || [];
        const report = {
            success: failedImports.length === 0,
            processed: data.length,
            successful: data.length - failedImports.length,
            failures: failedImports.length,
            errors: failedImports,
        };
        
        // 导入成功后，显示一个成功的提示
        if (report.successful > 0) {
            toast({ title: "导入完成", description: `成功导入 ${report.successful} 条记录。` });
            refetch(); // 关键一步：导入成功后，调用 refetch 刷新主列表数据！
        }
        
        // 如果有失败的记录，也给出提示
        if (report.failures > 0) {
            toast({ title: "部分失败", description: `${report.failures} 条记录导入失败，请查看详情。`, variant: "destructive" });
        }

        return report;

    } catch (e: any) {
        toast({ title: "严重错误", description: e.message, variant: "destructive" });
        return null;
    } finally {
        setIsImporting(false);
    }
  };


  // =================================================================
  // [新增功能] 在返回的对象中，添加 importRecords 和 isImporting
  // =================================================================
  return {
    // 您原有的返回值
    records,
    loading,
    activeFilters,
    setActiveFilters,
    pagination,
    setPagination,
    totalSummary,
    handleDelete,
    refetch,
    sortField,
    sortDirection,
    handleSort,
    // 新增的返回值
    isImporting,
    importRecords, 
  };
}
