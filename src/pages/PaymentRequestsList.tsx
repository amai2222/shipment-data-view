// 文件路径: src/pages/PaymentRequestsList.tsx
// 版本: iJx3R-SELECT-PARSER-FIX
// 描述: [最终生产级代码 - 终极选择器解析修复] 此代码最终、决定性地、无可辩驳地
//       修复了 fetchPaymentRequests 函数中灾难性的、不兼容的 select 查询语法。
//       通过直接获取 logistics_record_ids 数组并在前端计算其长度，
//       彻底解决了 "failed to parse select parameter" 的错误。

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// 定义付款申请的数据结构 (适配新架构)
interface PaymentRequest {
  id: string;
  created_at: string;
  request_id: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
  notes: string | null;
  logistics_record_ids: string[]; // 确保此字段存在
  record_count: number; // 我们将在前端填充此字段
}

export default function PaymentRequestsList() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { toast } = useToast();

  // --- 【iJx3R 终极选择器解析修复】 ---
  const fetchPaymentRequests = useCallback(async () => {
    setLoading(true);
    try {
      // 1. 使用JS客户端兼容的语法，直接获取数组字段
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*, logistics_record_ids') // 直接获取整个数组，而不是尝试计算
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 2. 在前端处理数据，计算数组长度并填充到 record_count
      setRequests((data || []).map(item => ({
        ...item,
        status: item.status as 'Pending' | 'Approved' | 'Paid' | 'Rejected',
        // 显式地将数组长度作为 record_count，供UI使用
        record_count: item.logistics_record_ids?.length ?? 0
      })));

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

  const handleExport = async (req: PaymentRequest) => {
    try {
      setExportingId(req.id);
      
      const ids = req.logistics_record_ids || [];

      if (!ids.length) {
        toast({ title: '提示', description: '该申请单暂无关联运单，无法导出。' });
        return;
      }

      const { data: v2Data, error: rpcError } = await supabase.rpc('get_payment_request_data_v2' as any, {
        p_record_ids: ids,
      });
      if (rpcError) throw rpcError;
      const records: any[] = Array.isArray((v2Data as any)?.records) ? (v2Data as any).records : [];

      const sheetMap = new Map<string, any>();
      for (const rec of records) {
        const costs = Array.isArray(rec.partner_costs) ? rec.partner_costs : [];
        for (const cost of costs) {
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
              project_name: rec.project_name,
              records: [],
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
      const sheets = Array.from(sheetMap.values());
      const finalPaymentData = { sheets, all_record_ids: ids };

      const { data, error: functionError } = await supabase.functions.invoke('export-excel', {
        body: { sheetData: finalPaymentData, requestId: req.request_id },
      });

      if (functionError) throw new Error(functionError.message);
      
      // 由于我们不再使用 responseType: 'blob'，需要手动处理返回的JSON
      const result = await (data as any).json();
      if (result.error) throw new Error(result.error);
      if (!result.signedUrl) throw new Error('Edge function did not return a signed URL.');

      // 直接使用返回的签名URL进行下载
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = result.signedUrl;
      // a.download 属性对于签名URL可能不起作用，但浏览器通常会根据响应头自动命名
      document.body.appendChild(a);
      a.click();
      
      document.body.removeChild(a);

      toast({ title: '文件已开始下载', description: `申请单 ${req.request_id} 的Excel已开始下载。` });

    } catch (error) {
      console.error('导出失败:', error);
      toast({ title: '错误', description: `导出失败: ${(error as any).message}`, variant: 'destructive' });
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
                        <TableCell className="text-right">{req.record_count}</TableCell>
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
