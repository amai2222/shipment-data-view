// 正确路径: src/pages/BusinessEntry/index.tsx

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileDown, FileUp, Loader2, Filter } from "lucide-react"; // 引入 Filter 图标
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

import { Project, LogisticsRecord } from './types';
import { useLogisticsData, INITIAL_FILTERS, TotalSummary, LogisticsFilters } from './hooks/useLogisticsData';
import { useExcelImport } from './hooks/useExcelImport';
import { FilterBar } from './components/FilterBar';
import { LogisticsTable } from './components/LogisticsTable';
import { ImportDialog } from './components/ImportDialog';

// [核心重构] - 创建一个全新的、功能更强大的合计信息组件
const SummaryDisplay = ({ totalSummary, activeFilters }: { totalSummary: TotalSummary, activeFilters: LogisticsFilters }) => {
  
  const filterLabels: Record<keyof Omit<LogisticsFilters, 'dateRange'>, string> = {
    projectName: "项目",
    driverName: "司机",
    licensePlate: "车牌号",
    driverPhone: "司机电话",
  };

  const activeFilterPills = useMemo(() => {
    const pills = [];
    
    // 处理日期范围
    if (activeFilters.dateRange?.from) {
      const from = format(activeFilters.dateRange.from, 'yyyy-MM-dd');
      const to = activeFilters.dateRange.to ? format(activeFilters.dateRange.to, 'yyyy-MM-dd') : from;
      pills.push(
        <span key="dateRange" className="bg-muted px-2 py-1 rounded-md text-xs font-medium">
          <strong>日期:</strong> {from === to ? from : `${from} to ${to}`}
        </span>
      );
    }

    // 处理其他文本筛选器
    for (const key in filterLabels) {
      const filterKey = key as keyof typeof filterLabels;
      if (activeFilters[filterKey]) {
        pills.push(
          <span key={key} className="bg-muted px-2 py-1 rounded-md text-xs font-medium">
            <strong>{filterLabels[filterKey]}:</strong> {activeFilters[filterKey]}
          </span>
        );
      }
    }
    return pills;
  }, [activeFilters]);

  return (
    <div className="flex justify-between items-center rounded-lg border p-4 text-sm">
      {/* 左侧：筛选条件 */}
      <div className="flex flex-wrap gap-2 items-center">
        {activeFilterPills.length > 0 ? (
          <>
            <Filter className="h-4 w-4 text-muted-foreground" />
            {activeFilterPills}
          </>
        ) : (
          <span className="text-muted-foreground text-xs">当前未应用任何筛选条件</span>
        )}
      </div>

      {/* 右侧：合计数值 */}
      <div className="flex items-center space-x-4 font-medium shrink-0">
        <span>合计:</span>
        <span className="font-bold">装: <span className="text-primary">{totalSummary.totalLoadingWeight.toFixed(2)}吨</span></span>
        <span className="font-bold">卸: <span className="text-primary">{totalSummary.totalUnloadingWeight.toFixed(2)}吨</span></span>
        <span className="font-bold">{totalSummary.actualCount}实际 / {totalSummary.returnCount}退货</span>
        <span>司机应收: <span className="font-bold text-green-600">¥{totalSummary.totalDriverPayableCost.toFixed(2)}</span></span>
      </div>
    </div>
  );
};


export default function BusinessEntry() {
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecord | null>(null);

  const { records, loading, activeFilters, setActiveFilters, pagination, setPagination, totalSummary, handleDelete, refetch } = useLogisticsData();
  const { isImporting, isImportModalOpen, importStep, importPreview, approvedDuplicates, importLogs, importLogRef, handleExcelImport, executeFinalImport, closeImportModal, setApprovedDuplicates } = useExcelImport(() => {
    refetch();
  });

  const loadInitialOptions = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('projects').select('id, name');
      if (error) throw error;
      setProjects(data || []);
    } catch (error) { 
      toast({ title: "错误", description: "加载项目列表失败", variant: "destructive" }); 
    }
  }, [toast]);

  useEffect(() => {
    loadInitialOptions();
  }, [loadInitialOptions]);

  const handleSearch = (newFilters: typeof INITIAL_FILTERS) => {
    setActiveFilters(newFilters);
    if (pagination.currentPage !== 1) {
      setPagination(p => ({ ...p, currentPage: 1 }));
    }
  };

  const handleClearSearch = () => {
    setActiveFilters(INITIAL_FILTERS);
    if (pagination.currentPage !== 1) {
      setPagination(p => ({ ...p, currentPage: 1 }));
    }
  };

  const exportToExcel = async () => { /* ... */ };
  const handleTemplateDownload = () => { /* ... */ };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">{/* ... Header JSX ... */}</div>

      <FilterBar
        onSearch={handleSearch}
        onClear={handleClearSearch}
        loading={loading}
        projects={projects}
      />

      {/* [核心重构] - 将合计信息渲染在表格上方，并传入 activeFilters */}
      <SummaryDisplay totalSummary={totalSummary} activeFilters={activeFilters} />

      <LogisticsTable
        records={records}
        loading={loading}
        pagination={pagination}
        setPagination={setPagination}
        onDelete={handleDelete}
        onView={setViewingRecord}
      />
      
      <ImportDialog isOpen={isImportModalOpen} onClose={closeImportModal} importStep={importStep} importPreview={importPreview} approvedDuplicates={approvedDuplicates} setApprovedDuplicates={setApprovedDuplicates} importLogs={importLogs} importLogRef={importLogRef} onExecuteImport={executeFinalImport} />
      
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>
        {/* ... Viewing Dialog JSX ... */}
      </Dialog>
    </div>
  );
}
