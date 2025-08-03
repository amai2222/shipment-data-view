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
import { useLogisticsData, INITIAL_FILTERS } from './hooks/useLogisticsData';
import { useExcelImport } from './hooks/useExcelImport';
import { FilterBar } from './components/FilterBar';
import { LogisticsTable } from './components/LogisticsTable';
import { ImportDialog } from './components/ImportDialog';

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

      <LogisticsTable
        records={records}
        loading={loading}
        totalSummary={totalSummary}
        pagination={pagination}
        setPagination={setPagination}
        onDelete={handleDelete}
        onView={setViewingRecord}
      />
      
      <ImportDialog isOpen={isImportModalOpen} onClose={closeImportModal} importStep={importStep} importPreview={importPreview} approvedDuplicates={approvedDuplicates} setApprovedDuplicates={setApprovedDuplicates} importLogs={importLogs} importLogRef={importLogRef} onExecuteImport={executeFinalImport} />
      
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>运单详情 (编号: {viewingRecord?.auto_number})</DialogTitle></DialogHeader>
          {viewingRecord && ( <div className="grid grid-cols-4 gap-x-4 gap-y-6 py-4 text-sm">{/* ... 详情内容 ... */}</div> )}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setViewingRecord(null)}>关闭</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
