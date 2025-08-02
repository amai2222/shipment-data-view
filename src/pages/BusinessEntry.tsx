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

// 2. TypeScript 类型定义 (保持不变)
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

// 3. 辅助函数和常量定义 (保持不变)
const getInitialDefaultDates = () => { /* ... */ };
const BLANK_FORM_DATA = { /* ... */ };
const parseExcelDate = (excelDate: any): string | null => { /* ... */ };

// 4. 主组件定义
export default function BusinessEntry() {
  // 状态管理 (保留您所有的原有状态)
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
  const navigate = useNavigate();

  // [核心修改] 升级原有的导入状态，以支持新的“预览-确认-执行”流程
  const [isImporting, setIsImporting] = useState(false); // 保留，用于禁用按钮
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const importLogRef = useRef<HTMLDivElement>(null);

  // [新增] 替换旧的 importData 和 importStep 状态，使其更强大
  const [importStep, setImportStep] = useState<'idle' | 'preprocessing' | 'preview' | 'confirmation' | 'processing'>('idle');
  const [importPreview, setImportPreview] = useState<{
    new_records: any[],
    duplicate_records: any[],
    error_records: any[]
  } | null>(null);
  const [approvedDuplicates, setApprovedDuplicates] = useState<Set<number>>(new Set());


  // 数据加载逻辑 (保持不变)
  const loadInitialOptions = useCallback(async () => { /* ... */ }, [toast]);
  const loadPaginatedRecords = useCallback(async () => { /* ... */ }, [currentPage, filters, toast]);
  
  // 副作用管理 (保持不变)
  useEffect(() => { loadInitialOptions(); }, [loadInitialOptions]);
  useEffect(() => { /* ... */ }, [currentPage, filters, loadPaginatedRecords]);
  useEffect(() => { /* ... */ }, [filters]);
  useEffect(() => { /* ... */ }, [importLogs]);
  useEffect(() => { /* ... */ }, [formData.project_id, drivers, locations]);
  useEffect(() => { /* ... */ }, [formData.driver_id, drivers]);
  useEffect(() => { /* ... */ }, [formData.current_cost, formData.extra_cost]);
  useEffect(() => { /* ... */ }, [formData.loading_date]);
  
  // 原有事件处理器 (全部保留，不做任何修改)
  const handleInputChange = (field: string, value: any) => { /* ... */ };
  const handleOpenModal = (record: LogisticsRecord | null = null) => { /* ... */ };
  const handleSubmit = async () => { /* ... */ };
  const handleDelete = async (id: string) => { /* ... */ };
  const exportToExcel = async () => { /* ... */ };
  const handleTemplateDownload = () => { /* ... */ };
  const summary = useMemo(() => { /* ... */ }, [records]);


  // ==================================================================
  // [核心修改] 全新的、分步的批量导入核心逻辑区
  // ==================================================================
  
  /**
   * 步骤 1: 用户选择Excel文件后触发，开始整个流程
   */
  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true); // 禁用按钮

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        setIsImportModalOpen(true);
        setImportStep('preprocessing');
        
        // 前端只做最基础的日期解析和数据整理
        const validRows: any[] = [];
        jsonData.forEach(row => {
            const loadingDateFormatted = parseExcelDate(row['装货日期']);
            if (loadingDateFormatted) {
                validRows.push({
                  ...row,
                  loading_date_parsed: loadingDateFormatted,
                  unloading_date_parsed: row['卸货日期'] ? parseExcelDate(row['卸货日期']) : loadingDateFormatted
                });
            }
        });

        // 将整理好的数据交给“审查官”函数进行后端校验
        getImportPreview(validRows);

      } catch (error) {
        toast({ title: "错误", description: "文件读取失败，请检查文件格式。", variant: "destructive" });
        closeImportModal();
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };
  
  /**
   * 步骤 2: 调用后端的“审查官”函数，获取详细的审查报告
   */
  const getImportPreview = async (validRows: any[]) => {
    setImportStep('preview');
    try {
      const recordsToPreview = validRows.map(rowData => ({
        // 此处字段必须与后端验重逻辑保持完全一致
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
      // 默认批准（勾选）所有检测到的重复项，让用户决定是否取消
      const initialApproved = new Set(previewResult.duplicate_records.map((_: any, index: number) => index));
      setApprovedDuplicates(initialApproved);
      
      // 进入确认步骤，向用户展示审查报告
      setImportStep('confirmation');
    
    } catch (error: any) {
      toast({ title: "预览失败", description: error.message, variant: "destructive" });
      closeImportModal();
    }
  };

  /**
   * 步骤 3: 用户点击最终确认按钮后，调用后端的“执行官”函数
   */
  const executeFinalImport = async () => {
    if (!importPreview) return;
    setImportStep('processing');
    setImportLogs([]); // 清空旧日志

    const addLog = (message: string) => setImportLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);

    // 组合最终要导入的记录列表
    const finalRecordsToImport = [
      ...importPreview.new_records.map(item => item.record), // 1. 所有新记录
      ...importPreview.duplicate_records // 2. 用户勾选了的重复记录
        .filter((_, index) => approvedDuplicates.has(index))
        .map(item => item.record)
    ];

    if (finalRecordsToImport.length === 0) {
      toast({ title: "操作完成", description: "没有选中任何需要导入的记录。" });
      setImportStep('confirmation'); // 返回上一步，避免关闭窗口
      return;
    }

    addLog(`准备导入 ${finalRecordsToImport.length} 条记录...`);

    try {
      // 调用我们已有的、可靠的执行函数
      const { data: result, error } = await supabase.rpc('batch_import_logistics_records', { p_records: finalRecordsToImport });
      if (error) throw error;
      
      addLog(`导入完成！成功: ${result.success_count}, 失败: ${result.error_count}`);
      if(result.error_count > 0) addLog(`失败详情: ${JSON.stringify(result.errors)}`)
      
      toast({ title:"导入成功", description: `共导入 ${result.success_count} 条记录。`});
      loadPaginatedRecords(); // 刷新主列表
      // 注意：此处不调用 closeImportModal()，让用户可以查看最终日志
    } catch (error: any) {
      addLog(`导入失败: ${error.message}`);
      toast({ title: "导入失败", description: error.message, variant: "destructive"});
    }
  };

  /**
   * 辅助函数：处理单个重复记录的勾选/取消
   */
  const handleToggleDuplicateApproval = (index: number) => {
    setApprovedDuplicates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) newSet.delete(index);
      else newSet.add(index);
      return newSet;
    });
  };

  /**
   * 辅助函数：处理“全选/全部取消”
   */
  const handleToggleAllDuplicates = () => {
    if (!importPreview) return;
    const allDuplicateIndices = Array.from({ length: importPreview.duplicate_records.length }, (_, i) => i);
    
    if (approvedDuplicates.size < importPreview.duplicate_records.length) {
      setApprovedDuplicates(new Set(allDuplicateIndices));
    } else {
      setApprovedDuplicates(new Set());
    }
  };

  /**
   * 辅助函数：关闭并重置导入弹窗的所有状态
   */
  const closeImportModal = () => {
    setIsImporting(false); // 重新启用按钮
    setIsImportModalOpen(false);
    setImportStep('idle');
    setImportPreview(null);
    setApprovedDuplicates(new Set());
    setImportLogs([]);
  }

  // 组件渲染 (保留您原有的UI结构)
  return (
    <div className="space-y-4">
      {/* 页面标题和按钮 (保持不变) */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">运单管理</h1>
          <p className="text-muted-foreground">录入、查询和管理所有运单记录</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTemplateDownload}><FileDown className="mr-2 h-4 w-4" />下载模板</Button>
          <Button variant="outline" asChild disabled={isImporting}>
            <Label htmlFor="excel-upload" className="cursor-pointer flex items-center">
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              导入Excel
              <Input id="excel-upload" type="file" className="hidden" onChange={handleExcelImport} accept=".xlsx, .xls" disabled={isImporting}/>
            </Label>
          </Button>
          <Button onClick={exportToExcel}><Download className="mr-2 h-4 w-4" />导出数据</Button>
          <Button onClick={() => handleOpenModal()}><PlusCircle className="mr-2 h-4 w-4" />新增运单</Button>
        </div>
      </div>
      
      {/* 筛选区域 (保持不变) */}
      <div className="flex items-end gap-4 p-4 border rounded-lg">
        {/* ... */}
      </div>

      {/* 表格区域 (保持不变) */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {/* ... */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? ( <TableRow><TableCell colSpan={10} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow> ) 
            : records.length === 0 ? ( <TableRow><TableCell colSpan={10} className="text-center h-24">没有找到匹配的记录</TableCell></TableRow> ) 
            : ( records.map((record) => ( <TableRow key={record.id} onClick={() => setViewingRecord(record)} className="cursor-pointer hover:bg-muted/50">{/* ... */}</TableRow> )) )}
          </TableBody>
        </Table>
      </div>

      {/* 分页组件 (保持不变) */}
      <Pagination>
        {/* ... */}
      </Pagination>

      {/* 数据汇总栏 (保持不变) */}
      <div className="flex items-center justify-end space-x-6 rounded-lg border p-4 text-sm font-medium">
        {/* ... */}
      </div>

      {/* 新增/编辑弹窗 (保持不变) */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        {/* ... */}
      </Dialog>
      
      {/* 查看详情弹窗 (保持不变) */}
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>
        {/* ... */}
      </Dialog>
      
      {/* ======================================================= */}
      {/* [核心修改区] 全新的批量导入流程弹窗 */}
      {/* ======================================================= */}
      <Dialog open={isImportModalOpen} onOpenChange={(isOpen) => !isOpen && closeImportModal()}>
        <DialogContent className="max-w-4xl">
           <DialogHeader><DialogTitle>导入运单数据</DialogTitle></DialogHeader>

           {/* 步骤 - 预处理中 */}
           {(importStep === 'preprocessing' || importStep === 'preview') && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary"/>
              <p className="text-muted-foreground">
                {importStep === 'preprocessing' ? '正在检查文件内容...' : '正在获取导入预览，请稍候...'}
              </p>
            </div>
           )}
           
           {/* 步骤 - 用户确认 */}
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
                   <h4 className="font-semibold text-lg text-yellow-800 dark:text-yellow-300">
                     发现 {importPreview.duplicate_records.length} 条疑似重复记录
                   </h4>
                   <p className="text-sm text-muted-foreground mb-4">
                     默认将全部导入。如果您确认某条是重复数据且不想再次导入，请取消勾选。
                   </p>
                   <div className="flex items-center space-x-2 p-2 border-b mb-2">
                     <Checkbox
                       id="select-all-duplicates"
                       checked={
                         approvedDuplicates.size > 0 && approvedDuplicates.size === importPreview.duplicate_records.length ? true
                         : approvedDuplicates.size > 0 ? 'indeterminate' : false
                       }
                       onCheckedChange={handleToggleAllDuplicates}
                     />
                     <label htmlFor="select-all-duplicates" className="font-medium cursor-pointer">
                       {approvedDuplicates.size < importPreview.duplicate_records.length ? '全选' : '全部取消'}
                     </label>
                   </div>
                   <div className="max-h-40 overflow-y-auto pr-2">
                      {importPreview.duplicate_records.map((item, index) => (
                        <div key={index} className="flex items-center space-x-2 p-2 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-800/30">
                           <Checkbox 
                             id={`dup-${index}`}
                             checked={approvedDuplicates.has(index)}
                             onCheckedChange={() => handleToggleDuplicateApproval(index)}
                           />
                           <label htmlFor={`dup-${index}`} className="text-sm cursor-pointer w-full">
                             {`${item.record.driver_name} | ${item.record.loading_location} | ${item.record.loading_date} | ${item.record.loading_weight || 'N/A'}吨`}
                           </label>
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
                 <Button onClick={executeFinalImport}>
                   确认并导入 ({importPreview.new_records.length + approvedDuplicates.size})
                 </Button>
               </div>
             </div>
           )}

           {/* 步骤 - 最终导入处理中 */}
           {importStep === 'processing' && ( 
             <div className="py-4 space-y-4">
               <h3 className="font-semibold">正在执行最终导入...</h3>
               <div ref={importLogRef} className="h-64 overflow-y-auto bg-gray-900 text-white font-mono text-xs p-4 rounded-md">
                 {importLogs.map((log, i) => <p key={i} className={log.includes('失败') ? 'text-red-400' : 'text-green-400'}>{log}</p>)}
               </div>
               <div className="text-center pt-4">
                 <Button onClick={closeImportModal}>关闭</Button>
               </div>
             </div>
           )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
