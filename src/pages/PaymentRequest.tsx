// 文件路径: src/pages/PaymentRequest.tsx
// 版本: FINAL-WITH-ALL-FEATURES-AND-NO-OMISSIONS

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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { useFilterState } from "@/hooks/useFilterState";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { BatchInputDialog } from "@/components/ui/BatchInputDialog";
import { PageHeader } from "@/components/PageHeader";

// --- 类型定义 (已更新) ---
interface PartnerCost { partner_id: string; partner_name: string; level: number; payable_amount: number; full_name?: string; bank_account?: string; bank_name?: string; branch_name?: string; }
interface LogisticsRecord { id: string; auto_number: string; project_name: string; project_id?: string; driver_id: string; driver_name: string; loading_location: string; unloading_location: string; loading_date: string; unloading_date: string | null; license_plate: string | null; driver_phone: string | null; payable_cost: number | null; partner_costs?: PartnerCost[]; payment_status: 'Unpaid' | 'Processing' | 'Paid'; invoice_status?: 'Uninvoiced' | 'Processing' | 'Invoiced' | null; cargo_type: string | null; loading_weight: number | null; unloading_weight: number | null; remarks: string | null; billing_type_id: number | null; }
interface LogisticsRecordWithPartners extends LogisticsRecord { current_cost?: number; extra_cost?: number; chain_name?: string | null; chain_id?: string | null; }
interface FinanceFilters { projectId: string; partnerId: string; startDate: string; endDate: string; paymentStatus: string; driverNames: string[]; }
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

// --- 常量和初始状态 (已更新) ---
const PAGE_SIZE = 50;
const INITIAL_FINANCE_FILTERS: FinanceFilters = { projectId: "all", partnerId: "all", startDate: "", endDate: "", paymentStatus: 'Unpaid', driverNames: [] };
const PAYMENT_STATUS_OPTIONS = [ { value: 'all', label: '所有状态' }, { value: 'Unpaid', label: '未支付' }, { value: 'Processing', label: '已申请支付' }, { value: 'Paid', label: '已完成支付' }, ];
const StaleDataPrompt = () => ( <div className="text-center py-10 border rounded-lg bg-muted/20"> <Search className="mx-auto h-12 w-12 text-muted-foreground" /> <h3 className="mt-2 text-sm font-semibold text-foreground">筛选条件已更改</h3> <p className="mt-1 text-sm text-muted-foreground">请点击“搜索”按钮以查看最新结果。</p> </div> );

export default function PaymentRequest() {
  // --- State 管理 (已更新) ---
  const [reportData, setReportData] = useState<any>(null);
  const [allPartners, setAllPartners] = useState<{id: string, name: string, level: number}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecordWithPartners | null>(null);
  const { toast } = useToast();
  const { uiFilters, setUiFilters, activeFilters, handleSearch, handleClear, isStale } = useFilterState(INITIAL_FINANCE_FILTERS);
  const [pagination, setPagination] = useState<PaginationState>({ currentPage: 1, totalPages: 1 });
  const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set() });
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [paymentPreviewData, setPaymentPreviewData] = useState<PaymentPreviewData | null>(null);
  const [finalPaymentData, setFinalPaymentData] = useState<FinalPaymentData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDriverBatchOpen, setIsDriverBatchOpen] = useState(false);
  const [showAllLevels, setShowAllLevels] = useState(false); // 控制是否显示所有层级的合作方
  const [editPartnerCostData, setEditPartnerCostData] = useState<EditPartnerCostData | null>(null);
  const [editChainData, setEditChainData] = useState<EditChainData | null>(null);
  const [availableChains, setAvailableChains] = useState<PartnerChain[]>([]);
  const [isLoadingChains, setIsLoadingChains] = useState(false);
  const [tempPartnerCosts, setTempPartnerCosts] = useState<PartnerCost[]>([]);
  

  // --- 数据获取 (已更新) ---
  const fetchInitialOptions = useCallback(async () => {
    try {
      const { data: projectsData } = await supabase.from('projects').select('id, name').order('name');
      setProjects(projectsData || []);
      const { data: partnersData } = await supabase.from('project_partners').select(`partner_id, level, partners!inner(name)`);
      const uniquePartners = Array.from(new Map(partnersData?.map(p => [ p.partner_id, { id: p.partner_id, name: (p.partners as any).name, level: p.level } ]) || []).values()).sort((a, b) => a.level - b.level);
      setAllPartners(uniquePartners);
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
        p_partner_id: activeFilters.partnerId === 'all' ? null : activeFilters.partnerId,
        p_payment_status_array: statusArray,
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

  // --- 核心函数实现 (已更新) ---
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
  const handleRecordSelect = (recordId: string) => { setSelection(prev => { const newSet = new Set(prev.selectedIds); if (newSet.has(recordId)) { newSet.delete(recordId); } else { newSet.add(recordId); } if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; } return { ...prev, selectedIds: newSet }; }); };
  const handleSelectAllOnPage = (isChecked: boolean) => { const pageIds = (reportData?.records || []).map((r: any) => r.id); if (isChecked) { setSelection(prev => ({ ...prev, selectedIds: new Set([...prev.selectedIds, ...pageIds]) })); } else { setSelection(prev => { const newSet = new Set(prev.selectedIds); pageIds.forEach(id => newSet.delete(id)); if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; } return { ...prev, selectedIds: newSet }; }); } };
  
  
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
  
  const getPaymentStatusBadge = (status: 'Unpaid' | 'Processing' | 'Paid') => {
    switch (status) {
      case 'Unpaid': return <Badge variant="destructive">未支付</Badge>;
      case 'Processing': return <Badge variant="secondary">已申请支付</Badge>;
      case 'Paid': return <Badge variant="default">已完成支付</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  // 修改合作方运费
  const handleEditPartnerCost = (record: LogisticsRecordWithPartners) => {
    setEditPartnerCostData({
      recordId: record.id,
      recordNumber: record.auto_number,
      partnerCosts: record.partner_costs || []
    });
    setTempPartnerCosts(JSON.parse(JSON.stringify(record.partner_costs || [])));
  };

  // 修改合作链路
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
    
    // 获取可用的合作链路
    setIsLoadingChains(true);
    try {
      const { data, error } = await supabase
        .from('partner_chains')
        .select('id, chain_name, is_default')
        .eq('project_id', projectId)  // ⭐ 使用查找到的 projectId，而不是 record.project_id
        .order('is_default', { ascending: false });
      
      if (error) throw error;
      
      console.log('✅ 查询到的合作链路:', data);
      
      if (!data || data.length === 0) {
        toast({ 
          title: "提示", 
          description: "该项目暂无合作链路，请先在项目管理中配置", 
          variant: "default" 
        });
      }
      
      setAvailableChains(data || []);
    } catch (error) {
      console.error("获取合作链路失败:", error);
      toast({ title: "错误", description: "获取合作链路失败", variant: "destructive" });
    } finally {
      setIsLoadingChains(false);
    }
  };

  // 保存合作方运费修改 - 只更新最高级合作方
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
          updated_at: new Date().toISOString()
        })
        .eq('logistics_record_id', editPartnerCostData.recordId)
        .eq('partner_id', highestLevelPartner.partner_id)
        .eq('level', maxLevel);
      
      if (updateError) throw updateError;
      
      toast({ 
        title: "成功", 
        description: `已更新最高级合作方"${highestLevelPartner.partner_name}"的运费` 
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

  // 保存合作链路修改 - 删除旧记录并重新计算
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
      fetchReportData();
    } catch (error) {
      console.error("修改合作链路失败:", error);
      toast({ title: "错误", description: `修改失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

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

  const isAllOnPageSelected = useMemo(() => {
    if (!reportData || !Array.isArray(reportData.records)) return false;
    const pageIds = reportData.records.map((r: any) => r.id);
    if (pageIds.length === 0) return false;
    return pageIds.every(id => selection.selectedIds.has(id));
  }, [reportData?.records, selection.selectedIds]);

  const selectionCount = useMemo(() => { if (selection.mode === 'all_filtered') return reportData?.count || 0; return selection.selectedIds.size; }, [selection, reportData?.count]);

  if (loading && !reportData && isStale) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>;

  // --- JSX 渲染 (已更新) ---
  return (
    <div className="space-y-6 p-4 md:p-6">
      <BatchInputDialog
        isOpen={isDriverBatchOpen}
        onClose={() => setIsDriverBatchOpen(false)}
        onConfirm={(values) => setUiFilters(prev => ({ ...prev, driverNames: values }))}
        title="批量输入司机姓名"
        description="请粘贴司机姓名，用换行或逗号分隔。"
        placeholder="例如:&#10;张三,&#10;李四&#10;王五"
        initialValue={uiFilters.driverNames}
      />
      
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
        <Card className="border-muted/40 shadow-sm">
        <CardContent className="p-4 bg-gradient-to-br from-background to-muted/5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 items-end">
            <div className="flex flex-col gap-1.5"><Label>项目</Label><Select value={uiFilters.projectId} onValueChange={(v) => handleFilterChange('projectId', v)}><SelectTrigger className="h-9 text-sm"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">所有项目</SelectItem>{Array.isArray(projects) && projects.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div>
            <div className="flex flex-col gap-1.5"><Label>日期范围</Label><DateRangePicker date={dateRangeValue} setDate={handleDateChange} /></div>
            <div className="flex flex-col gap-1.5"><Label>合作方</Label><Select value={uiFilters.partnerId} onValueChange={(v) => handleFilterChange('partnerId', v)}><SelectTrigger className="h-9 text-sm"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">所有合作方</SelectItem>{Array.isArray(allPartners) && allPartners.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} ({p.level}级)</SelectItem>))}</SelectContent></Select></div>
            <div className="flex flex-col gap-1.5">
              <Label>司机</Label>
              <div className="flex items-center gap-1">
                <Input
                  className="h-9 text-sm"
                  placeholder={uiFilters.driverNames.length > 1 ? `已输入 ${uiFilters.driverNames.length} 个司机` : "输入单个司机"}
                  value={uiFilters.driverNames.length === 1 ? uiFilters.driverNames[0] : ''}
                  onChange={(e) => setUiFilters(prev => ({ ...prev, driverNames: e.target.value ? [e.target.value] : [] }))}
                  disabled={uiFilters.driverNames.length > 1}
                />
                <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => setIsDriverBatchOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5"><Label>支付状态</Label><Select value={uiFilters.paymentStatus} onValueChange={(v) => handleFilterChange('paymentStatus', v)}><SelectTrigger className="h-9 text-sm"><SelectValue placeholder="选择状态..." /></SelectTrigger><SelectContent>{PAYMENT_STATUS_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}</SelectContent></Select></div>
            <div className="flex gap-2 pt-5">
              <Button onClick={handleSearch} size="sm" className="h-9 px-3 text-sm"><Search className="mr-2 h-4 w-4"/>搜索</Button>
              <Button variant="outline" size="sm" onClick={handleClear} className="h-9 px-3 text-sm">清除</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selection.selectedIds.size > 0 && selection.mode !== 'all_filtered' && isAllOnPageSelected && reportData?.count > (reportData?.records?.length || 0) && (
        <div className="flex items-center justify-center gap-4 p-3 text-sm font-medium text-center bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-800 rounded-lg shadow-sm">
          <span>已选择当前页的所有 <b className="text-blue-600">{reportData?.records?.length}</b> 条记录。</span>
          <Button variant="link" className="p-0 h-auto text-blue-600 hover:text-blue-700 font-semibold" onClick={() => setSelection({ mode: 'all_filtered', selectedIds: new Set() })}>选择全部 <b>{reportData?.count}</b> 条匹配的记录</Button>
        </div>
      )}
      {selection.mode === 'all_filtered' && (
        <div className="flex items-center justify-center gap-4 p-3 text-sm font-medium text-center bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-800 rounded-lg shadow-sm">
          <span>已选择全部 <b className="text-green-600">{reportData?.count}</b> 条匹配的记录。</span>
          <Button variant="link" className="p-0 h-auto text-green-600 hover:text-green-700 font-semibold" onClick={() => setSelection({ mode: 'none', selectedIds: new Set() })}>清除选择</Button>
        </div>
      )}
      
      {selection.selectedIds.size > 0 && selection.mode !== 'all_filtered' && (
        <div className="flex items-center justify-center gap-4 p-3 text-sm font-medium text-center bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 text-blue-800 rounded-lg shadow-sm">
          <span>已选择 <b className="text-blue-600">{selection.selectedIds.size}</b> 条记录</span>
          <Button variant="link" className="p-0 h-auto text-blue-600 hover:text-blue-700 font-semibold" onClick={() => setSelection({ mode: 'none', selectedIds: new Set() })}>清除选择</Button>
        </div>
      )}

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

      {/* 修改合作方运费对话框 */}
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
                            <Label htmlFor={`amount-${cost.partner_id}`}>应付金额 (¥)</Label>
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
            <Button onClick={handleSavePartnerCost} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 修改合作链路对话框 */}
      <Dialog open={!!editChainData} onOpenChange={(open) => !open && setEditChainData(null)}>
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
                    onValueChange={(value) => {
                      handleSaveChain(value);
                    }}
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
              }} 
              disabled={isSaving}
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      </div>
    </div>
  );
}
