import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileSpreadsheet, Receipt, Eye, AlertCircle, Send } from 'lucide-react';
import { MobilePaymentApproval } from '@/components/mobile/MobilePaymentApproval';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileCard } from '@/components/mobile/MobileCard';

interface PaymentRequest {
  id: string;
  created_at: string;
  request_id: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
  notes: string | null;
  logistics_record_ids: string[];
  record_count: number;
}

interface LogisticsRecordDetail {
  id: string;
  auto_number: string;
  driver_name: string;
  license_plate: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  loading_weight: number | null;
  payable_amount: number | null;
}

interface PartnerTotal {
  partner_id: string;
  partner_name: string;
  total_amount: number;
  level: number;
}

export default function MobilePaymentRequestsList() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [modalRecords, setModalRecords] = useState<LogisticsRecordDetail[]>([]);
  const [modalContentLoading, setModalContentLoading] = useState(false);
  const [partnerTotals, setPartnerTotals] = useState<PartnerTotal[]>([]);
  const [showApprovalPage, setShowApprovalPage] = useState<PaymentRequest | null>(null);

  const fetchPaymentRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // 移动端只加载前50条

      if (error) throw error;
      setRequests(((data as unknown) as PaymentRequest[]) || []);
    } catch (error) {
      console.error("加载付款申请列表失败:", error);
      toast({ 
        title: "错误", 
        description: `加载付款申请列表失败: ${(error as any).message}`, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPaymentRequests();
  }, [fetchPaymentRequests]);

  const getStatusBadge = (status: PaymentRequest['status']) => {
    switch (status) {
      case 'Pending': return <Badge variant="secondary">待审批</Badge>;
      case 'Approved': return <Badge variant="default">已审批</Badge>;
      case 'Paid': return <Badge variant="outline">已支付</Badge>;
      case 'Rejected': return <Badge variant="destructive">已驳回</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const handleExport = async (req: PaymentRequest) => {
    try {
      setExportingId(req.id);
      const { data, error } = await supabase.functions.invoke('export-excel', { 
        body: { requestId: req.request_id } 
      });
      
      if (error) {
        let errorMessage = error.message;
        try { 
          const errorBody = JSON.parse(error.context?.responseText || '{}'); 
          if (errorBody.error) { 
            errorMessage = errorBody.error; 
          } 
        } catch (_) {}
        throw new Error(errorMessage);
      }
      
      const { signedUrl } = data;
      if (!signedUrl) { 
        throw new Error('云函数未返回有效的下载链接。'); 
      }
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = signedUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({ 
        title: '文件已开始下载', 
        description: `申请单 ${req.request_id} 的Excel已开始下载。` 
      });
    } catch (error) {
      console.error('导出失败:', error);
      toast({ 
        title: '导出失败', 
        description: (error as any).message, 
        variant: 'destructive' 
      });
    } finally {
      setExportingId(null);
    }
  };

  const handleViewDetails = useCallback(async (request: PaymentRequest) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
    setModalContentLoading(true);
    setModalRecords([]);
    setPartnerTotals([]);

    try {
      const { data: rpcData, error } = await supabase.rpc('get_payment_request_data_v2', {
        p_record_ids: request.logistics_record_ids,
      });

      if (error) throw error;

      const rawRecords = (rpcData as any)?.records || [];
      
      const totalsMap = new Map<string, PartnerTotal>();
      let maxLevel = -1;
      
      rawRecords.forEach((rec: any) => {
        (rec.partner_costs || []).forEach((cost: any) => {
          const level = cost.level ?? 0; 
          if (level > maxLevel) {
            maxLevel = level;
          }
          const partnerId = cost.partner_id;
          if (!totalsMap.has(partnerId)) {
            totalsMap.set(partnerId, {
              partner_id: partnerId,
              partner_name: cost.full_name || cost.partner_name,
              total_amount: 0,
              level: level,
            });
          }
          const partnerData = totalsMap.get(partnerId)!;
          partnerData.total_amount += Number(cost.payable_amount || 0);
        });
      });
      
      const filteredTotals = Array.from(totalsMap.values()).filter(
        pt => pt.level < maxLevel
      ).sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
      
      setPartnerTotals(filteredTotals);

      const detailedRecords = rawRecords.map((rec: any) => {
        return {
          id: rec.id,
          auto_number: rec.auto_number,
          driver_name: rec.driver_name,
          license_plate: rec.license_plate,
          loading_location: rec.loading_location,
          unloading_location: rec.unloading_location,
          loading_date: rec.loading_date,
          loading_weight: rec.loading_weight,
          payable_amount: rec.payable_cost || 0, // 使用运单的司机应收金额，而不是所有合作方应付金额的总和
        };
      });
      
      setModalRecords(detailedRecords);

    } catch (error) {
      console.error('获取运单详情失败:', error);
      toast({
        title: '获取详情失败',
        description: (error as any).message,
        variant: 'destructive',
      });
      setIsModalOpen(false);
    } finally {
      setModalContentLoading(false);
    }
  }, [toast]);

  const formatCurrency = (value: number) => 
    (value || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' });

  const handleApprovalClick = (req: PaymentRequest) => {
    setShowApprovalPage(req);
  };

  // 如果显示审批页面，渲染 MobilePaymentApproval
  if (showApprovalPage) {
    return (
      <MobilePaymentApproval
        paymentRequestId={showApprovalPage.id}
        amount={partnerTotals.reduce((sum, pt) => sum + pt.total_amount, 0)}
        description={`付款申请单 ${showApprovalPage.request_id} - ${showApprovalPage.record_count} 条运单`}
        onApprovalSubmitted={() => {
          fetchPaymentRequests();
          setShowApprovalPage(null);
          toast({ title: "提交成功", description: "企业微信审批已提交" });
        }}
        onBack={() => setShowApprovalPage(null)}
      />
    );
  }

  if (loading) {
    return (
      <MobileLayout>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <MobileCard>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              付款申请单
            </CardTitle>
            <p className="text-sm text-muted-foreground">查看和管理付款申请批次</p>
          </CardHeader>
        </MobileCard>

        {/* 申请单列表 */}
        {requests.length === 0 ? (
          <MobileCard>
            <CardContent className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">暂无付款申请记录</p>
            </CardContent>
          </MobileCard>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <MobileCard key={req.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2 mb-1">
                        <Receipt className="h-4 w-4 text-primary" />
                        <span className="font-mono text-sm">{req.request_id}</span>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(req.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">运单数量</span>
                    <span className="font-medium">{req.record_count ?? 0} 条</span>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleViewDetails(req)}
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      查看详情
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => handleExport(req)} 
                      disabled={exportingId === req.id}
                      className="flex-1"
                    >
                      {exportingId === req.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="h-4 w-4 mr-1" />
                      )}
                      导出
                    </Button>
                  </div>

                  {req.status === 'Pending' && (
                    <div className="pt-2 border-t border-border">
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="w-full flex items-center gap-2"
                        onClick={() => handleApprovalClick(req)}
                      >
                        <Send className="h-4 w-4" />
                        企业微信审批
                      </Button>
                    </div>
                  )}
                </CardContent>
              </MobileCard>
            ))}
          </div>
        )}

        {/* 详情对话框 */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>申请单详情: {selectedRequest?.request_id}</DialogTitle>
              <DialogDescription>
                此申请单包含以下 {selectedRequest?.record_count ?? 0} 条运单记录。
              </DialogDescription>
            </DialogHeader>
            
            {!modalContentLoading && partnerTotals.length > 0 && (
              <div className="p-3 border rounded-lg bg-muted/50 mb-4">
                <h4 className="mb-2 font-semibold text-sm">金额汇总 (按合作方)</h4>
                <div className="space-y-2">
                  {partnerTotals.map(pt => (
                    <div key={pt.partner_id} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{pt.partner_name}:</span>
                      <span className="font-mono font-semibold text-primary">
                        {formatCurrency(pt.total_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="overflow-x-auto">
              {modalContentLoading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">运单号</TableHead>
                      <TableHead className="text-xs">司机</TableHead>
                      <TableHead className="text-xs">车牌</TableHead>
                      <TableHead className="text-xs">装货地</TableHead>
                      <TableHead className="text-xs">卸货地</TableHead>
                      <TableHead className="text-xs">重量</TableHead>
                      <TableHead className="text-xs">应付</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modalRecords.length > 0 ? modalRecords.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs font-mono">{r.auto_number}</TableCell>
                        <TableCell className="text-xs">{r.driver_name}</TableCell>
                        <TableCell className="text-xs">{r.license_plate || '-'}</TableCell>
                        <TableCell className="text-xs">{r.loading_location}</TableCell>
                        <TableCell className="text-xs">{r.unloading_location}</TableCell>
                        <TableCell className="text-xs">{r.loading_weight}</TableCell>
                        <TableCell className="text-xs">{formatCurrency(r.payable_amount || 0)}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                          没有找到记录
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
}