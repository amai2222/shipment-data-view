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
interface LogisticsRecord { id: string; auto_number: string; project_name: string; driver_id: string; driver_name: string; loading_location: string; unloading_location: string; loading_date: string; unloading_date: string | null; license_plate: string | null; driver_phone: string | null; payable_cost: number | null; partner_costs?: PartnerCost[]; payment_status: 'Unpaid' | 'Processing' | 'Paid'; cargo_type: string | null; loading_weight: number | null; unloading_weight: number | null; remarks: string | null; billing_type_id: number | null; }
interface LogisticsRecordWithPartners extends LogisticsRecord { current_cost?: number; extra_cost?: number; chain_name?: string | null; }
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

  const dateRangeValue: DateRange | undefined = (uiFilters.startDate || uiFilters.endDate) ? { from: uiFilters.startDate ? new Date(uiFilters.startDate) : undefined, to: uiFilters.endDate ? new Date(uiFilters.endDate) : undefined } : undefined;
  const displayedPartners = useMemo(() => {
    if (uiFilters.partnerId !== "all") {
      const selected = allPartners.find(p => p.id === uiFilters.partnerId);
      return selected ? [selected] : [];
    }
    if (!reportData || !Array.isArray(reportData.records)) return [];
    const relevantPartnerIds = new Set<string>();
    reportData.records.forEach((record: any) => {
      if (record && Array.isArray(record.partner_costs)) {
        record.partner_costs.forEach((cost: any) => relevantPartnerIds.add(cost.partner_id));
      }
    });
    return allPartners.filter(partner => relevantPartnerIds.has(partner.id)).sort((a, b) => a.level - b.level);
  }, [reportData, allPartners, uiFilters.partnerId]);

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
        <Card className="border-muted/40">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 items-end">
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
        <div className="flex items-center justify-center gap-4 p-2 text-sm font-medium text-center bg-secondary text-secondary-foreground rounded-md">
          <span>已选择当前页的所有 <b>{reportData?.records?.length}</b> 条记录。</span>
          <Button variant="link" className="p-0 h-auto" onClick={() => setSelection({ mode: 'all_filtered', selectedIds: new Set() })}>选择全部 <b>{reportData?.count}</b> 条匹配的记录</Button>
        </div>
      )}
      {selection.mode === 'all_filtered' && (
        <div className="flex items-center justify-center gap-4 p-2 text-sm font-medium text-center bg-secondary text-secondary-foreground rounded-md">
          <span>已选择全部 <b>{reportData?.count}</b> 条匹配的记录。</span>
          <Button variant="link" className="p-0 h-auto" onClick={() => setSelection({ mode: 'none', selectedIds: new Set() })}>清除选择</Button>
        </div>
      )}
      
      {selection.selectedIds.size > 0 && (
        <div className="flex items-center justify-center gap-4 p-2 text-sm font-medium text-center bg-blue-50 text-blue-700 rounded-md">
          <span>已选择 <b>{selection.selectedIds.size}</b> 条记录</span>
          <Button variant="link" className="p-0 h-auto" onClick={() => setSelection({ mode: 'none', selectedIds: new Set() })}>清除选择</Button>
        </div>
      )}

      {isStale ? ( <StaleDataPrompt /> ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>运单财务明细</CardTitle><p className="text-sm text-muted-foreground">各合作方应付金额按级别从左到右排列</p></div>
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
                          </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-semibold border-t-2">
                        <TableCell colSpan={7} className="text-right font-bold whitespace-nowrap">合计</TableCell>
                        <TableCell className="font-mono font-bold text-primary text-center whitespace-nowrap"><div>{formatCurrency(reportData?.overview?.total_payable_cost)}</div><div className="text-xs text-muted-foreground font-normal">(司机应收)</div></TableCell>
                        {Array.isArray(displayedPartners) && displayedPartners.map(p => { const total = (Array.isArray(reportData?.partner_payables) && reportData.partner_payables.find((pp: any) => pp.partner_id === p.id)?.total_payable) || 0; return (<TableCell key={p.id} className="text-center font-bold font-mono whitespace-nowrap"><div>{formatCurrency(total)}</div><div className="text-xs text-muted-foreground font-normal">({p.name})</div></TableCell>);})}
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
            <DialogDescription>将为以下合作方生成付款申请，并更新 {paymentPreviewData?.processed_record_ids.length || 0} 条运单状态为“已申请支付”。</DialogDescription>
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
      
      </div>
    </div>
  );
}
