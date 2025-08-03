// src/pages/BusinessEntry/index.tsx

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileDown, FileUp, PlusCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";

// Import refactored components and hooks
import { Project, Driver, Location, LogisticsRecord } from './types';
import { useLogisticsData } from './hooks/useLogisticsData';
import { useLogisticsForm } from './hooks/useLogisticsForm';
import { useExcelImport } from './hooks/useExcelImport';
import { FilterBar } from './components/FilterBar';
import { LogisticsTable } from './components/LogisticsTable';
import { LogisticsFormDialog } from './components/LogisticsFormDialog';
import { ImportDialog } from './components/ImportDialog';

export default function BusinessEntry() {
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecord | null>(null);

  const { records, loading, filters, setFilters, pagination, setPagination, summary, handleDelete, refetch } = useLogisticsData();
  const { isModalOpen, setIsModalOpen, editingRecord, formData, dispatch, partnerChains, filteredDrivers, filteredLocations, handleOpenModal, handleSubmit } = useLogisticsForm(projects, drivers, locations, () => {
    refetch();
    loadInitialOptions();
  });
  const { isImporting, isImportModalOpen, importStep, importPreview, approvedDuplicates, importLogs, importLogRef, handleExcelImport, executeFinalImport, closeImportModal, setApprovedDuplicates } = useExcelImport(() => {
    refetch();
    loadInitialOptions();
  });

  const loadInitialOptions = useCallback(async () => {
    try {
      const { data: projectsData } = await supabase.from('projects').select('id, name, start_date'); setProjects(projectsData as Project[] || []);
      const { data: driversData } = await supabase.from('drivers').select('id, name, license_plate, phone'); setDrivers(driversData as Driver[] || []);
      const { data: locationsData } = await supabase.from('locations').select('id, name'); setLocations(locationsData || []);
    } catch (error) { toast({ title: "错误", description: "加载筛选选项失败", variant: "destructive" }); }
  }, [toast]);

  useEffect(() => {
    loadInitialOptions();
  }, [loadInitialOptions]);

  const exportToExcel = async () => {
    toast({ title: "导出", description: "正在准备导出全部筛选结果..." });
    try {
      const { data, error } = await supabase.from('logistics_records_view').select('*').ilike('any_text', `%${filters.searchQuery}%`).gte('loading_date', filters.startDate).lte('loading_date', filters.endDate).order('loading_date', { ascending: false }).limit(10000);
      if (error) throw error;
      const dataToExport = (data || []).map((r: LogisticsRecord) => ({ '运单编号': r.auto_number, '项目名称': r.project_name, '合作链路': r.chain_name || '默认', '司机姓名': r.driver_name, '车牌号': r.license_plate, '司机电话': r.driver_phone, '装货地点': r.loading_location, '卸货地点': r.unloading_location, '装货日期': r.loading_date.split('T')[0], '卸货日期': r.unloading_date ? r.unloading_date.split('T')[0] : '', '运输类型': r.transport_type, '装货重量': r.loading_weight, '卸货重量': r.unloading_weight, '运费金额': r.current_cost, '额外费用': r.extra_cost, '司机应收': r.payable_cost, '备注': r.remarks, }));
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "运单记录");
      XLSX.writeFile(wb, "运单记录.xlsx");
      toast({ title: "成功", description: "全部筛选结果已成功导出！" });
    } catch (e) { toast({ title: "错误", description: "导出失败，请重试。", variant: "destructive" }); }
  };

  const handleTemplateDownload = () => {
    const templateData = [{ '项目名称': '', '合作链路': '', '司机姓名': '', '车牌号': '', '司机电话': '', '装货地点': '', '卸货地点': '', '装货日期': '2025/01/14', '卸货日期': '2025/01/14', '运输类型': '实际运输', '装货重量': '', '卸货重量': '', '运费金额': '', '额外费用': '', '备注': '' }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "模板");
    XLSX.writeFile(wb, "运单导入模板.xlsx");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">运单管理</h1>
          <p className="text-muted-foreground">录入、查询和管理所有运单记录</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTemplateDownload}><FileDown className="mr-2 h-4 w-4" />下载模板</Button>
          <Button variant="outline" asChild disabled={loading || isImporting}>
            <Label htmlFor="excel-upload" className="cursor-pointer flex items-center">
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              导入Excel
              <Input id="excel-upload" type="file" className="hidden" onChange={handleExcelImport} accept=".xlsx, .xls" disabled={loading || isImporting} />
            </Label>
          </Button>
          <Button onClick={exportToExcel} disabled={loading}><Download className="mr-2 h-4 w-4" />导出数据</Button>
          <Button onClick={() => handleOpenModal()} disabled={loading}><PlusCircle className="mr-2 h-4 w-4" />新增运单</Button>
        </div>
      </div>

      <FilterBar filters={filters} setFilters={setFilters} loading={loading} />

      <LogisticsTable
        records={records}
        loading={loading}
        summary={summary}
        pagination={pagination}
        setPagination={setPagination}
        onEdit={handleOpenModal}
        onDelete={handleDelete}
        onView={setViewingRecord}
      />

      <LogisticsFormDialog
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSubmit={handleSubmit}
        editingRecord={editingRecord}
        formData={formData}
        dispatch={dispatch}
        projects={projects}
        filteredDrivers={filteredDrivers}
        filteredLocations={filteredLocations}
        partnerChains={partnerChains}
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
      
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>运单详情 (编号: {viewingRecord?.auto_number})</DialogTitle></DialogHeader>
          {viewingRecord && ( <div className="grid grid-cols-4 gap-x-4 gap-y-6 py-4 text-sm"><div className="space-y-1"><Label className="text-muted-foreground">项目</Label><p>{viewingRecord.project_name}</p></div><div className="space-y-1"><Label className="text-muted-foreground">合作链路</Label><p>{viewingRecord.chain_name || '默认'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">装货日期</Label><p>{viewingRecord.loading_date ? viewingRecord.loading_date.split('T')[0] : '-'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">卸货日期</Label><p>{viewingRecord.unloading_date ? viewingRecord.unloading_date.split('T')[0] : '-'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">司机</Label><p>{viewingRecord.driver_name}</p></div><div className="space-y-1"><Label className="text-muted-foreground">车牌号</Label><p>{viewingRecord.license_plate || '-'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">司机电话</Label><p>{viewingRecord.driver_phone || '-'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">运输类型</Label><p>{viewingRecord.transport_type}</p></div><div className="space-y-1"><Label className="text-muted-foreground">装货地点</Label><p>{viewingRecord.loading_location}</p></div><div className="space-y-1"><Label className="text-muted-foreground">装货重量</Label><p>{viewingRecord.loading_weight ? `${viewingRecord.loading_weight} 吨` : '-'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">卸货地点</Label><p>{viewingRecord.unloading_location}</p></div><div className="space-y-1"><Label className="text-muted-foreground">卸货重量</Label><p>{viewingRecord.unloading_weight ? `${viewingRecord.unloading_weight} 吨` : '-'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">运费金额</Label><p className="font-mono">{viewingRecord.current_cost != null ? `¥${viewingRecord.current_cost.toFixed(2)}` : '-'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">额外费用</Label><p className="font-mono text-orange-600">{viewingRecord.extra_cost != null ? `¥${viewingRecord.extra_cost.toFixed(2)}` : '-'}</p></div><div className="space-y-1 col-span-2"><Label className="text-muted-foreground">司机应收</Label><p className="font-mono font-bold text-primary">{viewingRecord.payable_cost != null ? `¥${viewingRecord.payable_cost.toFixed(2)}` : '-'}</p></div><div className="col-span-4 space-y-1"><Label className="text-muted-foreground">备注</Label><p className="min-h-[40px] whitespace-pre-wrap">{viewingRecord.remarks || '无'}</p></div></div> )}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setViewingRecord(null)}>关闭</Button><Button onClick={() => { if (viewingRecord) { handleOpenModal(viewingRecord); setViewingRecord(null); } }}>编辑此记录</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
