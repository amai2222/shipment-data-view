// 文件路径: src/pages/BusinessEntry.tsx

// 1. 导入所有需要的工具和组件 (新增了交互所需的组件)
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
import { Download, FileDown, FileUp, PlusCircle, Edit, Trash2, Loader2, Siren } from "lucide-react"; // [新增] Siren Icon
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreatableCombobox } from "@/components/CreatableCombobox";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox"; // [新增] 用于确认重复项
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // [新增] 用于在弹窗中给予提示

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
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (excelDate instanceof Date) {
    const year = excelDate.getFullYear();
    const month = String(excelDate.getMonth() + 1).padStart(2, '0');
    const day = String(excelDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof excelDate === 'string') {
    const dateStr = excelDate.split(' ')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
      const parts = dateStr.split('/');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  console.warn("无法解析的日期格式:", excelDate);
  return null;
};

// 4. 主组件定义
export default function BusinessEntry() {
  // 状态管理
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
  
  // [核心修复] 使用“惰性初始化”来安全地初始化状态，防止白屏错误
  const [filters, setFilters] = useState(() => {
    const initialDates = getInitialDefaultDates();
    return {
      startDate: initialDates.startDate,
      endDate: initialDates.endDate,
      searchQuery: ""
    }
  });

  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 15;
  const navigate = useNavigate();

  // 升级后的导入流程状态
  const [isImporting, setIsImporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const importLogRef = useRef<HTMLDivElement>(null);
  const [importStep, setImportStep] = useState<'idle' | 'preprocessing' | 'preview' | 'confirmation' | 'processing'>('idle');
  const [importPreview, setImportPreview] = useState<{
    new_records: any[],
    duplicate_records: any[],
    error_records: any[]
  } | null>(null);
  const [approvedDuplicates, setApprovedDuplicates] = useState<Set<number>>(new Set());

  // 数据加载逻辑
  const loadInitialOptions = useCallback(async () => {
    try {
      const { data: projectsData } = await supabase.from('projects').select('id, name, start_date');
      setProjects(projectsData as Project[] || []);
      const { data: driversData } = await supabase.from('drivers').select('id, name, license_plate, phone');
      setDrivers(driversData as Driver[] || []);
      const { data: locationsData } = await supabase.from('locations').select('id, name');
      setLocations(locationsData || []);
    } catch (error) { 
      toast({ title: "错误", description: "加载筛选选项失败", variant: "destructive" }); 
    }
  }, [toast]);

  const loadPaginatedRecords = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const { data, error } = await supabase.rpc('get_paginated_logistics_records', {
        p_page_size: PAGE_SIZE, p_offset: offset, p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null, p_search_query: filters.searchQuery || null,
      });
      if (error) throw error;
      const result = data as any;
      setRecords(result?.records || []);
      setTotalPages(Math.ceil((result?.total_count || 0) / PAGE_SIZE) || 1);
    } catch (error) {
      toast({ title: "错误", description: "加载运单记录失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters, toast]);

 // 副作用管理
  useEffect(() => { loadInitialOptions(); }, [loadInitialOptions]);
  useEffect(() => {
    const timer = setTimeout(() => { loadPaginatedRecords(); }, 500);
    return () => clearTimeout(timer);
  }, [currentPage, filters, loadPaginatedRecords]); 
  useEffect(() => { if (currentPage !== 1) setCurrentPage(1); }, [filters]);
  useEffect(() => { if (importLogRef.current) importLogRef.current.scrollTop = importLogRef.current.scrollHeight; }, [importLogs]);

  // 表单交互逻辑的副作用
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
    } else {
      setPartnerChains([]); setFilteredDrivers([]); setFilteredLocations([]);
    }
  }, [formData.project_id, drivers, locations]);
  useEffect(() => {
    const selectedDriver = drivers.find(d => d.id === formData.driver_id);
    if (selectedDriver) {
      setFormData((prev: any) => ({
        ...prev, driver_name: selectedDriver.name, license_plate: selectedDriver.license_plate || prev.license_plate || '',
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
    if (formData.loading_date && !formData.unloading_date) handleInputChange('unloading_date', formData.loading_date);
  }, [formData.loading_date]);

  // 事件处理器
  const handleOpenModal = (record: LogisticsRecord | null = null) => {
    if (record) {
      setEditingRecord(record);
      setFormData({ /* ... */ });
    } else {
      const latestProject = [...projects].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))[0];
      setEditingRecord(null);
      setFormData({ ...BLANK_FORM_DATA, project_id: latestProject ? latestProject.id : "" });
    }
    setIsEditModalOpen(true);
  };
  const handleSubmit = async () => { /* ... */ };
  const handleDelete = async (id: string) => { /* ... */ };
  const summary = useMemo(() => { return (records || []).reduce((acc, record) => { /* ... */ return acc; }, { /* ... */ }); }, [records]);
  const exportToExcel = async () => { /* ... */ };
  const handleTemplateDownload = () => { /* ... */ };

  // ==================================================================
  // 全新的、分步的批量导入核心逻辑区
  // ==================================================================
  
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
            if (loadingDateFormatted) {
                validRows.push({
                  ...row,
                  loading_date_parsed: loadingDateFormatted,
                  unloading_date_parsed: row['卸货日期'] ? parseExcelDate(row['卸货日期']) : loadingDateFormatted,
                  // 确保所有字段都在，避免后端RPC调用出错
                  '项目名称': row['项目名称'], '合作链路': row['合作链路'], '司机姓名': row['司机姓名'], '车牌号': row['车牌号'], '司机电话': row['司机电话'],
                  '装货地点': row['装货地点'], '卸货地点': row['卸货地点'], '运输类型': row['运输类型'], '装货重量': row['装货重量'],
                  '卸货重量': row['卸货重量'], '运费金额': row['运费金额'], '额外费用': row['额外费用'], '备注': row['备注']
                });
            }
        });
        getImportPreview(validRows);
      } catch (error) { toast({ title: "错误", description: "文件读取失败", variant: "destructive" }); closeImportModal(); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };
  
  const getImportPreview = async (validRows: any[]) => {
    setImportStep('preview');
    try {
      const recordsToPreview = validRows.map(rowData => ({
        project_name: rowData['项目名称']?.trim(),
        chain_name: rowData['合作链路']?.trim() || null,
        driver_name: rowData['司机姓名']?.trim(),
        license_plate: rowData['车牌号']?.toString().trim() || null,
        driver_phone: rowData['司机电话']?.toString().trim() || null,
        loading_location: rowData['装货地点']?.trim(),
        unloading_location: rowData['卸货地点']?.trim(),
        loading_date: rowData.loading_date_parsed,
        unloading_date: rowData.unloading_date_parsed,
        loading_weight: rowData['装货重量'] ? parseFloat(rowData['装货重量']).toString() : null,
        unloading_weight: rowData['卸货重量'] ? parseFloat(rowData['卸货重量']).toString() : null,
        current_cost: rowData['运费金额'] ? parseFloat(rowData['运费金额']).toString() : '0',
        extra_cost: rowData['额外费用'] ? parseFloat(rowData['额外费用']).toString() : '0',
        transport_type: rowData['运输类型']?.trim() || '实际运输',
        remarks: rowData['备注']?.toString().trim() || null
      }));
      
      const { data: previewResult, error } = await supabase.rpc('preview_import_with_duplicates_check', { p_records: recordsToPreview });
      if (error) throw error;
      setImportPreview(previewResult);
      const initialApproved = new Set(previewResult.duplicate_records.map((_: any, index: number) => index));
      setApprovedDuplicates(initialApproved);
      setImportStep('confirmation');
    
    } catch (error: any) { toast({ title: "预览失败", description: error.message, variant: "destructive" }); closeImportModal(); }
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
      if(result.error_count > 0) addLog(`失败详情: ${JSON.stringify(result.errors.slice(0,5))}`);
      toast({ title:"导入成功", description: `共导入 ${result.success_count} 条记录。`});
      if(result.success_count > 0) loadPaginatedRecords();
    } catch (error: any) {
      addLog(`导入失败: ${error.message}`);
      toast({ title: "导入失败", description: error.message, variant: "destructive"});
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
    if (approvedDuplicates.size < importPreview.duplicate_records.length) {
      setApprovedDuplicates(new Set(allDuplicateIndices));
    } else {
      setApprovedDuplicates(new Set());
    }
  };

  const closeImportModal = () => {
    setIsImporting(false); setIsImportModalOpen(false); setImportStep('idle');
    setImportPreview(null); setApprovedDuplicates(new Set()); setImportLogs([]);
  };

  // UI渲染
  return (
    <div className="space-y-4">
      {/* 页面标题和按钮 */}
      <div className="flex justify-between items-center">{/* ... */}</div>
      
      {/* 筛选区域 */}
      <div className="flex items-end gap-4 p-4 border rounded-lg">{/* ... */}</div>

      {/* 表格区域 */}
      <div className="border rounded-lg"><Table>{/* ... */}</Table></div>

      {/* 分页组件 */}
      <Pagination>{/* ... */}</Pagination>

      {/* 数据汇总栏 */}
      <div className="flex items-center justify-end space-x-6 rounded-lg border p-4 text-sm font-medium">{/* ... */}</div>

      {/* 新增/编辑/查看弹窗 */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>{/* ... */}</Dialog>
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>{/* ... */}</Dialog>
      
      {/* 全新的批量导入流程弹窗 */}
      <Dialog open={isImportModalOpen} onOpenChange={(isOpen) => !isOpen && closeImportModal()}>
        <DialogContent className="max-w-4xl">
           <DialogHeader><DialogTitle>导入运单数据</DialogTitle></DialogHeader>

           {(importStep === 'preprocessing' || importStep === 'preview') && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary"/>
              <p className="text-muted-foreground">{importStep === 'preprocessing' ? '正在检查文件内容...' : '正在获取导入预览，请稍候...'}</p>
            </div>
           )}
           
           {importStep === 'confirmation' && importPreview && (
             <div>
               <Alert className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700">
                 <Siren className="h-4 w-4" />
                 <AlertTitle>请确认导入操作</AlertTitle>
                 <AlertDescription>系统已完成预检查，请审核后执行最终导入。</AlertDescription>
               </Alert>
               <div className="mb-4 p-4 border rounded-md">
                 <h4 className="font-semibold text-lg">{importPreview.new_records.length} 条新记录</h4>
                 <p className="text-sm text-muted-foreground">这些记录在数据库中不存在，将被直接导入。</p>
               </div>
               {importPreview.duplicate_records.length > 0 && (
                 <div className="mb-4 p-4 border border-yellow-300 rounded-md bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600">
                   <h4 className="font-semibold text-lg text-yellow-800 dark:text-yellow-300">发现 {importPreview.duplicate_records.length} 条疑似重复记录</h4>
                   <p className="text-sm text-muted-foreground mb-4">默认将全部导入。如果您确认某条是重复数据且不想再次导入，请取消勾选。</p>
                   <div className="flex items-center space-x-2 p-2 border-b mb-2">
                     <Checkbox id="select-all-duplicates" checked={ approvedDuplicates.size > 0 && approvedDuplicates.size === importPreview.duplicate_records.length ? true : approvedDuplicates.size > 0 ? 'indeterminate' : false } onCheckedChange={handleToggleAllDuplicates} />
                     <label htmlFor="select-all-duplicates" className="font-medium cursor-pointer">{approvedDuplicates.size < importPreview.duplicate_records.length ? '全选' : '全部取消'}</label>
                   </div>
                   <div className="max-h-40 overflow-y-auto pr-2">
                    {importPreview.duplicate_records.map((item, index) => (
                      <div key={index} className="flex items-center space-x-2 p-2 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-800/30">
                         <Checkbox id={`dup-${index}`} checked={approvedDuplicates.has(index)} onCheckedChange={() => handleToggleDuplicateApproval(index)} />
                         <label htmlFor={`dup-${index}`} className="text-sm cursor-pointer w-full">{`${item.record.driver_name} | ${item.record.loading_location} | ${item.record.loading_date} | ${item.record.loading_weight || 'N/A'}吨`}</label>
                      </div>
                    ))}
                   </div>
                 </div>
               )}
               {importPreview.error_records.length > 0 && (
                 <div className="mb-4 p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900/20 dark:border-red-600">
                    <h4 className="font-semibold text-lg text-red-800 dark:text-red-300">{importPreview.error_records.length} 条错误记录</h4>
                    <p className="text-sm text-muted-foreground mb-2">这些记录因格式或数据问题将不会被导入。</p>
                 </div>
               )}
               <div className="flex justify-end gap-2 mt-6">
                 <Button variant="outline" onClick={closeImportModal}>取消</Button>
                 <Button onClick={executeFinalImport} disabled={(importPreview.new_records.length + approvedDuplicates.size) === 0}>
                   确认并导入 ({importPreview.new_records.length + approvedDuplicates.size})
                 </Button>
               </div>
             </div>
           )}
           {importStep === 'processing' && ( 
             <div className="py-4 space-y-4">
               <h3 className="font-semibold">正在执行最终导入...</h3>
               <div ref={importLogRef} className="h-64 overflow-y-auto bg-gray-900 text-white font-mono text-xs p-4 rounded-md">
                 {importLogs.map((log, i) => <p key={i} className={log.includes('失败') || log.includes('error') ? 'text-red-400' : 'text-green-400'}>{log}</p>)}
               </div>
               <div className="text-center pt-4"><Button onClick={closeImportModal}>关闭</Button></div>
             </div>
           )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
