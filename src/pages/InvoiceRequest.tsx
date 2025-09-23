// 文件路径: src/pages/InvoiceRequest.tsx
// 描述: 开票申请管理页面，参考付款申请的业务逻辑

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Save, ListPlus, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { useFilterState } from "@/hooks/useFilterState";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

// --- 类型定义 ---

// RPC函数返回类型
interface DatabaseError {
  message: string;
  code?: string;
  details?: string;
}

interface SupabaseResponse<T> {
  data: T | null;
  error: DatabaseError | null;
}

interface PartnerCostRecord { 
  id: string; // 合作方成本记录ID
  logistics_record_id: string; // 运单ID
  auto_number: string; // 运单号
  project_name: string; 
  driver_id: string; 
  driver_name: string; 
  loading_location: string; 
  unloading_location: string; 
  loading_date: string; 
  unloading_date: string | null; 
  license_plate: string | null; 
  driver_phone: string | null; 
  partner_id: string; // 合作方ID
  partner_name: string; 
  level: number; // 合作方级别
  base_amount: number; // 基础金额
  payable_amount: number; // 应付金额
  tax_rate: number; // 税率
  invoice_status: 'Uninvoiced' | 'Processing' | 'Invoiced'; // 开票状态
  payment_status: 'Unpaid' | 'Processing' | 'Paid'; // 付款状态
  cargo_type: string | null; 
  loading_weight: number | null; 
  unloading_weight: number | null; 
  remarks: string | null; 
  billing_type_id: number | null;
  current_cost: number | null;
  extra_cost: number | null;
  chain_name: string | null;
  tax_number?: string; // 税号
  company_address?: string; // 公司地址
  bank_name?: string; // 开户银行
  bank_account?: string; // 银行账户
}

interface InvoiceFilters { 
  projectId: string; 
  partnerId: string; 
  startDate: string; 
  endDate: string; 
  invoiceStatus: string; 
  driverNames: string[]; 
}

interface PaginationState { 
  currentPage: number; 
  totalPages: number; 
}

interface SelectionState { 
  mode: 'none' | 'all_filtered'; 
  selectedIds: Set<string>; // 现在存储的是partner_cost记录的ID
}

interface InvoicePreviewSheet { 
  invoicing_partner_id: string; 
  invoicing_partner_full_name: string; 
  invoicing_partner_tax_number: string; 
  invoicing_partner_company_address: string; 
  invoicing_partner_bank_name: string;
  invoicing_partner_bank_account: string;
  record_count: number; 
  total_invoiceable: number; 
  partner_costs: PartnerCostRecord[]; // 改为存储合作方成本记录
}

interface InvoicePreviewData { 
  sheets: InvoicePreviewSheet[]; 
  processed_partner_cost_ids: string[]; // 改为合作方成本记录ID
}

interface FinalInvoiceData { 
  sheets: InvoicePreviewSheet[]; 
  all_partner_cost_ids: string[]; // 改为合作方成本记录ID
}

// --- 常量和初始状态 ---
const PAGE_SIZE = 50;
const INITIAL_INVOICE_FILTERS: InvoiceFilters = { 
  projectId: "all", 
  partnerId: "all", 
  startDate: "", 
  endDate: "", 
  invoiceStatus: 'Uninvoiced', 
  driverNames: [] 
};

const INVOICE_STATUS_OPTIONS = [
  { value: 'all', label: '所有状态' },
  { value: 'Uninvoiced', label: '未开票' },
  { value: 'Processing', label: '已申请开票' },
  { value: 'Invoiced', label: '已完成开票' },
];

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
  const [viewingRecord, setViewingRecord] = useState<PartnerCostRecord | null>(null);
  const { toast } = useToast();
  const { uiFilters, setUiFilters, activeFilters, handleSearch, handleClear, isStale } = useFilterState(INITIAL_INVOICE_FILTERS);
  const [pagination, setPagination] = useState<PaginationState>({ currentPage: 1, totalPages: 1 });
  const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set() });
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [invoicePreviewData, setInvoicePreviewData] = useState<InvoicePreviewData | null>(null);
  const [finalInvoiceData, setFinalInvoiceData] = useState<FinalInvoiceData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --- 数据获取 ---
  const fetchInitialOptions = useCallback(async () => {
    try {
      const { data: projectsData } = await supabase.from('projects').select('id, name').order('name');
      setProjects(projectsData || []);
      const { data: partnersData } = await supabase.from('project_partners').select(`partner_id, level, partners!inner(name)`);
      const uniquePartners = Array.from(new Map(partnersData?.map(p => [ 
        p.partner_id, 
        { 
          id: p.partner_id, 
          name: p.partners && typeof p.partners === 'object' && 'name' in p.partners 
            ? (p.partners as { name: string }).name 
            : 'Unknown Partner', 
          level: p.level 
        } 
      ]) || []).values()).sort((a, b) => a.level - b.level);
      setAllPartners(uniquePartners);
    } catch (error) {
      toast({ title: "错误", description: "加载筛选选项失败", variant: "destructive" });
    }
  }, [toast]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const statusArray = activeFilters.invoiceStatus === 'all' ? null : [activeFilters.invoiceStatus];
      const { data, error } = await supabase.rpc('get_invoice_request_data', {
        p_project_id: activeFilters.projectId === 'all' ? null : activeFilters.projectId,
        p_start_date: activeFilters.startDate || null,
        p_end_date: activeFilters.endDate || null,
        p_partner_id: activeFilters.partnerId === 'all' ? null : activeFilters.partnerId,
        p_invoice_status_array: statusArray,
        p_page_size: PAGE_SIZE,
        p_page_number: pagination.currentPage,
      });
      if (error) throw error;
      setReportData(data);
      const responseData = data as { count?: number } | null;
      setPagination(prev => ({ ...prev, totalPages: Math.ceil((responseData?.count || 0) / PAGE_SIZE) || 1 }));
    } catch (error) {
      console.error("加载开票申请数据失败:", error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast({ title: "错误", description: `加载开票申请数据失败: ${errorMessage}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeFilters, pagination.currentPage, toast]);

  useEffect(() => { fetchInitialOptions(); }, [fetchInitialOptions]);
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

  // --- 核心函数实现 ---
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

  const formatQuantity = (record: PartnerCostRecord): string => {
    const unit = getBillingUnit(record.billing_type_id);
    const loadingText = record.loading_weight ?? '-';
    const unloadingText = record.unloading_weight ?? '-';
    return `${loadingText} / ${unloadingText} ${unit}`;
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'Uninvoiced':
        return <Badge variant="secondary">未开票</Badge>;
      case 'Processing':
        return <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50">已申请开票</Badge>;
      case 'Invoiced':
        return <Badge variant="default" className="bg-green-500">已完成开票</Badge>;
      default:
        return <Badge variant="secondary">未知状态</Badge>;
    }
  };

  const handleFilterChange = <K extends keyof InvoiceFilters>(field: K, value: InvoiceFilters[K]) => { 
    setUiFilters(prev => ({ ...prev, [field]: value })); 
  };

  const handleDateChange = (dateRange: DateRange | undefined) => { 
    setUiFilters(prev => ({ 
      ...prev, 
      startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '', 
      endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '' 
    })); 
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
    const pageIds = (reportData?.records || []).map((r: PartnerCostRecord) => r.id); 
    if (isChecked) { 
      setSelection(prev => ({ ...prev, selectedIds: new Set([...prev.selectedIds, ...pageIds]) })); 
    } else { 
      setSelection(prev => { 
        const newSet = new Set(prev.selectedIds); 
        pageIds.forEach(id => newSet.delete(id)); 
        if (prev.mode === 'all_filtered') { 
          return { mode: 'none', selectedIds: newSet }; 
        } 
        return { ...prev, selectedIds: newSet }; 
      }); 
    } 
  };

  const handleApplyForInvoiceClick = async () => {
    const isCrossPageSelection = selection.mode === 'all_filtered';
    const selectionCount = selection.selectedIds.size;

    if (!isCrossPageSelection && selectionCount === 0) {
        toast({ title: "提示", description: "请先选择需要申请开票的合作方成本记录。" });
        return;
    }

    setIsGenerating(true);
    try {
      let idsToProcess: string[] = [];

      if (isCrossPageSelection) {
        const { data: allFilteredIds, error: idError } = await supabase.rpc('get_filtered_uninvoiced_partner_cost_ids', {
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
        toast({ title: "无可处理记录", description: "在当前选择或筛选条件下，没有找到可申请开票的"未开票"合作方成本记录。" });
        setIsGenerating(false);
        return;
      }

      const { data: v2Data, error: rpcError } = await supabase.rpc('get_invoice_request_data_v2', {
        p_partner_cost_ids: idsToProcess
      });

      if (rpcError) throw rpcError;

      const v2 = (v2Data as { partner_costs?: PartnerCostRecord[] }) || {};
      const partnerCosts: PartnerCostRecord[] = Array.isArray(v2.partner_costs) ? v2.partner_costs : [];
      
      // 按合作方分组
      const sheetMap = new Map<string, any>();

      for (const partnerCost of partnerCosts) {
        const key = partnerCost.partner_id;
        if (!sheetMap.has(key)) {
          sheetMap.set(key, {
            invoicing_partner_id: key,
            invoicing_partner_full_name: partnerCost.partner_name,
            invoicing_partner_tax_number: partnerCost.tax_number || '',
            invoicing_partner_company_address: partnerCost.company_address || '',
            invoicing_partner_bank_name: partnerCost.bank_name || '',
            invoicing_partner_bank_account: partnerCost.bank_account || '',
            record_count: 0,
            total_invoiceable: 0,
            partner_costs: []
          });
        }

        const sheet = sheetMap.get(key);
        sheet.record_count += 1;
        sheet.total_invoiceable += partnerCost.payable_amount;
        sheet.partner_costs.push(partnerCost);
      }

      const sheets = Array.from(sheetMap.values());
      const processedIds = partnerCosts.map(pc => pc.id);

      setInvoicePreviewData({ sheets, processed_partner_cost_ids: processedIds });
      setFinalInvoiceData({ sheets, all_partner_cost_ids: processedIds });
      setIsPreviewModalOpen(true);

    } catch (error) {
      console.error("生成开票申请预览失败:", error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast({ title: "错误", description: `生成开票申请预览失败: ${errorMessage}`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveInvoiceRequest = async () => {
    if (!finalInvoiceData) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('save_invoice_request', {
        p_invoice_data: finalInvoiceData
      });

      if (error) throw error;

      toast({ title: "成功", description: "开票申请已保存！" });
      setIsPreviewModalOpen(false);
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchReportData();
    } catch (error) {
      console.error("保存开票申请失败:", error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast({ title: "错误", description: `保存开票申请失败: ${errorMessage}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- 计算属性 ---
  const currentPageRecords = reportData?.records || [];
  const totalRecords = reportData?.count || 0;
  const selectedOnCurrentPage = currentPageRecords.filter((r: PartnerCostRecord) => selection.selectedIds.has(r.id)).length;
  const allOnCurrentPageSelected = currentPageRecords.length > 0 && selectedOnCurrentPage === currentPageRecords.length;
  const someOnCurrentPageSelected = selectedOnCurrentPage > 0 && selectedOnCurrentPage < currentPageRecords.length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">开票申请管理</h1>
          <p className="text-sm text-gray-600 mt-1">管理运单的开票申请流程</p>
        </div>
      </div>

      {/* 筛选器 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>项目</Label>
              <Select value={uiFilters.projectId} onValueChange={(value) => handleFilterChange('projectId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有项目</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>合作方</Label>
              <Select value={uiFilters.partnerId} onValueChange={(value) => handleFilterChange('partnerId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择合作方" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有合作方</SelectItem>
                  {allPartners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      L{partner.level} - {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>开票状态</Label>
              <Select value={uiFilters.invoiceStatus} onValueChange={(value) => handleFilterChange('invoiceStatus', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择开票状态" />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>日期范围</Label>
              <DateRangePicker
                value={{
                  from: uiFilters.startDate ? new Date(uiFilters.startDate) : undefined,
                  to: uiFilters.endDate ? new Date(uiFilters.endDate) : undefined,
                }}
                onChange={handleDateChange}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              搜索
            </Button>
            <Button variant="outline" onClick={handleClear}>
              清空筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              合作方成本记录 ({totalRecords} 条记录)
            </CardTitle>
            <div className="flex items-center gap-2">
              {selection.selectedIds.size > 0 && (
                <Button onClick={handleApplyForInvoiceClick} disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListPlus className="mr-2 h-4 w-4" />}
                  申请开票 ({selection.selectedIds.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isStale ? (
            <StaleDataPrompt />
          ) : loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">加载中...</span>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allOnCurrentPageSelected}
                          onCheckedChange={handleSelectAllOnPage}
                          ref={(el) => {
                            if (el) el.indeterminate = someOnCurrentPageSelected;
                          }}
                        />
                      </TableHead>
                      <TableHead>运单号</TableHead>
                      <TableHead>合作方</TableHead>
                      <TableHead>级别</TableHead>
                      <TableHead>项目</TableHead>
                      <TableHead>司机</TableHead>
                      <TableHead>路线</TableHead>
                      <TableHead>装货日期</TableHead>
                      <TableHead>开票状态</TableHead>
                      <TableHead>应付金额</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPageRecords.map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <Checkbox
                            checked={selection.selectedIds.has(record.id)}
                            onCheckedChange={() => handleRecordSelect(record.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{record.auto_number}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{record.partner_name}</div>
                            {record.tax_number && <div className="text-xs text-muted-foreground">税号: {record.tax_number}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">L{record.level}</Badge>
                        </TableCell>
                        <TableCell>{record.project_name}</TableCell>
                        <TableCell>{record.driver_name}</TableCell>
                        <TableCell>{simplifyRoute(record.loading_location, record.unloading_location)}</TableCell>
                        <TableCell>{record.loading_date}</TableCell>
                        <TableCell>{getInvoiceStatusBadge(record.invoice_status)}</TableCell>
                        <TableCell>{formatCurrency(record.payable_amount)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingRecord(record)}
                          >
                            详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分页 */}
              {pagination.totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setPagination(p => ({ ...p, currentPage: Math.max(1, p.currentPage - 1) }))}
                          className={cn(pagination.currentPage <= 1 && "pointer-events-none opacity-50")}
                        />
                      </PaginationItem>
                      {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setPagination(p => ({ ...p, currentPage: page }))}
                            isActive={page === pagination.currentPage}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setPagination(p => ({ ...p, currentPage: Math.min(p.totalPages, p.currentPage + 1) }))}
                          className={cn(pagination.currentPage >= pagination.totalPages && "pointer-events-none opacity-50")}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 开票申请预览对话框 */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>开票申请预览</DialogTitle>
            <DialogDescription>
              请确认以下开票申请信息，确认无误后点击"确认申请"。
            </DialogDescription>
          </DialogHeader>
          
          {invoicePreviewData && (
            <div className="space-y-4">
              {invoicePreviewData.sheets.map((sheet, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {sheet.invoicing_partner_full_name}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>税号: {sheet.invoicing_partner_tax_number || '未填写'}</div>
                      <div>地址: {sheet.invoicing_partner_company_address || '未填写'}</div>
                      <div>运单数量: {sheet.record_count} 条</div>
                      <div>开票金额: {formatCurrency(sheet.total_invoiceable)}</div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
              
              <div className="text-sm text-muted-foreground">
                总计: {invoicePreviewData.sheets.length} 个合作方，
                {invoicePreviewData.processed_partner_cost_ids.length} 条合作方成本记录，
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
              确认申请
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 合作方成本记录详情对话框 */}
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>合作方成本记录详情 (运单: {viewingRecord?.auto_number})</DialogTitle>
          </DialogHeader>
          {viewingRecord && (
            <div className="grid grid-cols-4 gap-x-4 gap-y-6 py-4 text-sm">
              {/* 合作方信息 */}
              <div className="space-y-1 col-span-2">
                <Label className="text-muted-foreground">合作方</Label>
                <p className="font-medium">{viewingRecord.partner_name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">合作方级别</Label>
                <p><Badge variant="outline">L{viewingRecord.level}</Badge></p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">税号</Label>
                <p>{viewingRecord.tax_number || '未填写'}</p>
              </div>
              
              {/* 成本信息 */}
              <div className="space-y-1">
                <Label className="text-muted-foreground">基础金额</Label>
                <p className="font-mono">{formatCurrency(viewingRecord.base_amount)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">税率</Label>
                <p>{(viewingRecord.tax_rate * 100).toFixed(2)}%</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">应付金额</Label>
                <p className="font-mono font-bold text-primary">{formatCurrency(viewingRecord.payable_amount)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">开票状态</Label>
                <p>{getInvoiceStatusBadge(viewingRecord.invoice_status)}</p>
              </div>

              {/* 运单信息 */}
              <div className="space-y-1">
                <Label className="text-muted-foreground">项目</Label>
                <p>{viewingRecord.project_name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">合作链路</Label>
                <p>{viewingRecord.chain_name || '未指定'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">装货日期</Label>
                <p>{viewingRecord.loading_date}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">司机</Label>
                <p>{viewingRecord.driver_name}</p>
              </div>
              
              <div className="space-y-1">
                <Label className="text-muted-foreground">车牌号</Label>
                <p>{viewingRecord.license_plate || '未填写'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">司机电话</Label>
                <p>{viewingRecord.driver_phone || '未填写'}</p>
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
                <Label className="text-muted-foreground">装货重量</Label>
                <p>{viewingRecord.loading_weight ? `${viewingRecord.loading_weight} 吨` : '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">卸货重量</Label>
                <p>{viewingRecord.unloading_weight ? `${viewingRecord.unloading_weight} 吨` : '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">运费金额</Label>
                <p className="font-mono">{formatCurrency(viewingRecord.current_cost)}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">额外费用</Label>
                <p className="font-mono">{formatCurrency(viewingRecord.extra_cost)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
