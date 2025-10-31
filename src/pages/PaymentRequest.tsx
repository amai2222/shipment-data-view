// ============================================================================
// 文件: PaymentRequest.tsx - 合作方付款申请页面
// ============================================================================
// 功能说明：
// 1. 运单财务对账数据展示（支持分页、筛选、排序）
// 2. 批量选择运单并生成付款申请
// 3. 单个/批量修改合作方运费
// 4. 单个/批量修改合作链路（自动重新计算成本）
// 5. 运单详情查看
// ============================================================================
// 版本: FINAL-WITH-ALL-FEATURES-AND-NO-OMISSIONS
// 文件大小: 1415行
// 最后更新: 2025-10-26
// ============================================================================

// ============================================================================
// 区域1: 依赖导入
// ============================================================================
import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Plus, Banknote, ChevronUp, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { useFilterState } from "@/hooks/useFilterState";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { BatchInputDialog } from "@/pages/BusinessEntry/components/BatchInputDialog";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
// ✅ 导入可复用组件
import { StatusBadge } from "@/components/common";

// 占位符图标组件
const Loader2 = ({ className }: { className?: string }) => <span className={className}>⏳</span>;
const Search = ({ className }: { className?: string }) => <span className={className}>🔍</span>;
const FileSpreadsheet = ({ className }: { className?: string }) => <span className={className}>📊</span>;
const EditIcon = ({ className }: { className?: string }) => <span className={className}>✏️</span>;
const LinkIcon = ({ className }: { className?: string }) => <span className={className}>🔗</span>;
const Hash = ({ className }: { className?: string }) => <span className={className}>#</span>;
const Phone = ({ className }: { className?: string }) => <span className={className}>📞</span>;
const FileText = ({ className }: { className?: string }) => <span className={className}>📄</span>;
const Users = ({ className }: { className?: string }) => <span className={className}>👥</span>;
const Building2 = ({ className }: { className?: string }) => <span className={className}>🏢</span>;

// ============================================================================
// 区域2: TypeScript类型定义
// ============================================================================
// 包含所有接口定义：运单、合作方、筛选器、分页、选择状态等
// ============================================================================
interface PartnerCost { partner_id: string; partner_name: string; level: number; payable_amount: number; full_name?: string; bank_account?: string; bank_name?: string; branch_name?: string; }
interface LogisticsRecord { id: string; auto_number: string; project_name: string; project_id?: string; driver_id: string; driver_name: string; loading_location: string; unloading_location: string; loading_date: string; unloading_date: string | null; license_plate: string | null; driver_phone: string | null; payable_cost: number | null; partner_costs?: PartnerCost[]; payment_status: 'Unpaid' | 'Processing' | 'Paid'; invoice_status?: 'Uninvoiced' | 'Processing' | 'Invoiced' | null; cargo_type: string | null; loading_weight: number | null; unloading_weight: number | null; remarks: string | null; billing_type_id: number | null; }
interface LogisticsRecordWithPartners extends LogisticsRecord { current_cost?: number; extra_cost?: number; chain_name?: string | null; chain_id?: string | null; }
interface FinanceFilters { 
  // 常规筛选
  projectId: string; 
  startDate: string; 
  endDate: string; 
  paymentStatus: string; 
  // 高级筛选
  partnerId: string; 
  driverName: string; 
  licensePlate: string; 
  driverPhone: string; 
  waybillNumbers: string; 
  otherPlatformName: string; 
}
interface PaginationState { currentPage: number; totalPages: number; }
interface SelectionState { mode: 'none' | 'all_filtered'; selectedIds: Set<string>; }
interface PaymentPreviewSheet { 
  paying_partner_id: string; 
  paying_partner_full_name: string; 
  paying_partner_bank_account: string; 
  paying_partner_bank_name: string; 
  paying_partner_branch_name: string; 
  record_count: number; 
  total_payable: number; 
  records: LogisticsRecord[]; 
}
interface PaymentPreviewData { sheets: PaymentPreviewSheet[]; processed_record_ids: string[]; }
interface FinalPaymentData { sheets: PaymentPreviewSheet[]; all_record_ids: string[]; }
interface PartnerChain { id: string; chain_name: string; is_default: boolean; }
interface EditPartnerCostData { recordId: string; recordNumber: string; partnerCosts: PartnerCost[]; driverPayableCost: number; }
interface EditChainData { recordId: string; recordNumber: string; projectId: string; currentChainName: string; }

// ============================================================================
// 区域3: 常量定义和初始状态
// ============================================================================
const PAGE_SIZE = 50;

// ✅ 支付状态配置（用于StatusBadge组件）
const PAYMENT_STATUS_CONFIG = {
  Unpaid: { label: '未支付', variant: 'destructive' as const },
  Processing: { label: '已申请支付', variant: 'secondary' as const },
  Paid: { label: '已完成支付', variant: 'default' as const },
};

const INITIAL_FINANCE_FILTERS: FinanceFilters = { 
  projectId: "all", 
  startDate: "", 
  endDate: "", 
  paymentStatus: 'Unpaid',
  partnerId: "all",
  driverName: "",
  licensePlate: "",
  driverPhone: "",
  waybillNumbers: "",
  otherPlatformName: ""
};
const PAYMENT_STATUS_OPTIONS = [ { value: 'all', label: '所有状态' }, { value: 'Unpaid', label: '未支付' }, { value: 'Processing', label: '已申请支付' }, { value: 'Paid', label: '已完成支付' }, ];
const StaleDataPrompt = () => ( <div className="text-center py-10 border rounded-lg bg-muted/20"> <Search className="mx-auto h-12 w-12 text-muted-foreground" /> <h3 className="mt-2 text-sm font-semibold text-foreground">筛选条件已更改</h3> <p className="mt-1 text-sm text-muted-foreground">请点击"搜索"按钮以查看最新结果。</p> </div> );

// ============================================================================
// 主组件: PaymentRequest
// ============================================================================
export default function PaymentRequest() {
  // ==========================================================================
  // 区域4: State状态管理
  // ==========================================================================
  // 包含：数据状态、筛选状态、分页状态、选择状态、对话框状态等
  // ==========================================================================
  const [reportData, setReportData] = useState<any>(null);
  const [allPartners, setAllPartners] = useState<{id: string, name: string, level: number}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecordWithPartners | null>(null);
  const { toast } = useToast();
  const { uiFilters, setUiFilters, activeFilters, handleSearch, handleClear, isStale } = useFilterState(INITIAL_FINANCE_FILTERS);
  const [pagination, setPagination] = useState<PaginationState>({ currentPage: 1, totalPages: 1 });
  const [showAdvanced, setShowAdvanced] = useState(false); // 控制高级筛选展开/收起
  const [platformOptions, setPlatformOptions] = useState<{platform_name: string; usage_count: number}[]>([]); // 动态平台选项
  const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set() });
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [paymentPreviewData, setPaymentPreviewData] = useState<PaymentPreviewData | null>(null);
  const [finalPaymentData, setFinalPaymentData] = useState<FinalPaymentData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [batchDialog, setBatchDialog] = useState<{
    isOpen: boolean;
    type: 'driver' | 'license' | 'phone' | 'waybill' | null;
  }>({ isOpen: false, type: null });
  const [showAllLevels, setShowAllLevels] = useState(false); // 控制是否显示所有层级的合作方
  const [editPartnerCostData, setEditPartnerCostData] = useState<EditPartnerCostData | null>(null);
  const [editChainData, setEditChainData] = useState<EditChainData | null>(null);
  const [availableChains, setAvailableChains] = useState<PartnerChain[]>([]);
  const [isLoadingChains, setIsLoadingChains] = useState(false);
  const [tempPartnerCosts, setTempPartnerCosts] = useState<(PartnerCost & { payable_amount: number | string })[]>([]);
  const [tempDriverCost, setTempDriverCost] = useState<number | string>(0);  // 临时司机应收（支持输入时的字符串状态）
  const [selectedChainId, setSelectedChainId] = useState<string>('');
  
  // 批量修改状态
  const [isBatchModifying, setIsBatchModifying] = useState(false);
  const [batchModifyType, setBatchModifyType] = useState<'cost' | 'chain' | null>(null);
  const [batchChainId, setBatchChainId] = useState<string>('');
  const [batchChains, setBatchChains] = useState<PartnerChain[]>([]);
  const [batchCostRecords, setBatchCostRecords] = useState<{
    id: string;
    auto_number: string;
    loading_date: string;
    driver_name: string;
    original_amount: number;           // 最高级合作方应收
    new_amount: string;                // 最高级合作方新应收
    original_driver_amount: number;    // 司机原应收
    new_driver_amount: string;         // 司机新应收
  }[]>([]);
  
  // 排序状态
  const [sortField, setSortField] = useState<string>('loading_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // ==========================================================================
  // 区域5: 数据获取函数
  // ==========================================================================
  // fetchInitialOptions: 获取项目和合作方列表（用于筛选器）
  // fetchReportData: 获取财务对账数据（运单列表）
  // ==========================================================================
  const fetchInitialOptions = useCallback(async () => {
    try {
      const { data: projectsData } = await supabase.from('projects').select('id, name').order('name');
      setProjects(projectsData || []);
      const { data: partnersData } = await supabase.from('project_partners').select(`partner_id, level, partners!inner(name)`);
      const uniquePartners = Array.from(new Map(partnersData?.map(p => [ p.partner_id, { id: p.partner_id, name: (p.partners as any).name, level: p.level } ]) || []).values()).sort((a, b) => a.level - b.level);
      setAllPartners(uniquePartners);
      
      // 加载动态平台选项
      const { data: platformsData } = await supabase.rpc('get_all_used_platforms');
      if (platformsData) {
        const fixedPlatforms = ['本平台', '中科智运', '中工智云', '可乐公司', '盼盼集团'];
        const dynamicPlatforms = (platformsData as {platform_name: string; usage_count: number}[]).filter(
          p => !fixedPlatforms.includes(p.platform_name)
        );
        setPlatformOptions(dynamicPlatforms);
      }
    } catch (error) {
      toast({ title: "错误", description: "加载筛选选项失败", variant: "destructive" });
    }
  }, [toast]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const statusArray = activeFilters.paymentStatus === 'all' ? null : [activeFilters.paymentStatus];
      const { data, error } = await supabase.rpc('get_payment_request_data', {
        p_project_id: activeFilters.projectId === 'all' ? null : activeFilters.projectId,
        p_start_date: activeFilters.startDate || null,
        p_end_date: activeFilters.endDate || null,
        p_payment_status_array: statusArray,
        p_partner_id: activeFilters.partnerId === 'all' ? null : activeFilters.partnerId,
        p_driver_name: activeFilters.driverName || null,
        p_license_plate: activeFilters.licensePlate || null,
        p_driver_phone: activeFilters.driverPhone || null,
        p_waybill_numbers: activeFilters.waybillNumbers || null,
        p_other_platform_name: activeFilters.otherPlatformName || null,
        p_page_size: PAGE_SIZE,
        p_page_number: pagination.currentPage,
      });
      if (error) throw error;
      setReportData(data);
      setPagination(prev => ({ ...prev, totalPages: Math.ceil(((data as any)?.count || 0) / PAGE_SIZE) || 1 }));
    } catch (error) {
      console.error("加载财务对账数据失败:", error);
      toast({ title: "错误", description: `加载财务对账数据失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeFilters, pagination.currentPage, toast]);

  useEffect(() => { fetchInitialOptions(); }, [fetchInitialOptions]);
  useEffect(() => { if (!isStale) { fetchReportData(); } else { setLoading(false); setReportData(null); } }, [fetchReportData, isStale]);
  useEffect(() => { setPagination(p => p.currentPage === 1 ? p : { ...p, currentPage: 1 }); setSelection({ mode: 'none', selectedIds: new Set() }); }, [activeFilters]);

  // ==========================================================================
  // 区域6: 工具函数
  // ==========================================================================
  // formatCurrency: 格式化货币
  // simplifyRoute: 简化路线显示
  // isRecordEditable: 检查运单是否可编辑
  // getUneditableReason: 获取不可编辑原因
  // getBillingUnit: 获取计费单位
  // formatQuantity: 格式化数量显示
  // ==========================================================================
  const formatCurrency = (value: number | null | undefined): string => { if (value == null) return '-'; return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value); };
  const simplifyRoute = (loading?: string, unloading?: string): string => { const start = (loading || '').substring(0, 2); const end = (unloading || '').substring(0, 2); return `${start}→${end}`; };
  const formatDate = (dateString: string | null | undefined): string => { if (!dateString) return '-'; return format(new Date(dateString), 'yyyy/MM/dd'); };
  
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
  const sortedRecords = useMemo(() => {
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
  
  // 检查运单是否可编辑（需要同时满足：未支付 且 未开票）
  const isRecordEditable = (record: LogisticsRecordWithPartners): boolean => {
    const isPaymentEditable = record.payment_status === 'Unpaid';
    const isInvoiceEditable = !record.invoice_status || record.invoice_status === 'Uninvoiced';
    return isPaymentEditable && isInvoiceEditable;
  };
  
  // 获取不可编辑的原因
  const getUneditableReason = (record: LogisticsRecordWithPartners): string => {
    if (record.payment_status !== 'Unpaid') {
      return record.payment_status === 'Processing' ? '已申请支付' : '已完成支付';
    }
    if (record.invoice_status && record.invoice_status !== 'Uninvoiced') {
      return record.invoice_status === 'Processing' ? '开票中' : '已开票';
    }
    return '';
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

  const handleFilterChange = <K extends keyof FinanceFilters>(field: K, value: FinanceFilters[K]) => { setUiFilters(prev => ({ ...prev, [field]: value })); };
  const handleDateChange = (dateRange: DateRange | undefined) => { setUiFilters(prev => ({ ...prev, startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '', endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '' })); };
  
  // 批量输入对话框处理
  const openBatchDialog = (type: 'driver' | 'license' | 'phone' | 'waybill') => { setBatchDialog({ isOpen: true, type }); };
  const closeBatchDialog = () => { setBatchDialog({ isOpen: false, type: null }); };
  const handleBatchConfirm = (values: string[]) => {
    // 运单管理版本的 BatchInputDialog onConfirm 回调传递的是 string[] 数组
    // 我们直接使用即可，不需要再 join
    const value = values.join(',');
    const type = batchDialog.type;
    if (type === 'driver') handleFilterChange('driverName', value);
    else if (type === 'license') handleFilterChange('licensePlate', value);
    else if (type === 'phone') handleFilterChange('driverPhone', value);
    else if (type === 'waybill') handleFilterChange('waybillNumbers', value);
  };
  const getCurrentBatchValue = () => {
    const type = batchDialog.type;
    if (type === 'driver') return uiFilters.driverName;
    if (type === 'license') return uiFilters.licensePlate;
    if (type === 'phone') return uiFilters.driverPhone;
    if (type === 'waybill') return uiFilters.waybillNumbers;
    return '';
  };
  const getBatchDialogConfig = () => {
    const type = batchDialog.type;
    if (type === 'driver') return { title: '批量输入司机姓名', placeholder: '请粘贴司机姓名，用换行或逗号分隔。', description: '支持批量输入多个司机姓名' };
    if (type === 'license') return { title: '批量输入车牌号', placeholder: '请粘贴车牌号，用换行或逗号分隔。', description: '支持批量输入多个车牌号' };
    if (type === 'phone') return { title: '批量输入电话号码', placeholder: '请粘贴电话号码，用换行或逗号分隔。', description: '支持批量输入多个电话号码' };
    if (type === 'waybill') return { title: '批量输入运单编号', placeholder: '请粘贴运单编号，用换行或逗号分隔。', description: '支持批量输入多个运单编号' };
    return { title: '', placeholder: '', description: '' };
  };
  const handleRecordSelect = (recordId: string) => { setSelection(prev => { const newSet = new Set(prev.selectedIds); if (newSet.has(recordId)) { newSet.delete(recordId); } else { newSet.add(recordId); } if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; } return { ...prev, selectedIds: newSet }; }); };
  const handleSelectAllOnPage = (isChecked: boolean) => { const pageIds = (sortedRecords || []).map((r: any) => r.id); if (isChecked) { setSelection(prev => ({ ...prev, selectedIds: new Set([...prev.selectedIds, ...pageIds]) })); } else { setSelection(prev => { const newSet = new Set(prev.selectedIds); pageIds.forEach(id => newSet.delete(id)); if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; } return { ...prev, selectedIds: newSet }; }); } };
  
  // ==========================================================================
  // 区域7: 付款申请核心功能
  // ==========================================================================
  
  /**
   * 处理"一键申请付款"按钮点击事件
   * 功能：
   * 1. 验证选择状态
   * 2. 获取所有需要处理的运单ID（支持跨页选择）
   * 3. 调用RPC函数生成付款预览数据
   * 4. 排除最高级合作方，只为低层级合作方生成付款申请
   * 5. 显示预览对话框
   */
  const handleApplyForPaymentClick = async () => {
    const isCrossPageSelection = selection.mode === 'all_filtered';
    const selectionCount = selection.selectedIds.size;

    if (!isCrossPageSelection && selectionCount === 0) {
        toast({ title: "提示", description: "请先选择需要申请付款的运单。" });
        return;
    }

    setIsGenerating(true);
    try {
      let idsToProcess: string[] = [];

      if (isCrossPageSelection) {
        const { data: allFilteredIds, error: idError } = await supabase.rpc('get_filtered_unpaid_ids' as any, {
            p_project_id: activeFilters.projectId === 'all' ? null : activeFilters.projectId,
            p_start_date: activeFilters.startDate || null,
            p_end_date: activeFilters.endDate || null,
            p_partner_id: activeFilters.partnerId === 'all' ? null : activeFilters.partnerId,
            p_driver_name: activeFilters.driverName || null,
            p_license_plate: activeFilters.licensePlate || null,
            p_driver_phone: activeFilters.driverPhone || null,
            p_waybill_numbers: activeFilters.waybillNumbers || null,
            p_other_platform_name: activeFilters.otherPlatformName || null,
        });
        if (idError) throw idError;
        idsToProcess = (allFilteredIds as string[] | null) || [];
      } else {
        idsToProcess = Array.from(selection.selectedIds);
      }

      if (idsToProcess.length === 0) {
        toast({ title: "无可处理运单", description: "在当前选择或筛选条件下，没有找到可申请付款的“未支付”运单。" });
        setIsGenerating(false);
        return;
      }

      const { data: v2Data, error: rpcError } = await supabase.rpc('get_payment_request_data_v2' as any, {
        p_record_ids: idsToProcess
      });

      if (rpcError) throw rpcError;

      const v2 = (v2Data as any) || {};
      const records: LogisticsRecord[] = Array.isArray(v2.records) ? v2.records : [];
      
      const sheetMap = new Map<string, any>();

      // ✅ 修复：按每个运单单独判断最高级，只包含低层级合作方
      for (const rec of records) {
        // ✅ 只处理未支付状态的运单
        if (rec.payment_status !== 'Unpaid') {
          continue;
        }
        
        const costs = Array.isArray(rec.partner_costs) ? rec.partner_costs : [];
        if (costs.length === 0) continue;

        // 计算当前运单的最高层级
        const recMaxLevel = Math.max(...costs.map(c => c.level));
        
        for (const cost of costs) {
          // ✅ 规则1：如果只有1个合作方，也要生成付款申请
          // ✅ 规则2：如果有多个合作方，只为低层级生成
          const shouldInclude = costs.length === 1 || cost.level < recMaxLevel;
          
          if (shouldInclude) {
            const key = cost.partner_id;
            if (!sheetMap.has(key)) {
              sheetMap.set(key, {
                paying_partner_id: key,
                paying_partner_full_name: cost.full_name || cost.partner_name,
                paying_partner_bank_account: cost.bank_account || '',
                paying_partner_bank_name: (cost as any).bank_name || '',
                paying_partner_branch_name: (cost as any).branch_name || '',
                record_count: 0,
                total_payable: 0,
                header_company_name: rec.project_name,
                records: []
              });
            }
            const sheet = sheetMap.get(key);
            if (!sheet.records.some((r: any) => r.record.id === rec.id)) {
                sheet.record_count += 1;
            }
            sheet.records.push({ record: rec, payable_amount: cost.payable_amount });
            sheet.total_payable += Number(cost.payable_amount || 0);
          }
        }
      }

      const sheets = Array.from(sheetMap.values());
      
      const finalRecordIds = new Set<string>();
      sheets.forEach(sheet => {
        sheet.records.forEach((r: any) => finalRecordIds.add(r.record.id));
      });
      
      const previewData: PaymentPreviewData = { sheets, processed_record_ids: Array.from(finalRecordIds) };

      const finalCount = previewData.processed_record_ids.length;
      if (finalCount === 0) {
        toast({ title: "提示", description: "按规则排除最高级合作方后，没有需要申请付款的运单。", variant: "destructive" });
        setIsGenerating(false);
        return;
      }
      
      const originalProcessedIds = new Set(records.map(r => r.id));
      if (!isCrossPageSelection && (selectionCount > originalProcessedIds.size || originalProcessedIds.size > finalCount)) {
          toast({ title: "部分运单被忽略", description: `您选择的运单中，部分因状态不符或属于最高级合作方而被自动忽略。`, variant: "default", duration: 8000 });
      }

      setPaymentPreviewData(previewData);
      setFinalPaymentData({
        sheets: previewData.sheets,
        all_record_ids: previewData.processed_record_ids
      });
      setIsPreviewModalOpen(true);

    } catch (error) {
      console.error("准备付款申请预览失败:", error);
      toast({ title: "错误", description: `准备付款申请预览失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * 确认并保存付款申请
   * 功能：
   * 1. 调用RPC函数process_payment_application创建付款申请单
   * 2. 更新运单状态为"已申请支付"
   * 3. 清空选择状态
   * 4. 刷新数据
   */
  const handleConfirmAndSave = async () => {
    if (!finalPaymentData || finalPaymentData.all_record_ids.length === 0) return;
    setIsSaving(true);
    try {
      const allRecordIds = finalPaymentData.all_record_ids;
      const { error } = await supabase.rpc('process_payment_application' as any, {
        p_record_ids: allRecordIds,
      });

      if (error) throw error;
      
      toast({
        title: "成功",
        description: `已成功为 ${allRecordIds.length} 条运单创建了一张总付款申请单。请前往“付款申请单列表”页面查看。`
      });

      setIsPreviewModalOpen(false);
      setPaymentPreviewData(null);
      setFinalPaymentData(null);
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchReportData();

    } catch (error) {
      console.error("保存付款申请失败:", error);
      toast({ title: "错误", description: `操作失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  // ✅ 已删除 getPaymentStatusBadge 函数，改用 StatusBadge 组件

  // ==========================================================================
  // 区域8: 单个运单编辑功能
  // ==========================================================================
  
  /**
   * 打开"修改合作方运费"对话框
   * 只允许修改最高级合作方的运费，其他层级自动计算
   */
  const handleEditPartnerCost = (record: LogisticsRecordWithPartners) => {
    setEditPartnerCostData({
      recordId: record.id,
      recordNumber: record.auto_number,
      partnerCosts: record.partner_costs || [],
      driverPayableCost: record.payable_cost || 0
    });
    setTempPartnerCosts(JSON.parse(JSON.stringify(record.partner_costs || [])));
    setTempDriverCost(record.payable_cost || 0);  // 设置临时司机应收
  };

  /**
   * 打开"修改合作链路"对话框
   * 功能：
   * 1. 获取运单所属项目
   * 2. 加载该项目的所有可用合作链路
   * 3. 显示当前链路和可选链路
   */
  const handleEditChain = async (record: LogisticsRecordWithPartners) => {
    // 如果没有 project_id，尝试通过 project_name 查找
    let projectId = record.project_id;
    
    if (!projectId && record.project_name) {
      const project = projects.find(p => p.name === record.project_name);
      if (project) {
        projectId = project.id;
      }
    }
    
    if (!projectId) {
      toast({ title: "错误", description: "无法获取项目信息", variant: "destructive" });
      return;
    }
    
    setEditChainData({
      recordId: record.id,
      recordNumber: record.auto_number,
      projectId: projectId,
      currentChainName: record.chain_name || '默认链路'
    });
    
    setSelectedChainId(''); // 清空之前的选择
    
    // 获取可用的合作链路
    setIsLoadingChains(true);
    try {
      console.log('🔍 准备查询合作链路，使用的 project_id:', projectId);
      console.log('🔍 运单信息:', {
        auto_number: record.auto_number,
        project_name: record.project_name,
        chain_name: record.chain_name
      });
      
      const { data, error } = await supabase
        .from('partner_chains')
        .select('id, chain_name, is_default, project_id')
        .eq('project_id', projectId)
        .order('is_default', { ascending: false });
      
      if (error) {
        console.error('❌ 查询合作链路错误:', error);
        throw error;
      }
      
      console.log('✅ 查询到的合作链路数量:', data?.length || 0);
      console.log('✅ 合作链路详情:', data);
      
      if (!data || data.length === 0) {
        // 检查该项目是否真的没有链路
        const { data: allChains } = await supabase
          .from('partner_chains')
          .select('project_id, chain_name')
          .limit(5);
        
        console.log('🔍 数据库中的部分合作链路（用于对比）:', allChains);
        
        toast({ 
          title: "提示", 
          description: `项目"${record.project_name}"暂无合作链路配置。如需配置，请前往项目管理页面。`, 
          variant: "default",
          duration: 5000
        });
      }
      
      setAvailableChains(data || []);
    } catch (error) {
      console.error("获取合作链路失败:", error);
      toast({ title: "错误", description: `获取合作链路失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setIsLoadingChains(false);
    }
  };

  /**
   * 恢复为系统自动计算（清除手动修改标记）
   * 功能：
   * 1. 将 is_manually_modified 设为 false
   * 2. 触发成本重算，恢复为系统自动计算的值
   */
  const handleResetToAutoCalculation = async () => {
    if (!editPartnerCostData) return;
    
    setIsSaving(true);
    try {
      // 找出最高级合作方
      const maxLevel = Math.max(...tempPartnerCosts.map(c => c.level));
      const highestLevelPartner = tempPartnerCosts.find(c => c.level === maxLevel);
      
      if (!highestLevelPartner) {
        throw new Error("未找到最高级合作方");
      }
      
      // 清除手动修改标记
      const { error: updateError } = await supabase
        .from('logistics_partner_costs')
        .update({
          is_manually_modified: false,  // 清除手动修改标记
          updated_at: new Date().toISOString()
        })
        .eq('logistics_record_id', editPartnerCostData.recordId)
        .eq('partner_id', highestLevelPartner.partner_id)
        .eq('level', maxLevel);
      
      if (updateError) throw updateError;
      
      // 调用重算函数，使用系统自动计算的值
      const recordData = reportData?.records.find((r: any) => r.id === editPartnerCostData.recordId);
      if (recordData && recordData.chain_id) {
        const { error: recalcError } = await supabase.rpc('modify_logistics_record_chain_with_recalc' as any, {
          p_record_id: editPartnerCostData.recordId,
          p_chain_name: recordData.chain_name || '默认链路'
        });
        
        if (recalcError) throw recalcError;
      }
      
      // 恢复司机应收为系统计算值（与最高级合作方一致）
      const { data: recalculatedCost } = await supabase
        .from('logistics_partner_costs')
        .select('payable_amount')
        .eq('logistics_record_id', editPartnerCostData.recordId)
        .eq('partner_id', highestLevelPartner.partner_id)
        .eq('level', maxLevel)
        .single();
      
      if (recalculatedCost) {
        await supabase
          .from('logistics_records')
          .update({
            payable_cost: recalculatedCost.payable_amount,  // 司机应收使用payable_cost字段
            updated_at: new Date().toISOString()
          })
          .eq('id', editPartnerCostData.recordId);
      }
      
      toast({ 
        title: "成功", 
        description: `已恢复为系统自动计算，最高级合作方"${highestLevelPartner.partner_name}"的运费和司机应收已重新计算` 
      });
      setEditPartnerCostData(null);
      setTempPartnerCosts([]);
      setTempDriverCost(0);
      fetchReportData();
    } catch (error) {
      console.error("恢复默认计算失败:", error);
      toast({ title: "错误", description: `操作失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  /**
   * 保存合作方运费修改（支持修改所有层级的合作方和司机应收）
   * 功能：
   * 1. 保存所有层级合作方的运费
   * 2. 保存司机应收
   * 3. 设置 is_manually_modified 标记
   */
  const handleSavePartnerCost = async () => {
    if (!editPartnerCostData) return;
    
    setIsSaving(true);
    try {
      // 验证运单支付状态和开票状态
      const { data: recordData, error: checkError } = await supabase
        .from('logistics_records')
        .select('payment_status, invoice_status')
        .eq('id', editPartnerCostData.recordId)
        .single();
      
      if (checkError) throw checkError;
      
      // 检查支付状态
      if (recordData.payment_status !== 'Unpaid') {
        const statusText = recordData.payment_status === 'Processing' ? '已申请支付' : '已完成支付';
        throw new Error(`只有未支付状态的运单才能修改运费。当前付款状态：${statusText}`);
      }
      
      // 检查开票状态
      if (recordData.invoice_status && recordData.invoice_status !== 'Uninvoiced') {
        const statusText = recordData.invoice_status === 'Processing' ? '开票中' : '已开票';
        throw new Error(`只有未开票状态的运单才能修改运费。当前开票状态：${statusText}`);
      }
      
      // 1. 更新所有层级合作方的金额
      for (const cost of tempPartnerCosts) {
        // 确保金额是数字类型
        const amount = typeof cost.payable_amount === 'string' ? parseFloat(cost.payable_amount) : cost.payable_amount;
        
        const { error: updateError } = await supabase
          .from('logistics_partner_costs')
          .update({
            payable_amount: amount,
            is_manually_modified: true,  // 标记为用户手动修改
            updated_at: new Date().toISOString()
          })
          .eq('logistics_record_id', editPartnerCostData.recordId)
          .eq('partner_id', cost.partner_id)
          .eq('level', cost.level);
        
        if (updateError) throw updateError;
      }
      
      // 2. 更新司机应收金额
      const driverAmount = typeof tempDriverCost === 'string' ? parseFloat(tempDriverCost) : tempDriverCost;
      const { error: driverUpdateError } = await supabase
        .from('logistics_records')
        .update({
          payable_cost: driverAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', editPartnerCostData.recordId);
      
      if (driverUpdateError) throw driverUpdateError;
      
      toast({ 
        title: "成功", 
        description: `已更新 ${tempPartnerCosts.length} 个合作方的运费和司机应收` 
      });
      setEditPartnerCostData(null);
      setTempPartnerCosts([]);
      setTempDriverCost(0);
      fetchReportData();
    } catch (error) {
      console.error("保存合作方运费失败:", error);
      toast({ title: "错误", description: `保存失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 保存合作链路修改
   * 功能：
   * 1. 调用RPC函数modify_logistics_record_chain_with_recalc
   * 2. 删除旧的合作方成本记录
   * 3. 根据新链路重新计算所有合作方成本
   * 4. 刷新数据
   */
  const handleSaveChain = async (newChainId: string) => {
    if (!editChainData) return;
    
    setIsSaving(true);
    try {
      const selectedChain = availableChains.find(c => c.id === newChainId);
      if (!selectedChain) throw new Error("未找到选择的合作链路");
      
      // 调用修改合作链路的RPC函数（包含成本重算）
      const { data, error } = await supabase.rpc('modify_logistics_record_chain_with_recalc' as any, {
        p_record_id: editChainData.recordId,
        p_chain_name: selectedChain.chain_name
      });
      
      if (error) throw error;
      
      const result = data as any;
      toast({ 
        title: "成功", 
        description: `合作链路已更新为"${selectedChain.chain_name}"，已重新计算${result?.recalculated_partners || 0}个合作方的成本` 
      });
      setEditChainData(null);
      setAvailableChains([]);
      setSelectedChainId('');
      fetchReportData();
    } catch (error) {
      console.error("修改合作链路失败:", error);
      toast({ title: "错误", description: `修改失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================================================
  // 区域9: 批量编辑功能
  // ==========================================================================
  
  /**
   * 批量恢复为系统自动计算
   * 功能：
   * 1. 批量清除选中运单的手动修改标记
   * 2. 触发成本重算
   * 3. 恢复为系统自动计算的值
   */
  const handleBatchResetToAuto = async () => {
    if (batchCostRecords.length === 0) return;

    setIsBatchModifying(true);
    let successCount = 0;
    let failedCount = 0;
    const failedList: string[] = [];

    try {
      for (const record of batchCostRecords) {
        try {
          // 检查运单状态
          const { data: recordData, error: checkError } = await supabase
            .from('logistics_records')
            .select('payment_status, invoice_status, chain_name, chain_id')
            .eq('id', record.id)
            .single();
          
          if (checkError) throw checkError;
          
          if (recordData.payment_status !== 'Unpaid') {
            failedCount++;
            failedList.push(`${record.auto_number}(已申请或已付款)`);
            continue;
          }
          
          if (recordData.invoice_status && recordData.invoice_status !== 'Uninvoiced') {
            failedCount++;
            failedList.push(`${record.auto_number}(已开票)`);
            continue;
          }
          
          // 获取最高级合作方
          const { data: costs } = await supabase
            .from('logistics_partner_costs')
            .select('partner_id, level')
            .eq('logistics_record_id', record.id)
            .order('level', { ascending: false })
            .limit(1);
          
          if (!costs || costs.length === 0) {
            failedCount++;
            failedList.push(`${record.auto_number}(无合作方)`);
            continue;
          }
          
          const highestPartner = costs[0];
          
          // 1. 清除合作方手动修改标记
          const { error: updateError } = await supabase
            .from('logistics_partner_costs')
            .update({
              is_manually_modified: false,  // 清除标记
              updated_at: new Date().toISOString()
            })
            .eq('logistics_record_id', record.id)
            .eq('partner_id', highestPartner.partner_id)
            .eq('level', highestPartner.level);
          
          if (updateError) throw updateError;
          
          // 2. 触发重算（会重新计算合作方应收）
          if (recordData.chain_name) {
            await supabase.rpc('modify_logistics_record_chain_with_recalc' as any, {
              p_record_id: record.id,
              p_chain_name: recordData.chain_name
            });
          }
          
          // 3. 恢复司机应收为系统计算值
          // 司机应收 = 最高级合作方应收（重新计算后的值）
          // 需要重新读取计算后的合作方金额
          const { data: recalculatedCost } = await supabase
            .from('logistics_partner_costs')
            .select('payable_amount')
            .eq('logistics_record_id', record.id)
            .eq('partner_id', highestPartner.partner_id)
            .eq('level', highestPartner.level)
            .single();
          
          if (recalculatedCost) {
            const { error: driverUpdateError } = await supabase
              .from('logistics_records')
              .update({
                payable_cost: recalculatedCost.payable_amount,  // 司机应收使用payable_cost字段
                updated_at: new Date().toISOString()
              })
              .eq('id', record.id);
            
            if (driverUpdateError) throw driverUpdateError;
          }
          
          successCount++;
        } catch (error) {
          failedCount++;
          failedList.push(`${record.auto_number}(错误: ${(error as any).message})`);
        }
      }

      toast({
        title: "批量恢复默认完成",
        description: `成功恢复 ${successCount} 条运单为系统自动计算（含合作方和司机应收），失败 ${failedCount} 条`,
        variant: successCount > 0 ? "default" : "destructive"
      });

      if (failedList.length > 0) {
        console.log('失败的运单:', failedList);
      }

      setBatchModifyType(null);
      setBatchCostRecords([]);
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchReportData();
    } catch (error) {
      console.error("批量恢复默认失败:", error);
      toast({ title: "错误", description: `批量操作失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setIsBatchModifying(false);
    }
  };
  
  /**
   * 批量修改应收
   * 功能：
   * 1. 逐个修改选中运单的最高级合作方应收金额
   * 2. 验证运单状态（只能修改"未支付"且"未开票"的运单）
   * 3. 显示成功和失败统计
   */
  const handleBatchModifyCost = async () => {
    // 验证每条记录的合作方和司机金额都有效（允许0，但不允许负数或空值）
    const invalidRecords = batchCostRecords.filter(r => {
      // 验证合作方金额
      const partnerValue = r.new_amount?.toString().trim();
      if (!partnerValue && partnerValue !== '0') return true;
      const partnerNum = parseFloat(partnerValue);
      if (isNaN(partnerNum) || partnerNum < 0) return true;
      
      // 验证司机金额
      const driverValue = r.new_driver_amount?.toString().trim();
      if (!driverValue && driverValue !== '0') return true;
      const driverNum = parseFloat(driverValue);
      if (isNaN(driverNum) || driverNum < 0) return true;
      
      return false;
    });
    if (invalidRecords.length > 0) {
      toast({ title: "错误", description: `请为所有运单输入有效的合作方和司机金额（可以是0，但不能为负数）`, variant: "destructive" });
      return;
    }

    setIsBatchModifying(true);
    let successCount = 0;
    let failedCount = 0;
    const failedList: string[] = [];

    try {
      // 逐个修改运单
      for (const record of batchCostRecords) {
        try {
          const newPartnerAmount = parseFloat(record.new_amount);
          const newDriverAmount = parseFloat(record.new_driver_amount);
          
          // 检查运单状态
          const { data: recordData, error: checkError } = await supabase
            .from('logistics_records')
            .select('payment_status, invoice_status')
            .eq('id', record.id)
            .single();
          
          if (checkError) throw checkError;
          
          if (recordData.payment_status !== 'Unpaid') {
            failedCount++;
            failedList.push(`${record.auto_number}(已申请或已付款)`);
            continue;
          }
          
          if (recordData.invoice_status && recordData.invoice_status !== 'Uninvoiced') {
            failedCount++;
            failedList.push(`${record.auto_number}(已开票)`);
            continue;
          }
          
          // 获取最高级合作方
          const { data: costs } = await supabase
            .from('logistics_partner_costs')
            .select('partner_id, level')
            .eq('logistics_record_id', record.id)
            .order('level', { ascending: false })
            .limit(1);
          
          if (!costs || costs.length === 0) {
            failedCount++;
            failedList.push(`${record.auto_number}(无合作方)`);
            continue;
          }
          
          const highestPartner = costs[0];
          
          // 1. 更新最高级合作方的金额
          const { error: updatePartnerError } = await supabase
            .from('logistics_partner_costs')
            .update({
              payable_amount: newPartnerAmount,
              is_manually_modified: true,  // 标记为用户手动修改
              updated_at: new Date().toISOString()
            })
            .eq('logistics_record_id', record.id)
            .eq('partner_id', highestPartner.partner_id)
            .eq('level', highestPartner.level);
          
          if (updatePartnerError) throw updatePartnerError;
          
          // 2. 更新司机应收金额
          const { error: updateDriverError } = await supabase
            .from('logistics_records')
            .update({
              payable_cost: newDriverAmount,  // 司机应收使用payable_cost字段
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);
          
          if (updateDriverError) throw updateDriverError;
          
          successCount++;
        } catch (error) {
          failedCount++;
          failedList.push(`${record.auto_number}(错误: ${(error as any).message})`);
        }
      }

      toast({
        title: "批量修改完成",
        description: `成功更新 ${successCount} 条运单（含合作方和司机应收），失败 ${failedCount} 条`,
        variant: successCount > 0 ? "default" : "destructive"
      });

      if (failedList.length > 0) {
        console.log('失败的运单:', failedList);
      }

      setBatchModifyType(null);
      setBatchCostRecords([]);
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchReportData();
    } catch (error) {
      console.error("批量修改应收失败:", error);
      toast({ title: "错误", description: `批量修改失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setIsBatchModifying(false);
    }
  };

  /**
   * 批量修改合作链路
   * 功能：
   * 1. 调用RPC函数batch_modify_chain
   * 2. 批量更新运单的合作链路
   * 3. 自动重新计算所有受影响运单的成本
   * 限制：所选运单必须属于同一个项目
   */
  const handleBatchModifyChain = async () => {
    if (!batchChainId) {
      toast({ title: "错误", description: "请选择合作链路", variant: "destructive" });
      return;
    }

    const idsToModify = Array.from(selection.selectedIds);
    if (idsToModify.length === 0) {
      toast({ title: "提示", description: "请先选择要修改的运单" });
      return;
    }

    const selectedChain = batchChains.find(c => c.id === batchChainId);
    if (!selectedChain) {
      toast({ title: "错误", description: "未找到选择的合作链路", variant: "destructive" });
      return;
    }

    setIsBatchModifying(true);
    try {
      const { data, error } = await supabase.rpc('batch_modify_chain' as any, {
        p_record_ids: idsToModify,
        p_chain_name: selectedChain.chain_name
      });

      if (error) throw error;

      const result = data as any;
      toast({
        title: result.success ? "批量修改完成" : "修改失败",
        description: result.message,
        variant: result.success ? "default" : "destructive"
      });

      if (result.failed_records && result.failed_records.length > 0) {
        console.log('失败的运单:', result.failed_records);
      }

      setBatchModifyType(null);
      setBatchChainId('');
      setBatchChains([]);
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchReportData();
    } catch (error) {
      console.error("批量修改链路失败:", error);
      toast({ title: "错误", description: `批量修改失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setIsBatchModifying(false);
    }
  };

  /**
   * 打开批量修改对话框
   * @param type - 'cost': 批量修改应收 | 'chain': 批量修改链路
   * 功能：
   * 1. 验证是否有选中的运单
   * 2. 准备对话框数据（运单列表或可用链路）
   * 3. 显示对应的批量修改对话框
   */
  const handleOpenBatchModify = async (type: 'cost' | 'chain') => {
    if (selection.selectedIds.size === 0) {
      toast({ title: "提示", description: "请先选择要修改的运单" });
      return;
    }

    setBatchModifyType(type);

    if (type === 'cost') {
      // 准备批量修改应收的运单数据
      const selectedRecords = reportData?.records.filter((r: any) => selection.selectedIds.has(r.id)) || [];
      
      const recordsWithCost = await Promise.all(
        selectedRecords.map(async (record: any) => {
          // 获取最高级合作方的应收金额
          const highestCost = record.partner_costs && record.partner_costs.length > 0
            ? record.partner_costs.reduce((max: any, cost: any) => 
                cost.level > max.level ? cost : max
              )
            : null;
          
          // 获取司机应收金额（使用payable_cost字段）
          const driverPayableCost = record.payable_cost || 0;
          
          return {
            id: record.id,
            auto_number: record.auto_number,
            loading_date: record.loading_date,
            driver_name: record.driver_name,
            original_amount: highestCost?.payable_amount || 0,
            new_amount: (highestCost?.payable_amount || 0).toString(),
            original_driver_amount: driverPayableCost,
            new_driver_amount: driverPayableCost.toString()
          };
        })
      );
      
      setBatchCostRecords(recordsWithCost);
    } else if (type === 'chain') {
      // 获取选中运单的项目（假设都是同一项目）
      const selectedRecords = reportData?.records.filter((r: any) => selection.selectedIds.has(r.id));
      if (selectedRecords && selectedRecords.length > 0) {
        const firstRecord = selectedRecords[0];
        let projectId = firstRecord.project_id;

        if (!projectId && firstRecord.project_name) {
          const project = projects.find(p => p.name === firstRecord.project_name);
          if (project) projectId = project.id;
        }

        if (projectId) {
          const { data } = await supabase
            .from('partner_chains')
            .select('id, chain_name, is_default')
            .eq('project_id', projectId)
            .order('is_default', { ascending: false });
          setBatchChains(data || []);
        }
      }
    }
  };

  // ==========================================================================
  // 区域10: 计算属性和条件判断
  // ==========================================================================
  
  /**
   * 日期范围选择器的值
   */
  const dateRangeValue: DateRange | undefined = (uiFilters.startDate || uiFilters.endDate) ? { from: uiFilters.startDate ? new Date(uiFilters.startDate) : undefined, to: uiFilters.endDate ? new Date(uiFilters.endDate) : undefined } : undefined;
  const displayedPartners = useMemo(() => {
    if (uiFilters.partnerId !== "all") {
      const selected = allPartners.find(p => p.id === uiFilters.partnerId);
      return selected ? [selected] : [];
    }
    if (!reportData || !Array.isArray(reportData.records)) return [];
    const relevantPartnerIds = new Set<string>();
    let maxLevel = 0;
    reportData.records.forEach((record: any) => {
      if (record && Array.isArray(record.partner_costs)) {
        record.partner_costs.forEach((cost: any) => {
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

  /**
   * 判断当前页是否全选
   */
  const isAllOnPageSelected = useMemo(() => {
    if (!sortedRecords || sortedRecords.length === 0) return false;
    const pageIds = sortedRecords.map((r: any) => r.id);
    return pageIds.every(id => selection.selectedIds.has(id));
  }, [sortedRecords, selection.selectedIds]);

  /**
   * 选择数量统计
   */
  const selectionCount = useMemo(() => { if (selection.mode === 'all_filtered') return reportData?.count || 0; return selection.selectedIds.size; }, [selection, reportData?.count]);

  // ==========================================================================
  // 区域11: 加载状态处理
  // ==========================================================================
  if (loading && !reportData && isStale) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>;

  // ==========================================================================
  // 区域12: JSX 渲染
  // ==========================================================================
  // 页面结构：
  // 1. 页面头部（标题 + 一键申请付款按钮）
  // 2. 筛选器（项目、日期、合作方、司机、支付状态）
  // 3. 选择提示条（当前页选择/跨页选择）
  // 4. 批量操作按钮条（批量修改应收/链路）
  // 5. 运单列表表格
  // 6. 分页组件
  // 7. 各种对话框（运单详情、付款预览、编辑对话框）
  // ==========================================================================
  return (
    <div className="space-y-6 p-4 md:p-6">
      <BatchInputDialog
        isOpen={batchDialog.isOpen}
        onClose={closeBatchDialog}
        onConfirm={handleBatchConfirm}
        title={getBatchDialogConfig().title}
        description={getBatchDialogConfig().description}
        placeholder={getBatchDialogConfig().placeholder}
        currentValue={getCurrentBatchValue()}
      />
      
      {/* ===== 页面头部 ===== */}
      <PageHeader 
        title="合作方付款申请" 
        description="向合作方申请支付运费"
        icon={Banknote}
        iconColor="text-green-600"
      >
        {!isStale && reportData && Array.isArray(reportData.records) && reportData.records.length > 0 && (
          <div className="flex gap-2">
            <Button 
              variant="default" 
              size="default"
              disabled={selection.selectedIds.size === 0}
              onClick={() => handleOpenBatchModify('cost')}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <EditIcon className="mr-2 h-4 w-4" />
              批量修改应收
            </Button>
            <Button 
              variant="default"
              size="default"
              disabled={selection.selectedIds.size === 0}
              onClick={() => handleOpenBatchModify('chain')}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              批量修改链路
            </Button>
            <Button variant="default" disabled={(selection.mode !== 'all_filtered' && selection.selectedIds.size === 0) || isGenerating} onClick={handleApplyForPaymentClick}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              一键申请付款 ({selectionCount})
            </Button>
          </div>
        )}
      </PageHeader>

      <div className="space-y-6">
        {/* ===== 筛选器区域 ===== */}
        <Card className="border-muted/40 shadow-sm">
          <CardContent className="p-4">
            {/* 常规筛选区域 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
              <div className="flex flex-col gap-1.5">
                <Label>项目</Label>
                <Select value={uiFilters.projectId} onValueChange={(v) => handleFilterChange('projectId', v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有项目</SelectItem>
                    {Array.isArray(projects) && projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <Label>日期范围</Label>
                <DateRangePicker date={dateRangeValue} setDate={handleDateChange} />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <Label>支付状态</Label>
                <Select value={uiFilters.paymentStatus} onValueChange={(v) => handleFilterChange('paymentStatus', v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="选择状态..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2 items-end">
                <Button onClick={handleSearch} className="h-10 flex-1 bg-blue-600 hover:bg-blue-700">
                  <Search className="mr-2 h-4 w-4"/>搜索
                </Button>
                <Button variant="outline" onClick={handleClear} className="h-10 flex-1">清除</Button>
              </div>
            </div>
            
            {/* 展开/收起高级筛选按钮 */}
            <div className="mt-4 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
              >
                {showAdvanced ? (
                  <>
                    <ChevronUp className="mr-1 h-4 w-4" />
                    收起高级筛选
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-4 w-4" />
                    展开高级筛选
                  </>
                )}
              </Button>
            </div>
            
            {/* 高级筛选区域 */}
            {showAdvanced && (
              <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 合作方筛选 */}
                  <div className="space-y-2">
                    <Label htmlFor="partner" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      合作方
                    </Label>
                    <Select value={uiFilters.partnerId} onValueChange={(v) => handleFilterChange('partnerId', v)}>
                      <SelectTrigger id="partner" className="h-10">
                        <SelectValue/>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">所有合作方</SelectItem>
                        {Array.isArray(allPartners) && allPartners.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name} ({p.level}级)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* 司机筛选 */}
                  <div className="space-y-2">
                    <Label htmlFor="driver" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      司机
                    </Label>
                    <div className="flex gap-1">
                      <Input
                        id="driver"
                        type="text"
                        placeholder="司机姓名，多个用逗号分隔..."
                        value={uiFilters.driverName}
                        onChange={e => handleFilterChange('driverName', e.target.value)}
                        className="h-10 flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openBatchDialog('driver')}
                        className="h-10 px-2"
                        title="批量输入"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* 车牌号筛选 */}
                  <div className="space-y-2">
                    <Label htmlFor="license" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                      <Hash className="h-4 w-4" />
                      车牌号
                    </Label>
                    <div className="flex gap-1">
                      <Input
                        id="license"
                        type="text"
                        placeholder="车牌号，多个用逗号分隔..."
                        value={uiFilters.licensePlate}
                        onChange={e => handleFilterChange('licensePlate', e.target.value)}
                        className="h-10 flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openBatchDialog('license')}
                        className="h-10 px-2"
                        title="批量输入"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* 电话筛选 */}
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      电话
                    </Label>
                    <div className="flex gap-1">
                      <Input
                        id="phone"
                        type="text"
                        placeholder="电话号码，多个用逗号分隔..."
                        value={uiFilters.driverPhone}
                        onChange={e => handleFilterChange('driverPhone', e.target.value)}
                        className="h-10 flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openBatchDialog('phone')}
                        className="h-10 px-2"
                        title="批量输入"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* 运单编号筛选 */}
                  <div className="space-y-2">
                    <Label htmlFor="waybill" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      运单编号
                    </Label>
                    <div className="flex gap-1">
                      <Input
                        id="waybill"
                        type="text"
                        placeholder="运单编号，多个用逗号分隔..."
                        value={uiFilters.waybillNumbers}
                        onChange={e => handleFilterChange('waybillNumbers', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
                        className="h-10 flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openBatchDialog('waybill')}
                        className="h-10 px-2"
                        title="批量输入"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-purple-600">
                      💡 支持搜索本平台和其他平台运单号
                    </div>
                  </div>
                  
                  {/* 其他平台名称筛选 */}
                  <div className="space-y-2">
                    <Label htmlFor="platform" className="text-sm font-medium text-purple-800 flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      其他平台名称
                    </Label>
                    <Select value={uiFilters.otherPlatformName || 'all'} onValueChange={(v) => handleFilterChange('otherPlatformName', v === 'all' ? '' : v)}>
                      <SelectTrigger id="platform" className="h-10">
                        <SelectValue placeholder="选择平台" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">所有平台</SelectItem>
                        <SelectItem value="本平台">本平台</SelectItem>
                        <SelectItem value="中科智运">中科智运</SelectItem>
                        <SelectItem value="中工智云">中工智云</SelectItem>
                        <SelectItem value="可乐公司">可乐公司</SelectItem>
                        <SelectItem value="盼盼集团">盼盼集团</SelectItem>
                        {platformOptions.length > 0 && (
                          <>
                            <SelectItem value="---" disabled className="text-xs text-purple-400">
                              ─── 其他平台 ───
                            </SelectItem>
                            {platformOptions.map((platform) => (
                              <SelectItem key={platform.platform_name} value={platform.platform_name}>
                                {platform.platform_name} ({platform.usage_count}条)
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-purple-600">
                      📊 固定平台: 5个 {platformOptions.length > 0 && `| 其他: ${platformOptions.length}个`}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      {/* ===== 选择提示区域 ===== */}
      {/* 提示1: 当前页全选提示 -> 可选择跨页全选 */}
      {selection.selectedIds.size > 0 && selection.mode !== 'all_filtered' && isAllOnPageSelected && reportData?.count > (reportData?.records?.length || 0) && (
        <div className="flex items-center justify-center gap-4 p-3 text-sm font-medium text-center bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-800 rounded-lg shadow-sm">
          <span>已选择当前页的所有 <b className="text-blue-600">{reportData?.records?.length}</b> 条记录。</span>
          <Button variant="link" className="p-0 h-auto text-blue-600 hover:text-blue-700 font-semibold" onClick={() => setSelection({ mode: 'all_filtered', selectedIds: new Set() })}>选择全部 <b>{reportData?.count}</b> 条匹配的记录</Button>
        </div>
      )}
      {/* 提示2: 跨页全选提示 */}
      {selection.mode === 'all_filtered' && (
        <div className="flex items-center justify-center gap-4 p-3 text-sm font-medium text-center bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-800 rounded-lg shadow-sm">
          <span>已选择全部 <b className="text-green-600">{reportData?.count}</b> 条匹配的记录。</span>
          <Button variant="link" className="p-0 h-auto text-green-600 hover:text-green-700 font-semibold" onClick={() => setSelection({ mode: 'none', selectedIds: new Set() })}>清除选择</Button>
        </div>
      )}
      
      {/* 提示3: 已选择运单数量 + 批量操作按钮 */}
      {selection.selectedIds.size > 0 && selection.mode !== 'all_filtered' && (
        <div className="flex items-center justify-between gap-4 p-3 text-sm font-medium text-center bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 text-blue-800 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <span>已选择 <b className="text-blue-600">{selection.selectedIds.size}</b> 条记录</span>
            <Button variant="link" className="p-0 h-auto text-blue-600 hover:text-blue-700 font-semibold" onClick={() => setSelection({ mode: 'none', selectedIds: new Set() })}>清除选择</Button>
          </div>
        </div>
      )}

      {/* ===== 主数据表格区域 ===== */}
      {isStale ? ( <StaleDataPrompt /> ) : (
        <>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-background to-muted/10 border-b">
                <div><CardTitle className="text-lg">运单财务明细</CardTitle><p className="text-sm text-muted-foreground">{showAllLevels ? '显示所有层级的合作方' : '仅显示最高级合作方'}</p></div>
                <Button variant="outline" size="sm" onClick={() => setShowAllLevels(!showAllLevels)} className="w-full sm:w-auto whitespace-nowrap hover:bg-primary/10 transition-colors">
                  {showAllLevels ? '仅显示最高级' : '展示全部级别'}
                </Button>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-x-auto">
                <div className="min-h-[400px]">
                  {loading ? (<div className="flex justify-center items-center h-full min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin"/></div>) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="w-12 whitespace-nowrap"><Checkbox checked={selection.mode === 'all_filtered' || isAllOnPageSelected} onCheckedChange={handleSelectAllOnPage} /></TableHead>
                      <TableHead className="whitespace-nowrap cursor-pointer hover:bg-muted/50" onClick={() => handleSort('auto_number')}>
                        <div className="flex items-center gap-1">
                          运单编号
                          {sortField === 'auto_number' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                        </div>
                      </TableHead>
                      <TableHead className="whitespace-nowrap">项目</TableHead>
                      <TableHead className="whitespace-nowrap cursor-pointer hover:bg-muted/50" onClick={() => handleSort('driver_name')}>
                        <div className="flex items-center gap-1">
                          司机
                          {sortField === 'driver_name' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                        </div>
                      </TableHead>
                      <TableHead className="whitespace-nowrap">路线</TableHead>
                      <TableHead className="whitespace-nowrap">装/卸数量</TableHead>
                      <TableHead className="whitespace-nowrap cursor-pointer hover:bg-muted/50" onClick={() => handleSort('loading_date')}>
                        <div className="flex items-center gap-1">
                          日期
                          {sortField === 'loading_date' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                        </div>
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-bold text-primary cursor-pointer hover:bg-muted/50" onClick={() => handleSort('payable_cost')}>
                        <div className="flex items-center gap-1">
                          司机应收
                          {sortField === 'payable_cost' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                        </div>
                      </TableHead>
                      {Array.isArray(displayedPartners) && displayedPartners.map(p => <TableHead key={p.id} className="text-center whitespace-nowrap">{p.name}<div className="text-xs text-muted-foreground">({p.level}级)</div></TableHead>)}
                      <TableHead className="whitespace-nowrap">合作链路</TableHead>
                      <TableHead className="whitespace-nowrap">支付状态</TableHead>
                      <TableHead className="whitespace-nowrap text-center">操作</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {Array.isArray(sortedRecords) && sortedRecords.map((r: LogisticsRecordWithPartners) => (
                          <TableRow key={r.id} data-state={selection.selectedIds.has(r.id) && "selected"}>
                              <TableCell className="whitespace-nowrap"><Checkbox checked={selection.mode === 'all_filtered' || selection.selectedIds.has(r.id)} onCheckedChange={() => handleRecordSelect(r.id)} /></TableCell>
                              <TableCell className="font-mono cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{r.auto_number}</TableCell>
                              <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{r.project_name}</TableCell>
                              <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{r.driver_name}</TableCell>
                              <TableCell className="text-sm cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{simplifyRoute(r.loading_location, r.unloading_location)}</TableCell>
                              <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{formatQuantity(r)}</TableCell>
                              <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{formatDate(r.loading_date)}</TableCell>
                              <TableCell className="font-mono cursor-pointer whitespace-nowrap font-bold text-primary" onClick={() => setViewingRecord(r)}>{formatCurrency(r.payable_cost)}</TableCell>
                              {Array.isArray(displayedPartners) && displayedPartners.map(p => { const cost = (Array.isArray(r.partner_costs) && r.partner_costs.find((c:any) => c.partner_id === p.id)); return <TableCell key={p.id} className="font-mono text-center cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{formatCurrency(cost?.payable_amount)}</TableCell>; })}
                               <TableCell className="whitespace-nowrap">
                                 <span className="text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">{r.chain_name || '默认链路'}</span>
                               </TableCell>
                              <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>
                                <StatusBadge status={r.payment_status} customConfig={PAYMENT_STATUS_CONFIG} />
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  {isRecordEditable(r) ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditPartnerCost(r);
                                        }}
                                        className="h-8 px-2 hover:bg-blue-50 hover:text-blue-600 transition-all hover:shadow-sm"
                                        title="修改合作方运费"
                                      >
                                        <EditIcon className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditChain(r);
                                        }}
                                        className="h-8 px-2 hover:bg-purple-50 hover:text-purple-600 transition-all hover:shadow-sm"
                                        title="修改合作链路"
                                      >
                                        <LinkIcon className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground" title={`不可编辑：${getUneditableReason(r)}`}>
                                      {getUneditableReason(r)}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                          </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-semibold border-t-2">
                        <TableCell colSpan={7} className="text-right font-bold whitespace-nowrap">合计</TableCell>
                        <TableCell className="font-mono font-bold text-primary text-center whitespace-nowrap"><div>{formatCurrency(reportData?.overview?.total_payable_cost)}</div><div className="text-xs text-muted-foreground font-normal">(司机应收)</div></TableCell>
                        {Array.isArray(displayedPartners) && displayedPartners.map(p => { const total = (Array.isArray(reportData?.partners) && reportData.partners.find((pp: any) => pp.partner_id === p.id)?.total_payable) || 0; return (<TableCell key={p.id} className="text-center font-bold font-mono whitespace-nowrap"><div>{formatCurrency(total)}</div><div className="text-xs text-muted-foreground font-normal">({p.name})</div></TableCell>);})}
                        <TableCell className="whitespace-nowrap"></TableCell>
                        <TableCell className="whitespace-nowrap"></TableCell>
                        <TableCell className="whitespace-nowrap"></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      
      {/* ===== 分页组件 ===== */}
      {!isStale && pagination.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPagination(p => ({...p, currentPage: Math.max(1, p.currentPage - 1)})); }} className={cn({ "pointer-events-none opacity-50": pagination.currentPage === 1 })} /></PaginationItem>
            <PaginationItem><PaginationLink isActive>{pagination.currentPage}</PaginationLink></PaginationItem>
            <PaginationItem><span className="px-4 py-2 text-sm">/ {pagination.totalPages}</span></PaginationItem>
            <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPagination(p => ({...p, currentPage: Math.min(p.totalPages, p.currentPage + 1)})); }} className={cn({ "pointer-events-none opacity-50": pagination.currentPage === pagination.totalPages })} /></PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* ===== 对话框区域 ===== */}
      {/* 对话框1: 运单详情对话框 */}
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>运单详情 (编号: {viewingRecord?.auto_number})</DialogTitle></DialogHeader>
          {viewingRecord && (
            <div className="grid grid-cols-4 gap-x-4 gap-y-6 py-4 text-sm">
              <div className="space-y-1"><Label className="text-muted-foreground">项目</Label><p>{viewingRecord.project_name}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">合作链路</Label><p>{viewingRecord.chain_name || '未指定'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">装货日期</Label><p>{formatDate(viewingRecord.loading_date)}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">支付状态</Label><p><StatusBadge status={viewingRecord.payment_status} customConfig={PAYMENT_STATUS_CONFIG} /></p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">司机</Label><p>{viewingRecord.driver_name}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">车牌号</Label><p>{viewingRecord.license_plate || '未填写'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">司机电话</Label><p>{viewingRecord.driver_phone || '未填写'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">运输类型</Label><p>{(viewingRecord as any).transport_type}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">装货地点</Label><p>{viewingRecord.loading_location}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">装货重量</Label><p>{viewingRecord.loading_weight ? `${viewingRecord.loading_weight} 吨` : '-'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">卸货地点</Label><p>{viewingRecord.unloading_location}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">卸货重量</Label><p>{viewingRecord.unloading_weight ? `${viewingRecord.unloading_weight} 吨` : '-'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">运费金额</Label><p className="font-mono">{formatCurrency(viewingRecord.current_cost)}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">额外费用</Label><p className="font-mono">{formatCurrency(viewingRecord.extra_cost)}</p></div>
              <div className="space-y-1 col-span-2"><Label className="text-muted-foreground">司机应收</Label><p className="font-mono font-bold text-primary">{formatCurrency(viewingRecord.payable_cost)}</p></div>
              <div className="col-span-4 space-y-1"><Label className="text-muted-foreground">备注</Label><p className="min-h-[40px]">{viewingRecord.remarks || '无'}</p></div>
            </div>
          )}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setViewingRecord(null)}>关闭</Button></div>
        </DialogContent>
      </Dialog>

      {/* 对话框2: 付款申请预览对话框 */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>付款申请预览</DialogTitle>
            <DialogDescription>将为以下合作方生成付款申请，并更新 {paymentPreviewData?.processed_record_ids.length || 0} 条运单状态为"已申请支付"。</DialogDescription>
          </DialogHeader>
          {paymentPreviewData && (
            <div className="max-h-[60vh] overflow-y-auto p-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>付款方 (收款人)</TableHead>
                    <TableHead>收款银行账号</TableHead>
                    <TableHead>开户行</TableHead>
                    <TableHead>支行网点</TableHead>
                    <TableHead className="text-right">运单数</TableHead>
                    <TableHead className="text-right">合计金额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentPreviewData.sheets.map(sheet => (
                    <TableRow key={sheet.paying_partner_id}>
                      <TableCell className="font-medium">{sheet.paying_partner_full_name}</TableCell>
                      <TableCell>{sheet.paying_partner_bank_account}</TableCell>
                      <TableCell>{sheet.paying_partner_bank_name}</TableCell>
                      <TableCell>{sheet.paying_partner_branch_name}</TableCell>
                      <TableCell className="text-right">{sheet.record_count}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(sheet.total_payable)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewModalOpen(false)} disabled={isSaving}>取消</Button>
            <Button onClick={handleConfirmAndSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              确认并生成申请
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 对话框3: 单个修改合作方运费对话框 */}
      <Dialog open={!!editPartnerCostData} onOpenChange={(open) => !open && setEditPartnerCostData(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-blue-100 rounded-lg">
                <EditIcon className="h-5 w-5 text-blue-600" />
              </div>
              修改合作方运费
            </DialogTitle>
            <DialogDescription className="text-base">运单编号: <span className="font-mono font-semibold">{editPartnerCostData?.recordNumber}</span></DialogDescription>
          </DialogHeader>
          {editPartnerCostData && (() => {
            const maxLevel = Math.max(...tempPartnerCosts.map(c => c.level));
            const sortedCosts = [...tempPartnerCosts].sort((a, b) => b.level - a.level); // 从高到低排序
            return (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto py-2">
                {/* 司机应收 */}
                <Card className="border-l-4 border-l-green-500 bg-green-50/50">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-medium text-green-700">司机应收</Label>
                        <p className="font-medium text-green-900">基础费用</p>
                        <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block bg-green-100 text-green-700">
                          直接支付给司机
                        </span>
                      </div>
                      <div>
                        <Label htmlFor="driver-amount" className="text-xs font-medium text-green-700">应收金额 (¥)</Label>
                        <Input
                          id="driver-amount"
                          type="text"
                          inputMode="decimal"
                          value={tempDriverCost.toString()}
                          onChange={(e) => {
                            const value = e.target.value;
                            // 允许输入空、负号、数字和小数点（不立即parseFloat）
                            if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
                              setTempDriverCost(value as any);  // 临时保存字符串
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (value && value !== '-' && !isNaN(parseFloat(value))) {
                              setTempDriverCost(parseFloat(parseFloat(value).toFixed(2)));
                            } else if (value === '' || value === '-') {
                              setTempDriverCost(0);
                            }
                          }}
                          className="font-mono border-green-300 focus:border-green-500 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="输入司机应收金额"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* 所有层级合作方 */}
                {sortedCosts.map((cost, index) => {
                  const isHighest = cost.level === maxLevel;
                  return (
                    <Card key={cost.partner_id} className={`border-l-4 ${isHighest ? 'border-l-blue-500 bg-blue-50/50' : 'border-l-purple-500 bg-purple-50/30'}`}>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">合作方名称</Label>
                            <p className="font-medium">{cost.partner_name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                              isHighest ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {cost.level}级 {isHighest && '(最高级)'}
                            </span>
                          </div>
                          <div>
                            <Label htmlFor={`amount-${cost.partner_id}`} className="text-xs font-medium">应收金额 (¥)</Label>
                            <Input
                              id={`amount-${cost.partner_id}`}
                              type="text"
                              inputMode="decimal"
                              value={typeof cost.payable_amount === 'number' ? cost.payable_amount.toString() : cost.payable_amount}
                              onChange={(e) => {
                                const value = e.target.value;
                                // 允许输入空、负号、数字和小数点（不立即parseFloat）
                                if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
                                  const newCosts = [...tempPartnerCosts];
                                  const targetIndex = newCosts.findIndex(c => c.partner_id === cost.partner_id);
                                  newCosts[targetIndex].payable_amount = value as any;  // 临时保存字符串
                                  setTempPartnerCosts(newCosts);
                                }
                              }}
                              onBlur={(e) => {
                                const value = e.target.value;
                                const newCosts = [...tempPartnerCosts];
                                const targetIndex = newCosts.findIndex(c => c.partner_id === cost.partner_id);
                                if (value && value !== '-' && !isNaN(parseFloat(value))) {
                                  newCosts[targetIndex].payable_amount = parseFloat(parseFloat(value).toFixed(2));
                                  setTempPartnerCosts(newCosts);
                                } else {
                                  newCosts[targetIndex].payable_amount = 0;
                                  setTempPartnerCosts(newCosts);
                                }
                              }}
                              className={`font-mono text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                isHighest ? 'border-blue-300 focus:border-blue-500' : 'border-purple-300 focus:border-purple-500'
                              }`}
                              placeholder="输入金额"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-xs text-yellow-800">
                    <strong>说明：</strong>
                    <br />• 🟢 绿色边框：司机应收金额
                    <br />• 🔵 蓝色边框：最高级合作方应收（通常是直接客户）
                    <br />• 🟣 紫色边框：低层级合作方应收（中间商）
                    <br />• 所有金额都可以独立修改
                  </p>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPartnerCostData(null)} disabled={isSaving}>
              取消
            </Button>
            <ConfirmDialog
              title="确认恢复默认"
              description={`确定要将运单 ${editPartnerCostData?.recordNumber} 的应收金额恢复为系统自动计算吗？此操作将清除手动修改标记并重新计算。`}
              onConfirm={handleResetToAutoCalculation}
            >
              <Button variant="secondary" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "🔄"}
                恢复默认
              </Button>
            </ConfirmDialog>
            <ConfirmDialog
              title="确认修改应收"
              description={`确定要修改运单 ${editPartnerCostData?.recordNumber} 的应收金额吗？此操作将更新司机应收和所有合作方的费用。`}
              onConfirm={handleSavePartnerCost}
            >
              <Button disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                保存修改
              </Button>
            </ConfirmDialog>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 对话框4: 单个修改合作链路对话框 */}
      <Dialog open={!!editChainData} onOpenChange={(open) => {
        if (!open) {
          setEditChainData(null);
          setAvailableChains([]);
          setSelectedChainId('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-purple-100 rounded-lg">
                <LinkIcon className="h-5 w-5 text-purple-600" />
              </div>
              修改合作链路
            </DialogTitle>
            <DialogDescription className="text-base">运单编号: <span className="font-mono font-semibold">{editChainData?.recordNumber}</span></DialogDescription>
          </DialogHeader>
          {editChainData && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">当前合作链路</Label>
                <div className="p-3 bg-muted/50 rounded-md border">
                  <p className="font-medium text-sm">{editChainData.currentChainName}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-chain">选择新的合作链路</Label>
                {isLoadingChains ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Select
                    value={selectedChainId}
                    onValueChange={setSelectedChainId}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="new-chain">
                      <SelectValue placeholder="请选择合作链路..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableChains.map((chain) => (
                        <SelectItem key={chain.id} value={chain.id}>
                          {chain.chain_name}
                          {chain.is_default && (
                            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              默认
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-xs text-blue-800">
                  <strong>提示：</strong>修改合作链路后，系统将自动重新计算该运单的所有合作方成本。
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setEditChainData(null);
                setAvailableChains([]);
                setSelectedChainId('');
              }} 
              disabled={isSaving}
            >
              取消
            </Button>
            <ConfirmDialog
              title="确认修改链路"
              description={`确定要将运单 ${editChainData?.recordNumber} 的合作链路修改为"${availableChains.find(c => c.id === selectedChainId)?.chain_name}"吗？此操作将自动重新计算所有合作方成本。`}
              onConfirm={() => {
                if (!selectedChainId) {
                  toast({ title: "提示", description: "请先选择合作链路", variant: "default" });
                  return;
                }
                handleSaveChain(selectedChainId);
              }}
            >
              <Button disabled={isSaving || !selectedChainId}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                确认修改
              </Button>
            </ConfirmDialog>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 对话框5: 批量修改应收对话框 */}
      <Dialog open={batchModifyType === 'cost'} onOpenChange={(open) => {
        if (!open) {
          setBatchModifyType(null);
          setBatchCostRecords([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-green-100 rounded-lg">
                <EditIcon className="h-5 w-5 text-green-600" />
              </div>
              批量修改应收
            </DialogTitle>
            <DialogDescription>已选择 {batchCostRecords.length} 条运单，请逐个输入新的合作方应收和司机应收金额</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-3">
              {batchCostRecords.map((record, index) => (
                <Card key={record.id} className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      {/* 基本信息行 */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">运单编号</Label>
                          <p className="font-mono text-sm font-medium">{record.auto_number}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">装货日期</Label>
                          <p className="text-sm">{formatDate(record.loading_date)}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">司机</Label>
                          <p className="text-sm font-medium">{record.driver_name}</p>
                        </div>
                      </div>
                      
                      {/* 合作方应收金额 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 p-3 rounded-md">
                        <div>
                          <Label className="text-xs font-medium text-blue-700">合作方原应收</Label>
                          <p className="text-sm font-mono text-blue-900">¥{record.original_amount.toFixed(2)}</p>
                        </div>
                        <div>
                          <Label htmlFor={`partner-amount-${index}`} className="text-xs font-medium text-blue-700">合作方新应收 (¥)</Label>
                          <Input
                            id={`partner-amount-${index}`}
                            type="text"
                            inputMode="decimal"
                            value={record.new_amount}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
                                const newRecords = [...batchCostRecords];
                                newRecords[index].new_amount = value;
                                setBatchCostRecords(newRecords);
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value;
                              if (value && value !== '-' && !isNaN(parseFloat(value))) {
                                const newRecords = [...batchCostRecords];
                                newRecords[index].new_amount = parseFloat(value).toFixed(2);
                                setBatchCostRecords(newRecords);
                              }
                            }}
                            disabled={isBatchModifying}
                            className="font-mono h-9 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="输入金额（可以是0）"
                          />
                        </div>
                      </div>
                      
                      {/* 司机应收金额 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-green-50 p-3 rounded-md">
                        <div>
                          <Label className="text-xs font-medium text-green-700">司机原应收</Label>
                          <p className="text-sm font-mono text-green-900">¥{record.original_driver_amount.toFixed(2)}</p>
                        </div>
                        <div>
                          <Label htmlFor={`driver-amount-${index}`} className="text-xs font-medium text-green-700">司机新应收 (¥)</Label>
                          <Input
                            id={`driver-amount-${index}`}
                            type="text"
                            inputMode="decimal"
                            value={record.new_driver_amount}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
                                const newRecords = [...batchCostRecords];
                                newRecords[index].new_driver_amount = value;
                                setBatchCostRecords(newRecords);
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value;
                              if (value && value !== '-' && !isNaN(parseFloat(value))) {
                                const newRecords = [...batchCostRecords];
                                newRecords[index].new_driver_amount = parseFloat(value).toFixed(2);
                                setBatchCostRecords(newRecords);
                              }
                            }}
                            disabled={isBatchModifying}
                            className="font-mono h-9 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="输入金额（可以是0）"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4">
              <p className="text-xs text-yellow-800">
                <strong>注意：</strong>
                <br />• 同时修改最高级合作方应收和司机应收
                <br />• 只能修改"未支付"且"未开票"的运单
                <br />• 已申请付款或已开票的运单将自动跳过
                <br />• 金额可以设置为0（表示无需支付）
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setBatchModifyType(null);
                setBatchCostRecords([]);
              }}
              disabled={isBatchModifying}
            >
              取消
            </Button>
            <ConfirmDialog
              title="确认批量恢复默认"
              description={`确定要将选中的 ${batchCostRecords.length} 条运单的应收金额恢复为系统自动计算吗？此操作将清除手动修改标记，重新计算合作方应收，并将司机应收恢复为与合作方应收一致。`}
              onConfirm={handleBatchResetToAuto}
            >
              <Button variant="secondary" disabled={isBatchModifying}>
                {isBatchModifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "🔄"}
                批量恢复默认 ({batchCostRecords.length}条)
              </Button>
            </ConfirmDialog>
            <ConfirmDialog
              title="确认批量修改应收"
              description={`确定要批量修改 ${batchCostRecords.length} 条运单的应收金额吗？此操作将同时更新合作方应收和司机应收。`}
              onConfirm={handleBatchModifyCost}
            >
              <Button disabled={isBatchModifying}>
                {isBatchModifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                确认修改 ({batchCostRecords.length}条)
              </Button>
            </ConfirmDialog>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 对话框6: 批量修改合作链路对话框 */}
      <Dialog open={batchModifyType === 'chain'} onOpenChange={(open) => {
        if (!open) {
          setBatchModifyType(null);
          setBatchChainId('');
          setBatchChains([]);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-purple-100 rounded-lg">
                <LinkIcon className="h-5 w-5 text-purple-600" />
              </div>
              批量修改合作链路
            </DialogTitle>
            <DialogDescription>已选择 {selection.selectedIds.size} 条运单</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batch-chain">选择合作链路</Label>
              <Select
                value={batchChainId}
                onValueChange={setBatchChainId}
                disabled={isBatchModifying}
              >
                <SelectTrigger id="batch-chain">
                  <SelectValue placeholder="请选择合作链路..." />
                </SelectTrigger>
                <SelectContent>
                  {batchChains.map((chain) => (
                    <SelectItem key={chain.id} value={chain.id}>
                      {chain.chain_name}
                      {chain.is_default && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          默认
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-xs text-blue-800">
                <strong>提示：</strong>
                <br />• 修改链路后将自动重新计算所有合作方成本
                <br />• 只能修改"未支付"且"未开票"的运单
                <br />• 已申请付款或已开票的运单将被跳过
                <br />• 所选运单必须属于同一个项目
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setBatchModifyType(null);
                setBatchChainId('');
                setBatchChains([]);
              }}
              disabled={isBatchModifying}
            >
              取消
            </Button>
            <ConfirmDialog
              title="确认批量修改链路"
              description={`确定要将选中的 ${selection.selectedIds.size} 条运单的合作链路修改为"${batchChains.find(c => c.id === batchChainId)?.chain_name}"吗？此操作将自动重新计算所有合作方成本。`}
              onConfirm={handleBatchModifyChain}
            >
              <Button disabled={isBatchModifying || !batchChainId}>
                {isBatchModifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                确认修改
              </Button>
            </ConfirmDialog>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      </div>
    </div>
  );
}

// ============================================================================
// 文件结束
// ============================================================================
