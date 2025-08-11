// 文件路径: src/pages/PaymentRequestsList.tsx
// 版本: 2xxrm-FINAL-ARCHITECTURE-FIX
// 描述: [最终生产级架构代码 - 终极架构革命] 此代码最终、决定性地、无可辩驳地
//       采纳了用户的革命性建议。handleExport 函数现在被极度简化，只负责向
//       云函数发送一个最小化的请求（包含requestId），而不再进行任何复杂的数据获取和处理。

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, FileSpreadsheet } from 'lucide-react';
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

export default function PaymentRequestsList() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { toast } = useToast();

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

  // --- 【2xxrm 终极架构革命】 ---
  const handleExport = async (req: PaymentRequest) => {
    try {
      setExportingId(req.id);

      // 1. 只向云函数发送 requestId
      const { data, error } = await supabase.functions.invoke('export-excel', {
        body: { requestId: req.request_id },
      });

      if (error) {
        // 尝试解析云函数返回的错误信息
        let errorMessage = error.message;
        try {
            const errorBody = JSON.parse(error.context?.responseText || '{}');
            if (errorBody.error) {
                errorMessage = errorBody.error;
            }
        } catch (_) {
            // 解析失败，使用原始错误信息
        }
        throw new Error(errorMessage);
      }

      // 2. 从云函数获取签名的下载链接
      const { signedUrl } = data;
      if (!signedUrl) {
        throw new Error('云函数未返回有效的下载链接。');
      }

      // 3. 在浏览器端创建并触发下载
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = signedUrl;
      // 文件名现在由云函数决定，这里可以不设置
      // a.download = `payment_request_${req.request_id}_${new Date().toISOString().split("T")[0]}.xlsx`;
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
                      <TableRow key={req.id}>
                        <TableCell className="font-mono">{req.request_id}</TableCell>
                        <TableCell>{format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                        <TableCell className="text-right">{req.record_count ?? 0}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button variant="default" size="sm" onClick={() => handleExport(req)} disabled={exportingId === req.id}>
                              {exportingId === req.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                              )}
                              导出
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => alert(`查看详情功能待开发，申请ID: ${req.request_id}`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
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
    </div>
  );
}
