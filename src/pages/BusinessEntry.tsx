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

  const loadData = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;

      const [projectsRes, driversRes, locationsRes, recordsRes] = await Promise.all([
        supabase.from('projects').select('id, name, start_date'),
        supabase.from('drivers').select('id, name, license_plate, phone'),
        supabase.from('locations').select('id, name'),
        supabase.from('logistics_records_view')
          .select('*', { count: 'exact' })
          .ilike('any_text', `%${searchQuery}%`)
          .gte('loading_date', filters.startDate)
          .lte('loading_date', filters.endDate)
          .order('loading_date', { ascending: false }).order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1)
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (driversRes.error) throw driversRes.error;
      if (locationsRes.error) throw locationsRes.error;
      if (recordsRes.error) throw recordsRes.error;

      setProjects(projectsRes.data || []);
      setDrivers(driversRes.data || []);
      setLocations(locationsRes.data || []);
      setRecords(recordsRes.data || []);
      setTotalPages(Math.ceil((recordsRes.count || 0) / PAGE_SIZE) || 1);
    } catch (error: any) {
      toast({ title: "错误", description: `数据加载失败: ${error.message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate, searchQuery, toast]);

  useEffect(() => {
    // 当筛选条件或搜索词变化时，重置到第一页并加载数据
    setCurrentPage(1);
    loadData(1);
  }, [filters, searchQuery, loadData]);

  useEffect(() => {
    // 仅当页码变化时（且不是第一页），才加载数据
    // 避免与上面的 effect 重复加载
    if (currentPage > 1) {
      loadData(currentPage);
    }
  }, [currentPage, loadData]);


  useEffect(() => { if (importLogRef.current) importLogRef.current.scrollTop = importLogRef.current.scrollHeight; }, [importLogs]);
  useEffect(() => {
    handleInputChange('chain_id', '');
    if (formData.project_id && projects.length > 0) {
      const fetchRelatedData = async () => { /* ... */ };
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

  const closeImportModal = () => {
    setIsImporting(false); setIsImportModalOpen(false); setImportStep('idle');
    setImportPreview(null); setApprovedDuplicates(new Set()); setImportLogs([]);
  };
  const getImportPreview = async (validRows: any[]) => {
    setImportStep('preview');
    try {
      const recordsToPreview = validRows.map(rowData => ({ /* ... */ }));
      const { data: previewResult, error } = await supabase.rpc('preview_import_with_duplicates_check', { p_records: recordsToPreview });
      if (error) throw error;
      setImportPreview(previewResult);
      setApprovedDuplicates(new Set(previewResult.duplicate_records.map((_: any, i: number) => i)));
      setImportStep('confirmation');
    } catch (error: any) { toast({ title: "预览失败", description: error.message, variant: "destructive" }); closeImportModal(); }
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
            const loadingDate = parseExcelDate(row['装货日期']);
            if (loadingDate) { validRows.push({ ...row, loading_date_parsed: loadingDate, unloading_date_parsed: row['卸货日期'] ? parseExcelDate(row['卸货日期']) : loadingDate }); }
        });
        await getImportPreview(validRows);
      } catch (error) { toast({ title: "错误", description: "文件读取失败", variant: "destructive" }); closeImportModal(); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };
  const executeFinalImport = async () => { /* ... */ };
  const handleToggleDuplicateApproval = (index: number) => { /* ... */ };
  const handleToggleAllDuplicates = () => { /* ... */ };
  
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
        <div className="grid w-full max-w-sm items-center gap-1.5"><Label htmlFor="search-query">快速搜索</Label><Input type="text" id="search-query" placeholder="搜索运单号、项目、司机..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} disabled={loading}/></div>
        <div className="grid items-center gap-1.5"><Label htmlFor="start-date">开始日期</Label><Input type="date" id="start-date" value={filters.startDate} onChange={e => setFilters(f => ({...f, startDate: e.target.value}))} disabled={loading}/></div>
        <div className="grid items-center gap-1.5"><Label htmlFor="end-date">结束日期</Label><Input type="date" id="end-date" value={filters.endDate} onChange={e => setFilters(f => ({...f, endDate: e.target.value}))} disabled={loading}/></div>
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
                  <ConfirmDialog title="确认删除" description={`您确定要删除运单 ${record.auto_number} 吗？`} onConfirm={() => handleDelete(record.id)}><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></ConfirmDialog>
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
        <span>当前页合计:</span>
        <span className="font-bold">装: <span className="text-primary">{summary.totalLoadingWeight.toFixed(2)}吨</span></span>
        <span className="font-bold">卸: <span className="text-primary">{summary.totalUnloadingWeight.toFixed(2)}吨</span></span>
        <span className="font-bold">{summary.actualCount}实际 / {summary.returnCount}退货</span>
        <span>司机运费: <span className="font-bold text-primary">¥{summary.totalCurrentCost.toFixed(2)}</span></span>
        <span>额外费用: <span className="font-bold text-orange-600">¥{summary.totalExtraCost.toFixed(2)}</span></span>
        <span>司机应收: <span className="font-bold text-green-600">¥{summary.totalDriverPayableCost.toFixed(2)}</span></span>
      </div>
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>...</Dialog>
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>...</Dialog>
      <Dialog open={isImportModalOpen} onOpenChange={(isOpen) => !isOpen && closeImportModal()}>
       <DialogContent className="max-w-4xl">
           <DialogHeader><DialogTitle>导入运单数据</DialogTitle></DialogHeader>
           {(importStep === 'preprocessing' || importStep === 'preview') && ( <div className="py-8 text-center space-y-4"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary"/><p className="text-muted-foreground">{importStep === 'preprocessing' ? '正在检查文件内容...' : '正在获取导入预览，请稍候...'}</p></div> )}
           {importStep === 'confirmation' && importPreview && (
             <div>
               <Alert className="mb-4"><Siren className="h-4 w-4" /><AlertTitle>请确认导入操作</AlertTitle><AlertDescription>系统已完成预检查。</AlertDescription></Alert>
               <div className="mb-4 p-4 border rounded-md"><h4 className="font-semibold">{importPreview.new_records.length} 条新记录</h4></div>
               {importPreview.duplicate_records.length > 0 && (
                 <div className="mb-4 p-4 border rounded-md">
                   <h4 className="font-semibold">{importPreview.duplicate_records.length} 条疑似重复记录</h4>
                   <div className="flex items-center space-x-2"><Checkbox id="select-all" onCheckedChange={handleToggleAllDuplicates} /><label htmlFor="select-all">全选</label></div>
                   <div>{importPreview.duplicate_records.map((item, index) => (<div key={index}><Checkbox onCheckedChange={() => handleToggleDuplicateApproval(index)} />...</div>))}</div>
                 </div>
               )}
               <div className="flex justify-end gap-2"><Button variant="outline" onClick={closeImportModal}>取消</Button><Button onClick={executeFinalImport}>确认导入</Button></div>
             </div>
           )}
           {importStep === 'processing' && ( <div className="py-4 space-y-4"><h3 className="font-semibold">正在导入...</h3><div ref={importLogRef}>{importLogs.map((log, i) => <p key={i}>{log}</p>)}</div><Button onClick={closeImportModal}>关闭</Button></div>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
