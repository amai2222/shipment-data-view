// 文件路径: src/pages/PaymentRequestsList.tsx
// 版本: z8A8C-FINAL-BULK-ACTION-RESTORATION
// 描述: [最终生产级批量操作修复] 此代码最终、决定性地、无可辩驳地
//       在正确的页面上实现了安全的、支持跨页选择的批量作废功能。
//       通过引入选择状态管理、复选框UI和调用批量RPC，完成了您最终的架构构想，
//       并修复了之前因传输失败导致的灾难性代码截断问题。

import { useState, useEffect, useCallback, useMemo } from 'react';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, FileSpreadsheet, Trash2, ClipboardList, FileText, Banknote } from 'lucide-react';
import { PaymentApproval } from '@/components/PaymentApproval';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { PageHeader } from '@/components/PageHeader';

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

export default function PaymentRequestsList() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { isAdmin } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [modalRecords, setModalRecords] = useState<LogisticsRecordDetail[]>([]);
  const [modalContentLoading, setModalContentLoading] = useState(false);
  const [partnerTotals, setPartnerTotals] = useState<PartnerTotal[]>([]);
  const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set() });
  const [isCancelling, setIsCancelling] = useState(false);
  const [totalRequestsCount, setTotalRequestsCount] = useState(0);

  const fetchPaymentRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error, count } = await supabase
        .from('payment_requests')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(((data as unknown) as PaymentRequest[]) || []);
      setTotalRequestsCount(count || 0);
    } catch (error) {
      console.error("加载付款申请列表失败:", error);
      toast({ title: "错误", description: `加载付款申请列表失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchPaymentRequests(); }, [fetchPaymentRequests]);

  const getStatusBadge = (status: PaymentRequest['status']) => {
    switch (status) {
      case 'Pending': return <Badge variant="secondary">待审批</Badge>;
      case 'Approved': return <Badge variant="default">已审批</Badge>;
      case 'Paid': return <Badge variant="outline">已支付</Badge>;
      case 'Rejected': return <Badge variant="destructive">已驳回</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const handleExport = async (e: React.MouseEvent, req: PaymentRequest) => {
    e.stopPropagation();
    try {
      setExportingId(req.id);
      const { data, error } = await supabase.functions.invoke('export-excel', { body: { requestId: req.request_id } });
      if (error) {
        let errorMessage = error.message;
        try { const errorBody = JSON.parse(error.context?.responseText || '{}'); if (errorBody.error) { errorMessage = errorBody.error; } } catch (_) {}
        throw new Error(errorMessage);
      }
      const { signedUrl } = data;
      if (!signedUrl) { throw new Error('云函数未返回有效的下载链接。'); }
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

  const handleGeneratePDF = async (e: React.MouseEvent, req: PaymentRequest) => {
    e.stopPropagation();
    try {
      setExportingId(req.id);
      
      // 获取PDF数据
      const { data: pdfData, error } = await supabase.rpc('get_payment_request_pdf_data' as any, {
        p_record_ids: req.logistics_record_ids
      });

      if (error) throw error;

      // 生成PDF HTML内容 - 按照项目分组，每个项目一个表格
      const generatePaymentRequestPDF = async (requestData: any): Promise<string> => {
        if (!requestData) {
          throw new Error('付款申请单数据不能为空');
        }

        const { waybills, partner_totals, total_waybills } = requestData;

        // 按项目分组运单数据
        const waybillsByProject = (waybills || []).reduce((groups: { [key: string]: any[] }, waybill: any) => {
          const projectName = waybill.project_name || '未知项目';
          if (!groups[projectName]) {
            groups[projectName] = [];
          }
          groups[projectName].push(waybill);
          return groups;
        }, {});

        // 获取收款人信息（从合作方汇总中获取）
        const payeeInfo = partner_totals && partner_totals.length > 0 ? partner_totals[0] : null;

        // 生成单个项目的表格
        const generateProjectTable = (projectName: string, projectWaybills: any[]) => {
          const projectTotal = projectWaybills.reduce((sum: number, waybill: any) => sum + (waybill.payable_cost || 0), 0);
          
          return `
            <div class="project-section">
              <table class="main-table">
                <thead>
                  <tr class="header-row">
                    <th rowspan="2">货主单位</th>
                    <th rowspan="2">序号</th>
                    <th rowspan="2">实际出发时间</th>
                    <th rowspan="2">实际到达时间</th>
                    <th rowspan="2">起始地</th>
                    <th rowspan="2">目的地</th>
                    <th rowspan="2">货物</th>
                    <th rowspan="2">司机</th>
                    <th rowspan="2">司机电话</th>
                    <th rowspan="2">车牌号</th>
                    <th rowspan="2">吨位</th>
                    <th rowspan="2">承运人运费</th>
                    <th rowspan="2">收款人</th>
                    <th rowspan="2">收款银行账号</th>
                    <th rowspan="2">开户行名称</th>
                    <th rowspan="2">支行网点</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="data-row">
                    <td rowspan="${projectWaybills.length + 1}">${projectName}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                  ${projectWaybills.map((waybill: any, index: number) => `
                    <tr class="data-row">
                      <td>${index + 1}</td>
                      <td>${waybill.loading_date ? new Date(waybill.loading_date).toLocaleDateString('zh-CN') : ''}</td>
                      <td>${waybill.unloading_date ? new Date(waybill.unloading_date).toLocaleDateString('zh-CN') : ''}</td>
                      <td>${waybill.loading_location || ''}</td>
                      <td>${waybill.unloading_location || ''}</td>
                      <td>货物</td>
                      <td>${waybill.driver_name || ''}</td>
                      <td>${waybill.driver_phone || ''}</td>
                      <td>${waybill.license_plate || ''}</td>
                      <td>${waybill.loading_weight || ''}</td>
                      <td>${(waybill.payable_cost || 0).toFixed(2)}</td>
                      <td>${payeeInfo ? payeeInfo.partner_name : ''}</td>
                      <td>${payeeInfo ? '银行账号' : ''}</td>
                      <td>${payeeInfo ? '开户行' : ''}</td>
                      <td>${payeeInfo ? '支行网点' : ''}</td>
                    </tr>
                  `).join('')}
                  <tr class="total-row">
                    <td colspan="11">合计</td>
                    <td>${projectTotal.toFixed(2)}</td>
                    <td colspan="4"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          `;
        };

        // 计算总金额
        const totalAmount = (waybills || []).reduce((sum: number, waybill: any) => sum + (waybill.payable_cost || 0), 0);

        return `
          <!DOCTYPE html>
          <html lang="zh-CN">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>支付申请表 - ${req.request_id}</title>
            <style>
              @media print {
                @page { size: A4; margin: 15mm; }
                body { margin: 0; padding: 0; font-family: 'Microsoft YaHei', Arial, sans-serif; font-size: 12px; line-height: 1.2; color: #000; }
              }
              body { font-family: 'Microsoft YaHei', Arial, sans-serif; font-size: 12px; line-height: 1.2; color: #000; margin: 0; padding: 15px; background: white; }
              .header { text-align: center; margin-bottom: 20px; }
              .company-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
              .form-title { font-size: 16px; font-weight: bold; margin-bottom: 15px; }
              .form-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
              .project-section { margin-bottom: 40px; page-break-inside: avoid; }
              .main-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              .main-table th, .main-table td { border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 11px; }
              .main-table th { background: #f0f0f0; font-weight: bold; }
              .main-table .header-row th { background: #e0e0e0; font-weight: bold; }
              .main-table .data-row td { text-align: left; }
              .main-table .data-row td:first-child { text-align: center; }
              .main-table .data-row td:nth-child(11), .main-table .data-row td:nth-child(12), .main-table .data-row td:nth-child(13), .main-table .data-row td:nth-child(14), .main-table .data-row td:nth-child(15) { text-align: right; }
              .total-row { font-weight: bold; background: #f8f8f8; }
              .remarks-section { margin: 15px 0; }
              .remarks-label { font-weight: bold; margin-bottom: 5px; }
              .signature-section { margin-top: 30px; }
              .signature-table { width: 100%; border-collapse: collapse; }
              .signature-table td { border: 1px solid #000; padding: 8px; text-align: center; font-size: 11px; height: 40px; }
              .signature-table .signature-cell { background: #f9f9f9; }
              .print-button { position: fixed; top: 20px; right: 20px; z-index: 1000; background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 12px; }
              .print-button:hover { background: #1d4ed8; }
              @media print { .print-button { display: none; } }
            </style>
          </head>
          <body>
            <button class="print-button" onclick="window.print()">🖨️ 打印申请表</button>
            
            <div class="header">
              <div class="company-title">中科智运(云南)供应链科技有限公司支付申请表</div>
            </div>
            
            <div class="form-info">
              <div>申请时间: ${new Date().toLocaleDateString('zh-CN')}</div>
              <div>申请编号: ${req.request_id}</div>
            </div>

            ${Object.entries(waybillsByProject).map(([projectName, projectWaybills]) => 
              generateProjectTable(projectName, projectWaybills as any[])
            ).join('')}

            <div class="remarks-section">
              <div class="remarks-label">备注:</div>
            </div>

            <div class="signature-section">
              <table class="signature-table">
                <tr>
                  <td class="signature-cell">信息专员签字</td>
                  <td class="signature-cell">信息部审核签字</td>
                  <td class="signature-cell">业务负责人签字</td>
                  <td class="signature-cell">复核审批人签字</td>
                  <td class="signature-cell">业务经理</td>
                  <td class="signature-cell">业务总经理</td>
                  <td class="signature-cell">财务部审核签字</td>
                </tr>
              </table>
            </div>
          </body>
          </html>
        `;
      };

      // 生成PDF内容
      const printHTML = await generatePaymentRequestPDF(pdfData);
      
      // 创建新窗口并写入HTML内容
      const previewWindow = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes');
      if (previewWindow) {
        previewWindow.document.write(printHTML);
        previewWindow.document.close();
        
        // 处理窗口关闭事件
        previewWindow.onbeforeunload = () => {};
      } else {
        throw new Error('无法打开预览窗口，请检查浏览器弹窗设置');
      }

      toast({ 
        title: 'PDF生成成功', 
        description: `已生成付款申请单PDF，包含 ${req.logistics_record_ids.length} 条运单。` 
      });
    } catch (error) {
      console.error('生成PDF失败:', error);
      toast({ title: '生成PDF失败', description: (error as any).message, variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  const handlePayment = async (e: React.MouseEvent, req: PaymentRequest) => {
    e.stopPropagation();
    try {
      setExportingId(req.id);
      
      // 更新付款状态
      const { data, error } = await supabase.rpc('set_payment_status_for_waybills' as any, {
        p_record_ids: req.logistics_record_ids,
        p_payment_status: 'Paid'
      });

      if (error) throw error;

      toast({ 
        title: '付款成功', 
        description: `已更新 ${(data as any)?.updated_waybills || 0} 条运单的付款状态，同步了 ${(data as any)?.updated_partner_costs || 0} 条合作方成本记录。` 
      });
      
      // 刷新数据
      fetchPaymentRequests();
    } catch (error) {
      console.error('付款操作失败:', error);
      toast({ title: '付款操作失败', description: (error as any).message, variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  const handleCancelPayment = async (e: React.MouseEvent, req: PaymentRequest) => {
    e.stopPropagation();
    try {
      setExportingId(req.id);
      
      // 取消付款状态
      const { data, error } = await supabase.rpc('void_payment_for_request' as any, {
        p_request_id: req.request_id,
        p_cancel_reason: '手动取消付款'
      });

      if (error) throw error;

      toast({ 
        title: '取消付款成功', 
        description: `已取消 ${(data as any).waybill_count} 条运单的付款状态，运单状态回退到"未付款"。` 
      });
      
      // 刷新数据
      fetchPaymentRequests();
    } catch (error) {
      console.error('取消付款操作失败:', error);
      toast({ title: '取消付款失败', description: (error as any).message, variant: 'destructive' });
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
      );
      
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

  const handleRequestSelect = (requestId: string) => {
    setSelection(prev => {
      const newSet = new Set(prev.selectedIds);
      if (newSet.has(requestId)) { newSet.delete(requestId); } else { newSet.add(requestId); }
      if (prev.mode === 'all_filtered') { return { mode: 'none', selectedIds: newSet }; }
      return { ...prev, selectedIds: newSet };
    });
  };

  const handleSelectAllOnPage = (isChecked: boolean) => {
    const pageIds = requests.map(r => r.id);
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

  const selectionCount = useMemo(() => {
    if (selection.mode === 'all_filtered') return totalRequestsCount;
    return selection.selectedIds.size;
  }, [selection, totalRequestsCount]);

  const isAllOnPageSelected = useMemo(() => {
    if (requests.length === 0) return false;
    return requests.every(req => selection.selectedIds.has(req.id));
  }, [requests, selection.selectedIds]);

  const handleCancelRequests = async () => {
    setIsCancelling(true);
    try {
      let idsToCancel: string[] = [];
      if (selection.mode === 'all_filtered') {
        const { data: allRequests, error: fetchError } = await supabase
          .from('payment_requests')
          .select('request_id')
          .in('status', ['Pending', 'Approved']);
        if (fetchError) throw fetchError;
        idsToCancel = allRequests.map(r => r.request_id);
      } else {
        const selectedReqs = requests.filter(r => selection.selectedIds.has(r.id) && ['Pending', 'Approved'].includes(r.status));
        idsToCancel = selectedReqs.map(r => r.request_id);
      }

      if (idsToCancel.length === 0) {
        toast({ title: "提示", description: "没有选择任何可作废的申请单（仅\"待审批\"和\"已审批\"状态可作废）。" });
        setIsCancelling(false);
        return;
      }

      // 检查作废资格
      const { data: eligibility, error: checkError } = await supabase.rpc('check_payment_rollback_eligibility', { 
        p_request_ids: idsToCancel 
      });
      if (checkError) throw checkError;

      if (!eligibility.can_proceed) {
        toast({ 
          title: "无法作废", 
          description: `选中的申请单中：${eligibility.already_paid} 个已付款，${eligibility.already_cancelled} 个已作废。只有待审批和已审批状态的申请单可以作废。`,
          variant: "destructive"
        });
        setIsCancelling(false);
        return;
      }

      // 执行作废操作
      const { data, error } = await supabase.rpc('void_payment_requests_by_ids' as any, { p_request_ids: idsToCancel });
      if (error) throw error;

      // 构建提示信息
      let description = `已成功作废 ${(data as any).cancelled_requests} 张申请单，${(data as any).waybill_count} 条关联运单的状态已回滚。`;
      if ((data as any).paid_requests_skipped > 0) {
        description += `\n已自动剔除 ${(data as any).paid_requests_skipped} 个已付款的申请单（需要先取消付款才能作废）。`;
      }

      toast({ 
        title: "操作成功", 
        description: description
      });
      setSelection({ mode: 'none', selectedIds: new Set() });
      fetchPaymentRequests();
    } catch (error) {
      console.error("批量作废申请失败:", error);
      toast({ title: "错误", description: `操作失败: ${(error as any).message}`, variant: "destructive" });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader 
        title="申请单管理" 
        description="查看和管理所有已生成的付款申请批次"
        icon={ClipboardList}
        iconColor="text-green-600"
      />

      <div className="space-y-6">

      <div className="flex justify-between items-center">
        <div/>
        {isAdmin && (
          <ConfirmDialog
          title={`确认作废 ${selectionCount} 张申请单`}
          description="此操作将删除选中的申请单，并将所有关联运单的状态恢复为“未支付”。此操作不可逆，请谨慎操作。"
          onConfirm={handleCancelRequests}
        >
          <Button variant="destructive" disabled={selectionCount === 0 || isCancelling}>
            {isCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            一键作废 ({selectionCount})
          </Button>
          </ConfirmDialog>
        )}
      </div>

      {selection.selectedIds.size > 0 && selection.mode !== 'all_filtered' && isAllOnPageSelected && totalRequestsCount > requests.length && (
        <div className="flex items-center justify-center gap-4 p-2 text-sm font-medium text-center bg-secondary text-secondary-foreground rounded-md">
          <span>已选择当前页的所有 <b>{requests.length}</b> 条记录。</span>
          <Button variant="link" className="p-0 h-auto" onClick={() => setSelection({ mode: 'all_filtered', selectedIds: new Set() })}>选择全部 <b>{totalRequestsCount}</b> 条记录</Button>
        </div>
      )}
      {selection.mode === 'all_filtered' && (
        <div className="flex items-center justify-center gap-4 p-2 text-sm font-medium text-center bg-secondary text-secondary-foreground rounded-md">
          <span>已选择全部 <b>{totalRequestsCount}</b> 条匹配的记录。</span>
          <Button variant="link" className="p-0 h-auto" onClick={() => setSelection({ mode: 'none', selectedIds: new Set() })}>清除选择</Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>历史申请记录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="min-h-[400px]">
            {loading ? (
              <div className="flex justify-center items-center h-full min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <Table>
                 <TableHeader>
                   <TableRow>
                     {isAdmin && <TableHead className="w-12"><Checkbox checked={selection.mode === 'all_filtered' || isAllOnPageSelected} onCheckedChange={handleSelectAllOnPage} /></TableHead>}
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
                        data-state={selection.selectedIds.has(req.id) ? "selected" : undefined}
                        className="hover:bg-muted/50"
                      >
                        {isAdmin && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selection.mode === 'all_filtered' || selection.selectedIds.has(req.id)} onCheckedChange={() => handleRequestSelect(req.id)} />
                          </TableCell>
                        )}
                        <TableCell className="font-mono cursor-pointer" onClick={() => handleViewDetails(req)}>{req.request_id}</TableCell>
                        <TableCell className="cursor-pointer" onClick={() => handleViewDetails(req)}>{format(new Date(req.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                        <TableCell className="cursor-pointer" onClick={() => handleViewDetails(req)}>{getStatusBadge(req.status)}</TableCell>
                        <TableCell className="text-right cursor-pointer" onClick={() => handleViewDetails(req)}>{req.record_count ?? 0}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <Button variant="default" size="sm" onClick={(e) => handleExport(e, req)} disabled={exportingId === req.id}>
                              {exportingId === req.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                              导出
                            </Button>
                            <Button variant="outline" size="sm" onClick={(e) => handleGeneratePDF(e, req)} disabled={exportingId === req.id}>
                              <FileText className="mr-2 h-4 w-4" />
                              生成PDF
                            </Button>
                            {req.status === 'Pending' && (
                              <Button variant="destructive" size="sm" onClick={(e) => handlePayment(e, req)} disabled={exportingId === req.id}>
                                <Banknote className="mr-2 h-4 w-4" />
                                付款
                              </Button>
                            )}
                            {req.status === 'Paid' && (
                              <Button variant="outline" size="sm" onClick={(e) => handleCancelPayment(e, req)} disabled={exportingId === req.id}>
                                <Banknote className="mr-2 h-4 w-4" />
                                取消付款
                              </Button>
                            )}
                            {req.status === 'Pending' && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <PaymentApproval
                                  paymentRequestId={req.id}
                                  amount={partnerTotals.reduce((sum, pt) => sum + pt.total_amount, 0)}
                                  description={`付款申请单 ${req.request_id} - ${req.record_count} 条运单`}
                                  onApprovalSubmitted={() => {
                                    fetchPaymentRequests();
                                    toast({ title: "提交成功", description: "企业微信审批已提交" });
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="h-24 text-center">暂无付款申请记录。</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>申请单详情: {selectedRequest?.request_id}</DialogTitle>
            <DialogDescription>
              此申请单包含以下 {selectedRequest?.record_count ?? 0} 条运单记录。
            </DialogDescription>
          </DialogHeader>
          
          {!modalContentLoading && partnerTotals.length > 0 && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="mb-2 font-semibold text-foreground">金额汇总 (按合作方)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                {partnerTotals
                  .sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
                  .map(pt => (
                  <div key={pt.partner_id} className="flex justify-between items-baseline">
                    <span className="text-sm text-muted-foreground">{pt.partner_name}:</span>
                    <span className="font-mono font-semibold text-primary">
                      {(pt.total_amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto">
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
                    <TableHead className="text-right">吨位</TableHead>
                    <TableHead className="text-right">司机应收(元)</TableHead>
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
                        <TableCell className="text-right">{rec.loading_weight ?? 'N/A'}</TableCell>
                        <TableCell className="text-right font-mono text-primary">
                          {(rec.payable_amount || 0).toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
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
    </div>
  );
}
