// 业务录入 - 完整重构版本
import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Package } from 'lucide-react';
import { useLogisticsData, INITIAL_FILTERS } from './hooks/useLogisticsData';
import { LogisticsTable } from './components/LogisticsTable';
import { FilterBar } from './components/FilterBar';
import { LogisticsFormDialog } from './components/LogisticsFormDialog';
import { ImportDialog } from './components/ImportDialog';
import { UpdateModeImportDialog } from './components/UpdateModeImportDialog';
import { useExcelImport } from './hooks/useExcelImport';
import { useExcelImportWithUpdate } from './hooks/useExcelImportWithUpdate';
import type { LogisticsRecord, LogisticsFilters, Project } from '@/types/businessEntry';
import { supabase } from '@/integrations/supabase/client';

export default function BusinessEntry() {
  const {
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
    handlePageSizeChange
  } = useLogisticsData();

  const [projects, setProjects] = useState<Project[]>([]);
  const [editingRecord, setEditingRecord] = useState<LogisticsRecord | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);

  const {
    isImporting,
    isImportModalOpen,
    importStep,
    importPreview,
    approvedDuplicates,
    setApprovedDuplicates,
    importLogs,
    importLogRef,
    handleExcelImport,
    executeFinalImport,
    closeImportModal
  } = useExcelImport(refetch);

  const {
    isImporting: isUpdating,
    isImportModalOpen: isUpdateModalOpen,
    importStep: updateStep,
    importPreview: updatePreview,
    importMode,
    setImportMode,
    approvedDuplicates: updateApprovedDuplicates,
    setApprovedDuplicates: setUpdateApprovedDuplicates,
    importLogs: updateLogs,
    importLogRef: updateLogRef,
    handleExcelImport: handleUpdateImport,
    executeFinalImport: executeUpdateImport,
    closeImportModal: closeUpdateModal
  } = useExcelImportWithUpdate(refetch);

  useEffect(() => {
    const loadProjects = async () => {
      const { data } = await supabase.from('projects').select('id, name').order('name');
      setProjects(data || []);
    };
    loadProjects();
  }, []);

  const handleFiltersChange = useCallback((newFilters: LogisticsFilters) => {
    setActiveFilters(newFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [setActiveFilters, setPagination]);

  const handleSearch = useCallback(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    refetch();
  }, [setPagination, refetch]);

  const handleClear = useCallback(() => {
    setActiveFilters(INITIAL_FILTERS);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, [setPagination, setActiveFilters]);

  const handleDeleteRecord = async (id: string, autoNumber: string) => {
    await handleDelete(id);
    refetch();
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
        filters={activeFilters}
        onFiltersChange={handleFiltersChange}
        onSearch={handleSearch}
        onClear={handleClear}
        loading={loading}
        projects={projects}
      />

      <LogisticsTable
        records={records}
        loading={loading}
        pagination={pagination}
        setPagination={setPagination}
        onEdit={(record) => {
          setEditingRecord(record);
          setIsFormDialogOpen(true);
        }}
        onView={(record) => {
          setEditingRecord(record);
          setIsFormDialogOpen(true);
        }}
        onDelete={handleDeleteRecord}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onPageSizeChange={handlePageSizeChange}
        activeFilters={activeFilters}
      />

      <LogisticsFormDialog
        isOpen={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
        editingRecord={editingRecord}
        projects={projects}
        onSubmitSuccess={() => {
          setIsFormDialogOpen(false);
          refetch();
        }}
      />

      <ImportDialog
        isOpen={isImportModalOpen}
        onClose={closeImportModal}
        importStep={importStep}
        importPreview={importPreview}
        approvedDuplicates={approvedDuplicates}
        setApprovedDuplicates={setApprovedDuplicates}
        importLogs={importLogs}
        importLogRef={importLogRef}
        onExecuteImport={executeFinalImport}
      />

      <UpdateModeImportDialog
        isOpen={isUpdateModalOpen}
        onClose={closeUpdateModal}
        importStep={updateStep}
        importPreview={updatePreview}
        importMode={importMode}
        setImportMode={setImportMode}
        approvedDuplicates={updateApprovedDuplicates}
        setApprovedDuplicates={setUpdateApprovedDuplicates}
        importLogs={updateLogs}
        importLogRef={updateLogRef}
        onExecuteImport={executeUpdateImport}
      />
    </div>
  );
}
