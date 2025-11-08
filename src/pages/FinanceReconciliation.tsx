// 文件路径: src/pages/FinanceReconciliation.tsx
// 描述: [最终修正版] 精确为“合作方名称”列设置10个汉字的最小宽度，实现最终视觉效果

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShipperProjectCascadeFilter } from "@/components/ShipperProjectCascadeFilter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Loader2, RefreshCw, Search, Calculator } from "lucide-react";
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
import { VirtualizedTable } from "@/components/VirtualizedTable";
import { PageHeader } from "@/components/PageHeader";

// --- 类型定义 ---
interface LogisticsRecord { id: string; auto_number: string; project_name: string; driver_name: string; loading_location: string; unloading_location: string; loading_date: string; unloading_date: string | null; loading_weight: number | null; unloading_weight: number | null; current_cost: number | null; payable_cost: number | null; extra_cost: number | null; license_plate: string | null; driver_phone: string | null; transport_type: string | null; remarks: string | null; chain_name: string | null; billing_type_id: number; }
interface PartnerPayable { partner_id: string; partner_name: string; level: number; total_payable: number; records_count: number; }
interface LogisticsRecordWithPartners extends LogisticsRecord { partner_costs: { partner_id: string; partner_name: string; level: number; payable_amount: number; }[]; }
interface FinanceFilters { projectId: string; partnerId: string; startDate: string; endDate: string; }
interface PaginationState { currentPage: number; totalPages: number; }
interface SelectionState { mode: 'none' | 'all_filtered'; selectedIds: Set<string>; }

// --- 常量和初始状态 ---
const PAGE_SIZE = 50;
const INITIAL_FINANCE_FILTERS: FinanceFilters = { projectId: "all", partnerId: "all", startDate: "", endDate: "" };
const StaleDataPrompt = () => ( <div className="text-center py-10 border rounded-lg bg-muted/20"> <Search className="mx-auto h-12 w-12 text-muted-foreground" /> <h3 className="mt-2 text-sm font-semibold text-foreground">筛选条件已更改</h3> <p className="mt-1 text-sm text-muted-foreground">请点击“搜索”按钮以查看最新结果。</p> </div> );

export default function FinanceReconciliation() {
  // --- State 管理 ---
  const [reportData, setReportData] = useState<any>(null);
  const [allPartners, setAllPartners] = useState<{id: string, name: string, level: number}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecordWithPartners | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const { toast } = useToast();
  const { uiFilters, setUiFilters, activeFilters, handleSearch, handleClear, isStale } = useFilterState(INITIAL_FINANCE_FILTERS);
  const [pagination, setPagination] = useState<PaginationState>({ currentPage: 1, totalPages: 1 });
  const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set() });
  const [selectedShipperId, setSelectedShipperId] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('all');

  // --- 数据获取 ---
  const fetchInitialOptions = useCallback(async () => {
    const startTime = performance.now();
    try {
      // 并行获取数据以提升性能
      const [projectsResult, partnersResult] = await Promise.all([
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('project_partners').select(`partner_id, level, partners!inner(name)`)
      ]);
      
      setProjects(projectsResult.data || []);
      const uniquePartners = Array.from(
        new Map(
          partnersResult.data?.map(p => [ 
            p.partner_id, 
            { id: p.partner_id, name: (p.partners as any).name, level: p.level } 
          ]) || []
        ).values()
      ).sort((a, b) => a.level - b.level);
      setAllPartners(uniquePartners);
      
      const loadTime = performance.now() - startTime;
      console.log(`初始数据加载时间: ${loadTime.toFixed(2)}ms`);
    } catch (error) {
      console.error('加载筛选选项失败:', error);
      toast({ title: "错误", description: "加载筛选选项失败", variant: "destructive" });
    }
  }, [toast]);

  const fetchReportData = useCallback(async () => {
    const startTime = performance.now();
    setLoading(true);
    try {
      // 使用优化的分页函数，包含billing_type_id
      const { data, error } = await supabase.rpc('get_finance_reconciliation_by_partner' as any, {
        p_project_id: activeFilters.projectId === 'all' ? null : activeFilters.projectId,
        p_start_date: activeFilters.startDate || null,
        p_end_date: activeFilters.endDate || null,
        p_partner_id: activeFilters.partnerId === 'all' ? null : activeFilters.partnerId,
        p_page_number: pagination.currentPage,
        p_page_size: PAGE_SIZE,
      });
      if (error) throw error;
      
      setReportData(data);
      setPagination(prev => ({ 
        ...prev, 
        totalPages: (data as any)?.total_pages || 1 
      }));
      
      const loadTime = performance.now() - startTime;
      const recordCount = (data as any)?.records?.length || 0;
      console.log(`财务数据加载完成: ${loadTime.toFixed(2)}ms, ${recordCount}条记录`);
      
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

  // [新增] 一个小巧、高效的货币格式化函数
  const formatCurrency = (value: number | null | undefined): string => {
    if (value == null || isNaN(value)) return '¥0.00';
    // 使用 Intl.NumberFormat 来实现专业的货币格式化，包括千位分隔符
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(value);
  };

  // 根据billing_type_id获取数量标签和显示函数
  const getQuantityLabel = (billingTypeId: number) => {
    switch (billingTypeId) {
      case 2: return '车次';
      case 3: return '体积(立方)';
      default: return '重量(吨)';
    }
  };

  const getQuantityDisplay = (record: any) => {
    const billingTypeId = record.billing_type_id || 1;
    const loading = record.loading_weight || 0;
    const unloading = record.unloading_weight || 0;
    // 根据 billing_type_id 返回带单位的字符串
    switch (billingTypeId) {
      case 2: return `1 车`;
      case 3: return `${loading} / ${unloading} 立方`;
      default: return `${loading} / ${unloading} 吨`;
    }
  };

  // --- 事件处理器 ---
  const handleFilterChange = <K extends keyof FinanceFilters>(field: K, value: FinanceFilters[K]) => { setUiFilters(prev => ({ ...prev, [field]: value })); };
  const handleDateChange = (dateRange: DateRange | undefined) => { setUiFilters(prev => ({ ...prev, startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '', endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '' })); };
  
  const handleRecordSelect = (recordId: string) => {
    setSelection(prev => {
      const newSet = new Set(prev.selectedIds);
      if (newSet.has(recordId)) { newSet.delete(recordId); } else { newSet.add(recordId); }
      if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; }
      return { ...prev, selectedIds: newSet };
    });
  };

  const handleSelectAllOnPage = (isChecked: boolean) => {
    const pageIds = (reportData?.records || []).map((r: any) => r.id);
    if (isChecked) {
      setSelection(prev => ({ ...prev, selectedIds: new Set([...prev.selectedIds, ...pageIds]) }));
    } else {
      setSelection(prev => {
        const newSet = new Set(prev.selectedIds);
        pageIds.forEach(id => newSet.delete(id));
        if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; }
        return { ...prev, selectedIds: newSet };
      });
    }
  };

  const handleBatchRecalculate = async () => {
    setIsRecalculating(true);
    try {
      let error;
      if (selection.mode === 'all_filtered') {
        const { error: filterError } = await supabase.rpc('batch_recalculate_by_filter' as any, {
          p_project_id: activeFilters.projectId === 'all' ? null : activeFilters.projectId,
          p_start_date: activeFilters.startDate || null,
          p_end_date: activeFilters.endDate || null,
          p_partner_id: activeFilters.partnerId === 'all' ? null : activeFilters.partnerId,
        });
        error = filterError;
      } else {
        const idsToRecalculate = Array.from(selection.selectedIds);
        if (idsToRecalculate.length === 0) {
          toast({ title: "提示", description: "没有选择任何运单。" });
          setIsRecalculating(false);
          return;
        }
        const { data: recalcResult, error: idError } = await supabase.rpc('batch_recalculate_partner_costs', { p_record_ids: idsToRecalculate });
        
        // ✅ 检查返回结果
        console.log('🔄 重算结果:', recalcResult);
        if (recalcResult) {
          console.log('📊 重算统计:', {
            总运单数: recalcResult.total_count,
            成功数: recalcResult.updated_count,
            跳过数: recalcResult.skipped_count,
            保护手工值: recalcResult.protected_count
          });
        }
        
        error = idError;
      }
      if (error) throw error;
      const count = selection.mode === 'all_filtered' ? reportData?.count || '全部' : selection.selectedIds.size;
      toast({ title: "成功", description: `已为 ${count} 条运单提交重算任务。` });
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchReportData();
    } catch (error) {
      console.error("批量重算失败:", error);
      toast({ title: "错误", description: "批量重算失败，请重试。", variant: "destructive" });
    } finally {
      setIsRecalculating(false);
    }
  };

  // --- 派生状态和工具函数 ---
  const dateRangeValue: DateRange | undefined = (uiFilters.startDate || uiFilters.endDate) ? { from: uiFilters.startDate ? new Date(uiFilters.startDate) : undefined, to: uiFilters.endDate ? new Date(uiFilters.endDate) : undefined } : undefined;
  
  const displayedPartners = useMemo(() => {
    if (uiFilters.partnerId !== "all") {
      const selected = allPartners.find(p => p.id === uiFilters.partnerId);
      return selected ? [selected] : [];
    }
    if (!reportData?.records) return [];
    const relevantPartnerIds = new Set<string>();
    (reportData.records || []).forEach((record: any) => {
      (record.partner_costs || []).forEach((cost: any) => relevantPartnerIds.add(cost.partner_id));
    });
    return allPartners.filter(partner => relevantPartnerIds.has(partner.id)).sort((a, b) => a.level - b.level);
  }, [reportData, allPartners, uiFilters.partnerId]);

  const exportDetailsToExcel = () => {
    if (!reportData?.records || reportData.records.length === 0) {
        toast({ title: "提示", description: "没有可导出的数据" });
        return;
    }
    const headers = ['运单编号', '项目名称', '司机姓名', '路线', '装货日期', '运费金额', '额外费用', '司机应收'];
    displayedPartners.forEach(p => headers.push(`${p.name}(应付)`));
    const dataToExport = (reportData.records || []).map((record: any) => {
      const row: {[key: string]: any} = {
        '运单编号': record.auto_number, '项目名称': record.project_name, '司机姓名': record.driver_name,
        '路线': `${record.loading_location} → ${record.unloading_location}`, '装货日期': record.loading_date,
        '运费金额': record.current_cost || 0, '额外费用': record.extra_cost || 0, '司机应收': record.payable_cost || 0,
      };
      displayedPartners.forEach(p => {
        const cost = (record.partner_costs || []).find((c:any) => c.partner_id === p.id);
        row[`${p.name}(应付)`] = cost ? cost.payable_amount : 0;
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "运单财务明细");
    XLSX.writeFile(wb, `运单财务明细_${new Date().toLocaleDateString()}.xlsx`);
    toast({ title: "成功", description: "财务明细数据已导出到Excel" });
  };

  const isAllOnPageSelected = useMemo(() => {
    const pageIds = (reportData?.records || []).map((r: any) => r.id);
    if (pageIds.length === 0) return false;
    return pageIds.every(id => selection.selectedIds.has(id));
  }, [reportData?.records, selection.selectedIds]);

  const selectionCount = useMemo(() => {
    if (selection.mode === 'all_filtered') return reportData?.count || 0;
    return selection.selectedIds.size;
  }, [selection, reportData?.count]);

  if (loading && !reportData) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="运费对账" 
        description="运费收入与合作方应付金额统计"
        icon={Calculator}
        iconColor="text-blue-600"
      />

      <div className="space-y-6">

      <Card className="border-muted/40">
        <CardContent className="p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-none" style={{width: '480px'}}>
              <ShipperProjectCascadeFilter
                selectedShipperId={selectedShipperId}
                selectedProjectId={selectedProjectId}
                onShipperChange={(id) => {
                  setSelectedShipperId(id);
                  setSelectedProjectId('all');
                }}
                onProjectChange={(id) => {
                  setSelectedProjectId(id);
                  handleFilterChange('projectId', id);
                }}
              />
            </div>
            <div className="flex-none w-64 space-y-2"><Label>日期范围</Label><DateRangePicker date={dateRangeValue} setDate={handleDateChange} /></div>
            <div className="flex-none w-40 space-y-2"><Label>合作方</Label><Select value={uiFilters.partnerId} onValueChange={(v) => handleFilterChange('partnerId', v)}><SelectTrigger className="h-10"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">全部</SelectItem>{allPartners.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} ({p.level}级)</SelectItem>))}</SelectContent></Select></div>
            <Button onClick={handleSearch} className="h-10 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"><Search className="mr-2 h-4 w-4"/>搜索</Button>
            <Button variant="outline" onClick={handleClear} className="h-10">清除</Button>
            <ConfirmDialog title="确认批量重算" description={`您确定要为选中的 ${selectionCount} 条运单重新计算所有合作方的应付金额吗？此操作会根据最新的项目合作链路配置覆盖现有数据。`} onConfirm={handleBatchRecalculate}>
              <Button variant="destructive" disabled={selectionCount === 0 || isRecalculating}>{isRecalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}一键重算已选运单 ({selectionCount})</Button>
            </ConfirmDialog>
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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-fr">
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">运单总数</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex items-center">
                <div className="text-2xl font-bold text-blue-600">{reportData?.overview?.total_records || 0}</div>
              </CardContent>
            </Card>
            
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">总运费</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex items-center">
                <div className="text-2xl font-bold text-green-600">{formatCurrency(reportData?.overview?.total_current_cost)}</div>
              </CardContent>
            </Card>
            
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">总额外费用</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex items-center">
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(reportData?.overview?.total_extra_cost)}</div>
              </CardContent>
            </Card>
            
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">司机应收汇总</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex items-center">
                <div className="text-2xl font-bold text-purple-600">{formatCurrency(reportData?.overview?.total_payable_cost)}</div>
              </CardContent>
            </Card>
          </div>

          {/* --- [已美化] 合作方应付汇总 Card --- */}
          <Card>
            <CardHeader>
              <CardTitle>合作方应付汇总</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* [最终修正] 为合作方名称列设置 10em 的最小宽度，确保视觉稳定 */}
                    <TableHead className="min-w-[10em]">合作方名称</TableHead>
                    {/* [最终修正] 保持内容自适应，以实现紧凑布局 */}
                    <TableHead className="w-[1%] whitespace-nowrap text-center">相关运单数</TableHead>
                    <TableHead className="w-[1%] whitespace-nowrap text-right">应付总金额 (元)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && !(reportData?.partner_payables?.length > 0) ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin inline-block"/>
                      </TableCell>
                    </TableRow>
                  ) : (!reportData?.partner_payables || reportData.partner_payables.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center">没有找到匹配的数据</TableCell>
                    </TableRow>
                  ) : (
                    (reportData.partner_payables).map((partner: any, index: number) => (
                      <TableRow key={partner.partner_id} className="even:bg-muted/40">
                        <TableCell className="font-medium">{partner.partner_name}</TableCell>
                        <TableCell className="text-center">{partner.records_count}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          {formatCurrency(partner.total_payable)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {/* --- 美化结束 --- */}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>运单财务明细</CardTitle><p className="text-sm text-muted-foreground">各合作方应付金额按级别从左到右排列</p></div>
                <Button variant="outline" size="sm" onClick={exportDetailsToExcel} disabled={!(reportData?.records?.length > 0)}><Download className="mr-2 h-4 w-4" />导出明细</Button>
            </CardHeader>
            <CardContent>
              <div className="min-h-[400px] overflow-x-auto">
                {loading ? (<div className="flex justify-center items-center h-full min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin"/></div>) : (
                <Table>
                  <TableHeader><TableRow><TableHead className="w-12"><Checkbox checked={selection.mode === 'all_filtered' || isAllOnPageSelected} onCheckedChange={handleSelectAllOnPage}/></TableHead><TableHead>运单编号</TableHead><TableHead>项目</TableHead><TableHead>司机</TableHead><TableHead>路线</TableHead><TableHead>日期</TableHead><TableHead>装货数量</TableHead><TableHead>运费</TableHead><TableHead className="text-orange-600">额外费</TableHead><TableHead className="text-green-600">司机应收</TableHead>{displayedPartners.map(p => <TableHead key={p.id} className="text-center">{p.name}<div className="text-xs text-muted-foreground">({p.level}级)</div></TableHead>)}<TableHead>状态</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(reportData?.records || []).map((r: any) => (<TableRow key={r.id} data-state={selection.selectedIds.has(r.id) && "selected"} className="whitespace-nowrap"><TableCell><Checkbox checked={selection.mode === 'all_filtered' || selection.selectedIds.has(r.id)} onCheckedChange={() => handleRecordSelect(r.id)}/></TableCell><TableCell className="font-mono cursor-pointer" onClick={() => setViewingRecord(r)}>{r.auto_number}</TableCell><TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>{r.project_name}</TableCell><TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>{r.driver_name}</TableCell><TableCell className="text-sm cursor-pointer" onClick={() => setViewingRecord(r)}>{`${r.loading_location?.substring(0, 2) || ''}→${r.unloading_location?.substring(0, 2) || ''}`}</TableCell><TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}>{r.loading_date}</TableCell><TableCell className="text-sm cursor-pointer" onClick={() => setViewingRecord(r)}>{getQuantityDisplay(r)}</TableCell><TableCell className="font-mono cursor-pointer" onClick={() => setViewingRecord(r)}>{formatCurrency(r.current_cost)}</TableCell><TableCell className="font-mono text-orange-600 cursor-pointer" onClick={() => setViewingRecord(r)}>{formatCurrency(r.extra_cost)}</TableCell><TableCell className="font-mono text-green-600 cursor-pointer" onClick={() => setViewingRecord(r)}>{formatCurrency(r.payable_cost)}</TableCell>{displayedPartners.map(p => { const cost = (r.partner_costs || []).find((c:any) => c.partner_id === p.id); return <TableCell key={p.id} className="font-mono text-center cursor-pointer" onClick={() => setViewingRecord(r)}>{formatCurrency(cost?.payable_amount)}</TableCell>; })}<TableCell className="cursor-pointer" onClick={() => setViewingRecord(r)}><Badge variant={r.current_cost ? "default" : "secondary"}>{r.current_cost ? "已计费" : "待计费"}</Badge></TableCell></TableRow>))}
                    <TableRow className="bg-muted/30 font-semibold border-t-2"><TableCell colSpan={7} className="text-right font-bold">合计</TableCell><TableCell className="font-mono font-bold text-center"><div>{formatCurrency(reportData?.overview?.total_current_cost)}</div><div className="text-xs text-muted-foreground font-normal">(运费)</div></TableCell><TableCell className="font-mono font-bold text-orange-600 text-center"><div>{formatCurrency(reportData?.overview?.total_extra_cost)}</div><div className="text-xs text-muted-foreground font-normal">(额外费)</div></TableCell><TableCell className="text-center font-bold font-mono text-green-600"><div>{formatCurrency(reportData?.overview?.total_payable_cost)}</div><div className="text-xs text-muted-foreground font-normal">(司机应收)</div></TableCell>{displayedPartners.map(p => { const total = (reportData?.partner_payables || []).find((pp: any) => pp.partner_id === p.id)?.total_payable || 0; return (<TableCell key={p.id} className="text-center font-bold font-mono"><div>{formatCurrency(total)}</div><div className="text-xs text-muted-foreground font-normal">({p.name})</div></TableCell>);})}<TableCell></TableCell></TableRow>
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
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>运单详情 (编号: {viewingRecord?.auto_number})</DialogTitle></DialogHeader>
          {viewingRecord && (
            <div className="grid grid-cols-4 gap-x-4 gap-y-6 py-4 text-sm">
              <div className="space-y-1"><Label className="text-muted-foreground">项目</Label><p>{viewingRecord.project_name}</p></div><div className="space-y-1"><Label className="text-muted-foreground">合作链路</Label><p>{viewingRecord.chain_name || '默认'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">装货日期</Label><p>{viewingRecord.loading_date}</p></div><div className="space-y-1"><Label className="text-muted-foreground">卸货日期</Label><p>{viewingRecord.unloading_date || '未填写'}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">司机</Label><p>{viewingRecord.driver_name}</p></div><div className="space-y-1"><Label className="text-muted-foreground">车牌号</Label><p>{viewingRecord.license_plate || '未填写'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">司机电话</Label><p>{viewingRecord.driver_phone || '未填写'}</p></div><div className="space-y-1"><Label className="text-muted-foreground">运输类型</Label><p>{viewingRecord.transport_type}</p></div>
              <div className="space-y-1"><Label className="text-muted-foreground">装货地点</Label><p>{viewingRecord.loading_location}</p></div><div className="space-y-1"><Label className="text-muted-foreground">{getQuantityLabel(viewingRecord.billing_type_id || 1)}</Label><p>{getQuantityDisplay(viewingRecord)}</p></div><div className="space-y-1"><Label className="text-muted-foreground">卸货地点</Label><p>{viewingRecord.unloading_location}</p></div><div className="space-y-1"></div>
              <div className="space-y-1"><Label className="text-muted-foreground">运费金额</Label><p className="font-mono">{formatCurrency(viewingRecord.current_cost)}</p></div><div className="space-y-1"><Label className="text-muted-foreground">额外费用</Label><p className="font-mono">{formatCurrency(viewingRecord.extra_cost)}</p></div><div className="space-y-1 col-span-2"><Label className="text-muted-foreground">司机应收</Label><p className="font-mono font-bold text-primary">{formatCurrency(viewingRecord.payable_cost)}</p></div>
              <div className="col-span-4 space-y-1"><Label className="text-muted-foreground">备注</Label><p className="min-h-[40px]">{viewingRecord.remarks || '无'}</p></div>
            </div>
          )}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setViewingRecord(null)}>关闭</Button></div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
