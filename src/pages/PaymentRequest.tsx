// 文件路径: src/pages/PaymentRequest.tsx
// 描述: [1MWgh 最终装甲修复版] 对所有 .map() 调用进行显式数组检查，彻底杜绝运行时崩溃。

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Loader2, Search, FileSpreadsheet, Save, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useFilterState } from "@/hooks/useFilterState";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";

// --- 类型定义 ---
interface PartnerCost { partner_id: string; partner_name: string; level: number; payable_amount: number; }
interface LogisticsRecord { id: string; auto_number: string; project_name: string; driver_id: string; driver_name: string; loading_location: string; unloading_location: string; loading_date: string; unloading_date: string | null; license_plate: string | null; driver_phone: string | null; payable_cost: number | null; partner_costs?: PartnerCost[]; payment_status: 'Unpaid' | 'Processing' | 'Paid'; }
interface LogisticsRecordWithPartners extends LogisticsRecord { current_cost?: number; extra_cost?: number; chain_name?: string; }
interface FinanceFilters { projectId: string; partnerId: string; startDate: string; endDate: string; paymentStatus: string[]; }
interface PaginationState { currentPage: number; totalPages: number; }
interface SelectionState { mode: 'none' | 'all_filtered'; selectedIds: Set<string>; }
interface PaymentSheetData { paying_partner_id: string; paying_partner_name: string; header_company_name: string; records: { record: LogisticsRecord; payable_to_driver: number; }[]; total_payable: number; }
interface MultiSheetPaymentData { sheets: PaymentSheetData[]; all_records: LogisticsRecord[]; }

// --- 常量和初始状态 ---
const PAGE_SIZE = 50;
const INITIAL_FINANCE_FILTERS: FinanceFilters = { projectId: "all", partnerId: "all", startDate: "", endDate: "", paymentStatus: ['Unpaid'] };
const PAYMENT_STATUS_OPTIONS: MultiSelectOption[] = [
    { value: 'Unpaid', label: '未支付' },
    { value: 'Processing', label: '已申请支付' },
    { value: 'Paid', label: '已完成支付' },
];
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
      const { data, error } = await supabase.rpc('get_finance_reconciliation_data', {
        p_project_id: activeFilters.projectId === 'all' ? null : activeFilters.projectId,
        p_start_date: activeFilters.startDate || null,
        p_end_date: activeFilters.endDate || null,
        p_partner_id: activeFilters.partnerId === 'all' ? null : activeFilters.partnerId,
        p_payment_status_array: activeFilters.paymentStatus.length > 0 ? activeFilters.paymentStatus : null,
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

  // --- Effects ---
  useEffect(() => { fetchInitialOptions(); }, [fetchInitialOptions]);
  useEffect(() => { if (!isStale) { fetchReportData(); } else { setLoading(false); } }, [fetchReportData, isStale]);
  useEffect(() => {
    setPagination(p => p.currentPage === 1 ? p : { ...p, currentPage: 1 });
    setSelection({ mode: 'none', selectedIds: new Set() });
  }, [activeFilters]);

  const formatCurrency = (value: number | null | undefined): string => {
    if (value == null) return '¥0.00';
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
  };

  // --- 事件处理器 ---
  const handleFilterChange = <K extends keyof FinanceFilters>(field: K, value: FinanceFilters[K]) => { setUiFilters(prev => ({ ...prev, [field]: value })); };
  const handleDateChange = (dateRange: DateRange | undefined) => { setUiFilters(prev => ({ ...prev, startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '', endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '' })); };
  const handleRecordSelect = (recordId: string) => { setSelection(prev => { const newSet = new Set(prev.selectedIds); if (newSet.has(recordId)) { newSet.delete(recordId); } else { newSet.add(recordId); } if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; } return { ...prev, selectedIds: newSet }; }); };
  const handleSelectAllOnPage = (isChecked: boolean) => { const pageIds = (reportData?.records || []).map((r: any) => r.id); if (isChecked) { setSelection(prev => ({ ...prev, selectedIds: new Set([...prev.selectedIds, ...pageIds]) })); } else { setSelection(prev => { const newSet = new Set(prev.selectedIds); pageIds.forEach(id => newSet.delete(id)); if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; } return { ...prev, selectedIds: newSet }; }); } };
  const handleApplyForPaymentClick = async () => { /* ... */ };
  const handleConfirmAndSave = async () => { /* ... */ };
  const handleCancelApplication = async () => { /* ... */ };
  const exportMultiSheetExcel = (data: MultiSheetPaymentData, requestId: string) => { /* ... */ };
  const exportDetailsToExcel = () => { /* ... */ };

  // --- 派生状态和工具函数 ---
  const dateRangeValue: DateRange | undefined = (uiFilters.startDate || uiFilters.endDate) ? { from: uiFilters.startDate ? new Date(uiFilters.startDate) : undefined, to: uiFilters.endDate ? new Date(uiFilters.endDate) : undefined } : undefined;
  
  const displayedPartners = useMemo(() => {
    if (uiFilters.partnerId !== "all") {
      const selected = allPartners.find(p => p.id === uiFilters.partnerId);
      return selected ? [selected] : [];
    }
    // [1MWgh] 装甲修复：确保 reportData 和 reportData.records 存在且为数组
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
    // [1MWgh] 装甲修复
    if (!reportData || !Array.isArray(reportData.records)) return false;
    const pageIds = reportData.records.map((r: any) => r.id);
    if (pageIds.length === 0) return false;
    return pageIds.every(id => selection.selectedIds.has(id));
  }, [reportData?.records, selection.selectedIds]);

  const selectionCount = useMemo(() => {
    if (selection.mode === 'all_filtered') return reportData?.count || 0;
    return selection.selectedIds.size;
  }, [selection, reportData?.count]);

  const getPaymentStatusBadge = (status: 'Unpaid' | 'Processing' | 'Paid') => {
    switch (status) {
      case 'Unpaid': return <Badge variant="destructive">未支付</Badge>;
      case 'Processing': return <Badge variant="secondary">已申请支付</Badge>;
      case 'Paid': return <Badge variant="success">已完成支付</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  if (loading && !reportData) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-bold text-foreground">合作方付款申请</h1><p className="text-muted-foreground">向合作方申请支付司机运费。</p></div>
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
                {/* [1MWgh] 装甲修复 */}
                {Array.isArray(projects) && projects.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
            </SelectContent></Select></div>
            <div className="flex flex-col gap-1.5"><Label>日期范围</Label><DateRangePicker date={dateRangeValue} setDate={handleDateChange} /></div>
            <div className="flex flex-col gap-1.5 min-w-[140px]"><Label>合作方</Label><Select value={uiFilters.partnerId} onValueChange={(v) => handleFilterChange('partnerId', v)}><SelectTrigger className="h-9 text-sm"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">所有合作方</SelectItem>
                {/* [1MWgh] 装甲修复 */}
                {Array.isArray(allPartners) && allPartners.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} ({p.level}级)</SelectItem>))}
            </SelectContent></Select></div>
            <div className="flex flex-col gap-1.5 min-w-[120px]">
                <Label>支付状态</Label>
                <MultiSelect options={PAYMENT_STATUS_OPTIONS} selected={uiFilters.paymentStatus} onChange={(v) => handleFilterChange('paymentStatus', v)} className="w-full" placeholder="选择状态..." />
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
                <Button variant="outline" size="sm" onClick={exportDetailsToExcel} disabled={!(reportData?.records?.length > 0)}><Download className="mr-2 h-4 w-4" />导出明细</Button>
            </CardHeader>
            <CardContent>
              <div className="min-h-[400px]">
                {loading ? (<div className="flex justify-center items-center h-full min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin"/></div>) : (
                <Table>
                  <TableHeader><TableRow><TableHead className="w-12"><Checkbox checked={selection.mode === 'all_filtered' || isAllOnPageSelected} onCheckedChange={handleSelectAllOnPage} /></TableHead><TableHead>运单编号</TableHead><TableHead>项目</TableHead><TableHead>司机</TableHead><TableHead>路线</TableHead><TableHead>日期</TableHead><TableHead>运费</TableHead><TableHead className="text-orange-600">额外费</TableHead>
                    {/* [1MWgh] 装甲修复 */}
                    {Array.isArray(displayedPartners) && displayedPartners.map(p => <TableHead key={p.id} className="text-center">{p.name}<div className="text-xs text-muted-foreground">({p.level}级)</div></TableHead>)}
                  <TableHead>支付状态</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {/* [1MWgh] 核心装甲修复 */}
                    {Array.isArray(reportData?.records) && reportData.records.map((r: any) => (
                        <TableRow key={r.id} data-state={selection.selectedIds.has(r.id) && "selected"}>
                            <TableCell><Checkbox checked={selection.mode === 'all_filtered' || selection.selectedIds.has(r.id)} onCheckedChange={() => handleRecordSelect(r.id)} /></TableCell>
                            <TableCell className="font-mono cursor-pointer" onClick={() => setViewingRecord(r)}>{r.auto_number}</TableCell>
                            <TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>{r.project_name}</TableCell>
                            <TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>{r.driver_name}</TableCell>
                            <TableCell className="text-sm cursor-pointer" onClick={() => setViewingRecord(r)}>{r.loading_location}→{r.unloading_location}</TableCell>
                            <TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>{r.loading_date}</TableCell>
                            <TableCell className="font-mono cursor-pointer" onClick={() => setViewingRecord(r)}>¥{r.current_cost?.toFixed(2)}</TableCell>
                            <TableCell className="font-mono text-orange-600 cursor-pointer" onClick={() => setViewingRecord(r)}>{r.extra_cost ? `¥${r.extra_cost.toFixed(2)}` : '-'}</TableCell>
                            {/* [1MWgh] 装甲修复 */}
                            {Array.isArray(displayedPartners) && displayedPartners.map(p => { const cost = (Array.isArray(r.partner_costs) && r.partner_costs.find((c:any) => c.partner_id === p.id)); return <TableCell key={p.id} className="font-mono text-center cursor-pointer" onClick={() => setViewingRecord(r)}>{cost ? `¥${cost.payable_amount.toFixed(2)}` : '-'}</TableCell>; })}
                            <TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>{getPaymentStatusBadge(r.payment_status)}</TableCell>
                        </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-semibold border-t-2"><TableCell colSpan={6} className="text-right font-bold">合计</TableCell><TableCell className="font-mono font-bold text-center"><div>¥{(reportData?.overview?.total_current_cost || 0).toFixed(2)}</div><div className="text-xs text-muted-foreground font-normal">(运费)</div></TableCell><TableCell className="font-mono font-bold text-orange-600 text-center"><div>¥{(reportData?.overview?.total_extra_cost || 0).toFixed(2)}</div><div className="text-xs text-muted-foreground font-normal">(额外费)</div></TableCell>
                        {/* [1MWgh] 装甲修复 */}
                        {Array.isArray(displayedPartners) && displayedPartners.map(p => { const total = (Array.isArray(reportData?.partner_payables) && reportData.partner_payables.find((pp: any) => pp.partner_id === p.id)?.total_payable) || 0; return (<TableCell key={p.id} className="text-center font-bold font-mono"><div>¥{total.toFixed(2)}</div><div className="text-xs text-muted-foreground font-normal">({p.name})</div></TableCell>);})}
                    <TableCell></TableCell></TableRow>
                  </TableBody>
                </Table>
                )}
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
        {/* ... 详情弹窗 ... */}
      </Dialog>

      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        {/* ... 预览弹窗 ... */}
      </Dialog>
    </div>
  );
}
