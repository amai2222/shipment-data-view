// 文件路径: src/pages/BusinessEntry.tsx

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BusinessEntryHeader } from "@/components/business/BusinessEntryHeader";
import { BusinessEntryFilters } from "@/components/business/BusinessEntryFilters";
import { BusinessEntryTable } from "@/components/business/BusinessEntryTable";
import { BusinessEntryPagination } from "@/components/business/BusinessEntryPagination";
import { BusinessEntrySummary } from "@/components/business/BusinessEntrySummary";
import { BusinessEntryEditModal } from "@/components/business/BusinessEntryEditModal";
import { BusinessEntryImportModal } from "@/components/business/BusinessEntryImportModal";
import ExcelWorker from '@/excel.worker?worker';

// 类型定义 (与之前一致)
interface LogisticsRecord {
  id: string; auto_number: string; project_id: string; project_name: string; chain_id: string | null; chain_name: string | null;
  driver_id: string; driver_name: string; loading_location: string; unloading_location: string; loading_date: string;
  unloading_date: string | null;
  loading_weight: number | null; unloading_weight: number | null; current_cost: number | null;
  payable_cost: number | null;
  license_plate: string | null; driver_phone: string | null; transport_type: string | null;
  extra_cost: number | null; remarks: string | null;
}
interface Project { id: string; name: string; start_date: string; }
interface Driver { id: string; name: string; license_plate: string | null; phone: string | null; }
interface Location { id: string; name:string; }
interface PartnerChain { id: string; chain_name: string; }

// 辅助函数 (与之前一致)
const getInitialDefaultDates = () => { /* ... */ };
const BLANK_FORM_DATA = { /* ... */ };
const parseExcelDate = (excelDate: any): string | null => { /* ... */ };

// 主组件
export default function BusinessEntry() {
  // --- 状态管理 ---
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
  const [filters, setFilters] = useState({ /* ... */ });
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 15;

  // --- 【新】处理重复冲突的状态 ---
  const [conflictData, setConflictData] = useState<any | null>(null);

  // --- 导入相关的状态 ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<'idle' | 'preprocessing' | 'preview' | 'processing'>('idle');
  const [importData, setImportData] = useState<{ valid: any[], invalid: any[], duplicates: any[] }>({ 
    valid: [], invalid: [], duplicates: [] 
  });
  const [preprocessingProgress, setPreprocessingProgress] = useState(0);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const importLogRef = useRef<HTMLDivElement>(null);

  // --- 【新】处理导入时强制覆盖的状态 ---
  const [forceImportDuplicates, setForceImportDuplicates] = useState(false);


  // --- 数据加载和副作用 (与之前基本一致) ---
  const loadInitialOptions = useCallback(async () => { /* ... */ }, [toast]);
  const loadPaginatedRecords = useCallback(async () => { /* ... */ }, [currentPage, filters, toast]);
  useEffect(() => { loadInitialOptions(); }, [loadInitialOptions]);
  useEffect(() => { const timer = setTimeout(() => { loadPaginatedRecords(); }, 500); return () => clearTimeout(timer); }, [currentPage, filters, loadPaginatedRecords]);
  useEffect(() => { if (currentPage !== 1) { setCurrentPage(1); } }, [filters]);
  useEffect(() => { if (importLogRef.current) { importLogRef.current.scrollTop = importLogRef.current.scrollHeight; } }, [importLogs]);
  const handleInputChange = (field: string, value: any) => { setFormData((prev: any) => ({ ...prev, [field]: value })); };
  // ... 其他联动 useEffect ...


  // --- 【核心改动】升级 handleSubmit 以处理重复冲突 ---
  const handleSubmit = async (isForced = false) => {
    const dataToSubmit = isForced && conflictData ? conflictData : formData;
    if (!dataToSubmit) return;

    // 此处省略了大量的验证和数据准备逻辑，因为它们与之前版本相同...
    // 包括：获取项目名称、处理司机信息（get_or_create_driver）、处理地点信息等。
    // 我们直接跳到调用 RPC 的部分
    let finalDriverId = dataToSubmit.driver_id; // 假设这之前的逻辑都已完成

    try {
      if (editingRecord) {
        // 更新逻辑保持不变，通常不检查重复
        await supabase.rpc('update_logistics_record_with_costs', { /* ... */ });
        toast({ title: "成功", description: "运单记录已更新" });
      } else {
        // 新增逻辑调用新的检查函数
        const { data, error } = await supabase.rpc('create_logistics_record_with_check', {
          // 这里需要确保参数名与您在 Supabase 中定义的函数完全匹配
          p_project_name: projects.find(p => p.id === dataToSubmit.project_id)?.name,
          p_driver_name: dataToSubmit.driver_name,
          p_cooperative_partner: partnerChains.find(c => c.id === dataToSubmit.chain_id)?.chain_name || null,
          p_license_plate: dataToSubmit.license_plate,
          p_loading_location: dataToSubmit.loading_location,
          p_unloading_location: dataToSubmit.unloading_location,
          p_loading_date: parseExcelDate(dataToSubmit.loading_date),
          p_loading_weight: dataToSubmit.loading_weight ? parseFloat(dataToSubmit.loading_weight) : null,
          p_unloading_weight: dataToSubmit.unloading_weight ? parseFloat(dataToSubmit.unloading_weight) : null,
          p_freight_cost: dataToSubmit.current_cost ? parseFloat(dataToSubmit.current_cost) : null,
          p_force_create: isForced
        });
        
        if (error) throw error;
        
        if (data.status === 'conflict') {
          // 如果后端返回冲突，暂存当前表单数据并打开确认对话框
          setConflictData(dataToSubmit);
          return; // 阻止后续操作
        } else if (data.status === 'success') {
          // 如果成功
          toast({ title: "成功", description: "新运单已添加" });
        }
      }
      // 成功后的收尾工作
      setIsEditModalOpen(false);
      setConflictData(null);
      loadPaginatedRecords();
    } catch (error: any) {
      toast({ title: "操作失败", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => { /* ... */ };
  const summary = useMemo(() => { /* ... */ }, [records]);
  const exportToExcel = async () => { /* ... */ };
  const handleTemplateDownload = () => { /* ... */ };

  // --- 文件导入逻辑 (核心改动) ---
  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportModalOpen(true);
    setImportStep('preprocessing');
    setImportLogs(['[系统] 正在安全地解析文件并与数据库预校验，请稍候...']);
    setPreprocessingProgress(0); // 可以在此使用不确定进度条

    const worker = new ExcelWorker();
    const reader = new FileReader();

    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      worker.postMessage(arrayBuffer);
    };

    worker.onmessage = (e) => {
      const { success, data, error } = e.data;
      if (success) {
        toast({ title: "预处理完成", description: "请检查并确认导入数据。" });
        setImportData(data); // data 现在包含 valid, invalid, 和 duplicates
        setImportStep('preview');
        setForceImportDuplicates(false); // 每次都重置复选框
      } else {
        toast({ title: "文件处理失败", description: error, variant: "destructive" });
        closeImportModal();
      }
      worker.terminate();
    };

    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const startActualImport = async () => {
    setImportStep('processing');
    setImportLogs([]);
    
    // 合并"新记录"和用户选择要强制导入的"重复记录"
    let recordsToImport = [...importData.valid];
    if (forceImportDuplicates) {
      recordsToImport = [...recordsToImport, ...importData.duplicates];
    }

    if (recordsToImport.length === 0) {
      toast({ title: "无数据可导入", description: "没有可导入的新记录。" });
      setImportStep('preview');
      return;
    }
    
    const addLog = (message: string) => setImportLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    addLog(`开始批量导入... 共 ${recordsToImport.length} 条记录。`);

    try {
      // 此处假设您有一个简单的批量插入函数`batch_insert_logistics_records`
      // 因为所有检查都已在前端完成
      const batchRecords = recordsToImport.map(row => ({
          project_name: row['项目名称']?.trim(),
          driver_name: row['司机姓名']?.trim(),
          cooperative_partner: row['合作链路']?.trim() || null,
          license_plate: row['车牌号']?.toString().trim() || null,
          loading_location: row['装货地点']?.trim(),
          unloading_location: row['卸货地点']?.trim(),
          loading_date: parseExcelDate(row['装货日期']),
          loading_weight: row['装货重量'] ? parseFloat(row['装货重量']) : null,
          unloading_weight: row['卸货重量'] ? parseFloat(row['卸货重量']) : null,
          freight_cost: row['运费金额'] ? parseFloat(row['运费金额']) : null
      }));

      // 分块插入以避免Payload过大
      const CHUNK_SIZE = 100;
      for (let i = 0; i < batchRecords.length; i += CHUNK_SIZE) {
        const chunk = batchRecords.slice(i, i + CHUNK_SIZE);
        addLog(`正在导入 ${i + 1} 到 ${i + chunk.length} 条记录...`);
        const { error } = await supabase.from('logistics_records').insert(chunk);
        if (error) throw new Error(`批次 ${i/CHUNK_SIZE + 1} 导入失败: ${error.message}`);
      }
      
      addLog(`--------------------`);
      addLog(`导入流程已完成！成功导入 ${recordsToImport.length} 条记录。`);
      toast({ title: "成功", description: `已成功导入 ${recordsToImport.length} 条记录！` });
      loadPaginatedRecords();
    } catch (error: any) {
      addLog(`导入发生错误: ${error.message}`);
      toast({ title: "错误", description: `导入失败: ${error.message}`, variant: "destructive" });
    }
  };


  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setTimeout(() => { // 延迟重置以避免UI闪烁
      setImportStep('idle');
      setImportData({ valid: [], invalid: [], duplicates: [] });
      setPreprocessingProgress(0);
      setImportLogs([]);
      setForceImportDuplicates(false);
    }, 300);
  }

  // --- UI 渲染 ---
  return (
    <div className="space-y-6">
      {/* 所有的 Header, Filters, Table 等组件保持不变 */}
      {/* ... */}
      <BusinessEntryImportModal
        isOpen={isImportModalOpen}
        onClose={closeImportModal}
        importStep={importStep}
        preprocessingProgress={preprocessingProgress}
        importData={importData}
        importLogs={importLogs}
        importLogRef={importLogRef}
        onFileUpload={handleExcelImport}
        onStartImport={startActualImport}
        isImporting={importStep === 'processing'}
        forceImportDuplicates={forceImportDuplicates}
        onForceImportDuplicatesChange={setForceImportDuplicates}
      />

      <AlertDialog open={!!conflictData} onOpenChange={() => setConflictData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>检测到重复记录</AlertDialogTitle>
            <AlertDialogDescription>
              系统中已存在一条具有相同项目、司机、路线、日期和重量的运单。您确定要创建一条完全相同的记录吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConflictData(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSubmit(true)}>
              强制创建
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
