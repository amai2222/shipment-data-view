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

  // 数据加载逻辑
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsRes, driversRes, locationsRes] = await Promise.all([
        supabase.from('projects').select('id, name, start_date'),
        supabase.from('drivers').select('id, name, license_plate, phone'),
        supabase.from('locations').select('id, name')
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (driversRes.error) throw driversRes.error;
      if (locationsRes.error) throw locationsRes.error;

      setProjects(projectsRes.data || []);
      setDrivers(driversRes.data || []);
      setLocations(locationsRes.data || []);
      
      // 只有在基础数据加载成功后，才加载依赖这些数据的运单记录
      const offset = (currentPage - 1) * PAGE_SIZE;
      const { data: recordsData, error: recordsError } = await supabase.rpc('get_paginated_logistics_records', {
        p_page_size: PAGE_SIZE, p_offset: offset, p_start_date: filters.startDate,
        p_end_date: filters.endDate, p_search_query: searchQuery
      });
      if (recordsError) throw recordsError;
      
      const result = recordsData as any;
      setRecords(result?.records || []);
      setTotalPages(Math.ceil((result?.total_count || 0) / PAGE_SIZE) || 1);

    } catch (error: any) {
      toast({ title: "错误", description: `数据加载失败: ${error.message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters.startDate, filters.endDate, searchQuery, toast]);

 // 副作用管理
  useEffect(() => { loadInitialData(); }, [loadInitialData]);
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

  // 事件处理器
  const handleInputChange = (field: string, value: any) => setFormData((prev: any) => ({ ...prev, [field]: value }));
  const handleOpenModal = (record: LogisticsRecord | null = null) => {
    if (record) {
      setEditingRecord(record);
      setFormData({ /* ... */ });
    } else {
      // [防御性修复] 确保在设置默认项目前, projects数组不为空
      const latestProject = projects.length > 0 ? [...projects].sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))[0] : null;
      setEditingRecord(null);
      setFormData({ ...BLANK_FORM_DATA, project_id: latestProject ? latestProject.id : "" });
    }
    setIsEditModalOpen(true);
  };
  const handleSubmit = async () => { /* ... */ };
  const handleDelete = async (id: string) => { /* ... */ };
  const summary = useMemo(() => { /* ... */ }, [records]);
  const exportToExcel = async () => { /* ... */ };
  const handleTemplateDownload = () => { /* ... */ };

  // 导入核心逻辑区
  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
  const getImportPreview = async (validRows: any[]) => { /* ... */ };
  const executeFinalImport = async () => { /* ... */ };
  const handleToggleDuplicateApproval = (index: number) => { /* ... */ };
  const handleToggleAllDuplicates = () => { /* ... */ };
  const closeImportModal = () => { /* ... */ };
  
  // UI渲染
  return (
    <div className="space-y-4">
      {/* 页面标题和按钮 */}
      <div className="flex justify-between items-center">{/* ... */}</div>
      {/* 筛选区域 */}
      <div className="flex items-end gap-4 p-4 border rounded-lg">{/* ... */}</div>
      {/* 表格区域 */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>{/* ... */}</TableHeader>
          <TableBody>
            {loading ? ( <TableRow><TableCell colSpan={10} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow> ) 
            : records.length === 0 ? ( <TableRow><TableCell colSpan={10} className="text-center h-24">在当前筛选条件下没有找到记录</TableCell></TableRow> ) 
            : ( records.map((record) => ( <TableRow key={record.id} onClick={() => setViewingRecord(record)} className="cursor-pointer hover:bg-muted/50">{/* ... */}</TableRow> )) )}
          </TableBody>
        </Table>
      </div>
      {/* 分页组件 */}
      <Pagination>{/* ... */}</Pagination>
      {/* 数据汇总栏 */}
      <div className="flex items-center justify-end space-x-6 rounded-lg border p-4 text-sm font-medium">{/* ... */}</div>
      {/* 新增/编辑/查看弹窗 */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>{/* ... */}</Dialog>
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>{/* ... */}</Dialog>
      {/* 全新的批量导入流程弹窗 */}
      <Dialog open={isImportModalOpen} onOpenChange={(isOpen) => !isOpen && closeImportModal()}>
        <DialogContent className="max-w-4xl">{/* ... */}</DialogContent>
      </Dialog>
    </div>
  );
}
