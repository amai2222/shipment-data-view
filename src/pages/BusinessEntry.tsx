// 文件路径: src/pages/BusinessEntry.tsx

// 1. 导入所有需要的工具和组件
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Download, FileDown, FileUp, PlusCircle, Edit, Trash2, Loader2, Siren } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreatableCombobox } from "@/components/CreatableCombobox";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// 2. TypeScript 类型定义
interface LogisticsRecord {
  id: string; auto_number: string; project_id: string; project_name: string; chain_id: string | null; chain_name: string | null;
  driver_id: string; driver_name: string; loading_location: string; unloading_location: string; loading_date: string;
  unloading_date: string | null;
  loading_weight: number | null; unloading_weight: number | null; current_cost: number | null;
  payable_cost: number | null;
  license_plate: string | null; driver_phone: string | null; transport_type: string | null;
  extra_cost: number | null; remarks: string | null;
  created_at?: string;
}
interface Project { id: string; name: string; start_date: string; }
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
  transport_type: "实际运输", extra_cost: null, payable_cost: null, remarks: ""
};

const parseExcelDate = (excelDate: any): string | null => {
  if (excelDate === null || excelDate === undefined || excelDate === '') return null;
  if (typeof excelDate === 'number' && excelDate > 0) {
    const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  if (excelDate instanceof Date) { return excelDate.toISOString().split('T')[0]; }
  if (typeof excelDate === 'string') {
    const dateStr = excelDate.split(' ')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  return null;
};

// 4. 主组件定义
export default function BusinessEntry() {
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
  const [filters, setFilters] = useState({ startDate: getInitialDefaultDates().startDate, endDate: getInitialDefaultDates().endDate, searchQuery: "" });
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 15;
  const navigate = useNavigate();
  const [isImporting, setIsImporting] = useState(false);
  const importLogRef = useRef<HTMLDivElement>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<'idle' | 'preprocessing' | 'preview' | 'confirmation' | 'processing'>('idle');
  const [importPreview, setImportPreview] = useState<{ new_records: any[], duplicate_records: any[], error_records: any[] } | null>(null);
  const [approvedDuplicates, setApprovedDuplicates] = useState<Set<number>>(new Set());

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
      const { data, error, count } = await supabase.from('logistics_records_view')
        .select('*', { count: 'exact' })
        .ilike('any_text', `%${filters.searchQuery}%`)
        .gte('loading_date', filters.startDate)
        .lte('loading_date', filters.endDate)
        .order('loading_date', { ascending: false }).order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      setRecords(data || []);
      setTotalPages(Math.ceil((count || 0) / PAGE_SIZE) || 1);
    } catch (error: any) {
      toast({ title: "错误", description: `加载运单记录失败: ${error.message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters, toast]);

  useEffect(() => { loadInitialOptions(); }, [loadInitialOptions]);
  useEffect(() => {
    const timer = setTimeout(() => { loadPaginatedRecords(); }, 500);
    return () => clearTimeout(timer);
  }, [currentPage, filters, loadPaginatedRecords]);
  useEffect(() => { if (currentPage !== 1) { setCurrentPage(1); } }, [filters]);
  useEffect(() => { if (importLogRef.current) { importLogRef.current.scrollTop = importLogRef.current.scrollHeight; } }, [importLogs]);
  
  const handleInputChange = (field: string, value: any) => setFormData((prev: any) => ({ ...prev, [field]: value })); 
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
    } else { setPartnerChains([]); setFilteredDrivers([]); setFilteredLocations([]); }
  }, [formData.project_id, drivers, locations]);
  useEffect(() => {
    const selectedDriver = drivers.find(d => d.id === formData.driver_id);
    if (selectedDriver) setFormData((prev: any) => ({ ...prev, driver_name: selectedDriver.name, license_plate: selectedDriver.license_plate, driver_phone: selectedDriver.phone }));
  }, [formData.driver_id, drivers]);
  useEffect(() => {
    const currentCost = parseFloat(formData.current_cost) || 0; const extraCost = parseFloat(formData.extra_cost) || 0;
    handleInputChange('payable_cost', (currentCost + extraCost > 0) ? (currentCost + extraCost).toFixed(2) : null);
  }, [formData.current_cost, formData.extra_cost]);
  useEffect(() => {
    if (formData.loading_date && !formData.unloading_date) handleInputChange('unloading_date', formData.loading_date);
  }, [formData.loading_date]);

  const handleOpenModal = (record: LogisticsRecord | null = null) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        project_id: record.project_id, chain_id: record.chain_id || "", driver_id: record.driver_id, driver_name: record.driver_name,
        loading_location: record.loading_location, unloading_location: record.unloading_location, 
        loading_date: record.loading_date ? record.loading_date.split('T')[0] : new Date().toISOString().split('T')[0],
        unloading_date: record.unloading_date ? record.unloading_date.split('T')[0] : (record.loading_date ? record.loading_date.split('T')[0] : new Date().toISOString().split('T')[0]),
        loading_weight: record.loading_weight, unloading_weight: record.unloading_weight, current_cost: record.current_cost,
        license_plate: record.license_plate, driver_phone: record.driver_phone, transport_type: record.transport_type || '实际运输',
        extra_cost: record.extra_cost, payable_cost: record.payable_cost, remarks: record.remarks
      });
    } else {
      const latestProject = projects.length > 0 ? [...projects].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))[0] : null;
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
    let finalDriverId = formData.driver_id; let finalDriverName = formData.driver_name;
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(formData.driver_id);
    if (!isUuid && formData.driver_name) {
      const { data: driverResult, error: driverError } = await supabase.rpc('get_or_create_driver', { p_driver_name: formData.driver_name, p_license_plate: formData.license_plate, p_phone: formData.driver_phone, p_project_id: formData.project_id });
      if (driverError || !driverResult || driverResult.length === 0) { toast({ title: "错误", description: "处理司机信息失败", variant: "destructive" }); return; }
      finalDriverId = driverResult[0].driver_id; finalDriverName = driverResult[0].driver_name;
    }
    await supabase.rpc('get_or_create_location', { p_location_name: formData.loading_location, p_project_id: formData.project_id });
    await supabase.rpc('get_or_create_location', { p_location_name: formData.unloading_location, p_project_id: formData.project_id });
    const recordData = {
      p_project_id: formData.project_id, p_project_name: projectName, p_chain_id: formData.chain_id || null, p_driver_id: finalDriverId, p_driver_name: finalDriverName,
      p_loading_location: formData.loading_location, p_unloading_location: formData.unloading_location, p_loading_date: formData.loading_date, p_unloading_date: formData.unloading_date || formData.loading_date,
      p_loading_weight: formData.loading_weight ? parseFloat(formData.loading_weight) : null, p_unloading_weight: formData.unloading_weight ? parseFloat(formData.unloading_weight) : null,
      p_current_cost: formData.current_cost ? parseFloat(formData.current_cost) : null, p_license_plate: formData.license_plate, p_driver_phone: formData.driver_phone, p_transport_type: formData.transport_type,
      p_extra_cost: formData.extra_cost ? parseFloat(formData.extra_cost) : null, p_remarks: formData.remarks
    };
    try {
      if (editingRecord) {
        await supabase.rpc('update_logistics_record_with_costs', { p_record_id: editingRecord.id, ...recordData });
        toast({ title: "成功", description: "运单记录已更新" });
      } else {
        await supabase.rpc('add_logistics_record_with_costs', recordData);
        toast({ title: "成功", description: "新运单已添加" });
      }
      setIsEditModalOpen(false); await loadPaginatedRecords(); await loadInitialOptions();
    } catch (error: any) { toast({ title: "操作失败", description: error.message, variant: "destructive" }); }
  };
    const handleDelete = async (id: string) => {
    try {
      await supabase.from('logistics_records').delete().eq('id', id);
      toast({ title: "成功", description: "运单记录已删除" });
      await loadPaginatedRecords();
    } catch (error: any) { toast({ title: "删除失败", description: error.message, variant: "destructive" }); }
  };
    const summary = useMemo(() => {
    return (records || []).reduce((acc, record) => {
      acc.totalLoadingWeight += record.loading_weight || 0; acc.totalUnloadingWeight += record.unloading_weight || 0;
      acc.totalCurrentCost += record.current_cost || 0; acc.totalExtraCost += record.extra_cost || 0;
      acc.totalDriverPayableCost += record.payable_cost || 0;
      if (record.transport_type === '实际运输') acc.actualCount += 1;
      else if (record.transport_type === '退货') acc.returnCount += 1;
      return acc;
    }, { totalLoadingWeight: 0, totalUnloadingWeight: 0, totalCurrentCost: 0, totalExtraCost: 0, totalDriverPayableCost: 0, actualCount: 0, returnCount: 0 });
  }, [records]);
    const exportToExcel = async () => {
    toast({ title: "导出", description: "正在准备导出全部筛选结果..." });
    try {
        const { data, error } = await supabase.from('logistics_records_view')
            .select('*')
            .ilike('any_text', `%${filters.searchQuery}%`).gte('loading_date', filters.startDate).lte('loading_date', filters.endDate)
            .order('loading_date', { ascending: false }).limit(10000);
        if (error) throw error;
      const dataToExport = (data || []).map((r: LogisticsRecord) => ({
        '运单编号': r.auto_number, '项目名称': r.project_name, '合作链路': r.chain_name || '默认', '司机姓名': r.driver_name, '车牌号': r.license_plate, '司机电话': r.driver_phone,
        '装货地点': r.loading_location, '卸货地点': r.unloading_location, '装货日期': r.loading_date, '卸货日期': r.unloading_date, '运输类型': r.transport_type, 
        '装货重量': r.loading_weight, '卸货重量': r.unloading_weight, '运费金额': r.current_cost, '额外费用': r.extra_cost, '司机应收': r.payable_cost, '备注': r.remarks,
      }));
      const ws = XLSX.utils.json_to_sheet(dataToExport); const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "运单记录"); XLSX.writeFile(wb, "运单记录.xlsx");
      toast({ title: "成功", description: "全部筛选结果已成功导出！" });
    } catch(e) { toast({ title: "错误", description: "导出失败，请重试。", variant: "destructive" }); }
  };
    const handleTemplateDownload = () => {
    const templateData = [{ '项目名称': '', '合作链路': '', '司机姓名': '', '车牌号': '', '司机电话': '', '装货地点': '', '卸货地点': '', '装货日期': '2025/01/14', '卸货日期': '2025/01/14', '运输类型': '实际运输', '装货重量': '', '卸货重量': '', '运费金额': '', '额外费用': '', '备注': '' }];
    const ws = XLSX.utils.json_to_sheet(templateData); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "模板"); XLSX.writeFile(wb, "运单导入模板.xlsx");
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false); setIsImporting(false); setImportStep('idle');
    setImportPreview(null); setApprovedDuplicates(new Set()); setImportLogs([]);
  };
  const handleToggleDuplicateApproval = (index: number) => {
    setApprovedDuplicates(prev => { const newSet = new Set(prev); if (newSet.has(index)) newSet.delete(index); else newSet.add(index); return newSet; });
  };
  const handleToggleAllDuplicates = (checked: boolean | 'indeterminate') => {
    if (!importPreview) return;
    if (checked === true) { setApprovedDuplicates(new Set(importPreview.duplicate_records.map((_, i) => i))); } else { setApprovedDuplicates(new Set()); }
  };
  const getImportPreview = async (validRows: any[]) => {
    setImportStep('preview');
    try {
      const recordsToPreview = validRows.map(rowData => ({
        project_name: rowData['项目名称']?.trim(), chain_name: rowData['合作链路']?.trim() || null,
        driver_name: rowData['司机姓名']?.trim(), license_plate: rowData['车牌号']?.toString().trim() || null,
        driver_phone: rowData['司机电话']?.toString().trim() || null, loading_location: rowData['装货地点']?.trim(),
        unloading_location: rowData['卸货地点']?.trim(), loading_date: rowData.loading_date_parsed,
        unloading_date: rowData.unloading_date_parsed, loading_weight: rowData['装货重量'] ? parseFloat(rowData['装货重量']).toString() : null, unloading_weight: rowData['卸货重量'] ? parseFloat(rowData['卸货重量']).toString() : null,
        current_cost: rowData['运费金额'] ? parseFloat(rowData['运费金额']).toString() : '0', extra_cost: rowData['额外费用'] ? parseFloat(rowData['额外费用']).toString() : '0',
        transport_type: rowData['运输类型']?.trim() || '实际运输', remarks: rowData['备注']?.toString().trim() || null
      }));
      const { data: previewResult, error } = await supabase.rpc('preview_import_with_duplicates_check', { p_records: recordsToPreview });
      if (error) throw error;
      setImportPreview(previewResult); setApprovedDuplicates(new Set()); setImportStep('confirmation');
    } catch (error: any) { toast({ title: "预览失败", description: error.message, variant: "destructive" }); closeImportModal(); }
  };
  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return; setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        setIsImportModalOpen(true); setImportStep('preprocessing');
        const validRows: any[] = [];
        jsonData.forEach(row => { const loadingDate = parseExcelDate(row['装货日期']); if(loadingDate) validRows.push({ ...row, loading_date_parsed: loadingDate, unloading_date_parsed: row['卸货日期'] ? parseExcelDate(row['卸货日期']) : loadingDate }); });
        await getImportPreview(validRows);
      } catch (error) { toast({ title: "错误", description: "文件读取失败，请检查文件格式。", variant: "destructive" }); closeImportModal(); }
    };
    reader.readAsArrayBuffer(file); event.target.value = '';
  };
  const executeFinalImport = async () => {
    if (!importPreview) return; setImportStep('processing'); setImportLogs([]);
    const addLog = (message: string) => setImportLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    const finalRecordsToImport = [ ...importPreview.new_records.map(item => item.record), ...importPreview.duplicate_records.filter((_, index) => approvedDuplicates.has(index)).map(item => item.record) ];
    if (finalRecordsToImport.length === 0) { toast({ title: "操作完成", description: "没有选中任何需要导入的记录。" }); setImportStep('confirmation'); return; }
    addLog(`准备导入 ${finalRecordsToImport.length} 条记录...`);
    try {
      const { data: result, error } = await supabase.rpc('batch_import_logistics_records', { p_records: finalRecordsToImport });
      if (error) throw error;
      addLog(`导入完成！成功: ${result.success_count}, 失败: ${result.error_count}`);
      if (result.error_count > 0) addLog(`失败详情: ${JSON.stringify(result.errors.slice(0, 5))}`);
      toast({ title: "导入成功", description: `共导入 ${result.success_count} 条记录。` });
      if (result.success_count > 0) { await loadPaginatedRecords(); }
    } catch (error: any) { addLog(`导入失败: ${error.message}`); toast({ title: "导入失败", description: error.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-foreground">运单管理</h1><p className="text-muted-foreground">录入、查询和管理所有运单记录</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTemplateDownload}><FileDown className="mr-2 h-4 w-4" />下载模板</Button>
          <Button variant="outline" asChild disabled={loading || isImporting}><Label htmlFor="excel-upload" className="cursor-pointer flex items-center">{isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}导入Excel<Input id="excel-upload" type="file" className="hidden" onChange={handleExcelImport} accept=".xlsx, .xls" disabled={loading || isImporting}/></Label></Button>
          <Button onClick={exportToExcel} disabled={loading}><Download className="mr-2 h-4 w-4" />导出数据</Button>
          <Button onClick={() => handleOpenModal()} disabled={loading}><PlusCircle className="mr-2 h-4 w-4" />新增运单</Button>
        </div>
      </div>
      <div className="flex items-end gap-4 p-4 border rounded-lg">
        <div className="grid w-full max-w-sm items-center gap-1.5"><Label htmlFor="search-query">快速搜索</Label><Input type="text" id="search-query" placeholder="搜索运单号、项目、司机..." value={filters.searchQuery} onChange={e => setFilters(f => ({...f, searchQuery: e.target.value}))} disabled={loading}/></div>
        <div className="grid items-center gap-1.5"><Label htmlFor="start-date">开始日期</Label><Input type="date" id="start-date" value={filters.startDate} onChange={e => setFilters(f => ({...f, startDate: e.target.value}))} disabled={loading}/></div>
        <div className="grid items-center gap-1.5"><Label htmlFor="end-date">结束日期</Label><Input type="date" id="end-date" value={filters.endDate} onChange={e => setFilters(f => ({...f, endDate: e.target.value}))} disabled={loading}/></div>
        <Button variant="outline" onClick={() => setFilters({ startDate: getInitialDefaultDates().startDate, endDate: getInitialDefaultDates().endDate, searchQuery: "" })} disabled={loading}>清除筛选</Button>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>运单编号</TableHead><TableHead>项目</TableHead><TableHead>合作链路</TableHead><TableHead>司机</TableHead><TableHead>路线</TableHead><TableHead>装货日期</TableHead><TableHead>运费</TableHead><TableHead>额外费</TableHead><TableHead>司机应收</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? ( <TableRow><TableCell colSpan={10} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow> ) 
            : records.length === 0 ? ( <TableRow><TableCell colSpan={10} className="text-center h-24">在当前筛选条件下没有找到记录</TableCell></TableRow> ) 
            : ( records.map((record) => ( <TableRow key={record.id} onClick={() => setViewingRecord(record)} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="font-mono">{record.auto_number}</TableCell><TableCell>{record.project_name}</TableCell>
                <TableCell>{record.chain_name || '默认'}</TableCell><TableCell>{record.driver_name}</TableCell>
                <TableCell>{record.loading_location} → {record.unloading_location}</TableCell>
                <TableCell>{record.loading_date ? record.loading_date.split('T')[0] : '-'}</TableCell>
                <TableCell className="font-mono">{record.current_cost != null ? `¥${record.current_cost.toFixed(2)}` : '-'}</TableCell>
                <TableCell className="font-mono text-orange-600">{record.extra_cost != null ? `¥${record.extra_cost.toFixed(2)}` : '-'}</TableCell>
                <TableCell className="font-mono text-green-600 font-semibold">{record.payable_cost != null ? `¥${record.payable_cost.toFixed(2)}` : '-'}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenModal(record)}><Edit className="h-4 w-4" /></Button>
                  <ConfirmDialog title="确认删除" description={`您确定要删除运单 ${record.auto_number} 吗？此操作不可恢复。`} onConfirm={() => handleDelete(record.id)}><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></ConfirmDialog>
                </TableCell>
              </TableRow> )) )}
          </TableBody>
        </Table>
      </div>
      <Pagination>
        <PaginationContent>
          <PaginationItem><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1 || loading}>上一页</Button></PaginationItem>
          <PaginationItem><span className="p-2 text-sm">第 {currentPage} 页 / 共 {totalPages} 页</span></PaginationItem>
          <PaginationItem><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || loading}>下一页</Button></PaginationItem>
        </PaginationContent>
      </Pagination>
      <div className="flex items-center justify-end space-x-6 rounded-lg border p-4 text-sm font-medium">
        <span>当前页合计:</span><span className="font-bold">装: <span className="text-primary">{summary.totalLoadingWeight.toFixed(2)}吨</span></span><span className="font-bold">卸: <span className="text-primary">{summary.totalUnloadingWeight.toFixed(2)}吨</span></span>
        <span className="font-bold">{summary.actualCount}实际 / {summary.returnCount}退货</span><span>司机运费: <span className="font-bold text-primary">¥{summary.totalCurrentCost.toFixed(2)}</span></span>
        <span>额外费用: <span className="font-bold text-orange-600">¥{summary.totalExtraCost.toFixed(2)}</span></span><span>司机应收: <span className="font-bold text-green-600">¥{summary.totalDriverPayableCost.toFixed(2)}</span></span>
      </div>
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>{editingRecord ? "编辑运单" : "新增运单"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-4 gap-4 py-4"><div className="space-y-1"><Label>项目 *</Label><Select value={formData.project_id} onValueChange={(v) => handleInputChange('project_id', v)}><SelectTrigger><SelectValue placeholder="请选择项目"/></SelectTrigger><SelectContent>{projects.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div><div className="space-y-1"><Label>合作链路</Label><Select value={formData.chain_id} onValueChange={(v) => handleInputChange('chain_id', v)} disabled={!formData.project_id}><SelectTrigger><SelectValue placeholder="默认链路"/></SelectTrigger><SelectContent>{partnerChains.map(c => (<SelectItem key={c.id} value={c.id}>{c.chain_name}</SelectItem>))}</SelectContent></Select></div><div className="space-y-1"><Label>装货日期 *</Label><Input type="date" value={formData.loading_date} onChange={(e) => handleInputChange('loading_date', e.target.value)} /></div><div className="space-y-1"><Label>卸货日期</Label><Input type="date" value={formData.unloading_date} onChange={(e) => handleInputChange('unloading_date', e.target.value)} /></div><div className="space-y-1"><Label>司机 *</Label><CreatableCombobox options={filteredDrivers.map(d => ({ value: d.id, label: `${d.name} (${d.license_plate || '无车牌'})` }))}  value={formData.driver_id} onValueChange={(value) => handleInputChange('driver_id', value)} placeholder="选择或创建司机" searchPlaceholder="搜索或输入新司机..." onCreateNew={(value) => handleInputChange('driver_id', value)} /></div><div className="space-y-1"><Label>车牌号</Label><Input value={formData.license_plate || ''} onChange={(e) => handleInputChange('license_plate', e.target.value)} /></div><div className="space-y-1"><Label>司机电话</Label><Input value={formData.driver_phone || ''} onChange={(e) => handleInputChange('driver_phone', e.target.value)} /></div><div className="space-y-1"><Label>运输类型</Label><Select value={formData.transport_type} onValueChange={(v) => handleInputChange('transport_type', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="实际运输">实际运输</SelectItem><SelectItem value="退货">退货</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label>装货地点 *</Label><CreatableCombobox options={filteredLocations.map(l => ({ value: l.name, label: l.name }))}  value={formData.loading_location} onValueChange={(value) => handleInputChange('loading_location', value)} placeholder="选择或创建地点" searchPlaceholder="搜索或输入新地点..." onCreateNew={(value) => handleInputChange('loading_location', value)} /></div><div className="space-y-1"><Label>装货重量</Label><Input type="number" value={formData.loading_weight || ''} onChange={(e) => handleInputChange('loading_weight', e.target.value)} /></div><div className="space-y-1"><Label>卸货地点 *</Label><CreatableCombobox options={filteredLocations.map(l => ({ value: l.name, label: l.name }))}  value={formData.unloading_location} onValueChange={(value) => handleInputChange('unloading_location', value)} placeholder="选择或创建地点" searchPlaceholder="搜索或输入新地点..." onCreateNew={(value) => handleInputChange('unloading_location', value)} /></div><div className="space-y-1"><Label>卸货重量</Label><Input type="number" value={formData.unloading_weight || ''} onChange={(e) => handleInputChange('unloading_weight', e.target.value)} /></div><div className="space-y-1"><Label>运费金额 (元)</Label><Input type="number" value={formData.current_cost || ''} onChange={(e) => handleInputChange('current_cost', e.target.value)} /></div><div className="space-y-1"><Label>额外费用 (元)</Label><Input type="number" value={formData.extra_cost || ''} onChange={(e) => handleInputChange('extra_cost', e.target.value)} /></div><div className="space-y-1 col-span-2"><Label>备注</Label><Textarea value={formData.remarks || ''} onChange={(e) => handleInputChange('remarks', e.target.value)} /></div><div className="space-y-1 col-start-4"><Label>司机应收 (自动计算)</Label><Input type="number" value={formData.payable_cost || ''} disabled className="font-bold text-primary" /></div></div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>取消</Button><Button type="submit" onClick={handleSubmit}>保存</Button></div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>运单详情 (编号: {viewingRecord?.auto_number})</DialogTitle></DialogHeader>
          {viewingRecord && ( <div className="grid grid-cols-4 gap-x-4 gap-y-6 py-4 text-sm"><div className="space-y-1"><Label className="text-muted-foreground">项目</Label><p>{viewingRecord.project_name}</p></div><div className="space-y-1"><Label className="text-muted-foreground">合作链路</Label><p>{viewingRecord.chain_name || '默认'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">装货日期</Label><p>{viewingRecord.loading_date ? viewingRecord.loading_date.split('T')[0] : '-'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">卸货日期</Label><p>{viewingRecord.unloading_date ? viewingRecord.unloading_date.split('T')[0] : '-'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">司机</Label><p>{viewingRecord.driver_name}</p></div><div className="space-y-1"><Label className="text-muted-foreground">车牌号</Label><p>{viewingRecord.license_plate || '-'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">司机电话</Label><p>{viewingRecord.driver_phone || '-'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">运输类型</Label><p>{viewingRecord.transport_type}</p></div><div className="space-y-1"><Label className="text-muted-foreground">装货地点</Label><p>{viewingRecord.loading_location}</p></div><div className="space-y-1"><Label className="text-muted-foreground">装货重量</Label><p>{viewingRecord.loading_weight ? `${viewingRecord.loading_weight} 吨` : '-'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">卸货地点</Label><p>{viewingRecord.unloading_location}</p></div><div className="space-y-1"><Label className="text-muted-foreground">卸货重量</Label><p>{viewingRecord.unloading_weight ? `${viewingRecord.unloading_weight} 吨` : '-'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">运费金额</Label><p className="font-mono">{viewingRecord.current_cost != null ? `¥${viewingRecord.current_cost.toFixed(2)}` : '-'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">额外费用</Label><p className="font-mono text-orange-600">{viewingRecord.extra_cost != null ? `¥${viewingRecord.extra_cost.toFixed(2)}` : '-'}</p></div><div className="space-y-1 col-span-2"><Label className="text-muted-foreground">司机应收</Label><p className="font-mono font-bold text-primary">{viewingRecord.payable_cost != null ? `¥${viewingRecord.payable_cost.toFixed(2)}` : '-'}</p></div><div className="col-span-4 space-y-1"><Label className="text-muted-foreground">备注</Label><p className="min-h-[40px] whitespace-pre-wrap">{viewingRecord.remarks || '无'}</p></div></div> )}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setViewingRecord(null)}>关闭</Button><Button onClick={() => { if (viewingRecord) { handleOpenModal(viewingRecord); setViewingRecord(null); } }}>编辑此记录</Button></div>
        </DialogContent>
      </Dialog>
      <Dialog open={isImportModalOpen} onOpenChange={(isOpen) => !isOpen && closeImportModal()}>
        <DialogContent className="max-w-4xl">
           <DialogHeader><DialogTitle>导入运单数据</DialogTitle></DialogHeader>
           {(importStep === 'preprocessing' || importStep === 'preview') && ( <div className="py-8 text-center space-y-4"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary"/><p className="text-muted-foreground">{importStep === 'preprocessing' ? '正在检查文件内容...' : '正在获取导入预览，请稍候...'}</p></div> )}
           {importStep === 'confirmation' && importPreview && (
             <div>
               <Alert className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700"><Siren className="h-4 w-4" /><AlertTitle>请确认导入操作</AlertTitle><AlertDescription>系统已完成预检查，请审核后执行最终导入。</AlertDescription></Alert>
               <div className="mb-4 p-4 border rounded-md"><h4 className="font-semibold text-lg">{importPreview.new_records.length} 条新记录</h4><p className="text-sm text-muted-foreground">这些记录在数据库中不存在，将被直接导入。</p></div>
               {importPreview.duplicate_records.length > 0 && (
                 <div className="mb-4 p-4 border border-yellow-300 rounded-md bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600">
                   <h4 className="font-semibold text-lg text-yellow-800 dark:text-yellow-300">发现 {importPreview.duplicate_records.length} 条疑似重复记录</h4><p className="text-sm text-muted-foreground mb-4">系统检测到数据库中可能已存在这些记录。如果您确认需要再次导入，请手动勾选。</p>
                   <div className="flex items-center space-x-2 p-2 border-b mb-2"><Checkbox id="select-all-duplicates" checked={ approvedDuplicates.size > 0 && approvedDuplicates.size === importPreview.duplicate_records.length ? true : approvedDuplicates.size > 0 ? 'indeterminate' : false } onCheckedChange={handleToggleAllDuplicates} /><label htmlFor="select-all-duplicates" className="font-medium cursor-pointer">全选/全部取消</label></div>
                   <div className="max-h-40 overflow-y-auto pr-2">{importPreview.duplicate_records.map((item, index) => (<div key={index} className="flex items-center space-x-2 p-2 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-800/30"><Checkbox id={`dup-${index}`} checked={approvedDuplicates.has(index)} onCheckedChange={() => handleToggleDuplicateApproval(index)} /><label htmlFor={`dup-${index}`} className="text-sm cursor-pointer w-full">{`${item.record.driver_name} | ${item.record.loading_location} | ${item.record.loading_date} | ${item.record.loading_weight || 'N/A'}吨`}</label></div>))}</div>
                 </div>
               )}
               {importPreview.error_records.length > 0 && (<div className="mb-4 p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20 dark:border-red-600"><h4 className="font-semibold text-lg text-red-800 dark:text-red-300">{importPreview.error_records.length} 条错误记录</h4><p className="text-sm text-muted-foreground mb-2">这些记录因格式或数据问题将不会被导入。</p></div>)}
               <div className="flex justify-end gap-2 mt-6">
                 <Button variant="outline" onClick={closeImportModal}>取消</Button>
                 <Button onClick={executeFinalImport} disabled={(importPreview.new_records.length + approvedDuplicates.size) === 0}>确认并导入 ({importPreview.new_records.length + approvedDuplicates.size})</Button>
               </div>
             </div>
           )}
           {importStep === 'processing' && ( <div className="py-4 space-y-4"><h3 className="font-semibold">正在执行最终导入...</h3><div ref={importLogRef} className="h-64 overflow-y-auto bg-gray-900 text-white font-mono text-xs p-4 rounded-md">{importLogs.map((log, i) => <p key={i} className={log.includes('失败') || log.includes('error') ? 'text-red-400' : 'text-green-400'}>{log}</p>)}</div><div className="text-center pt-4"><Button onClick={closeImportModal}>关闭</Button></div></div>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
