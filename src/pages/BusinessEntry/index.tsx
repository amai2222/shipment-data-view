// 最终文件路径: src/pages/BusinessEntry/index.tsx
// 描述: [最终完整版] 修复了分页栏布局，使其保持单行显示，并完成了分页控件的汉化。

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileDown, FileUp, Loader2, Search, Plus, MoreHorizontal, ArrowUpDown, FileText, CheckSquare, Square, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { Project, LogisticsRecord } from './types';
import { useLogisticsData, INITIAL_FILTERS, TotalSummary, LogisticsFilters } from './hooks/useLogisticsData';
import { useExcelImport } from './hooks/useExcelImport';
import { FilterBar } from './components/FilterBar';
import { EnhancedImportDialog } from './components/EnhancedImportDialog';
import { LogisticsFormDialog } from './components/LogisticsFormDialog';
import { WaybillDetailDialog } from '@/components/WaybillDetailDialog';
import { generatePrintVersion } from '@/components/TransportDocumentGenerator';
import { BatchPDFGenerator } from '@/components/BatchPDFGenerator';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LogisticsTable } from './components/LogisticsTable';

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || isNaN(value)) return '¥0.00';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(value);
};

const SummaryDisplay = ({ totalSummary, activeFilters }: { totalSummary: TotalSummary, activeFilters: LogisticsFilters }) => {
  const summaryTitle = useMemo(() => {
    const parts: string[] = [];
    if (activeFilters.projectName) { parts.push(`项目: ${activeFilters.projectName}`); }
    if (activeFilters.driverName) { parts.push(`司机: ${activeFilters.driverName}`); }
    if (activeFilters.licensePlate) { parts.push(`车牌: ${activeFilters.licensePlate}`); }
    if (activeFilters.driverPhone) { parts.push(`电话: ${activeFilters.driverPhone}`); }
    if (activeFilters.startDate && activeFilters.endDate) { parts.push(`日期: ${activeFilters.startDate} 至 ${activeFilters.endDate}`); }
    else if (activeFilters.startDate) { parts.push(`日期: 从 ${activeFilters.startDate}`); }
    else if (activeFilters.endDate) { parts.push(`日期: 截至 ${activeFilters.endDate}`); }
    if (parts.length === 0) { return "全部记录合计"; }
    return `${parts.join(' | ')} 合计`;
  }, [activeFilters]);

  return (
    <div className="flex items-center justify-start gap-x-6 rounded-lg border p-4 text-sm font-medium flex-nowrap overflow-x-auto scrollbar-thin">
      <span className="font-bold whitespace-nowrap">{summaryTitle}:</span>
      <span className="whitespace-nowrap">{totalSummary.actualCount}实际 / {totalSummary.returnCount}退货</span>
      <span className="whitespace-nowrap">司机运费: <span className="font-bold text-primary">{formatCurrency(totalSummary.totalCurrentCost)}</span></span>
      <span className="whitespace-nowrap">额外费用: <span className="font-bold text-orange-600">{formatCurrency(totalSummary.totalExtraCost)}</span></span>
      <span className="whitespace-nowrap">司机应收: <span className="font-bold text-green-600">{formatCurrency(totalSummary.totalDriverPayableCost)}</span></span>
      {totalSummary.totalWeightLoading > 0 && (
        <span className="whitespace-nowrap">计重合计: 装 <span className="font-bold text-primary">{totalSummary.totalWeightLoading.toFixed(2)}吨</span> / 卸 <span className="font-bold text-primary">{totalSummary.totalWeightUnloading.toFixed(2)}吨</span></span>
      )}
      {totalSummary.totalTripsLoading > 0 && (
        <span className="whitespace-nowrap">计车合计: <span className="font-bold text-primary">{totalSummary.totalTripsLoading.toFixed(0)}车</span></span>
      )}
      {totalSummary.totalVolumeLoading > 0 && (
        <span className="whitespace-nowrap">计体积合计: 装 <span className="font-bold text-primary">{totalSummary.totalVolumeLoading.toFixed(2)}立方</span> / 卸 <span className="font-bold text-primary">{totalSummary.totalVolumeUnloading.toFixed(2)}立方</span></span>
      )}
    </div>
  );
};

const PageSummaryFooter = ({ records }: { records: LogisticsRecord[] }) => {
  const pageSummary = useMemo(() => {
    return records.reduce((acc, record) => {
      acc.currentCost += record.current_cost || 0;
      acc.extraCost += record.extra_cost || 0;
      acc.payableCost += record.payable_cost || 0;
      return acc;
    }, { currentCost: 0, extraCost: 0, payableCost: 0 });
  }, [records]);

  return (
    <div className="text-sm text-muted-foreground whitespace-nowrap">
      <span className="font-bold">本页合计:</span>
      <span className="ml-2">运费 {formatCurrency(pageSummary.currentCost)}</span>
      <span className="ml-2">额外 {formatCurrency(pageSummary.extraCost)}</span>
      <span className="ml-2">应付款司机 <span className="font-semibold text-primary">{formatCurrency(pageSummary.payableCost)}</span></span>
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
  const { isAdmin } = usePermissions();
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecord | null>(null);
  const [uiFilters, setUiFilters] = useState(INITIAL_FILTERS);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LogisticsRecord | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<LogisticsRecord[]>([]);
  const [isBatchPDFOpen, setIsBatchPDFOpen] = useState(false);
  const { records, loading, activeFilters, setActiveFilters, pagination, setPagination, totalSummary, handleDelete, refetch, sortField, sortDirection, handleSort, handlePageSizeChange } = useLogisticsData();
  const { isImporting, isImportModalOpen, importStep, importPreview, approvedDuplicates, duplicateActions, importLogs, importLogRef, handleExcelImport, executeFinalImport, closeImportModal, setApprovedDuplicates, setDuplicateActions } = useExcelImport(() => { refetch(); });
  const isSummaryStale = useMemo(() => JSON.stringify(uiFilters) !== JSON.stringify(activeFilters), [uiFilters, activeFilters]);

  const loadInitialOptions = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('projects').select('id, name, start_date, end_date, manager, loading_address, unloading_address, project_status');
      if (error) throw error;
      setProjects(data || []);
    } catch (error) { toast({ title: "错误", description: "加载项目列表失败", variant: "destructive" }); }
  }, [toast]);

  useEffect(() => { loadInitialOptions(); }, [loadInitialOptions]);

  const handleSearch = () => {
    setActiveFilters(uiFilters);
    if (pagination.currentPage !== 1) { setPagination(p => ({ ...p, currentPage: 1 })); }
  };

  const handleClearSearch = () => {
    setUiFilters(INITIAL_FILTERS);
    setActiveFilters(INITIAL_FILTERS);
    if (pagination.currentPage !== 1) { setPagination(p => ({ ...p, currentPage: 1 })); }
  };

  const exportToExcel = async () => {
    toast({ title: "导出", description: "正在准备导出全部筛选结果..." });
    try {
      let query = supabase.from('logistics_records_view').select('*');
      if (activeFilters.projectName) query = query.eq('project_name', activeFilters.projectName);
      if (activeFilters.driverName) query = query.ilike('driver_name', `%${activeFilters.driverName}%`);
      if (activeFilters.licensePlate) query = query.ilike('license_plate', `%${activeFilters.licensePlate}%`);
      if (activeFilters.driverPhone) query = query.ilike('driver_phone', `%${activeFilters.driverPhone}%`);
      if (activeFilters.startDate) query = query.gte('loading_date', activeFilters.startDate);
      if (activeFilters.endDate) query = query.lte('loading_date', activeFilters.endDate);
      
      const { data, error } = await query.order('created_at', { ascending: false }).limit(10000);
      if (error) throw error;

      const dataToExport = data.map((r: any) => ({
        '运单编号': r.auto_number, '项目名称': r.project_name, '合作链路': r.chain_name || '默认', '司机姓名': r.driver_name, '车牌号': r.license_plate, '司机电话': r.driver_phone, '装货地点': r.loading_location, '卸货地点': r.unloading_location, '装货日期': r.loading_date, '卸货日期': r.unloading_date, '运输类型': r.transport_type, '装货重量': r.loading_weight, '卸货重量': r.unloading_weight, '运费金额': r.current_cost, '额外费用': r.extra_cost, '司机应收': r.payable_cost, '备注': r.remarks,
      }));
      
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "运单记录");
      XLSX.writeFile(wb, "运单记录.xlsx");
      toast({ title: "成功", description: `已成功导出 ${data.length} 条记录！` });
    } catch(e: any) {
      toast({ title: "错误", description: `导出失败: ${e.message}`, variant: "destructive" });
    }
  };

  const handleTemplateDownload = () => {
    const templateData = [
      {
        '项目名称': '示例项目A',
        '合作链路': '默认链路',
        '司机姓名': '张三',
        '车牌号': '京A12345',
        '司机电话': '13800138000',
        '装货地点': '北京仓库|天津仓库',
        '卸货地点': '上海仓库|苏州仓库',
        '装货日期': '2025-01-20',
        '卸货日期': '2025-01-21',
        '装货数量': '25.5',
        '卸货数量': '25.3',
        '运费金额': '1500.00',
        '额外费用': '100.00',
        '运输类型': '实际运输',
        '备注': '正常运输',
        '其他平台名称': '货拉拉,满帮',
        '其他平台运单号': 'HL20250120001|HL20250120002,MB20250120001'
      },
      {
        '项目名称': '示例项目B',
        '合作链路': '',
        '司机姓名': '李四',
        '车牌号': '沪B67890',
        '司机电话': '13900139000',
        '装货地点': '上海仓库',
        '卸货地点': '广州仓库|深圳仓库|东莞仓库',
        '装货日期': '2025-01-20',
        '卸货日期': '',
        '装货数量': '30.0',
        '卸货数量': '29.8',
        '运费金额': '2000.00',
        '额外费用': '0.00',
        '运输类型': '实际运输',
        '备注': '',
        '其他平台名称': '货拉拉',
        '其他平台运单号': 'HL20250120003|HL20250120004'
      },
      {
        '项目名称': '',
        '合作链路': '',
        '司机姓名': '',
        '车牌号': '',
        '司机电话': '',
        '装货地点': '',
        '卸货地点': '',
        '装货日期': '',
        '卸货日期': '',
        '装货数量': '',
        '卸货数量': '',
        '运费金额': '',
        '额外费用': '',
        '运输类型': '实际运输',
        '备注': '',
        '其他平台名称': '',
        '其他平台运单号': ''
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    
    // 设置列宽
    const colWidths = [
      { wch: 15 }, // 项目名称
      { wch: 15 }, // 合作链路
      { wch: 12 }, // 司机姓名
      { wch: 12 }, // 车牌号
      { wch: 15 }, // 司机电话
      { wch: 15 }, // 装货地点
      { wch: 15 }, // 卸货地点
      { wch: 12 }, // 装货日期
      { wch: 12 }, // 卸货日期
      { wch: 12 }, // 装货数量
      { wch: 12 }, // 卸货数量
      { wch: 12 }, // 运费金额
      { wch: 12 }, // 额外费用
      { wch: 12 }, // 运输类型
      { wch: 15 }, // 备注
      { wch: 20 }, // 其他平台名称
      { wch: 25 }  // 其他平台运单号
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, "运单导入模板");
    XLSX.writeFile(wb, "运单导入模板.xlsx");
  };

  const handleOpenAddDialog = () => {
    setEditingRecord(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenEditDialog = (record: LogisticsRecord) => {
    setEditingRecord(record);
    setIsFormDialogOpen(true);
  };

  const handleFormDialogClose = () => {
    setIsFormDialogOpen(false);
    setEditingRecord(null);
  };

  const handleFormSubmitSuccess = () => {
    refetch();
  };

  // 批量操作处理
  const handleBatchAction = (selectedIds: string[], action: string) => {
    if (action === 'generatePDF') {
      const selectedRecordsData = records.filter(record => selectedIds.includes(record.id));
      setSelectedRecords(selectedRecordsData);
      setIsBatchPDFOpen(true);
    }
  };

  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    if (isBatchMode) {
      setSelectedRecords([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">运单管理</h1>
          <p className="text-muted-foreground">查询、导入、导出和管理所有运单记录</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={isBatchMode ? "default" : "outline"} 
            onClick={toggleBatchMode}
            className={isBatchMode ? "bg-blue-600 text-white" : ""}
          >
            <CheckSquare className="mr-2 h-4 w-4" />
            {isBatchMode ? "退出批量模式" : "批量选择"}
          </Button>
          {isAdmin && (
            <Button onClick={handleOpenAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              新增运单
            </Button>
          )}
          <Button variant="outline" onClick={handleTemplateDownload}><FileDown className="mr-2 h-4 w-4" />下载模板</Button>
          {isAdmin && (
            <Button variant="outline" asChild disabled={loading || isImporting}>
              <Label htmlFor="excel-upload" className="cursor-pointer flex items-center">
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                导入Excel
                <Input id="excel-upload" type="file" className="hidden" onChange={handleExcelImport} accept=".xlsx, .xls" disabled={loading || isImporting}/>
              </Label>
            </Button>
          )}
          <Button onClick={exportToExcel} disabled={loading}><Download className="mr-2 h-4 w-4" />导出数据</Button>
        </div>
      </div>
      <FilterBar filters={uiFilters} onFiltersChange={setUiFilters} onSearch={handleSearch} onClear={handleClearSearch} loading={loading} projects={projects} />
      {!isSummaryStale && !loading && (<SummaryDisplay totalSummary={totalSummary} activeFilters={activeFilters} />)}
      {isSummaryStale ? (<StaleDataPrompt />) : (<LogisticsTable records={records} loading={loading} pagination={pagination} setPagination={setPagination} onDelete={handleDelete} onView={setViewingRecord} onEdit={handleOpenEditDialog} sortField={sortField} sortDirection={sortDirection} onSort={handleSort} onPageSizeChange={handlePageSizeChange} onBatchAction={handleBatchAction} isBatchMode={isBatchMode} onToggleBatchMode={toggleBatchMode} />)}
      {isAdmin && <EnhancedImportDialog isOpen={isImportModalOpen} onClose={closeImportModal} importStep={importStep} importPreview={importPreview} approvedDuplicates={approvedDuplicates} setApprovedDuplicates={setApprovedDuplicates} duplicateActions={duplicateActions} setDuplicateActions={setDuplicateActions} importLogs={importLogs} importLogRef={importLogRef} onExecuteImport={executeFinalImport} />}
      <LogisticsFormDialog
        isOpen={isFormDialogOpen}
        onClose={handleFormDialogClose}
        editingRecord={editingRecord}
        projects={projects}
        onSubmitSuccess={handleFormSubmitSuccess}
      />
      <WaybillDetailDialog 
        isOpen={!!viewingRecord} 
        onClose={() => setViewingRecord(null)} 
        record={viewingRecord} 
      />
      <BatchPDFGenerator
        isOpen={isBatchPDFOpen}
        onClose={() => setIsBatchPDFOpen(false)}
        selectedRecords={selectedRecords}
      />
    </div>
  );
}
