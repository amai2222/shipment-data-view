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
import { useLogisticsData, INITIAL_FILTERS } from './hooks/useLogisticsData'; // [核心修复] - 引入唯一的 INITIAL_FILTERS
import { useExcelImport } from './hooks/useExcelImport';
import { FilterBar } from './components/FilterBar';
import { LogisticsTable } from './components/LogisticsTable';
import { ImportDialog } from './components/ImportDialog';

export default function BusinessEntry() {
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecord | null>(null);

  const { records, loading, activeFilters, setActiveFilters, pagination, setPagination, summary, handleDelete, refetch } = useLogisticsData();
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

  const exportToExcel = async () => { /* ... 导出逻辑不变 ... */ };
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

      <LogisticsTable records={records} loading={loading} summary={summary} pagination={pagination} setPagination={setPagination} onDelete={handleDelete} onView={setViewingRecord} />
      
      <ImportDialog isOpen={isImportModalOpen} onClose={closeImportModal} importStep={importStep} importPreview={importPreview} approvedDuplicates={approvedDuplicates} setApprovedDuplicates={setApprovedDuplicates} importLogs={importLogs} importLogRef={importLogRef} onExecuteImport={executeFinalImport} />
      
      {/* [核心修复] - 恢复完整的“查看详情”对话框 */}
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>运单详情 (编号: {viewingRecord?.auto_number})</DialogTitle></DialogHeader>
          {viewingRecord && (
            <div className="grid grid-cols-4 gap-x-4 gap-y-6 py-4 text-sm">
              <div className="space-y-1"><Label className="text-muted-foreground">项目</Label><p>{viewingRecord.project_name}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">合作链路</Label><p>{viewingRecord.chain_name || '默认'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">装货日期</Label><p>{viewingRecord.loading_date ? viewingRecord.loading_date.split('T')[0] : '-'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">卸货日期</Label><p>{viewingRecord.unloading_date ? viewingRecord.unloading_date.split('T')[0] : '-'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">司机</Label><p>{viewingRecord.driver_name}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">车牌号</Label><p>{viewingRecord.license_plate || '-'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">司机电话</Label><p>{viewingRecord.driver_phone || '-'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">运输类型</Label><p>{viewingRecord.transport_type}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">装货地点</Label><p>{viewingRecord.loading_location}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">装货重量</Label><p>{viewingRecord.loading_weight ? `${viewingRecord.loading_weight} 吨` : '-'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">卸货地点</Label><p>{viewingRecord.unloading_location}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">卸货重量</Label><p>{viewingRecord.unloading_weight ? `${viewingRecord.unloading_weight} 吨` : '-'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">运费金额</Label><p className="font-mono">{viewingRecord.current_cost != null ? `¥${viewingRecord.current_cost.toFixed(2)}` : '-'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">额外费用</Label><p className="font-mono text-orange-600">{viewingRecord.extra_cost != null ? `¥${viewingRecord.extra_cost.toFixed(2)}` : '-'}</p></div>
              <div className="space-y-1 col-span-2"><Label className="text-muted-foreground">司机应收</Label><p className="font-mono font-bold text-primary">{viewingRecord.payable_cost != null ? `¥${viewingRecord.payable_cost.toFixed(2)}` : '-'}</p></div>
              <div className="col-span-4 space-y-1"><Label className="text-muted-foreground">备注</Label><p className="min-h-[40px] whitespace-pre-wrap">{viewingRecord.remarks || '无'}</p></div>
            </div>
          )}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setViewingRecord(null)}>关闭</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
