// 正确路径: src/pages/BusinessEntry/index.tsx

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileDown, FileUp, Loader2, Search } from "lucide-react"; // 引入 Search 图标
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";

import { Project, LogisticsRecord } from './types';
import { useLogisticsData, INITIAL_FILTERS, TotalSummary } from './hooks/useLogisticsData';
import { useExcelImport } from './hooks/useExcelImport';
import { FilterBar } from './components/FilterBar';
import { LogisticsTable } from './components/LogisticsTable';
import { ImportDialog } from './components/ImportDialog';

const SummaryDisplay = ({ totalSummary }: { totalSummary: TotalSummary }) => (
  <div className="flex items-center justify-end space-x-6 rounded-lg border p-4 text-sm font-medium">
    <span>筛选结果合计:</span>
    <span className="font-bold">装: <span className="text-primary">{totalSummary.totalLoadingWeight.toFixed(2)}吨</span></span>
    <span className="font-bold">卸: <span className="text-primary">{totalSummary.totalUnloadingWeight.toFixed(2)}吨</span></span>
    <span className="font-bold">{totalSummary.actualCount}实际 / {totalSummary.returnCount}退货</span>
    <span>司机运费: <span className="font-bold text-primary">¥{totalSummary.totalCurrentCost.toFixed(2)}</span></span>
    <span>额外费用: <span className="font-bold text-orange-600">¥{totalSummary.totalExtraCost.toFixed(2)}</span></span>
    <span>司机应收: <span className="font-bold text-green-600">¥{totalSummary.totalDriverPayableCost.toFixed(2)}</span></span>
  </div>
);

// [核心修复] - 创建一个新的提示组件
const StaleDataPrompt = () => (
  <div className="text-center py-10 border rounded-lg bg-muted/20">
    <Search className="mx-auto h-12 w-12 text-muted-foreground" />
    <h3 className="mt-2 text-sm font-semibold text-foreground">筛选条件已更改</h3>
    <p className="mt-1 text-sm text-muted-foreground">请点击“搜索”按钮以查看最新结果。</p>
  </div>
);


export default function BusinessEntry() {
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecord | null>(null);

  const [uiFilters, setUiFilters] = useState(INITIAL_FILTERS);

  const { records, loading, activeFilters, setActiveFilters, pagination, setPagination, totalSummary, handleDelete, refetch } = useLogisticsData();
  const { isImporting, isImportModalOpen, importStep, importPreview, approvedDuplicates, importLogs, importLogRef, handleExcelImport, executeFinalImport, closeImportModal, setApprovedDuplicates } = useExcelImport(() => {
    refetch();
  });

  const isSummaryStale = useMemo(() => {
    return JSON.stringify(uiFilters) !== JSON.stringify(activeFilters);
  }, [uiFilters, activeFilters]);

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

  const handleSearch = () => {
    setActiveFilters(uiFilters);
    if (pagination.currentPage !== 1) {
      setPagination(p => ({ ...p, currentPage: 1 }));
    }
  };

  const handleClearSearch = () => {
    setUiFilters(INITIAL_FILTERS);
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
        filters={uiFilters}
        onFiltersChange={setUiFilters}
        onSearch={handleSearch}
        onClear={handleClearSearch}
        loading={loading}
        projects={projects}
      />

      {/* [核心修复] - 使用 isSummaryStale 来决定渲染哪个视图 */}
      {isSummaryStale ? (
        <StaleDataPrompt />
      ) : (
        <>
          {!loading && <SummaryDisplay totalSummary={totalSummary} />}
          <LogisticsTable
            records={records}
            loading={loading}
            pagination={pagination}
            setPagination={setPagination}
            onDelete={handleDelete}
            onView={setViewingRecord}
          />
        </>
      )}
      
      <ImportDialog isOpen={isImportModalOpen} onClose={closeImportModal} importStep={importStep} importPreview={importPreview} approvedDuplicates={approvedDuplicates} setApprovedDuplicates={setApprovedDuplicates} importLogs={importLogs} importLogRef={importLogRef} onExecuteImport={executeFinalImport} />
      
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>
        {/* ... Viewing Dialog JSX ... */}
      </Dialog>
    </div>
  );
}
