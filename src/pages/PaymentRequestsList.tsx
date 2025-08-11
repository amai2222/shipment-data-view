// 文件路径: src/pages/PaymentRequestsList.tsx
// 版本: 3wdPu-FINAL-MODAL-DATA-FIX
// 描述: [最终生产级架构代码 - 终极弹窗数据修复] 此代码最终、决定性地、无可辩驳地
//       重构了详情弹窗的数据获取逻辑。通过废除错误的表查询，改为调用与后端导出
//       功能一致的 get_payment_request_data_v2 RPC，确保了数据的完整性和一致性。
//       弹窗现在可以正确显示“吨位”和“应付金额”，彻底修复了信息残缺的问题。

import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, FileSpreadsheet } from 'lucide-react';
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

// --- [3wdPu] 步骤1: 更新接口定义，增加新字段 ---
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

  const handleExport = async (e: React.MouseEvent, req: PaymentRequest) => {
    e.stopPropagation();
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

  // --- [3wdPu] 步骤2: 重构 handleViewDetails，使用正确的 RPC 数据源 ---
  const handleViewDetails = useCallback(async (request: PaymentRequest) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
    setModalContentLoading(true);
    setModalRecords([]);

    try {
      // 使用与后端导出功能一致的 RPC 调用
      const { data: rpcData, error } = await supabase.rpc('get_payment_request_data_v2', {
        p_record_ids: request.logistics_record_ids,
      });

      if (error) throw error;

      // RPC 返回的数据结构是 { records: [...] }
      const rawRecords = (rpcData as any)?.records || [];

      // 将 RPC 返回的复杂数据转换为适合弹窗的扁平化列表
      const detailedRecords = rawRecords.map((rec: any) => {
        // 将多个合作方的成本聚合，或根据业务逻辑选择一个
        // 此处我们简单地将所有合作方的应付金额相加，以代表该运单的总成本
        const totalPayable = (rec.partner_costs || []).reduce(
          (sum: number, cost: any) => sum + Number(cost.payable_amount || 0),
          0
        );

        return {
          id: rec.id,
          auto_number: rec.auto_number,
          driver_name: rec.driver_name,
          license_plate: rec.license_plate,
          loading_location: rec.loading_location,
          unloading_location: rec.unloading_location,
          loading_date: rec.loading_date,
          loading_weight: rec.loading_weight,
          payable_amount: totalPayable,
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
        <DialogContent className="max-w-6xl"> {/* 稍微加宽弹窗以容纳更多列 */}
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
                {/* --- [3wdPu] 步骤3: 更新表格头部 --- */}
                <TableHeader>
                  <TableRow>
                    <TableHead>运单号</TableHead>
                    <TableHead>司机</TableHead>
                    <TableHead>车牌号</TableHead>
                    <TableHead>起运地 → 目的地</TableHead>
                    <TableHead>装车日期</TableHead>
                    <TableHead className="text-right">吨位</TableHead>
                    <TableHead className="text-right">应付金额(元)</TableHead>
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
                        {/* --- [3wdPu] 步骤4: 渲染新的数据单元格 --- */}
                        <TableCell className="text-right">{rec.loading_weight ?? 'N/A'}</TableCell>
                        <TableCell className="text-right font-mono text-primary">
                          {rec.payable_amount?.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' }) ?? 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
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
