// 文件路径: src/pages/BusinessEntry.tsx

// 1. 导入所有需要的工具和组件
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Download, FileDown, FileUp, PlusCircle, Edit, Trash2, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreatableCombobox } from "@/components/CreatableCombobox";
import { Progress } from "@/components/ui/progress";

// 2. TypeScript 类型定义
interface LogisticsRecord {
  id: string; auto_number: string; project_id: string; project_name: string; chain_id: string | null; chain_name: string | null;
  driver_id: string; driver_name: string; loading_location: string; unloading_location: string; loading_date: string;
  unloading_date: string | null;
  loading_weight: number | null; unloading_weight: number | null; current_cost: number | null; 
  payable_cost: number | null;
  license_plate: string | null; driver_phone: string | null; transport_type: string | null;
  extra_cost: number | null; remarks: string | null;
}
interface Project { id: string; name:string; start_date: string; }
interface Driver { id: string; name: string; license_plate: string | null; phone: string | null; }
interface Location { id: string; name: string; }
interface PartnerChain { id: string; chain_name: string; }

// 3. 辅助函数和常量定义
const getInitialDefaultDates = () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    return { startDate: formatDate(firstDayOfMonth), endDate: formatDate(today) };
};

const BLANK_FORM_DATA = {
  project_id: "", chain_id: "", driver_id: "", driver_name: "", loading_location: "", unloading_location: "",
  loading_date: new Date().toISOString().split('T')[0], unloading_date: new Date().toISOString().split('T')[0],
  loading_weight: null, unloading_weight: null, current_cost: null, license_plate: "", driver_phone: "",
  transport_type: "实际运输", extra_cost: null, 
  payable_cost: null,
  remarks: ""
};

// 4. 主组件定义
export default function BusinessEntry() {
  // 5. 状态管理 (useState)
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [partnerChains, setPartnerChains] = useState<PartnerChain[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LogisticsRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecord | null>(null);
  
  const [formData, setFormData] = useState<any>(BLANK_FORM_DATA);
  const [filters, setFilters] = useState({ 
    startDate: getInitialDefaultDates().startDate, 
    endDate: getInitialDefaultDates().endDate, 
    searchQuery: "" 
  });
  
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 15;

  // 导入功能的状态
  const [isImporting, setIsImporting] = useState(false); // 控制“选择文件”按钮的加载状态
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false); // 控制预览弹窗的开关
  const [importData, setImportData] = useState<{valid: any[], invalid: any[], duplicateCount: number}>({ valid: [], invalid: [], duplicateCount: 0 }); // 存储从Excel解析的数据
  const [importProgress, setImportProgress] = useState(0); // 实时导入进度 (0-100)
  const [isProcessingImport, setIsProcessingImport] = useState(false); // 控制“确认导入”后的处理状态，用于显示进度条
  
  const navigate = useNavigate();

  // 6. 数据加载逻辑 (useCallback & useEffect)
  const loadInitialOptions = useCallback(async () => {
    try {
      const { data: projectsData } = await supabase.from('projects').select('id, name, start_date');
      setProjects(projectsData as Project[] || []);
      const { data: driversData } = await supabase.from('drivers').select('id, name, license_plate, phone');
      setDrivers(driversData as Driver[] || []);
      const { data: locationsData } = await supabase.from('locations').select('id, name');
      setLocations(locationsData || []);
    } catch (error) { toast({ title: "错误", description: "加载筛选选项失败", variant: "destructive" }); }
  }, [toast]);

  const loadPaginatedRecords = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const { data, error } = await supabase.rpc('get_paginated_logistics_records', {
        p_page_size: PAGE_SIZE,
        p_offset: offset,
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_search_query: filters.searchQuery || null,
      });
      if (error) throw error;
      setRecords(data.records || []);
      setTotalPages(Math.ceil(data.total_count / PAGE_SIZE) || 1);
    } catch (error) {
      toast({ title: "错误", description: "加载运单记录失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters, toast]);

  // 7. 副作用管理 (useEffect)
  useEffect(() => { loadInitialOptions(); }, [loadInitialOptions]);
  useEffect(() => { loadPaginatedRecords(); }, [loadPaginatedRecords]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage !== 1) setCurrentPage(1);
      else loadPaginatedRecords();
    }, 500);
    return () => clearTimeout(timer);
  }, [filters]);

  const handleInputChange = (field: string, value: any) => { setFormData((prev: any) => ({ ...prev, [field]: value })); };

  useEffect(() => {
    handleInputChange('chain_id', '');
    if (formData.project_id) {
      const fetchRelatedData = async () => {
        const { data: chainsData } = await supabase.from('partner_chains').select('id, chain_name').eq('project_id', formData.project_id);
        setPartnerChains(chainsData as PartnerChain[] || []);
        const { data: driverLinks } = await supabase.from('driver_projects').select('driver_id').eq('project_id', formData.project_id);
        const driverIds = driverLinks?.map(link => link.driver_id) || [];
        setFilteredDrivers(drivers.filter(driver => driverIds.includes(driver.id)));
        const { data: locationLinks } = await supabase.from('location_projects').select('location_id').eq('project_id', formData.project_id);
        const locationIds = locationLinks?.map(link => link.location_id) || [];
        setFilteredLocations(locations.filter(location => locationIds.includes(location.id)));
      };
      fetchRelatedData();
    } else {
      setPartnerChains([]);
      setFilteredDrivers([]);
      setFilteredLocations([]);
    }
  }, [formData.project_id, drivers, locations]);

  useEffect(() => {
    const selectedDriver = drivers.find(d => d.id === formData.driver_id);
    if (selectedDriver) {
      setFormData((prev: any) => ({
        ...prev,
        driver_name: selectedDriver.name,
        license_plate: selectedDriver.license_plate || prev.license_plate || '',
        driver_phone: selectedDriver.phone || prev.driver_phone || '',
      }));
    }
  }, [formData.driver_id, drivers]);

  useEffect(() => {
    const currentCost = parseFloat(formData.current_cost) || 0;
    const extraCost = parseFloat(formData.extra_cost) || 0;
    handleInputChange('payable_cost', (currentCost + extraCost > 0) ? (currentCost + extraCost).toFixed(2) : null);
  }, [formData.current_cost, formData.extra_cost]);
  
  useEffect(() => {
    if (formData.loading_date && !formData.unloading_date) {
      handleInputChange('unloading_date', formData.loading_date);
    }
  }, [formData.loading_date]);

  // 8. 事件处理器 (Handlers)
  const handleOpenModal = (record: LogisticsRecord | null = null) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        project_id: record.project_id, chain_id: record.chain_id || "", driver_id: record.driver_id, driver_name: record.driver_name,
        loading_location: record.loading_location, unloading_location: record.unloading_location, loading_date: record.loading_date,
        unloading_date: record.unloading_date || record.loading_date,
        loading_weight: record.loading_weight, unloading_weight: record.unloading_weight, current_cost: record.current_cost,
        license_plate: record.license_plate, driver_phone: record.driver_phone, transport_type: record.transport_type || '实际运输',
        extra_cost: record.extra_cost, 
        payable_cost: record.payable_cost,
        remarks: record.remarks
      });
    } else {
      const latestProject = [...projects].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))[0];
      setEditingRecord(null);
      setFormData({ ...BLANK_FORM_DATA, project_id: latestProject ? latestProject.id : "" });
    }
    setIsEditModalOpen(true);
  };
  
  const handleSubmit = async () => {
    const projectName = projects.find(p => p.id === formData.project_id)?.name;
    if (!projectName || !formData.driver_name || !formData.loading_location || !formData.unloading_location) {
      toast({ title: "错误", description: "项目、司机和地点为必填项", variant: "destructive" }); return;
    }
    
    let finalDriverId = formData.driver_id;
    let finalDriverName = formData.driver_name;
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(formData.driver_id);
    if (!isUuid) {
        const { data: driverResult, error: driverError } = await supabase.rpc('get_or_create_driver', {
            p_driver_name: formData.driver_name, p_license_plate: formData.license_plate, p_phone: formData.driver_phone, p_project_id: formData.project_id
        });
        if (driverError || !driverResult || driverResult.length === 0) { toast({ title: "错误", description: "处理司机信息失败", variant: "destructive" }); return; }
        finalDriverId = driverResult[0].driver_id;
        finalDriverName = driverResult[0].driver_name;
    }

    await supabase.rpc('get_or_create_location', { p_location_name: formData.loading_location, p_project_id: formData.project_id });
    await supabase.rpc('get_or_create_location', { p_location_name: formData.unloading_location, p_project_id: formData.project_id });

    const recordData = {
      p_project_id: formData.project_id, p_project_name: projectName, p_chain_id: formData.chain_id || null,
      p_driver_id: finalDriverId, p_driver_name: finalDriverName,
      p_loading_location: formData.loading_location, p_unloading_location: formData.unloading_location,
      p_loading_date: formData.loading_date, p_unloading_date: formData.unloading_date || null,
      p_loading_weight: formData.loading_weight ? parseFloat(formData.loading_weight) : null,
      p_unloading_weight: formData.unloading_weight ? parseFloat(formData.unloading_weight) : null,
      p_current_cost: formData.current_cost ? parseFloat(formData.current_cost) : null,
      p_license_plate: formData.license_plate, p_driver_phone: formData.driver_phone,
      p_transport_type: formData.transport_type,
      p_extra_cost: formData.extra_cost ? parseFloat(formData.extra_cost) : null,
      p_remarks: formData.remarks
    };
    
    try {
      if (editingRecord) {
        await supabase.rpc('update_logistics_record_with_costs', { p_record_id: editingRecord.id, ...recordData });
        toast({ title: "成功", description: "运单记录已更新" });
      } else {
        await supabase.rpc('add_logistics_record_with_costs', recordData);
        toast({ title: "成功", description: "新运单已添加" });
      }
      setIsEditModalOpen(false); 
      loadPaginatedRecords();
      loadInitialOptions();
    } catch (error: any) { toast({ title: "操作失败", description: error.message, variant: "destructive" }); }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('logistics_records').delete().eq('id', id);
      toast({ title: "成功", description: "运单记录已删除" });
      loadPaginatedRecords();
    } catch (error: any) { toast({ title: "删除失败", description: error.message, variant: "destructive" }); }
  };

  // 9. 计算属性 (useMemo)
  const summary = useMemo(() => {
    return (records || []).reduce((acc, record) => {
      acc.totalLoadingWeight += record.loading_weight || 0;
      acc.totalUnloadingWeight += record.unloading_weight || 0;
      acc.totalCurrentCost += record.current_cost || 0;
      acc.totalExtraCost += record.extra_cost || 0;
      acc.totalDriverPayableCost += record.payable_cost || 0;
      if (record.transport_type === '实际运输') acc.actualCount += 1;
      else if (record.transport_type === '退货') acc.returnCount += 1;
      return acc;
    }, {
      totalLoadingWeight: 0,
      totalUnloadingWeight: 0,
      totalCurrentCost: 0,
      totalExtraCost: 0,
      totalDriverPayableCost: 0,
      actualCount: 0,
      returnCount: 0,
    });
  }, [records]);

  // 10. 辅助功能函数
  const exportToExcel = async () => {
    toast.info("正在准备导出全部筛选结果...");
    try {
        const { data, error } = await supabase.rpc('get_paginated_logistics_records', {
            p_page_size: 99999, p_offset: 0,
            p_start_date: filters.startDate || null,
            p_end_date: filters.endDate || null,
            p_search_query: filters.searchQuery || null,
        });
        if (error) throw error;
        
        const dataToExport = data.records.map((r: LogisticsRecord) => ({
          '运单编号': r.auto_number, '项目名称': r.project_name, '合作链路': r.chain_name || '默认',
          '司机姓名': r.driver_name, '车牌号': r.license_plate, '司机电话': r.driver_phone,
          '装货地点': r.loading_location, '卸货地点': r.unloading_location, '装货日期': r.loading_date, '卸货日期': r.unloading_date,
          '运输类型': r.transport_type, '装货重量': r.loading_weight, '卸货重量': r.unloading_weight,
          '运费金额': r.current_cost, '额外费用': r.extra_cost, 
          '司机应收': r.payable_cost,
          '备注': r.remarks,
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "运单记录");
        XLSX.writeFile(wb, "运单记录.xlsx");
        toast.success("全部筛选结果已成功导出！");
    } catch(e) {
        toast.error("导出失败，请重试。");
    }
  };
  
  const handleTemplateDownload = () => {
    const templateData = [{'项目名称': '', '合作链路': '', '司机姓名': '', '车牌号': '', '司机电话': '', '装货地点': '', '卸货地点': '', '装货日期': '', '卸货日期': '', '运输类型': '实际运输', '装货重量': '', '卸货重量': '', '运费金额': '', '额外费用': '', '备注': ''}];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "模板");
    XLSX.writeFile(wb, "运单导入模板.xlsx");
  };
  
  // 【核心功能实现】处理Excel文件导入
  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    toast.info("正在读取并预处理Excel文件...");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const validRows: any[] = [];
            const invalidRows: any[] = [];
            const uniqueKeys = new Set<string>();
            let duplicateCount = 0;

            jsonData.forEach((row: any, index) => {
                const rowData = { ...row, originalRow: index + 2, error: '' };
                
                try { // 【核心修复】增加内部try...catch，防止单行错误导致整个流程崩溃
                    const projectName = rowData['项目名称']?.trim();
                    const driverName = rowData['司机姓名']?.trim();
                    const loadingLocation = rowData['装货地点']?.trim();
                    const unloadingLocation = rowData['卸货地点']?.trim();
                    const loadingDateRaw = rowData['装货日期'];

                    if (!projectName || !driverName || !loadingLocation || !unloadingLocation || !loadingDateRaw) {
                        throw new Error("缺少必填字段（项目/司机/地点/装货日期）");
                    }
                    if (!(loadingDateRaw instanceof Date && !isNaN(loadingDateRaw.getTime()))) {
                        throw new Error("“装货日期”格式不正确");
                    }
                    if (!projects.some(p => p.name === projectName)) {
                        throw new Error(`项目 "${projectName}" 不存在`);
                    }

                    const uniqueKey = `${projectName}-${driverName}-${loadingLocation}-${unloadingLocation}-${format(loadingDateRaw, 'yyyy-MM-dd')}`;
                    if (uniqueKeys.has(uniqueKey)) {
                        rowData.error = "重复数据";
                        duplicateCount++;
                        invalidRows.push(rowData);
                    } else {
                        uniqueKeys.add(uniqueKey);
                        validRows.push(rowData);
                    }
                } catch (err: any) {
                    rowData.error = err.message;
                    invalidRows.push(rowData);
                }
            });
            
            setImportData({ valid: validRows, invalid: invalidRows, duplicateCount });
            setIsImportPreviewOpen(true);
            toast.success("文件预处理完成，请确认导入数据。");

        } catch (error) {
            toast.error("文件处理失败，请检查文件格式是否与模板一致。");
        } finally {
            setIsImporting(false);
            if(event.target) event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const startActualImport = async () => {
    setIsProcessingImport(true);
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const [index, rowData] of importData.valid.entries()) {
      try {
        setImportProgress(((index + 1) / importData.valid.length) * 100);
        
        const project = projects.find(p => p.name === rowData['项目名称'].trim())!;
        
        const { data: driverResult, error: driverError } = await supabase.rpc('get_or_create_driver', {
            p_driver_name: rowData['司机姓名'].trim(),
            p_license_plate: rowData['车牌号']?.toString().trim() || null,
            p_phone: rowData['司机电话']?.toString().trim() || null,
            p_project_id: project.id
        });
        if (driverError || !driverResult || driverResult.length === 0) throw new Error("处理司机信息失败");
        const finalDriver = driverResult[0];

        await supabase.rpc('get_or_create_location', { p_location_name: rowData['装货地点'].trim(), p_project_id: project.id });
        await supabase.rpc('get_or_create_location', { p_location_name: rowData['卸货地点'].trim(), p_project_id: project.id });

        let chainId = null;
        const chainName = rowData['合作链路']?.trim();
        if(chainName){
            const {data: chainData} = await supabase.from('partner_chains').select('id').eq('project_id', project.id).eq('chain_name', chainName).single();
            if(chainData) chainId = chainData.id;
        }
        
        const recordData = {
            p_project_id: project.id,
            p_project_name: project.name,
            p_chain_id: chainId,
            p_driver_id: finalDriver.driver_id,
            p_driver_name: finalDriver.driver_name,
            p_loading_location: rowData['装货地点'].trim(),
            p_unloading_location: rowData['卸货地点'].trim(),
            p_loading_date: format(new Date(rowData['装货日期']), 'yyyy-MM-dd'),
            p_unloading_date: rowData['卸货日期'] ? format(new Date(rowData['卸货日期']), 'yyyy-MM-dd') : format(new Date(rowData['装货日期']), 'yyyy-MM-dd'),
            p_loading_weight: parseFloat(rowData['装货重量']) || null,
            p_unloading_weight: parseFloat(rowData['卸货重量']) || null,
            p_current_cost: parseFloat(rowData['运费金额']) || 0,
            p_extra_cost: parseFloat(rowData['额外费用']) || 0,
            p_license_plate: rowData['车牌号']?.toString().trim() || null,
            p_driver_phone: rowData['司机电话']?.toString().trim() || null,
            p_transport_type: rowData['运输类型']?.trim() || '实际运输',
            p_remarks: rowData['备注']?.toString().trim() || null
        };
        
        const { error: insertError } = await supabase.rpc('add_logistics_record_with_costs', recordData);
        if(insertError) throw insertError;

        successCount++;
      } catch (err: any) {
        errorCount++;
        errors.push(`Excel第 ${rowData.originalRow} 行: ${err.message}`);
      }
    }

    if (errorCount > 0) {
      console.error("导入失败的详细信息:", errors);
      toast.error(`导入完成，但有 ${errorCount} 条记录失败。`, { 
          description: `前几条错误: ${errors.slice(0, 3).join('; ')}...`
      });
    }
    if (successCount > 0) {
      toast.success(`成功导入 ${successCount} 条运单记录！`);
      loadPaginatedRecords();
    }
    setIsProcessingImport(false);
  };

  const closeImportModal = () => {
    setIsImportPreviewOpen(false);
    setImportData({ valid: [], invalid: [], duplicateCount: 0 });
    setImportProgress(0);
  }

  // 11. 渲染UI (return)
  return (
    <div className="space-y-4">
      {/* ... 页面标题、按钮、筛选器、表格、分页、汇总栏、编辑和详情弹窗 ... */}

      {/* 【新增】导入预览弹窗 */}
      <Dialog open={isImportPreviewOpen} onOpenChange={(isOpen) => !isOpen && closeImportModal()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>导入预览与确认</DialogTitle></DialogHeader>
          {isProcessingImport ? (
            <div className="py-8 text-center space-y-4">
              <h3 className="font-semibold">正在导入数据...</h3>
              <Progress value={importProgress} className="w-full" />
              <p className="text-sm text-muted-foreground">已处理 {Math.round(importProgress / 100 * importData.valid.length)} / {importData.valid.length} 条记录</p>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center bg-muted p-4 rounded-md mb-4">
                <div className="space-y-1">
                  <p>共发现 <strong>{importData.valid.length + importData.invalid.length}</strong> 条记录</p>
                  <p className="text-green-600"><strong>{importData.valid.length}</strong> 条记录格式正确，可以导入</p>
                  {importData.duplicateCount > 0 && <p className="text-yellow-600"><strong>{importData.duplicateCount}</strong> 条重复记录将被自动忽略</p>}
                  {importData.invalid.length > 0 && <p className="text-red-600"><strong>{importData.invalid.length - importData.duplicateCount}</strong> 条记录存在格式错误，将被忽略</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={closeImportModal}>取消</Button>
                  <Button onClick={startActualImport} disabled={importData.valid.length === 0}>
                    确认并开始导入 ({importData.valid.length})
                  </Button>
                </div>
              </div>
              {(importData.invalid.length > 0) && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">错误与重复记录预览 (最多显示5条)</h4>
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>行号</TableHead><TableHead>项目</TableHead><TableHead>司机</TableHead><TableHead>错误原因</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {importData.invalid.slice(0, 5).map(row => (
                          <TableRow key={row.originalRow} className="bg-red-50">
                            <TableCell>{row.originalRow}</TableCell>
                            <TableCell>{row['项目名称']}</TableCell>
                            <TableCell>{row['司机姓名']}</TableCell>
                            <TableCell className="text-red-700">{row.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
