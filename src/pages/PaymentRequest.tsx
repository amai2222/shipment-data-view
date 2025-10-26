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
import { Save, Plus, Banknote } from "lucide-react";

// 占位符图标组件
const Loader2 = ({ className }: { className?: string }) => <span className={className}>⏳</span>;
const Search = ({ className }: { className?: string }) => <span className={className}>🔍</span>;
const FileSpreadsheet = ({ className }: { className?: string }) => <span className={className}>📊</span>;
const EditIcon = ({ className }: { className?: string }) => <span className={className}>✏️</span>;
const LinkIcon = ({ className }: { className?: string }) => <span className={className}>🔗</span>;
const ChevronDown = ({ className }: { className?: string }) => <span className={className}>▼</span>;
const ChevronUp = ({ className }: { className?: string }) => <span className={className}>▲</span>;
const Hash = ({ className }: { className?: string }) => <span className={className}>#</span>;
const Phone = ({ className }: { className?: string }) => <span className={className}>📞</span>;
const FileText = ({ className }: { className?: string }) => <span className={className}>📄</span>;
const Users = ({ className }: { className?: string }) => <span className={className}>👥</span>;
const Building2 = ({ className }: { className?: string }) => <span className={className}>🏢</span>;
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { useFilterState } from "@/hooks/useFilterState";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { BatchInputDialog } from "@/pages/BusinessEntry/components/BatchInputDialog";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
interface EditPartnerCostData { recordId: string; recordNumber: string; partnerCosts: PartnerCost[]; }
interface EditChainData { recordId: string; recordNumber: string; projectId: string; currentChainName: string; }

// ============================================================================
// 区域3: 常量定义和初始状态
// ============================================================================
const PAGE_SIZE = 50;
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
  const [tempPartnerCosts, setTempPartnerCosts] = useState<PartnerCost[]>([]);
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
    original_amount: number;
    new_amount: string;
  }[]>([]);

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
  const handleSelectAllOnPage = (isChecked: boolean) => { const pageIds = (reportData?.records || []).map((r: any) => r.id); if (isChecked) { setSelection(prev => ({ ...prev, selectedIds: new Set([...prev.selectedIds, ...pageIds]) })); } else { setSelection(prev => { const newSet = new Set(prev.selectedIds); pageIds.forEach(id => newSet.delete(id)); if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; } return { ...prev, selectedIds: newSet }; }); } };
  
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
          if (cost.level < maxLevel) {
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
  
  /**
   * 获取支付状态徽章组件
   */
  const getPaymentStatusBadge = (status: 'Unpaid' | 'Processing' | 'Paid') => {
    switch (status) {
      case 'Unpaid': return <Badge variant="destructive">未支付</Badge>;
      case 'Processing': return <Badge variant="secondary">已申请支付</Badge>;
      case 'Paid': return <Badge variant="default">已完成支付</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

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
      partnerCosts: record.partner_costs || []
    });
    setTempPartnerCosts(JSON.parse(JSON.stringify(record.partner_costs || [])));
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
   * 保存合作方运费修改
   * 限制：
   * 1. 只更新最高级合作方的运费
   * 2. 只允许修改"未支付"且"未开票"的运单
   * 3. 其他层级的运费由系统自动计算
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
      
      // 找出最高级合作方
      const maxLevel = Math.max(...tempPartnerCosts.map(c => c.level));
      const highestLevelPartner = tempPartnerCosts.find(c => c.level === maxLevel);
      
      if (!highestLevelPartner) {
        throw new Error("未找到最高级合作方");
      }
      
      // 只更新最高级合作方的金额
      const { error: updateError } = await supabase
        .from('logistics_partner_costs')
        .update({
          payable_amount: highestLevelPartner.payable_amount,
          is_manually_modified: true,  // 🆕 标记为用户手动修改
          updated_at: new Date().toISOString()
        })
        .eq('logistics_record_id', editPartnerCostData.recordId)
        .eq('partner_id', highestLevelPartner.partner_id)
        .eq('level', maxLevel);
      
      if (updateError) throw updateError;
      
      toast({ 
        title: "成功", 
        description: `已更新最高级合作方"${highestLevelPartner.partner_name}"的运费（后续链路修改时会保护此手动值）` 
      });
      setEditPartnerCostData(null);
      setTempPartnerCosts([]);
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
   * 批量修改应收
   * 功能：
   * 1. 逐个修改选中运单的最高级合作方应收金额
   * 2. 验证运单状态（只能修改"未支付"且"未开票"的运单）
   * 3. 显示成功和失败统计
   */
  const handleBatchModifyCost = async () => {
    // 验证每条记录都有输入金额
    const invalidRecords = batchCostRecords.filter(r => !r.new_amount || parseFloat(r.new_amount) <= 0);
    if (invalidRecords.length > 0) {
      toast({ title: "错误", description: `请为所有运单输入有效金额`, variant: "destructive" });
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
          const newAmount = parseFloat(record.new_amount);
          
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
          
          // 更新最高级合作方的金额
          const { error: updateError } = await supabase
            .from('logistics_partner_costs')
            .update({
              payable_amount: newAmount,
              is_manually_modified: true,  // 🆕 标记为用户手动修改
              updated_at: new Date().toISOString()
            })
            .eq('logistics_record_id', record.id)
            .eq('partner_id', highestPartner.partner_id)
            .eq('level', highestPartner.level);
          
          if (updateError) throw updateError;
          
          successCount++;
        } catch (error) {
          failedCount++;
          failedList.push(`${record.auto_number}(错误: ${(error as any).message})`);
        }
      }

      toast({
        title: "批量修改完成",
        description: `成功更新 ${successCount} 条运单，失败 ${failedCount} 条`,
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
          
          return {
            id: record.id,
            auto_number: record.auto_number,
            loading_date: record.loading_date,
            driver_name: record.driver_name,
            original_amount: highestCost?.payable_amount || 0,
            new_amount: (highestCost?.payable_amount || 0).toString()
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
    if (!reportData || !Array.isArray(reportData.records)) return false;
    const pageIds = reportData.records.map((r: any) => r.id);
    if (pageIds.length === 0) return false;
    return pageIds.every(id => selection.selectedIds.has(id));
  }, [reportData?.records, selection.selectedIds]);

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
          <Button variant="default" disabled={(selection.mode !== 'all_filtered' && selection.selectedIds.size === 0) || isGenerating} onClick={handleApplyForPaymentClick}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            一键申请付款 ({selectionCount})
          </Button>
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
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleOpenBatchModify('cost')}>
              <EditIcon className="mr-2 h-4 w-4" />
              批量修改应收
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleOpenBatchModify('chain')}>
              <LinkIcon className="mr-2 h-4 w-4" />
              批量修改链路
            </Button>
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
                      <TableHead className="whitespace-nowrap">运单编号</TableHead>
                      <TableHead className="whitespace-nowrap">项目</TableHead>
                      <TableHead className="whitespace-nowrap">司机</TableHead>
                      <TableHead className="whitespace-nowrap">路线</TableHead>
                      <TableHead className="whitespace-nowrap">装/卸数量</TableHead>
                      <TableHead className="whitespace-nowrap">日期</TableHead>
                      <TableHead className="whitespace-nowrap font-bold text-primary">司机应收</TableHead>
                      {Array.isArray(displayedPartners) && displayedPartners.map(p => <TableHead key={p.id} className="text-center whitespace-nowrap">{p.name}<div className="text-xs text-muted-foreground">({p.level}级)</div></TableHead>)}
                      <TableHead className="whitespace-nowrap">合作链路</TableHead>
                      <TableHead className="whitespace-nowrap">支付状态</TableHead>
                      <TableHead className="whitespace-nowrap text-center">操作</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {Array.isArray(reportData?.records) && reportData.records.map((r: LogisticsRecordWithPartners) => (
                          <TableRow key={r.id} data-state={selection.selectedIds.has(r.id) && "selected"}>
                              <TableCell className="whitespace-nowrap"><Checkbox checked={selection.mode === 'all_filtered' || selection.selectedIds.has(r.id)} onCheckedChange={() => handleRecordSelect(r.id)} /></TableCell>
                              <TableCell className="font-mono cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{r.auto_number}</TableCell>
                              <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{r.project_name}</TableCell>
                              <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{r.driver_name}</TableCell>
                              <TableCell className="text-sm cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{simplifyRoute(r.loading_location, r.unloading_location)}</TableCell>
                              <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{formatQuantity(r)}</TableCell>
                              <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{r.loading_date}</TableCell>
                              <TableCell className="font-mono cursor-pointer whitespace-nowrap font-bold text-primary" onClick={() => setViewingRecord(r)}>{formatCurrency(r.payable_cost)}</TableCell>
                              {Array.isArray(displayedPartners) && displayedPartners.map(p => { const cost = (Array.isArray(r.partner_costs) && r.partner_costs.find((c:any) => c.partner_id === p.id)); return <TableCell key={p.id} className="font-mono text-center cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{formatCurrency(cost?.payable_amount)}</TableCell>; })}
                               <TableCell className="whitespace-nowrap">
                                 <span className="text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">{r.chain_name || '默认链路'}</span>
                               </TableCell>
                              <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{getPaymentStatusBadge(r.payment_status)}</TableCell>
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
                        {Array.isArray(displayedPartners) && displayedPartners.map(p => { const total = (Array.isArray(reportData?.partner_payables) && reportData.partner_payables.find((pp: any) => pp.partner_id === p.id)?.total_payable) || 0; return (<TableCell key={p.id} className="text-center font-bold font-mono whitespace-nowrap"><div>{formatCurrency(total)}</div><div className="text-xs text-muted-foreground font-normal">({p.name})</div></TableCell>);})}
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
              <div className="space-y-1"><Label className="text-muted-foreground">装货日期</Label><p>{viewingRecord.loading_date}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">支付状态</Label><p>{getPaymentStatusBadge(viewingRecord.payment_status)}</p></div>
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
                {sortedCosts.map((cost, index) => {
                  const isHighest = cost.level === maxLevel;
                  return (
                    <Card key={cost.partner_id} className={`border-l-4 ${isHighest ? 'border-l-blue-500 bg-blue-50/50' : 'border-l-gray-300 bg-gray-50/30'}`}>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">合作方名称</Label>
                            <p className="font-medium">{cost.partner_name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                              isHighest ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {cost.level}级 {isHighest && '(最高级)'}
                            </span>
                          </div>
                          <div>
                            <Label htmlFor={`amount-${cost.partner_id}`}>应收金额 (¥)</Label>
                            {isHighest ? (
                              <Input
                                id={`amount-${cost.partner_id}`}
                                type="number"
                                step="0.01"
                                value={cost.payable_amount}
                                onChange={(e) => {
                                  const newCosts = [...tempPartnerCosts];
                                  const targetIndex = newCosts.findIndex(c => c.partner_id === cost.partner_id);
                                  newCosts[targetIndex].payable_amount = parseFloat(e.target.value) || 0;
                                  setTempPartnerCosts(newCosts);
                                }}
                                className="font-mono border-blue-300 focus:border-blue-500"
                              />
                            ) : (
                              <div className="h-9 px-3 py-2 border rounded-md bg-muted/50 font-mono text-muted-foreground flex items-center">
                                ¥{cost.payable_amount.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                        {!isHighest && (
                          <p className="text-xs text-muted-foreground mt-2">
                            💡 低层级合作方金额由系统自动计算，不可手动修改
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-xs text-blue-800">
                    <strong>说明：</strong>只能修改最高级合作方的运费，其他层级的运费由系统根据利润率或税点自动计算。
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
              title="确认修改应收"
              description={`确定要修改运单 ${editPartnerCostData?.recordNumber} 的应收金额吗？此操作将更新最高级合作方的费用。`}
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
            <DialogDescription>已选择 {batchCostRecords.length} 条运单，请逐个输入新的应收金额</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-3">
              {batchCostRecords.map((record, index) => (
                <Card key={record.id} className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                      <div className="md:col-span-1">
                        <Label className="text-xs text-muted-foreground">运单编号</Label>
                        <p className="font-mono text-sm font-medium">{record.auto_number}</p>
                      </div>
                      <div className="md:col-span-1">
                        <Label className="text-xs text-muted-foreground">装货日期</Label>
                        <p className="text-sm">{new Date(record.loading_date).toLocaleDateString('zh-CN')}</p>
                      </div>
                      <div className="md:col-span-1">
                        <Label className="text-xs text-muted-foreground">司机</Label>
                        <p className="text-sm font-medium">{record.driver_name}</p>
                      </div>
                      <div className="md:col-span-1">
                        <Label className="text-xs text-muted-foreground">原应收金额</Label>
                        <p className="text-sm font-mono text-muted-foreground">¥{record.original_amount.toFixed(2)}</p>
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor={`amount-${index}`} className="text-xs text-muted-foreground">新应收金额 (¥)</Label>
                        <Input
                          id={`amount-${index}`}
                          type="number"
                          step="0.01"
                          value={record.new_amount}
                          onChange={(e) => {
                            const newRecords = [...batchCostRecords];
                            newRecords[index].new_amount = e.target.value;
                            setBatchCostRecords(newRecords);
                          }}
                          disabled={isBatchModifying}
                          className="font-mono h-9"
                          placeholder="输入新金额"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4">
              <p className="text-xs text-yellow-800">
                <strong>注意：</strong>
                <br />• 只会修改最高级合作方的应收金额
                <br />• 只能修改"未支付"且"未开票"的运单
                <br />• 已申请付款或已开票的运单将自动跳过
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
              title="确认批量修改应收"
              description={`确定要批量修改 ${batchCostRecords.length} 条运单的应收金额吗？此操作将更新这些运单最高级合作方的费用。`}
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
