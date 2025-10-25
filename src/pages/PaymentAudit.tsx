// 文件路径: src/pages/PaymentAudit.tsx
// 版本: 付款审核页面
// 描述: 复制付款申请单管理页面的代码，用于付款审核功能

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
// @ts-ignore - lucide-react图标导入
import { Loader2, FileSpreadsheet, Trash2, ClipboardList, FileText, Banknote, RotateCcw, Users } from 'lucide-react';

// 简单的图标占位符组件
const Search = ({ className }: { className?: string }) => <span className={className}>🔍</span>;
import { PaymentApproval } from '@/components/PaymentApproval';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { zhCN } from 'date-fns/locale';

// --- 类型定义 ---
interface PaymentRequest {
  id: string;
  created_at: string;
  request_id: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
  notes: string | null;
  logistics_record_ids: string[];
  record_count: number;
}
interface LogisticsRecordDetail { id: string; auto_number: string; driver_name: string; license_plate: string; loading_location: string; unloading_location: string; loading_date: string; loading_weight: number | null; payable_amount: number | null; }
interface PartnerTotal { partner_id: string; partner_name: string; total_amount: number; level: number; }
interface SelectionState { mode: 'none' | 'all_filtered'; selectedIds: Set<string>; }

export default function PaymentAudit() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [recordDetails, setRecordDetails] = useState<LogisticsRecordDetail[]>([]);
  const [partnerTotals, setPartnerTotals] = useState<PartnerTotal[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set() });
  const [isVoiding, setIsVoiding] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isBulkVoiding, setIsBulkVoiding] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    requestId: '',
    waybillNumber: '',
    driverName: '',
    loadingDate: null as Date | null,
    status: 'all'
  });
  const [filteredRequests, setFilteredRequests] = useState<PaymentRequest[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [paymentPreviewData, setPaymentPreviewData] = useState<any>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [finalPaymentData, setFinalPaymentData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDriverBatchOpen, setIsDriverBatchOpen] = useState(false);

  const { toast } = useToast();
  const { isAdmin, isFinance } = usePermissions();

  // 获取付款申请列表
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('获取付款申请列表失败:', error);
      toast({ title: "错误", description: "获取付款申请列表失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 获取申请详情
  const fetchRequestDetails = useCallback(async (request: PaymentRequest) => {
    try {
      setLoadingDetails(true);
      
      // 获取运单详情
      const { data: recordsData, error: recordsError } = await supabase
        .from('logistics_records')
        .select(`
          id, auto_number, driver_name, license_plate, 
          loading_location, unloading_location, loading_date, 
          loading_weight, payable_cost
        `)
        .in('id', request.logistics_record_ids);

      if (recordsError) throw recordsError;

      // 获取合作方汇总
      const { data: partnersData, error: partnersError } = await supabase
        .rpc('get_payment_request_partner_totals', {
          p_request_id: request.id
        });

      if (partnersError) throw partnersError;

      setRecordDetails(recordsData || []);
      setPartnerTotals(partnersData || []);
    } catch (error) {
      console.error('获取申请详情失败:', error);
      toast({ title: "错误", description: "获取申请详情失败", variant: "destructive" });
    } finally {
      setLoadingDetails(false);
    }
  }, [toast]);

  // 处理申请状态更新
  const handleStatusUpdate = useCallback(async (requestId: string, newStatus: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({ 
          status: newStatus,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({ 
        title: "状态更新成功", 
        description: `申请状态已更新为${newStatus}` 
      });

      await fetchRequests();
    } catch (error) {
      console.error('更新状态失败:', error);
      toast({ title: "错误", description: "更新状态失败", variant: "destructive" });
    }
  }, [fetchRequests, toast]);

  // 批量作废
  const handleBulkVoid = useCallback(async () => {
    if (selection.selectedIds.size === 0) {
      toast({ title: "提示", description: "请选择要作废的申请", variant: "default" });
      return;
    }

    try {
      setIsBulkVoiding(true);
      const { error } = await supabase
        .from('payment_requests')
        .update({ status: 'Rejected' })
        .in('id', Array.from(selection.selectedIds));

      if (error) throw error;

      toast({ 
        title: "批量作废成功", 
        description: `已作废 ${selection.selectedIds.size} 个申请` 
      });

      setSelection({ mode: 'none', selectedIds: new Set() });
      await fetchRequests();
    } catch (error) {
      console.error('批量作废失败:', error);
      toast({ title: "错误", description: "批量作废失败", variant: "destructive" });
    } finally {
      setIsBulkVoiding(false);
    }
  }, [selection, fetchRequests, toast]);

  // 导出Excel
  const handleExportExcel = useCallback(async () => {
    try {
      setIsExporting(true);
      const { data, error } = await supabase.functions.invoke('export-excel', {
        body: { 
          type: 'payment_requests',
          request_ids: filteredRequests.map(r => r.id)
        }
      });

      if (error) throw error;

      // 创建下载链接
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `付款申请审核_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: "导出成功", description: "Excel文件已下载" });
    } catch (error) {
      console.error('导出失败:', error);
      toast({ title: "错误", description: "导出失败", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }, [filteredRequests, toast]);

  // 应用筛选
  const applyFilters = useCallback(() => {
    let filtered = requests;

    if (filters.requestId) {
      filtered = filtered.filter(r => r.request_id.toLowerCase().includes(filters.requestId.toLowerCase()));
    }
    if (filters.status !== 'all') {
      filtered = filtered.filter(r => r.status === filters.status);
    }

    setFilteredRequests(filtered);
  }, [requests, filters]);

  // 重置筛选
  const resetFilters = useCallback(() => {
    setFilters({
      requestId: '',
      waybillNumber: '',
      driverName: '',
      loadingDate: null,
      status: 'all'
    });
    setFilteredRequests(requests);
  }, [requests]);

  // 获取状态徽章
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'Pending': { label: '待审核', variant: 'secondary' as const },
      'Approved': { label: '已通过', variant: 'default' as const },
      'Paid': { label: '已付款', variant: 'default' as const },
      'Rejected': { label: '已拒绝', variant: 'destructive' as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // 初始化数据
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // 应用筛选
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (selection.mode === 'all_filtered') {
      setSelection({ mode: 'none', selectedIds: new Set() });
    } else {
      setSelection({ mode: 'all_filtered', selectedIds: new Set() });
    }
  }, [selection]);

  // 选择单个项目
  const handleSelectItem = useCallback((requestId: string) => {
    const newSelectedIds = new Set(selection.selectedIds);
    if (newSelectedIds.has(requestId)) {
      newSelectedIds.delete(requestId);
    } else {
      newSelectedIds.add(requestId);
    }
    setSelection({ mode: 'none', selectedIds: newSelectedIds });
  }, [selection]);

  // 检查是否已选择
  const isSelected = useCallback((requestId: string) => {
    return selection.mode === 'all_filtered' || selection.selectedIds.has(requestId);
  }, [selection]);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="付款审核" 
        description="审核和管理付款申请单"
      />

      {/* 筛选器 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              筛选条件
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? '隐藏筛选' : '显示筛选'}
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="requestId">申请单号</Label>
                <Input
                  id="requestId"
                  value={filters.requestId}
                  onChange={(e) => setFilters(prev => ({ ...prev, requestId: e.target.value }))}
                  placeholder="输入申请单号"
                />
              </div>
              <div>
                <Label htmlFor="status">状态</Label>
                <select
                  id="status"
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="all">全部</option>
                  <option value="Pending">待审核</option>
                  <option value="Approved">已通过</option>
                  <option value="Paid">已付款</option>
                  <option value="Rejected">已拒绝</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={applyFilters} size="sm">
                  应用筛选
                </Button>
                <Button onClick={resetFilters} variant="outline" size="sm">
                  重置
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 操作栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selection.mode === 'all_filtered'}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-muted-foreground">
                全选 ({filteredRequests.length} 项)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={isExporting || filteredRequests.length === 0}
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                导出Excel
              </Button>
              {selection.mode === 'all_filtered' || selection.selectedIds.size > 0 ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkVoid}
                  disabled={isBulkVoiding}
                >
                  {isBulkVoiding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  批量作废 ({selection.mode === 'all_filtered' ? filteredRequests.length : selection.selectedIds.size})
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 申请列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            付款申请列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">加载中...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selection.mode === 'all_filtered'}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>申请单号</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>运单数量</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected(request.id)}
                        onCheckedChange={() => handleSelectItem(request.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{request.request_id}</TableCell>
                    <TableCell>{format(new Date(request.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                    <TableCell>{request.record_count}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>{request.notes || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setIsDetailDialogOpen(true);
                            fetchRequestDetails(request);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          详情
                        </Button>
                        {request.status === 'Pending' && (isAdmin || isFinance) && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setIsApprovalDialogOpen(true);
                              }}
                            >
                              <Banknote className="h-4 w-4 mr-1" />
                              审核
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setIsVoidDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              作废
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>申请详情 - {selectedRequest?.request_id}</DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">加载详情中...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 运单详情 */}
              <div>
                <h3 className="text-lg font-semibold mb-4">运单详情</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>运单号</TableHead>
                      <TableHead>司机</TableHead>
                      <TableHead>车牌号</TableHead>
                      <TableHead>路线</TableHead>
                      <TableHead>装货日期</TableHead>
                      <TableHead>装货重量</TableHead>
                      <TableHead>应付金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordDetails.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.auto_number}</TableCell>
                        <TableCell>{record.driver_name}</TableCell>
                        <TableCell>{record.license_plate}</TableCell>
                        <TableCell>{record.loading_location} → {record.unloading_location}</TableCell>
                        <TableCell>{format(new Date(record.loading_date), 'yyyy-MM-dd')}</TableCell>
                        <TableCell>{record.loading_weight ? `${record.loading_weight}吨` : '-'}</TableCell>
                        <TableCell>¥{record.payable_amount?.toFixed(2) || '0.00'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 合作方汇总 */}
              {partnerTotals.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">合作方汇总</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>合作方</TableHead>
                        <TableHead>级别</TableHead>
                        <TableHead>应付金额</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partnerTotals.map((partner) => (
                        <TableRow key={partner.partner_id}>
                          <TableCell>{partner.partner_name}</TableCell>
                          <TableCell>{partner.level}级</TableCell>
                          <TableCell>¥{partner.total_amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 审核对话框 */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>审核申请 - {selectedRequest?.request_id}</DialogTitle>
          </DialogHeader>
          <PaymentApproval
            request={selectedRequest}
            onApprove={async (notes) => {
              if (selectedRequest) {
                await handleStatusUpdate(selectedRequest.id, 'Approved', notes);
                setIsApprovalDialogOpen(false);
              }
            }}
            onReject={async (notes) => {
              if (selectedRequest) {
                await handleStatusUpdate(selectedRequest.id, 'Rejected', notes);
                setIsApprovalDialogOpen(false);
              }
            }}
            onCancel={() => setIsApprovalDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* 作废确认对话框 */}
      <ConfirmDialog
        open={isVoidDialogOpen}
        onOpenChange={setIsVoidDialogOpen}
        title="确认作废"
        description={`确定要作废申请单 ${selectedRequest?.request_id} 吗？此操作不可撤销。`}
        onConfirm={async () => {
          if (selectedRequest) {
            await handleStatusUpdate(selectedRequest.id, 'Rejected', '已作废');
            setIsVoidDialogOpen(false);
          }
        }}
        confirmText="确认作废"
        cancelText="取消"
        variant="destructive"
      />
    </div>
  );
}
