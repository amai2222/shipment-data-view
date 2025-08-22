import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PaymentInvoiceRecord {
  id: string;
  auto_number: string;
  project_name: string;
  partner_id: string;
  partner_name: string;
  driver_name: string;
  loading_date: string;
  route: string;
  loading_weight: number;
  partner_payable: number;
  paid_amount: number;
  invoiced_amount: number;
  pending_payment: number;
  pending_invoice: number;
  payment_status: string;
  invoice_status: string;
  level: number;
}

interface PartnerSummary {
  partner_id: string;
  partner_name: string;
  level: number;
  total_records: number;
  total_payable: number;
  total_paid: number;
  total_invoiced: number;
  total_pending_payment: number;
  total_pending_invoice: number;
  records: PaymentInvoiceRecord[];
}

interface Partner {
  id: string;
  name: string;
}

export default function PaymentInvoiceDetail() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [partnerSummaries, setPartnerSummaries] = useState<PartnerSummary[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestData, setRequestData] = useState<any>(null);

  // Dialog states
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPartnerSummary, setSelectedPartnerSummary] = useState<PartnerSummary | null>(null);
  
  const [singlePaymentDialogOpen, setSinglePaymentDialogOpen] = useState(false);
  const [singleInvoiceDialogOpen, setSingleInvoiceDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PaymentInvoiceRecord | null>(null);
  
  const [batchPaymentDialogOpen, setBatchPaymentDialogOpen] = useState(false);
  const [batchInvoiceDialogOpen, setBatchInvoiceDialogOpen] = useState(false);
  const [selectedPartnerForBatch, setSelectedPartnerForBatch] = useState<PartnerSummary | null>(null);

  // Form states
  const [paymentForm, setPaymentForm] = useState({
    partner_id: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    remarks: '',
    bank_receipt_number: '',
    payment_images: [] as File[]
  });

  const [invoiceForm, setInvoiceForm] = useState({
    partner_id: '',
    amount: '',
    invoice_number: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    remarks: '',
    invoice_images: [] as File[]
  });

  useEffect(() => {
    loadPartners();
    if (requestId) {
      loadPaymentRequestData();
    }
  }, [requestId]);

  const loadPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error('加载合作方失败:', error);
      toast({
        title: "错误",
        description: "加载合作方列表失败",
        variant: "destructive",
      });
    }
  };

  const loadPaymentRequestData = async () => {
    if (!requestId) return;
    
    setLoading(true);
    try {
      // Get the payment request details
      const { data: requestData, error: requestError } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;
      
      setRequestData(requestData);

      // Get the logistics records data for this request
      const { data: recordsData, error: recordsError } = await supabase.rpc('get_payment_request_data_v2', {
        p_record_ids: requestData.logistics_record_ids,
      });

      if (recordsError) throw recordsError;

      // Transform data and group by partner
      const responseData = recordsData as any;
      const allRecords: PaymentInvoiceRecord[] = [];
      
      (responseData?.records || []).forEach((rec: any) => {
        (rec.partner_costs || []).forEach((partnerCost: any) => {
          allRecords.push({
            id: `${rec.id}-${partnerCost.partner_id}`,
            auto_number: rec.auto_number,
            project_name: rec.project_name || '',
            partner_id: partnerCost.partner_id,
            partner_name: partnerCost.partner_name,
            driver_name: rec.driver_name,
            loading_date: rec.loading_date,
            route: `${rec.loading_location} → ${rec.unloading_location}`,
            loading_weight: rec.loading_weight || 0,
            partner_payable: partnerCost.payable_amount || 0,
            paid_amount: 0,
            invoiced_amount: 0,
            pending_payment: partnerCost.payable_amount || 0,
            pending_invoice: partnerCost.payable_amount || 0,
            payment_status: '待付款',
            invoice_status: '待开票',
            level: partnerCost.level || 1
          });
        });
      });

      // Group by partner
      const partnerGroups = allRecords.reduce((groups: { [key: string]: PaymentInvoiceRecord[] }, record) => {
        const key = `${record.partner_id}-${record.level}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(record);
        return groups;
      }, {});

      // Create partner summaries
      const summaries: PartnerSummary[] = Object.values(partnerGroups).map(records => {
        const firstRecord = records[0];
        return {
          partner_id: firstRecord.partner_id,
          partner_name: firstRecord.partner_name,
          level: firstRecord.level,
          total_records: records.length,
          total_payable: records.reduce((sum, r) => sum + r.partner_payable, 0),
          total_paid: records.reduce((sum, r) => sum + r.paid_amount, 0),
          total_invoiced: records.reduce((sum, r) => sum + r.invoiced_amount, 0),
          total_pending_payment: records.reduce((sum, r) => sum + r.pending_payment, 0),
          total_pending_invoice: records.reduce((sum, r) => sum + r.pending_invoice, 0),
          records: records
        };
      });

      setPartnerSummaries(summaries.sort((a, b) => a.level - b.level));
    } catch (error) {
      console.error('加载付款申请数据失败:', error);
      toast({
        title: "错误",
        description: "加载付款申请数据失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (partnerSummary: PartnerSummary) => {
    setSelectedPartnerSummary(partnerSummary);
    setDetailDialogOpen(true);
  };

  const handleSinglePayment = (record: PaymentInvoiceRecord) => {
    setSelectedRecord(record);
    setPaymentForm({
      partner_id: record.partner_id,
      amount: record.pending_payment.toString(),
      date: format(new Date(), 'yyyy-MM-dd'),
      remarks: '',
      bank_receipt_number: '',
      payment_images: []
    });
    setSinglePaymentDialogOpen(true);
  };

  const handleSingleInvoice = (record: PaymentInvoiceRecord) => {
    setSelectedRecord(record);
    setInvoiceForm({
      partner_id: record.partner_id,
      amount: record.pending_invoice.toString(),
      invoice_number: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      remarks: '',
      invoice_images: []
    });
    setSingleInvoiceDialogOpen(true);
  };

  const handleBatchPayment = (partnerSummary: PartnerSummary) => {
    setSelectedPartnerForBatch(partnerSummary);
    setPaymentForm({
      partner_id: partnerSummary.partner_id,
      amount: partnerSummary.total_pending_payment.toString(),
      date: format(new Date(), 'yyyy-MM-dd'),
      remarks: '',
      bank_receipt_number: '',
      payment_images: []
    });
    setBatchPaymentDialogOpen(true);
  };

  const handleBatchInvoice = (partnerSummary: PartnerSummary) => {
    setSelectedPartnerForBatch(partnerSummary);
    setInvoiceForm({
      partner_id: partnerSummary.partner_id,
      amount: partnerSummary.total_pending_invoice.toString(),
      invoice_number: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      remarks: '',
      invoice_images: []
    });
    setBatchInvoiceDialogOpen(true);
  };

  const submitSinglePayment = async () => {
    if (!selectedRecord || !paymentForm.partner_id || !paymentForm.amount) {
      toast({
        title: "错误",
        description: "请填写完整的付款信息",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const recordId = selectedRecord.id.split('-')[0]; // Get the original logistics_record_id

      const { error } = await supabase
        .from('payment_records')
        .insert([{
          logistics_record_id: recordId,
          partner_id: paymentForm.partner_id,
          payment_amount: parseFloat(paymentForm.amount),
          payment_date: paymentForm.date,
          remarks: paymentForm.remarks,
          user_id: userId
        }]);

      if (error) throw error;

      toast({
        title: "成功",
        description: "付款记录已创建",
      });

      setSinglePaymentDialogOpen(false);
      setPaymentForm({
        partner_id: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        remarks: '',
        bank_receipt_number: '',
        payment_images: []
      });
      loadPaymentRequestData();
    } catch (error) {
      console.error('付款失败:', error);
      toast({
        title: "错误",
        description: "付款操作失败",
        variant: "destructive",
      });
    }
  };

  const submitSingleInvoice = async () => {
    if (!selectedRecord || !invoiceForm.partner_id || !invoiceForm.amount) {
      toast({
        title: "错误",
        description: "请填写完整的开票信息",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const recordId = selectedRecord.id.split('-')[0]; // Get the original logistics_record_id

      const { error } = await supabase
        .from('invoice_records')
        .insert([{
          logistics_record_id: recordId,
          partner_id: invoiceForm.partner_id,
          invoice_amount: parseFloat(invoiceForm.amount),
          invoice_number: invoiceForm.invoice_number,
          invoice_date: invoiceForm.date,
          remarks: invoiceForm.remarks,
          user_id: userId
        }]);

      if (error) throw error;

      toast({
        title: "成功",
        description: "开票记录已创建",
      });

      setSingleInvoiceDialogOpen(false);
      setInvoiceForm({
        partner_id: '',
        amount: '',
        invoice_number: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        remarks: '',
        invoice_images: []
      });
      loadPaymentRequestData();
    } catch (error) {
      console.error('开票失败:', error);
      toast({
        title: "错误",
        description: "开票操作失败",
        variant: "destructive",
      });
    }
  };

  const submitBatchPayment = async () => {
    if (!selectedPartnerForBatch || !paymentForm.partner_id || !paymentForm.amount) {
      toast({
        title: "错误",
        description: "请填写完整的付款信息",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const amountPerRecord = parseFloat(paymentForm.amount) / selectedPartnerForBatch.records.length;

      const paymentRecords = selectedPartnerForBatch.records.map(record => ({
        logistics_record_id: record.id.split('-')[0],
        partner_id: paymentForm.partner_id,
        payment_amount: amountPerRecord,
        payment_date: paymentForm.date,
        remarks: paymentForm.remarks,
        user_id: userId
      }));

      const { error } = await supabase
        .from('payment_records')
        .insert(paymentRecords);

      if (error) throw error;

      toast({
        title: "成功",
        description: `已为 ${selectedPartnerForBatch.records.length} 条运单记录付款`,
      });

      setBatchPaymentDialogOpen(false);
      setPaymentForm({
        partner_id: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        remarks: '',
        bank_receipt_number: '',
        payment_images: []
      });
      loadPaymentRequestData();
    } catch (error) {
      console.error('批量付款失败:', error);
      toast({
        title: "错误",
        description: "批量付款操作失败",
        variant: "destructive",
      });
    }
  };

  const submitBatchInvoice = async () => {
    if (!selectedPartnerForBatch || !invoiceForm.partner_id || !invoiceForm.amount) {
      toast({
        title: "错误",
        description: "请填写完整的开票信息",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const amountPerRecord = parseFloat(invoiceForm.amount) / selectedPartnerForBatch.records.length;

      const invoiceRecords = selectedPartnerForBatch.records.map(record => ({
        logistics_record_id: record.id.split('-')[0],
        partner_id: invoiceForm.partner_id,
        invoice_amount: amountPerRecord,
        invoice_number: invoiceForm.invoice_number,
        invoice_date: invoiceForm.date,
        remarks: invoiceForm.remarks,
        user_id: userId
      }));

      const { error } = await supabase
        .from('invoice_records')
        .insert(invoiceRecords);

      if (error) throw error;

      toast({
        title: "成功",
        description: `已为 ${selectedPartnerForBatch.records.length} 条运单记录开票`,
      });

      setBatchInvoiceDialogOpen(false);
      setInvoiceForm({
        partner_id: '',
        amount: '',
        invoice_number: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        remarks: '',
        invoice_images: []
      });
      loadPaymentRequestData();
    } catch (error) {
      console.error('批量开票失败:', error);
      toast({
        title: "错误",
        description: "批量开票操作失败",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case '已付款':
        return <Badge variant="default">已付款</Badge>;
      case '部分付款':
        return <Badge variant="secondary">部分付款</Badge>;
      case '已开票':
        return <Badge variant="default">已开票</Badge>;
      case '部分开票':
        return <Badge variant="secondary">部分开票</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Helper functions for dynamic button names
  const getHighestLevel = () => {
    return Math.max(...partnerSummaries.map(p => p.level));
  };

  const getLowestLevel = () => {
    return Math.min(...partnerSummaries.map(p => p.level));
  };

  const getPartnerNameByLevel = (level: number) => {
    const partner = partnerSummaries.find(p => p.level === level);
    return partner?.partner_name || '';
  };

  const getPaymentButtonText = (summary: PartnerSummary) => {
    const highestLevel = getHighestLevel();
    const lowestLevel = getLowestLevel();
    
    if (summary.level === highestLevel) {
      // 最高级合作方
      return `确认 【${summary.partner_name}】已付款`;
    } else if (summary.level === lowestLevel) {
      // 最低级合作方
      return `向【${summary.partner_name}】付款`;
    } else {
      // 中级合作方
      const lowerLevelPartnerName = getPartnerNameByLevel(summary.level - 1);
      return `向【${lowerLevelPartnerName || '下一级合作方'}】付款`;
    }
  };

  const getInvoiceButtonText = (summary: PartnerSummary) => {
    const highestLevel = getHighestLevel();
    const lowestLevel = getLowestLevel();
    
    if (summary.level === lowestLevel) {
      // 最低级合作方
      return `确认【${summary.partner_name}】收票`;
    } else {
      // 非最低级合作方
      const higherLevelPartnerName = getPartnerNameByLevel(summary.level + 1);
      return `向【${higherLevelPartnerName || '上一级合作方'}】开票`;
    }
  };

  const getPaymentButtonVariant = (summary: PartnerSummary) => {
    const highestLevel = getHighestLevel();
    return summary.level === highestLevel ? "destructive" : "default";
  };

  const getInvoiceButtonVariant = (summary: PartnerSummary) => {
    const lowestLevel = getLowestLevel();
    return summary.level === lowestLevel ? "destructive" : "default";
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate('/finance/payment-invoice')}>
          ← 返回申请单列表
        </Button>
        <h1 className="text-3xl font-bold">
          编号【{requestData?.request_id || requestId}】付款申请单明细
        </h1>
        <div />
      </div>

      {/* 合作方汇总表格 */}
      <Card>
        <CardHeader>
          <CardTitle>按申请单付款开票</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>合作方</TableHead>
                  <TableHead>级别</TableHead>
                  <TableHead>运单数量</TableHead>
                  <TableHead>总应付金额</TableHead>
                  <TableHead>待付金额</TableHead>
                  <TableHead>已付金额</TableHead>
                  <TableHead>待开票金额</TableHead>
                  <TableHead>已开票金额</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnerSummaries.map((summary) => (
                  <TableRow 
                    key={`${summary.partner_id}-${summary.level}`} 
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handleRowClick(summary)}
                  >
                    <TableCell>{summary.partner_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Level {summary.level}</Badge>
                    </TableCell>
                    <TableCell>{summary.total_records}</TableCell>
                    <TableCell>¥{summary.total_payable.toFixed(2)}</TableCell>
                    <TableCell>¥{summary.total_pending_payment.toFixed(2)}</TableCell>
                    <TableCell>¥{summary.total_paid.toFixed(2)}</TableCell>
                    <TableCell>¥{summary.total_pending_invoice.toFixed(2)}</TableCell>
                    <TableCell>¥{summary.total_invoiced.toFixed(2)}</TableCell>
                     <TableCell>
                       <div className="flex gap-1">
                         <Button 
                           size="sm" 
                           variant={getPaymentButtonVariant(summary)}
                           onClick={(e) => {
                             e.stopPropagation();
                             handleBatchPayment(summary);
                           }}
                         >
                           {getPaymentButtonText(summary)}
                         </Button>
                         <Button 
                           size="sm" 
                           variant={getInvoiceButtonVariant(summary)}
                           onClick={(e) => {
                             e.stopPropagation();
                             handleBatchInvoice(summary);
                           }}
                         >
                           {getInvoiceButtonText(summary)}
                         </Button>
                       </div>
                     </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {partnerSummaries.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              暂无数据
            </div>
          )}
        </CardContent>
      </Card>

      {/* 运单明细对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              运单明细 - {selectedPartnerSummary?.partner_name} (Level {selectedPartnerSummary?.level})
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>运单号</TableHead>
                  <TableHead>司机</TableHead>
                  <TableHead>装车日期</TableHead>
                  <TableHead>路线</TableHead>
                  <TableHead>装货重量</TableHead>
                  <TableHead>应付金额</TableHead>
                  <TableHead>付款状态</TableHead>
                  <TableHead>开票状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPartnerSummary?.records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.auto_number}</TableCell>
                    <TableCell>{record.driver_name}</TableCell>
                    <TableCell>{record.loading_date}</TableCell>
                    <TableCell>{record.route}</TableCell>
                    <TableCell>{record.loading_weight}吨</TableCell>
                    <TableCell>¥{record.partner_payable.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(record.payment_status)}</TableCell>
                    <TableCell>{getStatusBadge(record.invoice_status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleSinglePayment(record)}
                        >
                          付款
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleSingleInvoice(record)}
                        >
                          开票
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* 单个运单付款对话框 */}
      <Dialog open={singlePaymentDialogOpen} onOpenChange={setSinglePaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>单笔付款 - {selectedRecord?.auto_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>合作方</Label>
              <Select 
                value={paymentForm.partner_id} 
                onValueChange={(value) => setPaymentForm({...paymentForm, partner_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择合作方" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map(partner => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>付款金额</Label>
              <Input
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                placeholder="请输入付款金额"
              />
            </div>
            <div className="space-y-2">
              <Label>付款日期</Label>
              <Input
                type="date"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm({...paymentForm, date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={paymentForm.remarks}
                onChange={(e) => setPaymentForm({...paymentForm, remarks: e.target.value})}
                placeholder="请输入备注信息"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSinglePaymentDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={submitSinglePayment}>
                确定付款
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 单个运单开票对话框 */}
      <Dialog open={singleInvoiceDialogOpen} onOpenChange={setSingleInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>单笔开票 - {selectedRecord?.auto_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>合作方</Label>
              <Select 
                value={invoiceForm.partner_id} 
                onValueChange={(value) => setInvoiceForm({...invoiceForm, partner_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择合作方" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map(partner => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>开票金额</Label>
              <Input
                type="number"
                value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm({...invoiceForm, amount: e.target.value})}
                placeholder="请输入开票金额"
              />
            </div>
            <div className="space-y-2">
              <Label>发票号码</Label>
              <Input
                value={invoiceForm.invoice_number}
                onChange={(e) => setInvoiceForm({...invoiceForm, invoice_number: e.target.value})}
                placeholder="请输入发票号码"
              />
            </div>
            <div className="space-y-2">
              <Label>开票日期</Label>
              <Input
                type="date"
                value={invoiceForm.date}
                onChange={(e) => setInvoiceForm({...invoiceForm, date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={invoiceForm.remarks}
                onChange={(e) => setInvoiceForm({...invoiceForm, remarks: e.target.value})}
                placeholder="请输入备注信息"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSingleInvoiceDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={submitSingleInvoice}>
                确定开票
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 批量付款对话框 */}
      <Dialog open={batchPaymentDialogOpen} onOpenChange={setBatchPaymentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              批量付款 - {selectedPartnerForBatch?.partner_name} ({selectedPartnerForBatch?.total_records} 条运单)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>合作方</Label>
              <Select 
                value={paymentForm.partner_id} 
                onValueChange={(value) => setPaymentForm({...paymentForm, partner_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择合作方" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map(partner => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>付款金额</Label>
              <Input
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                placeholder="请输入付款金额"
              />
            </div>
            <div className="space-y-2">
              <Label>付款日期</Label>
              <Input
                type="date"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm({...paymentForm, date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>电子银行回单编号 (可选)</Label>
              <Input
                value={paymentForm.bank_receipt_number}
                onChange={(e) => setPaymentForm({...paymentForm, bank_receipt_number: e.target.value})}
                placeholder="请输入银行回单编号"
              />
            </div>
            <div className="space-y-2">
              <Label>上传银行回单图片 (可选)</Label>
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setPaymentForm({...paymentForm, payment_images: files});
                }}
              />
              {paymentForm.payment_images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {paymentForm.payment_images.map((file, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Payment image ${index + 1}`}
                        className="w-full h-20 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newImages = paymentForm.payment_images.filter((_, i) => i !== index);
                          setPaymentForm({...paymentForm, payment_images: newImages});
                        }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={paymentForm.remarks}
                onChange={(e) => setPaymentForm({...paymentForm, remarks: e.target.value})}
                placeholder="请输入备注信息"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setBatchPaymentDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={submitBatchPayment}>
                确定付款
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 批量开票对话框 */}
      <Dialog open={batchInvoiceDialogOpen} onOpenChange={setBatchInvoiceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              批量开票 - {selectedPartnerForBatch?.partner_name} ({selectedPartnerForBatch?.total_records} 条运单)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>合作方</Label>
              <Select 
                value={invoiceForm.partner_id} 
                onValueChange={(value) => setInvoiceForm({...invoiceForm, partner_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择合作方" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map(partner => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>开票金额</Label>
              <Input
                type="number"
                value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm({...invoiceForm, amount: e.target.value})}
                placeholder="请输入开票金额"
              />
            </div>
            <div className="space-y-2">
              <Label>发票号码</Label>
              <Input
                value={invoiceForm.invoice_number}
                onChange={(e) => setInvoiceForm({...invoiceForm, invoice_number: e.target.value})}
                placeholder="请输入发票号码"
              />
            </div>
            <div className="space-y-2">
              <Label>开票日期</Label>
              <Input
                type="date"
                value={invoiceForm.date}
                onChange={(e) => setInvoiceForm({...invoiceForm, date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>上传发票图片 (可选)</Label>
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setInvoiceForm({...invoiceForm, invoice_images: files});
                }}
              />
              {invoiceForm.invoice_images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {invoiceForm.invoice_images.map((file, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Invoice image ${index + 1}`}
                        className="w-full h-20 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newImages = invoiceForm.invoice_images.filter((_, i) => i !== index);
                          setInvoiceForm({...invoiceForm, invoice_images: newImages});
                        }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={invoiceForm.remarks}
                onChange={(e) => setInvoiceForm({...invoiceForm, remarks: e.target.value})}
                placeholder="请输入备注信息"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setBatchInvoiceDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={submitBatchInvoice}>
                确定开票
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}