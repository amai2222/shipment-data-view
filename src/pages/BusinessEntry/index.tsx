// 业务录入 - 完整重构版本
import { useState, useEffect, useCallback, useRef } from 'react';
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
import type { LogisticsRecord, LogisticsFilters, Project } from '@/types/businessEntry';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { generatePrintVersion } from '@/components/TransportDocumentGenerator';

export default function BusinessEntry() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateFileInputRef = useRef<HTMLInputElement>(null);

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
  const [isBatchMode, setIsBatchMode] = useState(false);

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

  // 新建运单
  const handleCreateNew = useCallback(() => {
    setEditingRecord(null);
    setIsFormDialogOpen(true);
  }, []);

  // 导入
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 更新导入
  const handleUpdateImportClick = useCallback(() => {
    updateFileInputRef.current?.click();
  }, []);

  // 导出
  const handleExport = useCallback(async () => {
    try {
      toast({ title: "正在导出...", description: "请稍候" });
      
      // 获取所有符合筛选条件的记录
      const { data, error } = await supabase.rpc('get_logistics_summary_and_records_enhanced', {
        p_start_date: activeFilters.startDate || null,
        p_end_date: activeFilters.endDate || null,
        p_project_name: activeFilters.projectName || null,
        p_driver_name: activeFilters.driverName || null,
        p_license_plate: activeFilters.licensePlate || null,
        p_driver_phone: activeFilters.driverPhone || null,
        p_other_platform_name: activeFilters.otherPlatformName || null,
        p_waybill_numbers: activeFilters.waybillNumbers || null,
        p_has_scale_record: activeFilters.hasScaleRecord || null,
        p_page_number: 1,
        p_page_size: 10000, // 获取所有记录
        p_sort_field: sortField,
        p_sort_direction: sortDirection
      });

      if (error) throw error;

      const exportData = ((data as { records?: LogisticsRecord[] })?.records) || [];
      
      if (exportData.length === 0) {
        toast({ 
          title: "无数据可导出", 
          description: "当前筛选条件下没有数据",
          variant: "destructive" 
        });
        return;
      }

      // 格式化数据用于导出
      const formattedData = exportData.map((record) => ({
        '运单编号': record.auto_number,
        '项目名称': record.project_name,
        '合作链路': record.chain_name || '',
        '司机姓名': record.driver_name,
        '车牌号': record.license_plate || '',
        '司机电话': record.driver_phone || '',
        '装货地点': record.loading_location,
        '卸货地点': record.unloading_location,
        '装货日期': record.loading_date,
        '卸货日期': record.unloading_date || '',
        '装货数量': record.loading_weight || '',
        '卸货数量': record.unloading_weight || '',
        '运费金额': record.current_cost || '',
        '额外费用': record.extra_cost || '',
        '运输类型': record.transport_type || '',
        '备注': record.remarks || ''
      }));

      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '运单数据');
      
      const fileName = `运单数据_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({ 
        title: "导出成功", 
        description: `已导出 ${exportData.length} 条记录` 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '导出失败';
      toast({ 
        title: "导出失败", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  }, [activeFilters, sortField, sortDirection, toast]);

  // 批量操作
  const handleBatchAction = useCallback(async (selectedIds: string[], action: string) => {
    if (action === 'generatePDF') {
      try {
        const selectedRecords = records.filter(r => selectedIds.includes(r.id));
        
        toast({
          title: "正在生成PDF",
          description: `准备生成 ${selectedRecords.length} 份运输单据...`
        });

        // 生成所有PDF
        for (const record of selectedRecords) {
          const printHTML = await generatePrintVersion(record);
          const previewWindow = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes');
          if (previewWindow) {
            previewWindow.document.write(printHTML);
            previewWindow.document.close();
          }
          // 添加短暂延迟避免浏览器阻止弹窗
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        toast({
          title: "PDF生成完成",
          description: `已生成 ${selectedRecords.length} 份运输单据`
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'PDF生成失败';
        toast({
          title: "PDF生成失败",
          description: errorMessage,
          variant: "destructive"
        });
      }
    }
  }, [records, toast]);

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
        onCreateNew={handleCreateNew}
        onImport={handleImportClick}
        onUpdateImport={handleUpdateImportClick}
        onExport={handleExport}
        onToggleBatchMode={() => setIsBatchMode(!isBatchMode)}
        isBatchMode={isBatchMode}
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
        isBatchMode={isBatchMode}
        onToggleBatchMode={() => setIsBatchMode(!isBatchMode)}
        onBatchAction={handleBatchAction}
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

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleExcelImport}
      />
      <input
        ref={updateFileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleUpdateImport}
      />
    </div>
  );
}
