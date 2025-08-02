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
  const [filters, setFilters] = useState(() => getInitialDefaultDates());
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 15;
  const navigate = useNavigate();
  const [isImporting, setIsImporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const importLogRef = useRef<HTMLDivElement>(null);
  const [importStep, setImportStep] = useState<'idle' | 'preprocessing' | 'preview' | 'confirmation' | 'processing'>('idle');
  const [importPreview, setImportPreview] = useState<{ new_records: any[], duplicate_records: any[], error_records: any[] } | null>(null);
  const [approvedDuplicates, setApprovedDuplicates] = useState<Set<number>>(new Set());

  const handleInputChange = (field: string, value: any) => setFormData((prev: any) => ({ ...prev, [field]: value }));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsRes, driversRes, locationsRes] = await Promise.all([
        supabase.from('projects').select('id, name, start_date'),
        supabase.from('drivers').select('id, name, license_plate, phone'),
        supabase.from('locations').select('id, name'),
      ]);
      if (projectsRes.error) throw projectsRes.error;
      if (driversRes.error) throw driversRes.error;
      if (locationsRes.error) throw locationsRes.error;
      setProjects(projectsRes.data || []);
      setDrivers(driversRes.data || []);
      setLocations(locationsRes.data || []);

      const offset = (currentPage - 1) * PAGE_SIZE;
      const { data, error, count } = await supabase.from('logistics_records_view')
        .select('*', { count: 'exact' })
        .ilike('any_text', `%${searchQuery}%`)
        .gte('loading_date', filters.startDate)
        .lte('loading_date', filters.endDate)
        .order('loading_date', { ascending: false }).order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      setRecords(data || []);
      setTotalPages(Math.ceil((count || 0) / PAGE_SIZE) || 1);
    } catch (error: any) {
      toast({ title: "错误", description: `数据加载失败: ${error.message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters.startDate, filters.endDate, searchQuery, toast]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (currentPage !== 1) setCurrentPage(1); }, [filters, searchQuery]);
  useEffect(() => { if (importLogRef.current) importLogRef.current.scrollTop = importLogRef.current.scrollHeight; }, [importLogs]);
  useEffect(() => {
    handleInputChange('chain_id', '');
    if (formData.project_id && projects.length > 0) {
      const fetchRelatedData = async () => {
        const { data: chainsData } = await supabase.from('partner_chains').select('id, chain_name').eq('project_id', formData.project_id);
        setPartnerChains(chainsData || []);
        const { data: driverLinks } = await supabase.from('driver_projects').select('driver_id').eq('project_id', formData.project_id);
        const driverIds = driverLinks?.map(link => link.driver_id) || [];
        setFilteredDrivers(drivers.filter(driver => driverIds.includes(driver.id)));
        const { data: locationLinks } = await supabase.from('location_projects').select('location_id').eq('project_id', formData.project_id);
        const locationIds = locationLinks?.map(link => link.location_id) || [];
        setFilteredLocations(locations.filter(location => locationIds.includes(location.id)));
      };
      fetchRelatedData();
    } else {
      setPartnerChains([]); setFilteredDrivers([]); setFilteredLocations([]);
    }
  }, [formData.project_id, projects, drivers, locations]);
  useEffect(() => {
    const selectedDriver = drivers.find(d => d.id === formData.driver_id);
    if (selectedDriver) setFormData((p: any) => ({ ...p, driver_name: selectedDriver.name, license_plate: selectedDriver.license_plate || p.license_plate || '', driver_phone: selectedDriver.phone || p.driver_phone || ''}));
  }, [formData.driver_id, drivers]);
  useEffect(() => {
    const currentCost = parseFloat(formData.current_cost) || 0;
    const extraCost = parseFloat(formData.extra_cost) || 0;
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
        unloading_date: record.unloading_date ? record.unloading_date.split('T')[0] : record.loading_date ? record.loading_date.split('T')[0] : new Date().toISOString().split('T')[0],
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
  const handleSubmit = async () => { /* ... */ };
  const handleDelete = async (id: string) => { /* ... */ };
  const summary = useMemo(() => {
    return (records || []).reduce((acc, record) => {
      acc.totalLoadingWeight += record.loading_weight || 0; acc.totalUnloadingWeight += record.unloading_weight || 0;
      acc.totalCurrentCost += record.current_cost || 0; acc.totalExtraCost += record.extra_cost || 0;
      acc.totalDriverPayableCost += record.payable_cost || 0;
      if (record.transport_type === '实际运输') acc.actualCount += 1;
      else if (record.transport_type === '退货') acc.returnCount += 1;
      return acc;
    }, {
      totalLoadingWeight: 0, totalUnloadingWeight: 0, totalCurrentCost: 0,
      totalExtraCost: 0, totalDriverPayableCost: 0, actualCount: 0, returnCount: 0,
    });
  }, [records]);
  const exportToExcel = async () => { /* ... */ };
  const handleTemplateDownload = () => { /* ... */ };

  // ===================================
  // 导入核心逻辑区 (完整实现)
  // ===================================
  const closeImportModal = () => {
    setIsImporting(false); setIsImportModalOpen(false); setImportStep('idle');
    setImportPreview(null); setApprovedDuplicates(new Set()); setImportLogs([]);
  };

  const getImportPreview = async (validRows: any[]) => {
    setImportStep('preview');
    try {
      const recordsToPreview = validRows.map(rowData => ({
        project_name: rowData['项目名称']?.trim(), chain_name: rowData['合作链路']?.trim() || null,
        driver_name: rowData['司机姓名']?.trim(), license_plate: rowData['车牌号']?.toString().trim() || null,
        driver_phone: rowData['司机电话']?.toString().trim() || null, loading_location: rowData['装货地点']?.trim(),
        unloading_location: rowData['卸货地点']?.trim(), loading_date: rowData.loading_date_parsed,
        unloading_date: rowData.unloading_date_parsed, loading_weight: rowData['装货重量'] ? parseFloat(rowData['装货重量']).toString() : null,
        unloading_weight: rowData['卸货重量'] ? parseFloat(rowData['卸货重量']).toString() : null,
        current_cost: rowData['运费金额'] ? parseFloat(rowData['运费金额']).toString() : '0',
        extra_cost: rowData['额外费用'] ? parseFloat(rowData['额外费用']).toString() : '0',
        transport_type: rowData['运输类型']?.trim() || '实际运输', remarks: rowData['备注']?.toString().trim() || null
      }));
      const { data: previewResult, error } = await supabase.rpc('preview_import_with_duplicates_check', { p_records: recordsToPreview });
      if (error) throw error;
      setImportPreview(previewResult);
      const initialApproved = new Set(previewResult.duplicate_records.map((_: any, index: number) => index));
      setApprovedDuplicates(initialApproved);
      setImportStep('confirmation');
    } catch (error: any) {
      toast({ title: "预览失败", description: error.message, variant: "destructive" });
      closeImportModal();
    }
  };

  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        setIsImportModalOpen(true);
        setImportStep('preprocessing');
        const validRows: any[] = [];
        jsonData.forEach(row => {
            const loadingDateFormatted = parseExcelDate(row['装货日期']);
            if (loadingDateFormatted) { validRows.push({ ...row, loading_date_parsed: loadingDateFormatted, unloading_date_parsed: row['卸货日期'] ? parseExcelDate(row['卸货日期']) : loadingDateFormatted }); }
        });
        await getImportPreview(validRows);
      } catch (error) {
        toast({ title: "错误", description: "文件读取失败，请检查文件格式。", variant: "destructive" });
        closeImportModal();
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };
  
  const executeFinalImport = async () => {
    if (!importPreview) return;
    setImportStep('processing');
    setImportLogs([]);
    const addLog = (message: string) => setImportLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    const finalRecordsToImport = [
      ...importPreview.new_records.map(item => item.record),
      ...importPreview.duplicate_records.filter((_, index) => approvedDuplicates.has(index)).map(item => item.record)
    ];
    if (finalRecordsToImport.length === 0) {
      toast({ title: "操作完成", description: "没有选中任何需要导入的记录。" });
      setImportStep('confirmation'); return;
    }
    addLog(`准备导入 ${finalRecordsToImport.length} 条记录...`);
    try {
      const { data: result, error } = await supabase.rpc('batch_import_logistics_records', { p_records: finalRecordsToImport });
      if (error) throw error;
      addLog(`导入完成！成功: ${result.success_count}, 失败: ${result.error_count}`);
      if (result.error_count > 0) addLog(`失败详情: ${JSON.stringify(result.errors.slice(0, 5))}`);
      toast({ title: "导入成功", description: `共导入 ${result.success_count} 条记录。` });
      if (result.success_count > 0) await loadData();
    } catch (error: any) {
      addLog(`导入失败: ${error.message}`);
      toast({ title: "导入失败", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleDuplicateApproval = (index: number) => {
    setApprovedDuplicates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) newSet.delete(index); else newSet.add(index);
      return newSet;
    });
  };
  const handleToggleAllDuplicates = () => {
    if (!importPreview) return;
    const allDuplicateIndices = Array.from({ length: importPreview.duplicate_records.length }, (_, i) => i);
    if (approvedDuplicates.size < importPreview.duplicate_records.length) { setApprovedDuplicates(new Set(allDuplicateIndices)); } else { setApprovedDuplicates(new Set()); }
  };
  
  // UI渲染
    return (
    <div className="space-y-4">
      {/* 页面标题和按钮 */}
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-foreground">运单管理</h1><p className="text-muted-foreground">录入、查询和管理所有运单记录</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTemplateDownload}><FileDown className="mr-2 h-4 w-4" />下载模板</Button>
          <Button variant="outline" asChild disabled={loading || isImporting}><Label htmlFor="excel-upload" className="cursor-pointer flex items-center">{isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}导入Excel<Input id="excel-upload" type="file" className="hidden" onChange={handleExcelImport} accept=".xlsx, .xls" disabled={loading || isImporting}/></Label></Button>
          <Button onClick={exportToExcel} disabled={loading}><Download className="mr-2 h-4 w-4" />导出数据</Button>
          <Button onClick={() => handleOpenModal()} disabled={loading}><PlusCircle className="mr-2 h-4 w-4" />新增运单</Button>
        </div>
      </div>
      
      {/* 筛选区域 */}
      <div className="flex items-end gap-4 p-4 border rounded-lg">
        <div className="grid w-full max-w-sm items-center gap-1.5"><Label htmlFor="search-query">快速搜索</Label><Input type="text" id="search-query" placeholder="搜索运单号、项目、司机..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
        <div className="grid items-center gap-1.5"><Label htmlFor="start-date">开始日期</Label><Input type="date" id="start-date" value={filters.startDate} onChange={e => setFilters(f => ({...f, startDate: e.target.value}))} /></div>
        <div className="grid items-center gap-1.5"><Label htmlFor="end-date">结束日期</Label><Input type="date" id="end-date" value={filters.endDate} onChange={e => setFilters(f => ({...f, endDate: e.target.value}))}/></div>
        <Button variant="outline" onClick={() => { setFilters(getInitialDefaultDates()); setSearchQuery(""); }}>清除筛选</Button>
      </div>

      {/* 表格区域 */}
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

      {/* 分页组件 */}
      <Pagination>
        <PaginationContent>
          <PaginationItem><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1 || loading}>上一页</Button></PaginationItem>
          <PaginationItem><span className="p-2 text-sm">第 {currentPage} 页 / 共 {totalPages} 页</span></PaginationItem>
          <PaginationItem><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || loading}>下一页</Button></PaginationItem>
        </PaginationContent>
      </Pagination>

      {/* 数据汇总栏 */}
      <div className="flex items-center justify-end space-x-6 rounded-lg border p-4 text-sm font-medium">...</div>
      {/* 新增/编辑/查看弹窗 */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>...</Dialog>
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>...</Dialog>
      
      {/* 导入流程弹窗 */}
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
                   <h4 className="font-semibold text-lg text-yellow-800 dark:text-yellow-300">发现 {importPreview.duplicate_records.length} 条疑似重复记录</h4><p className="text-sm text-muted-foreground mb-4">默认将全部导入。如果您确认某条是重复数据且不想再次导入，请取消勾选。</p>
                   <div className="flex items-center space-x-2 p-2 border-b mb-2"><Checkbox id="select-all-duplicates" checked={ approvedDuplicates.size > 0 && approvedDuplicates.size === importPreview.duplicate_records.length ? true : approvedDuplicates.size > 0 ? 'indeterminate' : false } onCheckedChange={handleToggleAllDuplicates} /><label htmlFor="select-all-duplicates" className="font-medium cursor-pointer">{approvedDuplicates.size < importPreview.duplicate_records.length ? '全选' : '全部取消'}</label></div>
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
