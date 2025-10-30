// 业务录入 - 完整重构版本
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLogisticsData, INITIAL_FILTERS } from './hooks/useLogisticsData';
import { LogisticsTable } from './components/LogisticsTable';
import { FilterBar } from './components/FilterBar';
import { LogisticsFormDialog } from './components/LogisticsFormDialog';
import { ImportDialog } from './components/ImportDialog';
import { UpdateModeImportDialog } from './components/UpdateModeImportDialog';
import { useExcelImport } from './hooks/useExcelImport';
import { useExcelImportWithUpdate } from './hooks/useExcelImportWithUpdate';
import type { LogisticsRecord } from '@/types/businessEntry';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';

export default function BusinessEntry() {
  const { toast } = useToast();
  const [uiFilters, setUiFilters] = useState(INITIAL_FILTERS);
  const [activeFilters, setActiveFilters] = useState(INITIAL_FILTERS);
  const [isStale, setIsStale] = useState(false);
  
  const {
    records,
    totalCount,
    summary,
    currentPage,
    pageSize,
    totalPages,
    isLoading,
    loadData,
    deleteRecord,
    setCurrentPage,
    setPageSize
  } = useLogisticsData();

  const [projects, setProjects] = useState<any[]>([]);
  const [editingRecord, setEditingRecord] = useState<LogisticsRecord | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);

  const {
    isImporting,
    isImportModalOpen,
    importStep,
    importPreview,
    importLogs,
    handleExcelImport,
    executeFinalImport,
    closeImportModal
  } = useExcelImport();

  const {
    isImporting: isUpdating,
    isImportModalOpen: isUpdateModalOpen,
    importStep: updateStep,
    importPreview: updatePreview,
    importMode,
    setImportMode,
    importLogs: updateLogs,
    handleExcelImport: handleUpdateImport,
    executeFinalImport: executeUpdateImport,
    closeImportModal: closeUpdateModal
  } = useExcelImportWithUpdate();

  useEffect(() => {
    const loadProjects = async () => {
      const { data } = await supabase.from('projects').select('id, name').order('name');
      setProjects(data || []);
    };
    loadProjects();
  }, []);

  useEffect(() => {
    if (!isStale) {
      loadData(activeFilters, currentPage, pageSize);
    }
  }, [activeFilters, currentPage, pageSize, isStale, loadData]);

  const handleSearch = useCallback(() => {
    setActiveFilters(uiFilters);
    setIsStale(false);
    setCurrentPage(1);
  }, [uiFilters, setCurrentPage]);

  const handleFilterChange = useCallback((key: string, value: any) => {
    setUiFilters(prev => ({ ...prev, [key]: value }));
    setIsStale(true);
  }, []);

  const handleDateChange = useCallback((range: DateRange | undefined) => {
    setUiFilters(prev => ({
      ...prev,
      startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
      endDate: range?.to ? format(range.to, 'yyyy-MM-dd') : ''
    }));
    setIsStale(true);
  }, []);

  const handleClear = useCallback(() => {
    setUiFilters(INITIAL_FILTERS);
    setActiveFilters(INITIAL_FILTERS);
    setIsStale(false);
    setCurrentPage(1);
  }, [setCurrentPage]);

  const handleDelete = async (id: string) => {
    const success = await deleteRecord(id);
    if (success) {
      loadData(activeFilters, currentPage, pageSize);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader 
        title="业务录入" 
        description="运单数据录入和管理" 
        icon={Package} 
        iconColor="text-blue-600" 
      />

      <FilterBar
        filters={uiFilters}
        projects={projects}
        onFilterChange={handleFilterChange}
        onDateChange={handleDateChange}
        onSearch={handleSearch}
        onClear={handleClear}
        onImport={() => {}}
        onUpdateImport={() => {}}
        isStale={isStale}
      />

      <LogisticsTable
        records={records}
        onEdit={(record) => {
          setEditingRecord(record);
          setIsFormDialogOpen(true);
        }}
        onDelete={handleDelete}
        currentPage={currentPage}
        pageSize={pageSize}
        totalPages={totalPages}
        totalRecords={totalCount}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        isLoading={isLoading}
        summary={summary}
        filters={activeFilters}
      />

      <LogisticsFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        record={editingRecord}
        onSuccess={() => {
          setIsFormDialogOpen(false);
          loadData(activeFilters, currentPage, pageSize);
        }}
      />

      <ImportDialog
        isOpen={isImportModalOpen}
        onClose={closeImportModal}
        importStep={importStep}
        importPreview={importPreview}
        importLogs={importLogs}
        onImport={handleExcelImport}
        onConfirm={executeFinalImport}
      />

      <UpdateModeImportDialog
        isOpen={isUpdateModalOpen}
        onClose={closeUpdateModal}
        importStep={updateStep}
        importPreview={updatePreview}
        importMode={importMode}
        onModeChange={setImportMode}
        importLogs={updateLogs}
        onImport={handleUpdateImport}
        onConfirm={executeUpdateImport}
      />
    </div>
  );
}
