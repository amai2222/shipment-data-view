// 开票申请页面 - 完全参考付款申请页面的数据结构和显示方式
// 文件路径: src/pages/InvoiceRequest.tsx

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Search, Receipt, Save, ListPlus, ChevronUp, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFilterState } from "@/hooks/useFilterState";
import { format } from "date-fns";
// ✅ 修改：移除日期转换函数，直接传递中国时区日期字符串给后端
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { InvoiceRequestFilterBar } from "@/pages/InvoiceRequest/components/InvoiceRequestFilterBar";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";
import { TableSkeleton, PageSummaryPagination, SummaryCard, generateSummaryTitle, type PageSummaryItem, type SummaryItem } from "@/components/common";
import { useUnifiedPermissions } from '@/hooks/useUnifiedPermissions';

// ✅ 合计卡片组件
const InvoiceSummaryCard = ({ 
  summaryData, 
  activeFilters,
  projects = []
}: { 
  summaryData: {
    totalCount: number;
    totalDriverReceivable: number;
    totalInvoiceableAmount: number;
    totalWeightLoading: number;
    totalWeightUnloading: number;
    totalTrips: number;
    totalVolumeLoading: number;
    totalVolumeUnloading: number;
    totalPiecesLoading: number;
    totalPiecesUnloading: number;
  };
  activeFilters: InvoiceFilters;
  projects?: Array<{id: string, name: string}>;
}) => {
  // ✅ 使用公共合计卡片组件
  const summaryTitle = generateSummaryTitle(activeFilters as unknown as Record<string, unknown>, projects);
  
  const summaryItems: SummaryItem[] = useMemo(() => {
    const items: SummaryItem[] = [
      { 
        label: '', 
        value: `${summaryData.totalCount}条运单`,
        formatter: (val) => <span>{val}</span>
      },
      { 
        label: '司机应收', 
        value: summaryData.totalDriverReceivable,
        className: 'text-green-600'
      },
      { 
        label: '开票金额', 
        value: summaryData.totalInvoiceableAmount,
        className: 'text-primary'
      }
    ];

    if (summaryData.totalWeightLoading > 0) {
      items.push({
        label: '计重合计',
        value: `装 ${summaryData.totalWeightLoading.toFixed(2)}吨 / 卸 ${summaryData.totalWeightUnloading.toFixed(2)}吨`,
        className: 'text-primary',
        formatter: (val) => <span className="font-bold">{val}</span>
      });
    }
    if (summaryData.totalTrips > 0) {
      items.push({
        label: '计车合计',
        value: `${summaryData.totalTrips.toFixed(0)}车`,
        className: 'text-primary',
        formatter: (val) => <span className="font-bold">{val}</span>
      });
    }
    if (summaryData.totalVolumeLoading > 0) {
      items.push({
        label: '计体积合计',
        value: `装 ${summaryData.totalVolumeLoading.toFixed(2)}立方 / 卸 ${summaryData.totalVolumeUnloading.toFixed(2)}立方`,
        className: 'text-primary',
        formatter: (val) => <span className="font-bold">{val}</span>
      });
    }
    if (summaryData.totalPiecesLoading > 0) {
      items.push({
        label: '计件合计',
        value: `装 ${summaryData.totalPiecesLoading.toFixed(0)}件 / 卸 ${summaryData.totalPiecesUnloading.toFixed(0)}件`,
        className: 'text-primary',
        formatter: (val) => <span className="font-bold">{val}</span>
      });
    }

    return items;
  }, [summaryData]);

  return <SummaryCard title={summaryTitle} items={summaryItems} />;
};

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
  tax_number?: string;
  company_address?: string;
  id?: string;
  logistics_record_id?: string;
}

// 开票申请筛选器类型
interface InvoiceFilters {
  waybillNumbers?: string;
  driverName?: string;
  licensePlate?: string;
  driverPhone?: string;
  projectId: string;
  partnerId: string;
  startDate: string;
  endDate: string;
  invoiceStatus: string;
  driverReceivable?: string;
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
  total_invoiceable_for_partner?: number;
}

// RPC 返回的数据类型
interface InvoiceRequestResponse {
  records?: LogisticsRecord[];
  partners?: Array<{
    partner_id: string;
    partner_name: string;
    total_payable: number;
  }>;
  overview?: {
    total_invoiceable_cost: number;
  };
  count?: number;
}

// project_partners 查询返回的类型
interface ProjectPartnerData {
  partner_id: string;
  level: number;
  partners: {
    name: string;
  };
}


interface PaginationState { 
  currentPage: number; 
  totalPages: number;
  pageSize: number;
  totalCount: number;
}

interface SelectionState { 
  mode: 'none' | 'all_filtered'; 
  selectedIds: Set<string>; 
}

interface InvoicePreviewSheet { 
  invoicing_partner_id: string; 
  invoicing_partner_full_name: string; 
  invoicing_partner_tax_number?: string;
  invoicing_partner_company_address?: string;
  invoicing_partner_bank_account: string; 
  invoicing_partner_bank_name: string; 
  invoicing_partner_branch_name: string; 
  record_count: number; 
  total_invoiceable: number; 
  records: Array<LogisticsRecord & { total_invoiceable_for_partner?: number }>;
  partner_costs?: PartnerCost[];
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
  { value: 'Processing', label: '已申请开票' }, 
  { value: 'Approved', label: '开票审核通过' }, 
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
    
    return format(chinaDate, "yyyy/MM/dd");
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
  const { hasButtonAccess } = useUnifiedPermissions();
  
  // --- State 管理 ---
  const [reportData, setReportData] = useState<InvoiceRequestResponse | null>(null);
  const [allPartners, setAllPartners] = useState<{id: string, name: string, level: number}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingRecord, setViewingRecord] = useState<(LogisticsRecordWithPartners & { total_invoiceable_for_partner?: number }) | null>(null);
  const { toast} = useToast();
  
  // 排序状态
  const [sortField, setSortField] = useState<string>('loading_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAllLevels, setShowAllLevels] = useState(false); // 控制是否显示所有层级的合作方
  const { uiFilters, setUiFilters, activeFilters, handleSearch, handleClear, isStale } = useFilterState(INITIAL_INVOICE_FILTERS);
  const [pagination, setPagination] = useState<PaginationState>({ 
    currentPage: 1, 
    totalPages: 1,
    pageSize: PAGE_SIZE,
    totalCount: 0
  });
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
      const { data: partnersData } = await supabase
        .from('project_partners')
        .select(`partner_id, level, partners!inner(name)`)
        .returns<ProjectPartnerData[]>();
      const uniquePartners = Array.from(
        new Map(
          (partnersData || []).map((p: ProjectPartnerData) => [ 
            p.partner_id, 
            { id: p.partner_id, name: p.partners.name, level: p.level } 
          ])
        ).values()
      ).sort((a, b) => a.level - b.level);
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
          'Approved': 'Approved',
          'Invoiced': 'Invoiced',
          '已开票': 'Invoiced',
          '未开票': 'Uninvoiced',
          '已申请开票': 'Processing',
          '开票审核通过': 'Approved'
        };
        const mappedStatus = statusMap[activeFilters.invoiceStatus] || activeFilters.invoiceStatus;
        statusArray = [mappedStatus];
      }
      // 将中国时区的日期转换为 UTC 日期（用于数据库查询）
      // ✅ 修改：直接传递中国时区日期字符串，后端函数会处理时区转换
      // ✅ 辅助函数：将空字符串转换为 null
      const toNullIfEmpty = (value: string | null | undefined): string | null => {
        return (value && value.trim() !== '' && value !== 'all') ? value.trim() : null;
      };
      
      const { data, error } = await supabase.rpc('get_invoice_request_data_1120', {
        p_project_id: toNullIfEmpty(activeFilters.projectId),
        p_start_date: toNullIfEmpty(activeFilters.startDate),
        p_end_date: toNullIfEmpty(activeFilters.endDate),
        p_partner_id: toNullIfEmpty(activeFilters.partnerId),
        p_invoice_status_array: statusArray,
        p_page_size: pagination.pageSize,
        p_page_number: pagination.currentPage,
        // 新增高级筛选参数
        p_waybill_numbers: toNullIfEmpty(activeFilters.waybillNumbers),
        p_driver_name: toNullIfEmpty(activeFilters.driverName),
        p_license_plate: toNullIfEmpty(activeFilters.licensePlate),
        p_driver_phone: toNullIfEmpty(activeFilters.driverPhone),
        p_driver_receivable: toNullIfEmpty(activeFilters.driverReceivable),
      });
      if (error) throw error;
      setReportData(data);
      const totalCount = (data as InvoiceRequestResponse)?.count || 0;
      setPagination(prev => ({ 
        ...prev, 
        totalPages: Math.ceil(totalCount / prev.pageSize) || 1,
        totalCount: totalCount
      }));
    } catch (error) {
      console.error("加载开票申请数据失败:", error);
      toast({ 
        title: "错误", 
        description: `加载开票申请数据失败: ${error instanceof Error ? error.message : String(error)}`, 
        variant: "destructive" 
      });
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [activeFilters, pagination.currentPage, pagination.pageSize, toast]);

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

  // 排序处理函数
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // 排序后的数据
  const sortedRecords = useMemo<LogisticsRecord[]>(() => {
    if (!reportData?.records || !Array.isArray(reportData.records)) return [];
    
    const records = [...reportData.records];
    records.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'loading_date':
          aVal = new Date(a.loading_date).getTime();
          bVal = new Date(b.loading_date).getTime();
          break;
        case 'auto_number':
          aVal = a.auto_number;
          bVal = b.auto_number;
          break;
        case 'driver_name':
          aVal = a.driver_name || '';
          bVal = b.driver_name || '';
          break;
        case 'payable_cost':
          aVal = a.payable_cost || 0;
          bVal = b.payable_cost || 0;
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      
      // 次级排序：按运单编号
      if (sortField !== 'auto_number') {
        return a.auto_number < b.auto_number ? -1 : 1;
      }
      return 0;
    });
    
    return records;
  }, [reportData?.records, sortField, sortDirection]);

  // ✅ 计算本页合计数据（用于分页底部显示）
  const pageSummary = useMemo(() => {
    if (!sortedRecords || sortedRecords.length === 0) {
      return {
        totalDriverReceivable: 0,
        totalInvoiceableAmount: 0,
      };
    }

    return sortedRecords.reduce((acc, record) => {
      // 司机应收合计
      acc.totalDriverReceivable += record.payable_cost || 0;
      
      // 开票金额合计（从 partner_costs 中计算）
      if (record.partner_costs && Array.isArray(record.partner_costs)) {
        const invoiceableAmount = record.partner_costs.reduce((sum, cost) => sum + (cost.payable_amount || 0), 0);
        acc.totalInvoiceableAmount += invoiceableAmount;
      } else if ((record as LogisticsRecordWithPartners).total_invoiceable_for_partner) {
        acc.totalInvoiceableAmount += (record as LogisticsRecordWithPartners).total_invoiceable_for_partner || 0;
      }
      
      return acc;
    }, {
      totalDriverReceivable: 0,
      totalInvoiceableAmount: 0,
    });
  }, [sortedRecords]);

  // ✅ 计算合计数据
  const summaryData = useMemo(() => {
    if (!sortedRecords || sortedRecords.length === 0) {
      return {
        totalCount: 0,
        totalDriverReceivable: 0,
        totalInvoiceableAmount: 0,
        totalWeightLoading: 0,
        totalWeightUnloading: 0,
        totalTrips: 0,
        totalVolumeLoading: 0,
        totalVolumeUnloading: 0,
        totalPiecesLoading: 0,
        totalPiecesUnloading: 0,
      };
    }

    return sortedRecords.reduce((acc, record) => {
      const billingTypeId = record.billing_type_id || 1;
      const loadingWeight = record.loading_weight || 0;
      const unloadingWeight = record.unloading_weight || 0;
      
      // 司机应收合计
      acc.totalDriverReceivable += record.payable_cost || 0;
      
      // 开票金额合计（从 partner_costs 中计算）
      if (record.partner_costs && Array.isArray(record.partner_costs)) {
        const invoiceableAmount = record.partner_costs.reduce((sum, cost) => sum + (cost.payable_amount || 0), 0);
        acc.totalInvoiceableAmount += invoiceableAmount;
      } else if ((record as LogisticsRecordWithPartners).total_invoiceable_for_partner) {
        acc.totalInvoiceableAmount += (record as LogisticsRecordWithPartners).total_invoiceable_for_partner || 0;
      }
      
      // 根据计费类型统计数量
      switch (billingTypeId) {
        case 1: // 计重
          acc.totalWeightLoading += loadingWeight;
          acc.totalWeightUnloading += unloadingWeight;
          break;
        case 2: // 计车
          acc.totalTrips += 1;
          break;
        case 3: // 计体积
          acc.totalVolumeLoading += loadingWeight;
          acc.totalVolumeUnloading += unloadingWeight;
          break;
        case 4: // 计件
          acc.totalPiecesLoading += loadingWeight;
          acc.totalPiecesUnloading += unloadingWeight;
          break;
      }
      
      acc.totalCount += 1;
      return acc;
    }, {
      totalCount: 0,
      totalDriverReceivable: 0,
      totalInvoiceableAmount: 0,
      totalWeightLoading: 0,
      totalWeightUnloading: 0,
      totalTrips: 0,
      totalVolumeLoading: 0,
      totalVolumeUnloading: 0,
      totalPiecesLoading: 0,
      totalPiecesUnloading: 0,
    });
  }, [sortedRecords]);

  // 统一的数量显示函数，根据 billing_type_id 动态返回带单位的字符串（参考运单管理）
  const formatQuantity = (record: LogisticsRecord): string => {
    const billingTypeId = record.billing_type_id || 1;
    const loading = record.loading_weight || 0;
    const unloading = record.unloading_weight || 0;
    
    switch (billingTypeId) {
      case 1: return `${loading.toFixed(2)} / ${unloading.toFixed(2)} 吨`;
      case 2: return `1 车`;
      case 3: return `${loading.toFixed(2)} / ${unloading.toFixed(2)} 立方`;
      case 4: return `${loading.toFixed(0)} / ${unloading.toFixed(0)} 件`;
      default: return '-';
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'Uninvoiced':
        return <Badge variant="secondary" className="bg-gray-100">未开票</Badge>;
      case 'Processing':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">已申请开票</Badge>;
      case 'Approved':
        return <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">开票审核通过</Badge>;
      case 'Invoiced':
        return <Badge variant="outline" className="border-green-600 text-white bg-green-600">已开票</Badge>;
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
    const pageIds = (sortedRecords || []).map((r: LogisticsRecord) => r.id); 
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
        // ✅ 修改：直接传递中国时区日期字符串，后端函数会处理时区转换
        const { data: allData, error: allError } = await supabase.rpc('get_invoice_request_data_1120', {
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
        const allFilteredRecords = (allData as InvoiceRequestResponse)?.records || [];
        idsToProcess = allFilteredRecords.map((record) => record.id);
        allSelectedIds = idsToProcess; // 全选模式下，所有筛选的ID都是要处理的
      } else {
        allSelectedIds = Array.from(selection.selectedIds);
        idsToProcess = allSelectedIds;
      }

      // ✅ 检查运单状态，筛选出可处理的运单
      const { data: statusData, error: statusError } = await supabase
        .from('logistics_records')
        .select('id, auto_number, invoice_status')
        .in('id', allSelectedIds)
        .returns<Array<{ id: string; auto_number: string | null; invoice_status: string | null }>>();

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
      
      // ✅ 调试：查看每个运单的最高级别
      console.log('运单级别分析:');
      records.forEach(rec => {
        const levels = (rec.partner_costs || []).map((c: PartnerCost) => c.level);
        const recMaxLevel = levels.length > 0 ? Math.max(...levels) : 0;
        console.log(`${rec.auto_number}: maxLevel=${recMaxLevel}, costs=${rec.partner_costs?.length || 0}`);
      });

      // 按合作方分组（参考付款申请逻辑）
      let maxLevel = 0;
      for (const rec of records) {
        for (const cost of rec.partner_costs || []) {
          if (cost.level > maxLevel) {
            maxLevel = cost.level;
          }
        }
      }
      
      console.log('全局maxLevel:', maxLevel);

      const sheetMap = new Map<string, InvoicePreviewSheet & { partner_costs: Array<{
        id?: string;
        logistics_record_id: string;
        partner_id: string;
        payable_amount: number;
        invoice_status?: string;
      }> }>();

      for (const rec of records) {
        const costs = Array.isArray(rec.partner_costs) ? rec.partner_costs : [];
        if (costs.length === 0) continue;

        for (const cost of costs) {
          // ✅ 包含所有最高级合作方，即使金额为0（支持手动修改为0的情况）
          if (cost.level === maxLevel && (!cost.invoice_status || cost.invoice_status === 'Uninvoiced')) {
            const key = cost.partner_id;
            if (!sheetMap.has(key)) {
              sheetMap.set(key, {
                invoicing_partner_id: key,
                invoicing_partner_full_name: cost.full_name || cost.partner_name,
                invoicing_partner_tax_number: cost.tax_number || '',
                invoicing_partner_company_address: cost.company_address || '',
                invoicing_partner_bank_account: cost.bank_account || '',
                invoicing_partner_bank_name: cost.bank_name || '',
                invoicing_partner_branch_name: cost.branch_name || '',
                record_count: 0,
                total_invoiceable: 0,
                records: [],
                partner_costs: []  // ✅ 添加 partner_costs 数组
              });
            }

            const sheet = sheetMap.get(key);
            
            // ✅ 添加 partner_cost 信息到 sheet
            sheet.partner_costs.push({
              id: cost.id,
              logistics_record_id: rec.id,
              partner_id: cost.partner_id,
              payable_amount: cost.payable_amount,
              invoice_status: cost.invoice_status
            });
            
            // 检查是否已经添加了这个运单
            const existingRecord = sheet.records.find((r: LogisticsRecord) => r.id === rec.id);
            if (!existingRecord) {
              // 计算该运单对当前合作方的开票金额（允许0金额）
              const totalInvoiceableForPartner = costs
                .filter(c => c.partner_id === key && (!c.invoice_status || c.invoice_status === 'Uninvoiced'))
                .reduce((sum, c) => sum + (c.payable_amount || 0), 0);  // ✅ 允许0金额

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

      // ✅ 调试：检查每个sheet的partner_costs
      console.log('生成的sheets详情:');
      sheets.forEach((sheet, idx) => {
        console.log(`Sheet ${idx + 1} - ${sheet.invoicing_partner_full_name}:`);
        console.log(`  运单数: ${sheet.record_count}`);
        console.log(`  partner_costs数量: ${sheet.partner_costs?.length || 0}`);
        console.log(`  运单列表:`, sheet.records.map((r: LogisticsRecord) => r.auto_number));
        if (sheet.partner_costs) {
          console.log(`  partner_costs详情:`, sheet.partner_costs.map((c) => ({
            id: c.id ? '有' : '❌无',
            logistics_record_id: c.logistics_record_id,
            amount: c.payable_amount
          })));
        }
      });

      setInvoicePreviewData({ sheets, processed_record_ids: processedIds });
      setFinalInvoiceData({ sheets, all_record_ids: processedIds });
      setIsPreviewModalOpen(true);

    } catch (error) {
      console.error("生成开票申请预览失败:", error);
      toast({
        title: "错误",
        description: `生成开票申请预览失败: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveInvoiceRequest = async () => {
    // 权限检查
    if (!hasButtonAccess('finance.generate_invoice')) {
      toast({ 
        title: '权限不足', 
        description: '您没有生成发票的权限。请联系管理员在权限管理中分配 "finance.generate_invoice" 权限。', 
        variant: 'destructive' 
      });
      return;
    }

    if (!finalInvoiceData || !finalInvoiceData.all_record_ids || finalInvoiceData.all_record_ids.length === 0) return;

    setIsSaving(true);
    try {
      // ✅ 准备传递给后端的数据结构
      // 需要将 sheets 中的 partner_cost IDs 提取出来
      const allPartnerCostIds: string[] = [];
      finalInvoiceData.sheets.forEach((sheet: InvoicePreviewSheet) => {
        if (Array.isArray(sheet.partner_costs)) {
          sheet.partner_costs.forEach((cost: PartnerCost) => {
            if (cost.id) {
              allPartnerCostIds.push(cost.id);
            }
          });
        }
      });

      // ✅ 调试日志：查看传给后端的数据
      console.log('传给后端的sheets数量:', finalInvoiceData.sheets.length);
      console.log('传给后端的sheets:', finalInvoiceData.sheets.map((s: InvoicePreviewSheet) => ({
        partner: s.invoicing_partner_full_name,
        count: s.record_count,
        amount: s.total_invoiceable,
        has_partner_costs: Array.isArray(s.partner_costs) && s.partner_costs.length > 0,
        partner_costs_count: s.partner_costs?.length || 0
      })));
      console.log('传给后端的all_partner_cost_ids数量:', allPartnerCostIds.length);

      const { data, error } = await supabase.rpc('save_invoice_request_1126', {
        p_invoice_data: {
          sheets: finalInvoiceData.sheets,
          all_partner_cost_ids: allPartnerCostIds
        }
      });

      if (error) throw error;

      // 解析返回结果
      const result = data as { 
        success: boolean; 
        message: string;
        created_requests: Array<{
          request_number: string;
          partner_name: string;
          total_amount: number;
          record_count: number;
        }>; 
        total_requests: number;
        total_partner_costs: number;
      };

      // 根据创建的申请单数量显示不同的提示
      if (result.total_requests > 1) {
        const partnerList = result.created_requests
          .map(req => `${req.partner_name}(${req.record_count}条)`)
          .join('、');
        
        toast({
          title: "成功 - 已自动切分",
          description: `根据最高级合作方自动创建了 ${result.total_requests} 个开票申请单：${partnerList}，共处理 ${finalInvoiceData.all_record_ids.length} 条运单`,
          variant: "default",
          duration: 8000  // 信息较多，延长显示时间
        });
      } else {
        toast({
          title: "成功",
          description: `开票申请已成功创建，共处理 ${finalInvoiceData.all_record_ids.length} 条运单`,
          variant: "default"
        });
      }

      setIsPreviewModalOpen(false);
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchReportData();

    } catch (error) {
      console.error("保存开票申请失败:", error);
      
      // ✅ 改进错误处理：提取更友好的错误信息
      let errorMessage = '保存开票申请失败';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // 处理 Supabase 错误对象
        const supabaseError = error as { message?: string; details?: string; hint?: string; code?: string };
        if (supabaseError.message) {
          errorMessage = supabaseError.message;
        } else if (supabaseError.details) {
          errorMessage = supabaseError.details;
        } else {
          errorMessage = String(error);
        }
      } else {
        errorMessage = String(error);
      }
      
      toast({
        title: "错误",
        description: errorMessage,
        variant: "destructive",
        duration: 5000  // 延长显示时间，让用户有时间阅读错误信息
      });
    } finally {
      setIsSaving(false);
    }
  };

  // --- 计算派生状态 ---
  const displayedPartners = useMemo<Array<{id: string, name: string, level: number}>>(() => {
    if (uiFilters.partnerId !== "all") {
      const selected = allPartners.find(p => p.id === uiFilters.partnerId);
      return selected ? [selected] : [];
    }
    if (!reportData || !Array.isArray(reportData.records)) return [];
    
    // 获取相关合作方和最高级别（包括0金额的记录，因为可能是手动修改）
    const relevantPartnerIds = new Set<string>();
    let maxLevel = 0;
    reportData.records.forEach((record: LogisticsRecord) => {
      if (record && Array.isArray(record.partner_costs)) {
        record.partner_costs.forEach((cost: PartnerCost) => {
          // ✅ 移除金额检查，允许显示0金额的合作方（支持手动修改为0的情况）
          relevantPartnerIds.add(cost.partner_id);
          if (cost.level > maxLevel) {
            maxLevel = cost.level;
          }
        });
      }
    });
    
    const filteredPartners = allPartners.filter(partner => relevantPartnerIds.has(partner.id)).sort((a, b) => a.level - b.level);
    
    // 根据 showAllLevels 决定是否只显示最高级
    if (!showAllLevels && maxLevel > 0) {
      return filteredPartners.filter(p => p.level === maxLevel);
    }
    return filteredPartners;
  }, [reportData, allPartners, uiFilters.partnerId, showAllLevels]);

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

      const uninvoicedCount = (statusData || []).filter((record: { id: string; invoice_status: string | null }) => record.invoice_status === 'Uninvoiced').length;
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
        {hasButtonAccess('finance.generate_invoice') && !isStale && reportData && Array.isArray(reportData.records) && reportData.records.length > 0 && (
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
          onFiltersChange={(filters) => setUiFilters(filters)} 
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
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-background to-muted/10 border-b">
              <div>
                <CardTitle className="text-lg">运单开票明细</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {totalRecords} 条记录 • {showAllLevels ? '显示所有层级的合作方' : '仅显示最高级合作方'}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAllLevels(!showAllLevels)} 
                className="w-full sm:w-auto whitespace-nowrap hover:bg-primary/10 transition-colors"
              >
                {showAllLevels ? '仅显示最高级' : '展示全部级别'}
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rowCount={10} colCount={12} showCheckbox={true} />
              ) : (
                <>
                  {/* ✅ 合计卡片 */}
                  {!loading && sortedRecords && sortedRecords.length > 0 && (
                    <div className="mb-4">
                      <InvoiceSummaryCard 
                        summaryData={summaryData}
                        activeFilters={activeFilters}
                        projects={projects}
                      />
                    </div>
                  )}
                  
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
                                    ref={(el) => {
                                      if (el) {
                                        const input = el.querySelector('input');
                                        if (input && input instanceof HTMLInputElement) {
                                          input.indeterminate = someOnCurrentPageSelected;
                                        }
                                      }
                                    }}
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
                          <TableHead className="min-w-[120px] sticky left-12 bg-background z-10 whitespace-nowrap font-medium cursor-pointer hover:bg-muted/50" onClick={() => handleSort('auto_number')}>
                            <div className="flex items-center gap-1">
                              运单号
                              {sortField === 'auto_number' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                            </div>
                          </TableHead>
                          <TableHead className="min-w-[100px] whitespace-nowrap">项目</TableHead>
                          <TableHead className="min-w-[80px] whitespace-nowrap cursor-pointer hover:bg-muted/50" onClick={() => handleSort('driver_name')}>
                            <div className="flex items-center gap-1">
                              司机
                              {sortField === 'driver_name' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                            </div>
                          </TableHead>
                          <TableHead className="min-w-[140px] whitespace-nowrap">路线</TableHead>
                          <TableHead className="min-w-[100px] whitespace-nowrap hidden sm:table-cell">装/卸数量</TableHead>
                          <TableHead className="min-w-[120px] whitespace-nowrap hidden md:table-cell cursor-pointer hover:bg-muted/50" onClick={() => handleSort('loading_date')}>
                            <div className="flex items-center gap-1">
                              装货日期
                              {sortField === 'loading_date' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                            </div>
                          </TableHead>
                          <TableHead className="min-w-[100px] whitespace-nowrap font-bold text-primary cursor-pointer hover:bg-muted/50" onClick={() => handleSort('payable_cost')}>
                            <div className="flex items-center gap-1">
                              司机应收
                              {sortField === 'payable_cost' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                            </div>
                          </TableHead>
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
                        {Array.isArray(sortedRecords) && sortedRecords.map((r: LogisticsRecordWithPartners) => (
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
                            <TableCell className="cursor-pointer whitespace-nowrap font-bold text-primary" onClick={() => setViewingRecord(r)}>
                              <CurrencyDisplay 
                                value={
                                  r.payable_cost || 
                                  (Array.isArray(r.partner_costs) && r.partner_costs.find((c: PartnerCost) => c.level === 0)?.payable_amount) ||
                                  r.current_cost ||
                                  null
                                }
                                className="text-primary"
                              />
                            </TableCell>
                            {Array.isArray(displayedPartners) && displayedPartners.map(p => { 
                              const cost = (Array.isArray(r.partner_costs) && r.partner_costs.find((c: PartnerCost) => c.partner_id === p.id)); 
                              return (
                                <TableCell key={p.id} className="text-center cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>
                                  <CurrencyDisplay value={cost?.payable_amount} />
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
                          <TableCell className="font-bold text-primary text-center whitespace-nowrap">
                            <div><CurrencyDisplay value={reportData?.overview?.total_invoiceable_cost} className="text-primary" /></div>
                            <div className="text-xs text-muted-foreground font-normal">(司机应收)</div>
                          </TableCell>
                          {Array.isArray(displayedPartners) && displayedPartners.map(p => { 
                            const partnerData = Array.isArray(reportData?.partners) 
                              ? reportData.partners.find((pp: { partner_id: string; partner_name: string; total_payable: number }) => pp.partner_id === p.id)
                              : undefined;
                            const total = partnerData?.total_payable || 0; 
                            return (
                              <TableCell key={p.id} className="text-center font-bold whitespace-nowrap">
                                <div><CurrencyDisplay value={total} /></div>
                                <div className="text-xs text-muted-foreground font-normal">({p.name})</div>
                              </TableCell>
                            );
                          })}
                          <TableCell className="whitespace-nowrap"></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* ✅ 使用公共分页组件 */}
                  <PageSummaryPagination
                    pagination={pagination}
                    onPaginationChange={(newPagination) => {
                      setPagination(newPagination);
                      // useEffect 会自动触发数据重新加载
                    }}
                    pageSummaryItems={[
                      { label: '司机应收', value: pageSummary.totalDriverReceivable },
                      { label: '开票金额', value: pageSummary.totalInvoiceableAmount }
                    ]}
                  />
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
                      <div>开票金额: <CurrencyDisplay value={sheet.total_invoiceable} /></div>
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
                              <TableHead className="text-right">司机应收</TableHead>
                              <TableHead className="text-right">开票金额</TableHead>
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
                                  {formatChineseDate(record.loading_date)}
                                </TableCell>
                                <TableCell className="text-sm text-right">
                                  <CurrencyDisplay value={record.payable_cost || 0} />
                                </TableCell>
                                <TableCell className="text-sm text-right">
                                  <CurrencyDisplay value={record.total_invoiceable_for_partner || 0} />
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
                金额合计: <CurrencyDisplay value={invoicePreviewData.sheets.reduce((sum, sheet) => sum + sheet.total_invoiceable, 0)} />
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
                <p>{formatChineseDate(viewingRecord.loading_date)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">开票状态</Label>
                <p>{getInvoiceStatusBadge(viewingRecord.invoice_status)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">应收金额（司机）</Label>
                <p className="font-bold text-primary"><CurrencyDisplay 
                  value={
                    viewingRecord.payable_cost || 
                    (Array.isArray(viewingRecord.partner_costs) && viewingRecord.partner_costs.find((c: PartnerCost) => c.level === 0)?.payable_amount) ||
                    viewingRecord.current_cost ||
                    null
                  }
                  className="text-primary"
                /></p>
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
                  <p><CurrencyDisplay value={viewingRecord.current_cost} /></p>
                </div>
              )}
              {viewingRecord.extra_cost && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">额外费用</Label>
                  <p><CurrencyDisplay value={viewingRecord.extra_cost} /></p>
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
