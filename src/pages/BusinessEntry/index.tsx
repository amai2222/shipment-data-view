// 最终文件路径: src/pages/BusinessEntry/index.tsx

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileDown, FileUp, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";

import { Project, LogisticsRecord } from './types';
import { useLogisticsData, INITIAL_FILTERS, TotalSummary } from './hooks/useLogisticsData';
import { useExcelImport } from './hooks/useExcelImport';
import { FilterBar } from './components/FilterBar';
import { LogisticsTable } from './components/LogisticsTable';
import { ImportDialog } from './components/ImportDialog';

const SummaryDisplay = ({ totalSummary, activeFilters, projects }: { totalSummary: TotalSummary, activeFilters: typeof INITIAL_FILTERS, projects: Project[] }) => {
  
  const summaryTitle = useMemo(() => {
    const parts: string[] = [];
    
    if (activeFilters.projectId) {
      const projectName = projects.find(p => p.id === activeFilters.projectId)?.name || activeFilters.projectId;
      parts.push(`项目: ${projectName}`);
    }
    if (activeFilters.driverName) {
      parts.push(`司机: ${activeFilters.driverName}`);
    }
    if (activeFilters.licensePlate) {
      parts.push(`车牌: ${activeFilters.licensePlate}`);
    }
    if (activeFilters.startDate && activeFilters.endDate) {
      parts.push(`日期: ${activeFilters.startDate} 至 ${activeFilters.endDate}`);
    } else if (activeFilters.startDate) {
      parts.push(`日期: 从 ${activeFilters.startDate}`);
    } else if (activeFilters.endDate) {
      parts.push(`日期: 截至 ${activeFilters.endDate}`);
    }

    if (parts.length === 0) {
      return "全部记录合计";
    }

    return `${parts.join(' | ')} 合计`;

  }, [activeFilters, projects]);

  return (
    <div className="flex items-center justify-start flex-wrap gap-x-6 gap-y-2 rounded-lg border p-4 text-sm font-medium">
      <span className="font-bold">{summaryTitle}:</span>
      <span>装: <span className="font-bold text-primary">{totalSummary.totalLoadingWeight.toFixed(2)}吨</span></span>
      <span>卸: <span className="font-bold text-primary">{totalSummary.totalUnloadingWeight.toFixed(2)}吨</span></span>
      <span>{totalSummary.actualCount}实际 / {totalSummary.returnCount}退货</span>
      <span>司机运费: <span className="font-bold text-primary">¥{totalSummary.totalCurrentCost.toFixed(2)}</span></span>
      <span>额外费用: <span className="font-bold text-orange-600">¥{totalSummary.totalExtraCost.toFixed(2)}</span></span>
      <span>司机应收: <span className="font-bold text-green-600">¥{totalSummary.totalDriverPayableCost.toFixed(2)}</span></span>
    </div>
  );
};

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

      {!isSummaryStale && !loading && (
        <SummaryDisplay 
          totalSummary={totalSummary} 
          activeFilters={activeFilters} 
          projects={projects} 
        />
      )}

      {isSummaryStale ? (
        <StaleDataPrompt />
      ) : (
        <LogisticsTable
          records={records}
          loading={loading}
          pagination={pagination}
          setPagination={setPagination}
          onDelete={handleDelete}
          onView={setViewingRecord}
        />
      )}
      
      <ImportDialog isOpen={isImportModalOpen} onClose={closeImportModal} importStep={importStep} importPreview={importPreview} approvedDuplicates={approvedDuplicates} setApprovedDuplicates={setApprovedDuplicates} importLogs={importLogs} importLogRef={importLogRef} onExecuteImport={executeFinalImport} />
      
      {/* [已集成] 使用从原始代码移植过来的、功能完整的详情对话框 */}
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>运单详情 (编号: {viewingRecord?.auto_number})</DialogTitle>
          </DialogHeader>
          {viewingRecord && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-6 py-4 text-sm">
              <div className="space-y-1"><Label className="text-muted-foreground">项目</Label><p>{viewingRecord.project_name}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">合作链路</Label><p>{viewingRecord.chain_name || '默认'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">装货日期</Label><p>{viewingRecord.loading_date ? viewingRecord.loading_date.split('T')[0] : '未填写'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">卸货日期</Label><p>{viewingRecord.unloading_date ? viewingRecord.unloading_date.split('T')[0] : '未填写'}</p></div>

              <div className="space-y-1"><Label className="text-muted-foreground">司机</Label><p>{viewingRecord.driver_name}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">车牌号</Label><p>{viewingRecord.license_plate || '未填写'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">司机电话</Label><p>{viewingRecord.driver_phone || '未填写'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">运输类型</Label><p>{viewingRecord.transport_type}</p></div>

              <div className="space-y-1"><Label className="text-muted-foreground">装货地点</Label><p>{viewingRecord.loading_location}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">装货重量</Label><p>{viewingRecord.loading_weight ? `${viewingRecord.loading_weight} 吨` : '-'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">卸货地点</Label><p>{viewingRecord.unloading_location}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">卸货重量</Label><p>{viewingRecord.unloading_weight ? `${viewingRecord.unloading_weight} 吨` : '-'}</p></div>

              <div className="space-y-1"><Label className="text-muted-foreground">运费金额</Label><p className="font-mono">{viewingRecord.current_cost != null ? `¥${viewingRecord.current_cost.toFixed(2)}` : '-'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">额外费用</Label><p className="font-mono text-orange-600">{viewingRecord.extra_cost != null ? `¥${viewingRecord.extra_cost.toFixed(2)}` : '-'}</p></div>
              <div className="space-y-1 col-span-1 md:col-span-2"><Label className="text-muted-foreground">司机应收</Label><p className="font-mono font-bold text-primary">{viewingRecord.driver_payable_cost != null ? `¥${viewingRecord.driver_payable_cost.toFixed(2)}` : '-'}</p></div>
              
              <div className="col-span-1 md:col-span-4 space-y-1"><Label className="text-muted-foreground">备注</Label><p className="min-h-[40px] whitespace-pre-wrap">{viewingRecord.remarks || '无'}</p></div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setViewingRecord(null)}>关闭</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
