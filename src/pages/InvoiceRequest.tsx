// 开票申请页面 - 完全参考付款申请页面的数据结构和显示方式
// 文件路径: src/pages/InvoiceRequest.tsx

import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Search, Receipt, Save, ListPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFilterState } from "@/hooks/useFilterState";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { InvoiceRequestFilterBar } from "@/pages/InvoiceRequest/components/InvoiceRequestFilterBar";

// --- 类型定义 (与付款申请完全一致) ---
interface PartnerCost { 
  partner_id: string; 
  partner_name: string; 
  level: number; 
  payable_amount: number; 
  invoice_status?: string;
  full_name?: string; 
  bank_account?: string; 
  bank_name?: string; 
  branch_name?: string; 
}

// 开票申请筛选器类型
interface InvoiceFilters {
  waybillNumbers: string;
  driverName: string;
  licensePlate: string;
  driverPhone: string;
  projectId: string;
  partnerId: string;
  startDate: string;
  endDate: string;
  invoiceStatus: string;
  driverReceivable: string;
}

interface LogisticsRecord { 
  id: string; 
  auto_number: string; 
  project_name: string; 
  driver_id: string; 
  driver_name: string; 
  loading_location: string; 
  unloading_location: string; 
  loading_date: string; 
  unloading_date: string | null; 
  license_plate: string | null; 
  driver_phone: string | null; 
  payable_cost: number | null; 
  partner_costs?: PartnerCost[]; 
  invoice_status: 'Uninvoiced' | 'Processing' | 'Invoiced'; 
  cargo_type: string | null; 
  loading_weight: number | null; 
  unloading_weight: number | null; 
  remarks: string | null; 
  billing_type_id: number | null; 
}

interface LogisticsRecordWithPartners extends LogisticsRecord { 
  current_cost?: number; 
  extra_cost?: number; 
  chain_name?: string | null; 
}


interface PaginationState { 
  currentPage: number; 
  totalPages: number; 
}

interface SelectionState { 
  mode: 'none' | 'all_filtered'; 
  selectedIds: Set<string>; 
}

interface InvoicePreviewSheet { 
  invoicing_partner_id: string; 
  invoicing_partner_full_name: string; 
  invoicing_partner_bank_account: string; 
  invoicing_partner_bank_name: string; 
  invoicing_partner_branch_name: string; 
  record_count: number; 
  total_invoiceable: number; 
  records: LogisticsRecord[]; 
}

interface InvoicePreviewData { 
  sheets: InvoicePreviewSheet[]; 
  processed_record_ids: string[]; 
}

interface FinalInvoiceData { 
  sheets: InvoicePreviewSheet[]; 
  all_record_ids: string[]; 
}

// --- 常量和初始状态 ---
const PAGE_SIZE = 50;
const INITIAL_INVOICE_FILTERS: InvoiceFilters = { 
  waybillNumbers: "",
  driverName: "",
  licensePlate: "",
  driverPhone: "",
  projectId: "all", 
  partnerId: "all", 
  startDate: "", 
  endDate: "",
  invoiceStatus: "all",
  driverReceivable: "",
};

const INVOICE_STATUS_OPTIONS = [ 
  { value: 'all', label: '所有状态' }, 
  { value: 'Uninvoiced', label: '未开票' }, 
  { value: 'Processing', label: '开票中' }, 
  { value: 'Invoiced', label: '已开票' }, 
];

// 日期格式化函数 - 将UTC日期转换为中国时区日期显示
const formatChineseDate = (dateString: string): string => {
  if (!dateString) return '-';
  try {
    // 如果日期字符串没有时间部分，添加UTC时间
    const utcDateString = dateString.includes('T') ? dateString : dateString + 'T00:00:00Z';
    const utcDate = new Date(utcDateString);
    
    // 转换为中国时区 (UTC+8)
    const chinaDate = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
    
    return format(chinaDate, "yyyy-MM-dd");
  } catch (error) {
    console.error('日期格式化错误:', error);
    return dateString;
  }
};

const StaleDataPrompt = () => ( 
  <div className="text-center py-10 border rounded-lg bg-muted/20"> 
    <Search className="mx-auto h-12 w-12 text-muted-foreground" /> 
    <h3 className="mt-2 text-sm font-semibold text-foreground">筛选条件已更改</h3> 
    <p className="mt-1 text-sm text-muted-foreground">请点击"搜索"按钮以查看最新结果。</p> 
  </div> 
);

export default function InvoiceRequest() {
  // --- State 管理 ---
  const [reportData, setReportData] = useState<any>(null);
  const [allPartners, setAllPartners] = useState<{id: string, name: string, level: number}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecordWithPartners | null>(null);
  const { toast } = useToast();
  const { uiFilters, setUiFilters, activeFilters, handleSearch, handleClear, isStale } = useFilterState(INITIAL_INVOICE_FILTERS);
  const [pagination, setPagination] = useState<PaginationState>({ currentPage: 1, totalPages: 1 });
  const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set() });
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [invoicePreviewData, setInvoicePreviewData] = useState<InvoicePreviewData | null>(null);
  const [finalInvoiceData, setFinalInvoiceData] = useState<FinalInvoiceData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [processableCount, setProcessableCount] = useState<number>(0); // 可处理的运单数量

  // --- 数据获取 ---
  const fetchInitialOptions = useCallback(async () => {
    try {
      const { data: projectsData } = await supabase.from('projects').select('id, name').order('name');
      setProjects(projectsData || []);
      const { data: partnersData } = await supabase.from('project_partners').select(`partner_id, level, partners!inner(name)`);
      const uniquePartners = Array.from(new Map(partnersData?.map(p => [ 
        p.partner_id, 
        { id: p.partner_id, name: (p.partners as any).name, level: p.level } 
      ]) || []).values()).sort((a, b) => a.level - b.level);
      setAllPartners(uniquePartners);
    } catch (error) {
      toast({ title: "错误", description: "加载筛选选项失败", variant: "destructive" });
    }
  }, [toast]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      // 状态映射：前端中文状态 -> 后端英文状态
      let statusArray: string[] | null = null;
      if (activeFilters.invoiceStatus && activeFilters.invoiceStatus !== 'all') {
        const statusMap: { [key: string]: string } = {
          'Uninvoiced': 'Uninvoiced',
          'Processing': 'Processing', 
          'Invoiced': 'Invoiced',
          '已开票': 'Invoiced',
          '未开票': 'Uninvoiced',
          '开票中': 'Processing'
        };
        const mappedStatus = statusMap[activeFilters.invoiceStatus] || activeFilters.invoiceStatus;
        statusArray = [mappedStatus];
      }
      const { data, error } = await supabase.rpc('get_invoice_request_data', {
        p_project_id: activeFilters.projectId === 'all' ? null : activeFilters.projectId,
        p_start_date: activeFilters.startDate || null,
        p_end_date: activeFilters.endDate || null,
        p_partner_id: activeFilters.partnerId === 'all' ? null : activeFilters.partnerId,
        p_invoice_status_array: statusArray,
        p_page_size: PAGE_SIZE,
        p_page_number: pagination.currentPage,
        // 新增高级筛选参数
        p_waybill_numbers: activeFilters.waybillNumbers || null,
        p_driver_name: activeFilters.driverName || null,
        p_license_plate: activeFilters.licensePlate || null,
        p_driver_phone: activeFilters.driverPhone || null,
        p_driver_receivable: activeFilters.driverReceivable || null,
      });
      if (error) throw error;
      setReportData(data);
      setPagination(prev => ({ 
        ...prev, 
        totalPages: Math.ceil(((data as any)?.count || 0) / PAGE_SIZE) || 1 
      }));
    } catch (error) {
      console.error("加载开票申请数据失败:", error);
      toast({ 
        title: "错误", 
        description: `加载开票申请数据失败: ${(error as any).message}`, 
        variant: "destructive" 
      });
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [activeFilters, pagination.currentPage, toast]);

  // --- 效果钩子 ---
  useEffect(() => {
    fetchInitialOptions();
  }, [fetchInitialOptions]);

  useEffect(() => {
    if (!isStale) {
      fetchReportData();
    } else {
      setLoading(false);
      setReportData(null);
    }
  }, [fetchReportData, isStale]);

  useEffect(() => {
    setPagination(p => p.currentPage === 1 ? p : { ...p, currentPage: 1 });
    setSelection({ mode: 'none', selectedIds: new Set() });
  }, [activeFilters]);

  useEffect(() => {
    if (pagination.currentPage > 1) {
      fetchReportData();
    }
  }, [pagination.currentPage, fetchReportData]);

  // --- 工具函数 ---
  const formatCurrency = (value: number | null | undefined): string => {
    if (value == null) return '-';
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
  };

  const simplifyRoute = (loading?: string, unloading?: string): string => { 
    const start = (loading || '').substring(0, 2); 
    const end = (unloading || '').substring(0, 2); 
    return `${start}→${end}`; 
  };

  const getBillingUnit = (billingTypeId: number | null | undefined): string => {
    switch (billingTypeId) {
      case 1: return '吨';
      case 2: return '车';
      case 3: return '立方';
      default: return '';
    }
  };

  const formatQuantity = (record: LogisticsRecord): string => {
    const unit = getBillingUnit(record.billing_type_id);
    const loadingText = record.loading_weight ?? '-';
    const unloadingText = record.unloading_weight ?? '-';
    return `${loadingText} / ${unloadingText} ${unit}`;
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'Uninvoiced':
        return <Badge variant="secondary" className="bg-gray-100">未开票</Badge>;
      case 'Processing':
        return <Badge variant="default" className="bg-yellow-500">申请中</Badge>;
      case 'Invoiced':
        return <Badge variant="default" className="bg-green-500">已开票</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };


  const handleFilterChange = (key: keyof InvoiceFilters, value: string) => {
    setUiFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleRecordSelect = (recordId: string) => { 
    setSelection(prev => { 
      const newSet = new Set(prev.selectedIds); 
      if (newSet.has(recordId)) { 
        newSet.delete(recordId); 
      } else { 
        newSet.add(recordId); 
      } 
      if (prev.mode === 'all_filtered') { 
        return { mode: 'none', selectedIds: newSet }; 
      } 
      return { ...prev, selectedIds: newSet }; 
    }); 
  };

  const handleSelectAllOnPage = (isChecked: boolean) => { 
    const pageIds = (reportData?.records || []).map((r: LogisticsRecord) => r.id); 
    if (isChecked) { 
      setSelection(prev => ({ 
        ...prev, 
        selectedIds: new Set([...prev.selectedIds, ...pageIds]) 
      })); 
    } else { 
      setSelection(prev => { 
        const newSet = new Set(prev.selectedIds); 
        pageIds.forEach(id => newSet.delete(id)); 
        return { ...prev, selectedIds: newSet }; 
      }); 
    } 
  };

  const handleSelectAllFiltered = () => {
    setSelection(prev => ({
      ...prev,
      mode: 'all_filtered',
      selectedIds: new Set()
    }));
  };

  const handleApplyForInvoiceClick = async () => {
    const isCrossPageSelection = selection.mode === 'all_filtered';
    const selectionCount = selection.selectedIds.size;

    if (!isCrossPageSelection && selectionCount === 0) {
      toast({ title: "提示", description: "请先选择需要申请开票的运单。" });
      return;
    }

    setIsGenerating(true);
    try {
      let idsToProcess: string[] = [];
      let allSelectedIds: string[] = [];

      if (isCrossPageSelection) {
        // 使用与主查询相同的逻辑获取所有筛选条件下的运单ID
        const { data: allData, error: allError } = await supabase.rpc('get_invoice_request_data', {
          p_project_id: activeFilters.projectId === 'all' ? null : activeFilters.projectId,
          p_start_date: activeFilters.startDate || null,
          p_end_date: activeFilters.endDate || null,
          p_partner_id: activeFilters.partnerId === 'all' ? null : activeFilters.partnerId,
          p_invoice_status_array: null, // 获取所有状态
          p_page_size: 1000,
          p_page_number: 1,
          // 新增高级筛选参数
          p_waybill_numbers: activeFilters.waybillNumbers || null,
          p_driver_name: activeFilters.driverName || null,
          p_license_plate: activeFilters.licensePlate || null,
          p_driver_phone: activeFilters.driverPhone || null,
          p_driver_receivable: activeFilters.driverReceivable || null,
        });

        if (allError) throw allError;
        
        // 后端已经处理了高级筛选，直接使用结果
        const allFilteredRecords = allData?.records || [];
        idsToProcess = allFilteredRecords.map(record => record.id);
        allSelectedIds = idsToProcess; // 全选模式下，所有筛选的ID都是要处理的
      } else {
        allSelectedIds = Array.from(selection.selectedIds);
        idsToProcess = allSelectedIds;
      }

      // ✅ 检查运单状态，筛选出可处理的运单
      const { data: statusData, error: statusError } = await supabase
        .from('logistics_records')
        .select('id, auto_number, invoice_status')
        .in('id', allSelectedIds);

      if (statusError) throw statusError;

      const statusMap = new Map(statusData?.map(record => [record.id, record]) || []);
      
      // 分类运单状态
      const uninvoicedIds: string[] = [];
      const processingIds: string[] = [];
      const invoicedIds: string[] = [];
      const processingNumbers: string[] = [];
      const invoicedNumbers: string[] = [];

      for (const id of allSelectedIds) {
        const record = statusMap.get(id);
        if (record) {
          switch (record.invoice_status) {
            case 'Uninvoiced':
              uninvoicedIds.push(id);
              break;
            case 'Processing':
              processingIds.push(id);
              processingNumbers.push(record.auto_number);
              break;
            case 'Invoiced':
              invoicedIds.push(id);
              invoicedNumbers.push(record.auto_number);
              break;
          }
        }
      }

      // 显示状态提示
      if (processingIds.length > 0 || invoicedIds.length > 0) {
        let message = "以下运单已开票或开票中，将自动略过：\n";
        if (processingNumbers.length > 0) {
          message += `开票中：${processingNumbers.join(', ')}\n`;
        }
        if (invoicedNumbers.length > 0) {
          message += `已开票：${invoicedNumbers.join(', ')}\n`;
        }
        message += `\n将处理 ${uninvoicedIds.length} 条未开票运单。`;
        
        toast({ 
          title: "状态检查", 
          description: message,
          duration: 5000
        });
      }

      // 只处理未开票的运单
      idsToProcess = uninvoicedIds;

      if (idsToProcess.length === 0) {
        toast({ 
          title: "无可处理运单", 
          description: "所选运单都已开票或开票中，没有可申请开票的运单。" 
        });
        setIsGenerating(false);
        return;
      }

      const { data: v2Data, error: rpcError } = await supabase.rpc('get_invoice_data_by_record_ids', {
        p_record_ids: idsToProcess
      });

      if (rpcError) throw rpcError;

      const v2 = (v2Data as { records?: LogisticsRecord[] }) || {};
      const records: LogisticsRecord[] = Array.isArray(v2.records) ? v2.records : [];
      
      // 按合作方分组（参考付款申请逻辑）
      let maxLevel = 0;
      for (const rec of records) {
        for (const cost of rec.partner_costs || []) {
          if (cost.level > maxLevel) {
            maxLevel = cost.level;
          }
        }
      }

      const sheetMap = new Map<string, any>();

      for (const rec of records) {
        const costs = Array.isArray(rec.partner_costs) ? rec.partner_costs : [];
        if (costs.length === 0) continue;

        for (const cost of costs) {
          if (cost.level === maxLevel && (!cost.invoice_status || cost.invoice_status === 'Uninvoiced')) {
            const key = cost.partner_id;
            if (!sheetMap.has(key)) {
              sheetMap.set(key, {
                invoicing_partner_id: key,
                invoicing_partner_full_name: cost.full_name || cost.partner_name,
                invoicing_partner_bank_account: cost.bank_account || '',
                invoicing_partner_bank_name: cost.bank_name || '',
                invoicing_partner_branch_name: cost.branch_name || '',
                record_count: 0,
                total_invoiceable: 0,
                records: []
              });
            }

            const sheet = sheetMap.get(key);
            
            // 检查是否已经添加了这个运单
            const existingRecord = sheet.records.find((r: any) => r.id === rec.id);
            if (!existingRecord) {
              // 计算该运单对当前合作方的开票金额
              const totalInvoiceableForPartner = costs
                .filter(c => c.partner_id === key && (!c.invoice_status || c.invoice_status === 'Uninvoiced'))
                .reduce((sum, c) => sum + c.payable_amount, 0);

              sheet.records.push({
                ...rec,
                total_invoiceable_for_partner: totalInvoiceableForPartner
              });
              sheet.record_count += 1;
              sheet.total_invoiceable += totalInvoiceableForPartner;
            }
          }
        }
      }

      const sheets = Array.from(sheetMap.values());
      const processedIds = idsToProcess;

      setInvoicePreviewData({ sheets, processed_record_ids: processedIds });
      setFinalInvoiceData({ sheets, all_record_ids: processedIds });
      setIsPreviewModalOpen(true);

    } catch (error) {
      console.error("生成开票申请预览失败:", error);
      toast({
        title: "错误",
        description: `生成开票申请预览失败: ${(error as any).message}`,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveInvoiceRequest = async () => {
    if (!finalInvoiceData || !finalInvoiceData.all_record_ids || finalInvoiceData.all_record_ids.length === 0) return;

    setIsSaving(true);
    try {
      // ✅ 方案A：统一逻辑，只传运单ID数组（与付款申请一致）
      const { data, error } = await supabase.rpc('save_invoice_request', {
        p_record_ids: finalInvoiceData.all_record_ids
      });

      if (error) throw error;

      toast({
        title: "成功",
        description: `开票申请已成功创建，共处理 ${finalInvoiceData.all_record_ids.length} 条运单`,
        variant: "default"
      });

      setIsPreviewModalOpen(false);
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchReportData();

    } catch (error) {
      console.error("保存开票申请失败:", error);
      toast({
        title: "错误",
        description: `保存开票申请失败: ${(error as any).message}`,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // --- 计算派生状态 ---
  const displayedPartners = useMemo(() => {
    if (uiFilters.partnerId !== "all") {
      const selected = allPartners.find(p => p.id === uiFilters.partnerId);
      return selected ? [selected] : [];
    }
    if (!reportData || !Array.isArray(reportData.records)) return [];
    
    // 使用与付款申请页面相同的逻辑：直接从records中的partner_costs获取
    const relevantPartnerIds = new Set<string>();
    reportData.records.forEach((record: any) => {
      if (record && Array.isArray(record.partner_costs)) {
        record.partner_costs.forEach((cost: any) => {
          // 只有当payable_amount大于0时才添加到相关合作方列表
          if (cost.payable_amount && cost.payable_amount > 0) {
            relevantPartnerIds.add(cost.partner_id);
          }
        });
      }
    });
    
    return allPartners.filter(partner => relevantPartnerIds.has(partner.id)).sort((a, b) => a.level - b.level);
  }, [reportData, allPartners, uiFilters.partnerId]);

  const currentPageRecords = reportData?.records || [];
  const totalRecords = reportData?.count || 0;
  const selectedOnCurrentPage = currentPageRecords.filter((r: LogisticsRecord) => selection.selectedIds.has(r.id)).length;
  const allOnCurrentPageSelected = currentPageRecords.length > 0 && selectedOnCurrentPage === currentPageRecords.length;
  const someOnCurrentPageSelected = selectedOnCurrentPage > 0 && selectedOnCurrentPage < currentPageRecords.length;
  
  const selectionCount = useMemo(() => {
    if (selection.mode === 'all_filtered') return reportData?.count || 0;
    return selection.selectedIds.size;
  }, [selection, reportData?.count]);

  // 计算可处理的运单数量
  const calculateProcessableCount = useCallback(async () => {
    if (!reportData?.records || !Array.isArray(reportData.records)) {
      setProcessableCount(0);
      return;
    }

    try {
      let recordIds: string[] = [];
      
      if (selection.mode === 'all_filtered') {
        // 全选模式：计算所有筛选结果中未开票的运单数量
        recordIds = reportData.records.map(record => record.id);
      } else {
        // 单选模式：只计算已选择的运单
        recordIds = Array.from(selection.selectedIds);
      }

      if (recordIds.length === 0) {
        setProcessableCount(0);
        return;
      }

      const { data: statusData, error } = await supabase
        .from('logistics_records')
        .select('id, invoice_status')
        .in('id', recordIds);

      if (error) {
        console.error('获取运单状态失败:', error);
        setProcessableCount(0);
        return;
      }

      const uninvoicedCount = statusData?.filter(record => record.invoice_status === 'Uninvoiced').length || 0;
      setProcessableCount(uninvoicedCount);
    } catch (error) {
      console.error('计算可处理运单数量失败:', error);
      setProcessableCount(0);
    }
  }, [reportData?.records, selection.mode, selection.selectedIds]);

  // 当数据变化时重新计算可处理数量
  useEffect(() => {
    calculateProcessableCount();
  }, [calculateProcessableCount]);

  // --- 渲染 ---
  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="开票申请管理" 
        description="向合作方申请开具发票"
        icon={Receipt}
        iconColor="text-green-600"
      >
        {!isStale && reportData && Array.isArray(reportData.records) && reportData.records.length > 0 && (
          <Button variant="default" disabled={(selection.mode !== 'all_filtered' && selection.selectedIds.size === 0) || isGenerating || processableCount === 0} onClick={handleApplyForInvoiceClick}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
            一键申请开票 ({processableCount})
          </Button>
        )}
      </PageHeader>

      <div className="space-y-6">
        {/* 筛选条件 */}
        <InvoiceRequestFilterBar 
          filters={uiFilters} 
          onFiltersChange={setUiFilters} 
          onSearch={handleSearch} 
          onClear={handleClear} 
          loading={loading} 
          projects={projects} 
        />

      {/* 数据表格 */}
      {isStale ? (
        <StaleDataPrompt />
      ) : (
        <>
          {/* 操作栏 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    已选择 {selection.selectedIds.size} 条运单
                    {selection.mode === 'all_filtered' && ` (跨页选择)`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                运单记录 ({totalRecords} 条记录)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-4 px-4">
                    <Table className="min-w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 sticky left-0 bg-background z-10">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 hover:bg-blue-100 rounded-md"
                                >
                                  <Checkbox 
                                    checked={allOnCurrentPageSelected}
                                    ref={(el) => el && (el.indeterminate = someOnCurrentPageSelected)}
                                    className="h-3.5 w-3.5"
                                  />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onSelect={() => handleSelectAllOnPage(true)}>
                                  选择当前页 ({reportData?.records?.length || 0})
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleSelectAllOnPage(false)}>
                                  取消选择当前页
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={handleSelectAllFiltered}>
                                  选择所有 {totalRecords} 条记录
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableHead>
                          <TableHead className="min-w-[120px] sticky left-12 bg-background z-10 whitespace-nowrap font-medium">运单号</TableHead>
                          <TableHead className="min-w-[100px] whitespace-nowrap">项目</TableHead>
                          <TableHead className="min-w-[80px] whitespace-nowrap">司机</TableHead>
                          <TableHead className="min-w-[140px] whitespace-nowrap">路线</TableHead>
                          <TableHead className="min-w-[100px] whitespace-nowrap hidden sm:table-cell">装/卸数量</TableHead>
                          <TableHead className="min-w-[120px] whitespace-nowrap hidden md:table-cell">装货日期</TableHead>
                          <TableHead className="min-w-[100px] whitespace-nowrap font-bold text-primary">司机应收</TableHead>
                          {Array.isArray(displayedPartners) && displayedPartners.map(p => (
                            <TableHead key={p.id} className="min-w-[100px] text-center whitespace-nowrap">
                              <div className="text-xs font-medium">{p.name}</div>
                              <div className="text-xs text-muted-foreground">({p.level}级)</div>
                            </TableHead>
                          ))}
                          <TableHead className="min-w-[80px] whitespace-nowrap">开票状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.isArray(reportData?.records) && reportData.records.map((r: LogisticsRecordWithPartners) => (
                          <TableRow key={r.id} data-state={selection.selectedIds.has(r.id) && "selected"}>
                            <TableCell className="sticky left-0 bg-background z-10 whitespace-nowrap">
                              <Checkbox 
                                checked={selection.mode === 'all_filtered' || selection.selectedIds.has(r.id)} 
                                onCheckedChange={() => handleRecordSelect(r.id)} 
                              />
                            </TableCell>
                            <TableCell className="font-mono cursor-pointer sticky left-12 bg-background z-10 whitespace-nowrap font-medium" onClick={() => setViewingRecord(r)}>
                              {r.auto_number}
                            </TableCell>
                            <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>
                              <div className="max-w-[100px] truncate" title={r.project_name}>{r.project_name}</div>
                            </TableCell>
                            <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>
                              <div className="max-w-[80px] truncate" title={r.driver_name}>{r.driver_name}</div>
                            </TableCell>
                            <TableCell className="text-sm cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>
                              <div className="max-w-[140px] truncate" title={`${r.loading_location} → ${r.unloading_location}`}>
                                {simplifyRoute(r.loading_location, r.unloading_location)}
                              </div>
                            </TableCell>
                            <TableCell className="cursor-pointer whitespace-nowrap hidden sm:table-cell" onClick={() => setViewingRecord(r)}>
                              {formatQuantity(r)}
                            </TableCell>
                            <TableCell className="cursor-pointer whitespace-nowrap hidden md:table-cell" onClick={() => setViewingRecord(r)}>
                              {formatChineseDate(r.loading_date)}
                            </TableCell>
                            <TableCell className="font-mono cursor-pointer whitespace-nowrap font-bold text-primary" onClick={() => setViewingRecord(r)}>
                              {formatCurrency(r.payable_cost)}
                            </TableCell>
                            {Array.isArray(displayedPartners) && displayedPartners.map(p => { 
                              const cost = (Array.isArray(r.partner_costs) && r.partner_costs.find((c:any) => c.partner_id === p.id)); 
                              return (
                                <TableCell key={p.id} className="font-mono text-center cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>
                                  {formatCurrency(cost?.payable_amount)}
                                </TableCell>
                              ); 
                            })}
                            <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>
                              {getInvoiceStatusBadge(r.invoice_status)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-semibold border-t-2">
                          <TableCell colSpan={7} className="text-right font-bold whitespace-nowrap">合计</TableCell>
                          <TableCell className="font-mono font-bold text-primary text-center whitespace-nowrap">
                            <div>{formatCurrency(reportData?.overview?.total_invoiceable_cost)}</div>
                            <div className="text-xs text-muted-foreground font-normal">(司机应收)</div>
                          </TableCell>
                          {Array.isArray(displayedPartners) && displayedPartners.map(p => { 
                            const total = (Array.isArray(reportData?.partner_invoiceables) && reportData.partner_invoiceables.find((pp: any) => pp.partner_id === p.id)?.total_payable) || 0; 
                            return (
                              <TableCell key={p.id} className="text-center font-bold font-mono whitespace-nowrap">
                                <div>{formatCurrency(total)}</div>
                                <div className="text-xs text-muted-foreground font-normal">({p.name})</div>
                              </TableCell>
                            );
                          })}
                          <TableCell className="whitespace-nowrap"></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* 分页 */}
                  <div className="mt-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                            className={cn(pagination.currentPage <= 1 && "pointer-events-none opacity-50")}
                          />
                        </PaginationItem>
                        
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                          const pageNum = i + 1;
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => setPagination(prev => ({ ...prev, currentPage: pageNum }))}
                                isActive={pagination.currentPage === pageNum}
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.min(prev.totalPages, prev.currentPage + 1) }))}
                            className={cn(pagination.currentPage >= pagination.totalPages && "pointer-events-none opacity-50")}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* 预览对话框 */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>开票申请预览</DialogTitle>
            <DialogDescription>
              请确认以下开票申请信息，确认无误后点击保存。
            </DialogDescription>
          </DialogHeader>

          {invoicePreviewData && (
            <div className="space-y-6">
              {invoicePreviewData.sheets.map((sheet, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {sheet.invoicing_partner_full_name}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>运单数量: {sheet.record_count} 条</div>
                      <div>开票金额: {formatCurrency(sheet.total_invoiceable)}</div>
                    </div>
                  </CardHeader>
                  
                  {/* 运单明细 */}
                  <CardContent>
                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-muted-foreground">运单明细</h4>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>运单号</TableHead>
                              <TableHead>项目</TableHead>
                              <TableHead>司机</TableHead>
                              <TableHead>路线</TableHead>
                              <TableHead>装货日期</TableHead>
                              <TableHead>开票金额</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sheet.records.map((record) => (
                              <TableRow key={record.id}>
                                <TableCell className="font-mono text-sm">
                                  {record.auto_number}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {record.project_name}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {record.driver_name}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {record.loading_location} → {record.unloading_location}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {record.loading_date}
                                </TableCell>
                                <TableCell className="text-sm font-mono">
                                  {formatCurrency(record.total_invoiceable_for_partner || 0)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <div className="text-sm text-muted-foreground">
                总计: {invoicePreviewData.processed_record_ids.length} 条运单，
                金额合计: {formatCurrency(invoicePreviewData.sheets.reduce((sum, sheet) => sum + sheet.total_invoiceable, 0))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveInvoiceRequest} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存开票申请
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={!!viewingRecord} onOpenChange={() => setViewingRecord(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>运单详情</DialogTitle>
          </DialogHeader>
          
          {viewingRecord && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <Label className="text-muted-foreground">运单号</Label>
                <p className="font-mono">{viewingRecord.auto_number}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">项目</Label>
                <p>{viewingRecord.project_name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">司机</Label>
                <p>{viewingRecord.driver_name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">装货地点</Label>
                <p>{viewingRecord.loading_location}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">卸货地点</Label>
                <p>{viewingRecord.unloading_location}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">装货日期</Label>
                <p>{viewingRecord.loading_date}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">开票状态</Label>
                <p>{getInvoiceStatusBadge(viewingRecord.invoice_status)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">应收金额</Label>
                <p className="font-mono font-bold text-primary">{formatCurrency(viewingRecord.payable_cost)}</p>
              </div>
              
              {viewingRecord.loading_weight && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">装货重量</Label>
                  <p>{viewingRecord.loading_weight} 吨</p>
                </div>
              )}
              {viewingRecord.unloading_weight && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">卸货重量</Label>
                  <p>{viewingRecord.unloading_weight} 吨</p>
                </div>
              )}
              {viewingRecord.current_cost && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">运费金额</Label>
                  <p className="font-mono">{formatCurrency(viewingRecord.current_cost)}</p>
                </div>
              )}
              {viewingRecord.extra_cost && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">额外费用</Label>
                  <p className="font-mono">{formatCurrency(viewingRecord.extra_cost)}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
