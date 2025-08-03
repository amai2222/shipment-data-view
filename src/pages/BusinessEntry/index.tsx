// 正确路径: src/pages/BusinessEntry/index.tsx

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileDown, FileUp, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";

import { Project, LogisticsRecord } from './types';
import { useLogisticsData, INITIAL_FILTERS, TotalSummary } from './hooks/useLogisticsData';
import { useExcelImport } from './hooks/useExcelImport';
import { FilterBar } from './components/FilterBar';
import { LogisticsTable } from './components/LogisticsTable';
import { ImportDialog } from './components/ImportDialog';

// [核心重构] - 创建一个独立的合计信息组件
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
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-foreground">运单管理</h1><p className="text-muted-foreground">查询和管理所有运单记录</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTemplateDownload}><FileDown className="mr-2 h-4 w-4" />下载模板</Button>
          <Button variant="outline" asChild disabled={loading || isImporting}><Label htmlFor="excel-upload" className="cursor-pointer flex items-center">{isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}导入Excel<Input id="excel-upload" type="file" className="hidden" onChange={handleExcelImport} accept=".xlsx, .xls" disabled={loading || isImporting}/></Label></Button>
          <Button onClick={exportToExcel} disabled={loading}><Download className="mr-2 h-4 w-4" />导出数据</Button>
        </div>
      </div>

      <FilterBar
        onSearch={handleSearch}
        onClear={handleClearSearch}
        loading={loading}
        projects={projects}
      />

      {/* [核心重构] - 将合计信息渲染在表格上方 */}
      <SummaryDisplay totalSummary={totalSummary} />

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
