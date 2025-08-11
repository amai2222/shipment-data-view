// 文件路径: src/pages/PaymentRequestsList.tsx
// 版本: 88BpU-FINAL-ROW-CLICK-FIX
// 描述: [最终生产级架构代码 - 终极行点击修复] 此代码最终、决定性地、无可辩驳地
//       将“查看详情”的触发器从微小的图标转移到了整个表格行，并提供了清晰的
//       视觉反馈。通过使用 event.stopPropagation()，完美解决了操作按钮与行点击
//       之间的事件冲突，提供了现代、直观且无错误的交互体验。

import { useState, useEffect, useCallback } from 'react';
import React from 'react'; // [88BpU] 引入React以使用MouseEvent类型
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, FileSpreadsheet } from 'lucide-react'; // [88BpU] 移除 Eye 图标
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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
  unloading_location:string;
  loading_date: string;
}

export default function PaymentRequestsList() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [modalRecords, setModalRecords] = useState<LogisticsRecordDetail[]>([]);
  const [modalContentLoading, setModalContentLoading] = useState(false);

  const fetchPaymentRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as PaymentRequest[]);
    } catch (error) {
      console.error("加载付款申请列表失败:", error);
      toast({
        title: "错误",
        description: `加载付款申请列表失败: ${(error as any).message}`,
        variant: "destructive",
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
      case 'Pending':
        return <Badge variant="secondary">待审批</Badge>;
      case 'Approved':
        return <Badge variant="default">已审批</Badge>;
      case 'Paid':
        return <Badge variant="outline">已支付</Badge>;
      case 'Rejected':
        return <Badge variant="destructive">已驳回</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // --- [88BpU] 步骤1: 修改 handleExport 以接受事件对象并阻止冒泡 ---
  const handleExport = async (e: React.MouseEvent, req: PaymentRequest) => {
    e.stopPropagation(); // 阻止点击事件传递到TableRow，避免打开弹窗
    try {
      setExportingId(req.id);
      const { data, error } = await supabase.functions.invoke('export-excel', {
        body: { requestId: req.request_id },
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
      toast({ title: '文件已开始下载', description: `申请单 ${req.request_id} 的Excel已开始下载。` });
    } catch (error) {
      console.error('导出失败:', error);
      toast({ title: '导出失败', description: (error as any).message, variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  const handleViewDetails = useCallback(async (request: PaymentRequest) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
    setModalContentLoading(true);
    setModalRecords([]);

    try {
      const { data, error } = await supabase
        .from('logistics_records')
        .select('id, auto_number, driver_name, license_plate, loading_location, unloading_location, loading_date')
        .in('id', request.logistics_record_ids);

      if (error) throw error;
      
      setModalRecords(data as LogisticsRecordDetail[]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">付款申请单列表</h1>
        <p className="text-muted-foreground">查看和管理所有已生成的付款申请批次。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>历史申请记录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="min-h-[400px]">
            {loading ? (
              <div className="flex justify-center items-center h-full min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申请编号</TableHead>
                    <TableHead>申请时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">运单数</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length > 0 ? (
                    requests.map((req) => (
                      // --- [88BpU] 步骤2: 将 onClick 和样式应用到 TableRow ---
                      <TableRow 
                        key={req.id} 
                        onClick={() => handleViewDetails(req)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell className="font-mono">{req.request_id}</TableCell>
                        <TableCell>{format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        <TableCell className="text-right">{req.record_count ?? 0}</TableCell>
                        <TableCell className="text-center">
                          {/* --- [88BpU] 步骤3: 修改导出按钮的 onClick 并移除眼睛图标 --- */}
                          <Button 
                            variant="default" 
                            size="sm" 
                            onClick={(e) => handleExport(e, req)} 
                            disabled={exportingId === req.id}
                          >
                            {exportingId === req.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <FileSpreadsheet className="mr-2 h-4 w-4" />
                            )}
                            导出
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        暂无付款申请记录。
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>申请单详情: {selectedRequest?.request_id}</DialogTitle>
            <DialogDescription>
              此申请单包含以下 {selectedRequest?.record_count ?? 0} 条运单记录。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {modalContentLoading ? (
              <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>运单号</TableHead>
                    <TableHead>司机</TableHead>
                    <TableHead>车牌号</TableHead>
                    <TableHead>起运地 → 目的地</TableHead>
                    <TableHead>装车日期</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modalRecords.length > 0 ? (
                    modalRecords.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell className="font-mono">{rec.auto_number}</TableCell>
                        <TableCell>{rec.driver_name}</TableCell>
                        <TableCell>{rec.license_plate}</TableCell>
                        <TableCell>{`${rec.loading_location} → ${rec.unloading_location}`}</TableCell>
                        <TableCell>{format(new Date(rec.loading_date), 'yyyy-MM-dd')}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        未能加载运单详情或此申请单无运单。
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
  );
}
