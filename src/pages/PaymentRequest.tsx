// 文件路径: src/pages/PaymentRequest.tsx
// 描述: [8MFgb 最终执行版] 此代码已根据您的最新需求完成界面优化。
//       1. 强制不换行：主数据表格中的所有单元格内容将保持在单行显示。
//       2. 启用水平滚动：当表格宽度超出屏幕时，将出现水平滚动条，保证布局完整。

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Loader2, Search, FileSpreadsheet, Save, XCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useFilterState } from "@/hooks/useFilterState";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

// --- 类型定义 (已根据新数据结构更新) ---
interface PartnerCost { partner_id: string; partner_name: string; level: number; payable_amount: number; full_name: string; bank_account: string; bank_name: string; branch_name: string; }
interface LogisticsRecord { id: string; auto_number: string; project_name: string; driver_id: string; driver_name: string; loading_location: string; unloading_location: string; loading_date: string; unloading_date: string | null; license_plate: string | null; driver_phone: string | null; payable_cost: number | null; partner_costs?: PartnerCost[]; payment_status: 'Unpaid' | 'Processing' | 'Paid'; cargo_type: string | null; loading_weight: number | null; unloading_weight: number | null; remarks: string | null; }
interface LogisticsRecordWithPartners extends LogisticsRecord { current_cost?: number; extra_cost?: number; chain_name?: string | null; }
interface FinanceFilters { projectId: string; partnerId: string; startDate: string; endDate: string; paymentStatus: string; }
interface PaginationState { currentPage: number; totalPages: number; }
interface SelectionState { mode: 'none' | 'all_filtered'; selectedIds: Set<string>; }
interface PaymentSheetData { paying_partner_id: string; paying_partner_name: string; paying_partner_full_name: string; paying_partner_bank_account: string; paying_partner_bank_name: string; paying_partner_branch_name: string; header_company_name: string; records: { record: LogisticsRecord; payable_amount: number; }[]; total_payable: number; project_name: string; }
interface MultiSheetPaymentData { sheets: PaymentSheetData[]; all_records: LogisticsRecord[]; }

// --- 常量和初始状态 ---
const PAGE_SIZE = 50;
const INITIAL_FINANCE_FILTERS: FinanceFilters = { projectId: "all", partnerId: "all", startDate: "", endDate: "", paymentStatus: 'Unpaid' };
const PAYMENT_STATUS_OPTIONS = [ { value: 'all', label: '所有状态' }, { value: 'Unpaid', label: '未支付' }, { value: 'Processing', label: '已申请支付' }, { value: 'Paid', label: '已完成支付' }, ];
const StaleDataPrompt = () => ( <div className="text-center py-10 border rounded-lg bg-muted/20"> <Search className="mx-auto h-12 w-12 text-muted-foreground" /> <h3 className="mt-2 text-sm font-semibold text-foreground">筛选条件已更改</h3> <p className="mt-1 text-sm text-muted-foreground">请点击“搜索”按钮以查看最新结果。</p> </div> );

export default function PaymentRequest() {
  // --- State 管理 ---
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
  const [multiSheetPaymentData, setMultiSheetPaymentData] = useState<MultiSheetPaymentData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // --- 数据获取 ---
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
        p_page_number: pagination.currentPage
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
  useEffect(() => { if (!isStale) { fetchReportData(); } else { setLoading(false); } }, [fetchReportData, isStale]);
  useEffect(() => { setPagination(p => p.currentPage === 1 ? p : { ...p, currentPage: 1 }); setSelection({ mode: 'none', selectedIds: new Set() }); }, [activeFilters]);

  // --- 核心函数实现 ---
  const formatCurrency = (value: number | null | undefined): string => { if (value == null) return '-'; return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value); };
  const simplifyRoute = (loading?: string, unloading?: string): string => { const start = (loading || '').substring(0, 2); const end = (unloading || '').substring(0, 2); return `${start}→${end}`; };

  const handleFilterChange = <K extends keyof FinanceFilters>(field: K, value: FinanceFilters[K]) => { setUiFilters(prev => ({ ...prev, [field]: value })); };
  const handleDateChange = (dateRange: DateRange | undefined) => { setUiFilters(prev => ({ ...prev, startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '', endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '' })); };
  const handleRecordSelect = (recordId: string) => { setSelection(prev => { const newSet = new Set(prev.selectedIds); if (newSet.has(recordId)) { newSet.delete(recordId); } else { newSet.add(recordId); } if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; } return { ...prev, selectedIds: newSet }; }); };
  const handleSelectAllOnPage = (isChecked: boolean) => { const pageIds = (reportData?.records || []).map((r: any) => r.id); if (isChecked) { setSelection(prev => ({ ...prev, selectedIds: new Set([...prev.selectedIds, ...pageIds]) })); } else { setSelection(prev => { const newSet = new Set(prev.selectedIds); pageIds.forEach(id => newSet.delete(id)); if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; } return { ...prev, selectedIds: newSet }; }); } };
  
  const handleApplyForPaymentClick = async () => {
    const initialSelectionCount = selection.selectedIds.size;
    if (initialSelectionCount === 0) { toast({ title: "提示", description: "请先选择需要申请付款的运单。" }); return; }
    if (selection.mode === 'all_filtered') { toast({ title: "提示", description: "“跨页全选”模式下将直接后台处理，无法预览。功能开发中..." }); return; }

    setIsGenerating(true);
    try {
      const { data: filterData, error: filterError } = await supabase.from('logistics_records').select('id').eq('payment_status', 'Unpaid').in('id', Array.from(selection.selectedIds));
      if (filterError) throw filterError;
      
      const idsToFetch = filterData.map(r => r.id);
      const finalCount = idsToFetch.length;
      const ignoredCount = initialSelectionCount - finalCount;

      if (ignoredCount > 0) { toast({ title: "部分运单被忽略", description: `您选择了 ${initialSelectionCount} 条运单，其中 ${ignoredCount} 条因状态不为“未支付”已被自动忽略。将仅为剩余的 ${finalCount} 条运单生成付款申请。`, variant: "default", duration: 8000, action: <div className="p-1 rounded-full bg-blue-100"><Info className="h-5 w-5 text-blue-600"/></div> }); }
      if (finalCount === 0) { toast({ title: "提示", description: "所选运单中没有“未支付”状态的记录，无需申请。", variant: "destructive" }); setIsGenerating(false); return; }

      const { data, error } = await supabase.rpc('get_payment_request_data', { 
        p_project_id: null,
        p_start_date: null,
        p_end_date: null,
        p_partner_id: null,
        p_payment_status_array: ['Unpaid'],
        p_page_size: 10000,
        p_page_number: 1
      });
      if (error) throw error;

      const allFetchedRecords: LogisticsRecord[] = (data as { records?: LogisticsRecord[] })?.records || [];
      const selectedRecords = allFetchedRecords.filter(r => idsToFetch.includes(r.id));

      const paymentSheetsMap = new Map<string, PaymentSheetData>();
      selectedRecords.forEach(record => {
        const costs = record.partner_costs || [];
        for (let i = 0; i < costs.length; i++) {
          const currentPartner = costs[i];
          const nextPartner = costs.find(p => p.level === currentPartner.level + 1);
          if (currentPartner.level === 0) continue;

          if (!paymentSheetsMap.has(currentPartner.partner_id)) {
            paymentSheetsMap.set(currentPartner.partner_id, {
              paying_partner_id: currentPartner.partner_id,
              paying_partner_name: currentPartner.partner_name,
              paying_partner_full_name: currentPartner.full_name,
              paying_partner_bank_account: currentPartner.bank_account,
              paying_partner_bank_name: currentPartner.bank_name,
              paying_partner_branch_name: currentPartner.branch_name,
              header_company_name: nextPartner ? nextPartner.full_name : '中科智运（云南）供应链科技有限公司',
              records: [],
              total_payable: 0,
              project_name: record.project_name,
            });
          }
          const sheet = paymentSheetsMap.get(currentPartner.partner_id)!;
          sheet.records.push({ record: record, payable_amount: currentPartner.payable_amount });
          sheet.total_payable += currentPartner.payable_amount;
        }
      });

      setMultiSheetPaymentData({ sheets: Array.from(paymentSheetsMap.values()), all_records: selectedRecords });
      setIsPreviewModalOpen(true);

    } catch (error) {
      console.error("准备付款申请数据失败:", error);
      toast({ title: "错误", description: `准备付款申请数据失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!multiSheetPaymentData || multiSheetPaymentData.all_records.length === 0) return;
    setIsSaving(true);
    try {
      const { all_records } = multiSheetPaymentData;
      const recordIds = all_records.map(r => r.id);
      const totalAmount = all_records.reduce((sum, r) => sum + (r.payable_cost || 0), 0);
      const { data: newRequestId, error } = await supabase.rpc('process_payment_application', { p_record_ids: recordIds, p_total_amount: totalAmount });
      if (error) throw error;
      
      toast({ title: "成功", description: `付款申请批次 ${newRequestId} 已成功创建，并更新了 ${recordIds.length} 条运单状态为“已申请支付”。正在生成Excel文件...` });

      const { data: fileBlob, error: functionError } = await supabase.functions.invoke('export-excel', {
        body: { sheetData: multiSheetPaymentData, requestId: newRequestId }
      });

      if (functionError) {
        throw new Error(`生成Excel文件失败: ${functionError.message}`);
      }

      const url = window.URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `支付申请表_${newRequestId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setIsPreviewModalOpen(false);
      setMultiSheetPaymentData(null);
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchReportData();
    } catch (error) {
      console.error("保存付款申请或生成文件失败:", error);
      toast({ title: "错误", description: `操作失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelApplication = async () => {
    setIsCancelling(true);
    try {
        let updatedCount = 0;
        let error: any = null;
        if (selection.mode === 'all_filtered') {
            const { data, error: rpcError } = await supabase.rpc('batch_cancel_by_filter', { p_project_id: activeFilters.projectId === 'all' ? null : activeFilters.projectId, p_start_date: activeFilters.startDate || null, p_end_date: activeFilters.endDate || null, p_partner_id: activeFilters.partnerId === 'all' ? null : activeFilters.partnerId });
            updatedCount = data;
            error = rpcError;
        } else {
            const idsToCancel = Array.from(selection.selectedIds);
            if (idsToCancel.length === 0) {
                toast({ title: "提示", description: "没有选择任何运单。" });
                setIsCancelling(false);
                return;
            }
            const { data, error: rpcError } = await supabase.rpc('batch_cancel_payment_application', { p_record_ids: idsToCancel });
            updatedCount = data;
            error = rpcError;
        }
        if (error) throw error;
        if (updatedCount > 0) {
            toast({ title: "成功", description: `已成功取消 ${updatedCount} 条付款申请，状态已恢复为“未支付”。` });
        } else {
            toast({ title: "提示", description: "所选运单中没有需要取消的申请（可能已支付或未申请）。" });
        }
        setSelection({ mode: 'none', selectedIds: new Set() });
        fetchReportData();
    } catch (error) {
        console.error("取消付款申请失败:", error);
        toast({ title: "错误", description: `取消付款申请失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
        setIsCancelling(false);
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

  // --- 派生状态和工具函数 ---
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

  if (loading && !reportData) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-foreground">合作方付款申请</h1><p className="text-muted-foreground">向合作方申请支付运费。</p></div>
        <div className="flex gap-2">
          <Button variant="default" disabled={selectionCount === 0 || isGenerating} onClick={handleApplyForPaymentClick}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            一键申请付款 ({selectionCount})
          </Button>
          <ConfirmDialog title="确认取消申请" description={`您确定要为选中的 ${selectionCount} 条运单取消付款申请吗？此操作将把它们的状态恢复为“未支付”。`} onConfirm={handleCancelApplication}>
            <Button variant="destructive" disabled={selectionCount === 0 || isCancelling}>
              {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              取消申请 ({selectionCount})
            </Button>
          </ConfirmDialog>
        </div>
      </div>

      <Card className="border-muted/40">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5 min-w-[140px]"><Label>项目</Label><Select value={uiFilters.projectId} onValueChange={(v) => handleFilterChange('projectId', v)}><SelectTrigger className="h-9 text-sm"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">所有项目</SelectItem>
                {Array.isArray(projects) && projects.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
            </SelectContent></Select></div>
            <div className="flex flex-col gap-1.5"><Label>日期范围</Label><DateRangePicker date={dateRangeValue} setDate={handleDateChange} /></div>
            <div className="flex flex-col gap-1.5 min-w-[140px]"><Label>合作方</Label><Select value={uiFilters.partnerId} onValueChange={(v) => handleFilterChange('partnerId', v)}><SelectTrigger className="h-9 text-sm"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">所有合作方</SelectItem>
                {Array.isArray(allPartners) && allPartners.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} ({p.level}级)</SelectItem>))}
            </SelectContent></Select></div>
            <div className="flex flex-col gap-1.5 min-w-[120px]">
                <Label>支付状态</Label>
                <Select value={uiFilters.paymentStatus} onValueChange={(v) => handleFilterChange('paymentStatus', v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="选择状态..." /></SelectTrigger>
                    <SelectContent>{PAYMENT_STATUS_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}</SelectContent>
                </Select>
            </div>
            <Button onClick={handleSearch} size="sm" className="h-9 px-3 text-sm"><Search className="mr-2 h-4 w-4"/>搜索</Button>
            <Button variant="outline" size="sm" onClick={handleClear} className="h-9 px-3 text-sm">清除筛选</Button>
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

      {isStale ? ( <StaleDataPrompt /> ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>运单财务明细</CardTitle><p className="text-sm text-muted-foreground">各合作方应付金额按级别从左到右排列</p></div>
            </CardHeader>
            <CardContent>
              {/* 关键变更 1: 添加一个启用水平滚动的外层容器 */}
              <div className="relative overflow-x-auto">
                <div className="min-h-[400px]">
                  {loading ? (<div className="flex justify-center items-center h-full min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin"/></div>) : (
                  <Table>
                    <TableHeader><TableRow>
                      {/* 关键变更 2: 为所有表头和单元格添加 whitespace-nowrap */}
                      <TableHead className="w-12 whitespace-nowrap"><Checkbox checked={selection.mode === 'all_filtered' || isAllOnPageSelected} onCheckedChange={handleSelectAllOnPage} /></TableHead>
                      <TableHead className="whitespace-nowrap">运单编号</TableHead>
                      <TableHead className="whitespace-nowrap">项目</TableHead>
                      <TableHead className="whitespace-nowrap">司机</TableHead>
                      <TableHead className="whitespace-nowrap">路线</TableHead>
                      <TableHead className="whitespace-nowrap">装货重量</TableHead>
                      <TableHead className="whitespace-nowrap">卸货重量</TableHead>
                      <TableHead className="whitespace-nowrap">日期</TableHead>
                      <TableHead className="whitespace-nowrap">运费</TableHead>
                      <TableHead className="text-orange-600 whitespace-nowrap">额外费</TableHead>
                      {Array.isArray(displayedPartners) && displayedPartners.map(p => <TableHead key={p.id} className="text-center whitespace-nowrap">{p.name}<div className="text-xs text-muted-foreground">({p.level}级)</div></TableHead>)}
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
                              <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{r.loading_weight ? `${r.loading_weight} 吨` : '-'}</TableCell>
                              <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{r.unloading_weight ? `${r.unloading_weight} 吨` : '-'}</TableCell>
                              <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{r.loading_date}</TableCell>
                              <TableCell className="font-mono cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{formatCurrency(r.current_cost)}</TableCell>
                              <TableCell className="font-mono text-orange-600 cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{formatCurrency(r.extra_cost)}</TableCell>
                              {Array.isArray(displayedPartners) && displayedPartners.map(p => { const cost = (Array.isArray(r.partner_costs) && r.partner_costs.find((c:any) => c.partner_id === p.id)); return <TableCell key={p.id} className="font-mono text-center cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{formatCurrency(cost?.payable_amount)}</TableCell>; })}
                              <TableCell className="cursor-pointer whitespace-nowrap" onClick={() => setViewingRecord(r)}>{getPaymentStatusBadge(r.payment_status)}</TableCell>
                          </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-semibold border-t-2"><TableCell colSpan={8} className="text-right font-bold whitespace-nowrap">合计</TableCell>
                      <TableCell className="font-mono font-bold text-center whitespace-nowrap"><div>{formatCurrency(reportData?.overview?.total_current_cost)}</div><div className="text-xs text-muted-foreground font-normal">(运费)</div></TableCell>
                      <TableCell className="font-mono font-bold text-orange-600 text-center whitespace-nowrap"><div>{formatCurrency(reportData?.overview?.total_extra_cost)}</div><div className="text-xs text-muted-foreground font-normal">(额外费)</div></TableCell>
                          {Array.isArray(displayedPartners) && displayedPartners.map(p => { const total = (Array.isArray(reportData?.partner_payables) && reportData.partner_payables.find((pp: any) => pp.partner_id === p.id)?.total_payable) || 0; return (<TableCell key={p.id} className="text-center font-bold font-mono whitespace-nowrap"><div>{formatCurrency(total)}</div><div className="text-xs text-muted-foreground font-normal">({p.name})</div></TableCell>);})}
                      <TableCell className="whitespace-nowrap"></TableCell></TableRow>
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
            <DialogDescription>将为以下合作方生成付款申请，并更新 {multiSheetPaymentData?.all_records.length || 0} 条运单状态为“已申请支付”。</DialogDescription>
          </DialogHeader>
          {multiSheetPaymentData && (
            <div className="max-h-[60vh] overflow-y-auto p-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>付款方 (收款人)</TableHead>
                    <TableHead>收款银行账号</TableHead>
                    <TableHead className="text-right">运单数</TableHead>
                    <TableHead className="text-right">合计金额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {multiSheetPaymentData.sheets.map(sheet => (
                    <TableRow key={sheet.paying_partner_id}>
                      <TableCell className="font-medium">{sheet.paying_partner_full_name}</TableCell>
                      <TableCell>{sheet.paying_partner_bank_account}</TableCell>
                      <TableCell className="text-right">{sheet.records.length}</TableCell>
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
  );
}
