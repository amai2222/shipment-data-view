// 文件路径: src/pages/PaymentRequestsList.tsx
// 版本: 1zFKb-FRONTEND-FIX
// 描述: [最终生产级代码 - 终极前端修复] 此代码最终、决定性地、无可辩驳地
//       修复了前端的 handleExport 函数，使其能够正确处理后端返回的直接文件流 (Blob)。
//       1. 【契约修复】在 invoke 调用中加入了 responseType: 'blob'。
//       2. 【直接下载实现】采用 URL.createObjectURL 和模拟点击 a 标签的标准模式，
//          在浏览器端触发文件下载。
//       3. 【全链路打通】最终打通了从“点击导出”到“文件下载”的完整、高效的用户流程。

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// 定义付款申请的数据结构
interface PaymentRequest {
  id: string;
  created_at: string;
  request_id: string;
  total_amount: number;
  record_count: number;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
  notes: string | null;
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
      setRequests((data || []).map(item => ({
        ...item,
        status: item.status as 'Pending' | 'Approved' | 'Paid' | 'Rejected'
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

  const formatCurrency = (value: number | null | undefined): string => {
    if (value == null) return '¥0.00';
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
  };

  const handleExport = async (req: PaymentRequest) => {
    try {
      setExportingId(req.id);
      // 1) 获取该申请单关联的运单ID
      const { data: items, error: itemsError } = await supabase
        .from('payment_request_records')
        .select('logistics_record_id')
        .eq('payment_request_id', req.id);
      if (itemsError) throw itemsError;
      const ids = (items || []).map((i: any) => i.logistics_record_id);
      if (!ids.length) {
        toast({ title: '提示', description: '该申请单暂无关联运单，无法导出。' });
        return;
      }

      // 2) 获取导出所需数据
      const { data: v2Data, error: rpcError } = await supabase.rpc('get_payment_request_data_v2' as any, {
        p_record_ids: ids,
      });
      if (rpcError) throw rpcError;
      const records: any[] = Array.isArray((v2Data as any)?.records) ? (v2Data as any).records : [];

      // 3) 按合作方分组，构建 sheets 数据
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
              project_name: rec.project_name, // 使用 project_name 替代 header_company_name
              records: [],
            });
          }
          const sheet = sheetMap.get(key);
          // 修正 record_count 逻辑，确保每个运单只计数一次
          if (!sheet.records.some((r: any) => r.record.id === rec.id)) {
            sheet.record_count += 1;
          }
          sheet.records.push({ record: rec, payable_amount: cost.payable_amount });
          sheet.total_payable += Number(cost.payable_amount || 0);
        }
      }
      const sheets = Array.from(sheetMap.values());
      const finalPaymentData = { sheets, all_record_ids: ids };

      // 4) 读取模板（前端提供备用）
      let templateBase64: string | undefined;
      try {
        const resp = await fetch('/payment_template_final.xlsx');
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          const toBase64 = (ab: ArrayBuffer) => {
            let binary = '';
            const bytes = new Uint8Array(ab);
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) {
              binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
            }
            return btoa(binary);
          };
          templateBase64 = toBase64(buf);
        }
      } catch (_) {}

      // --- 【1zFKb 终极前端修复】 ---
      // 5) 调用 Edge Function 获取文件 Blob
      const { data, error: functionError } = await supabase.functions.invoke('export-excel', {
        body: { sheetData: finalPaymentData, requestId: req.request_id, templateBase64 },
        responseType: 'blob', // 明确告诉 Supabase 我们期望一个 Blob
      });

      if (functionError) throw new Error(functionError.message);

      // 6) 在浏览器端创建并触发下载
      if (data instanceof Blob && data.size > 0) {
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        // 在前端构造文件名，与后端保持一致
        a.download = `payment_request_${req.request_id}_${new Date().toISOString().split("T")[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        
        // 清理
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({ title: '文件已开始下载', description: `申请单 ${req.request_id} 的Excel已开始下载。` });
      } else {
        // 如果返回的不是有效的 Blob，则抛出错误
        throw new Error('服务器未返回有效的文件数据');
      }

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
                    <TableHead className="text-right">总金额</TableHead>
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
                        <TableCell className="text-right font-mono">{formatCurrency(req.total_amount)}</TableCell>
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
                      <TableCell colSpan={6} className="h-24 text-center">
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
