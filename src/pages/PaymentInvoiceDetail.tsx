import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DateRange } from "react-day-picker";
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
  latest_payment_date?: string;
  latest_invoice_date?: string;
  level: number;
}

interface Project {
  id: string;
  name: string;
}

interface Partner {
  id: string;
  name: string;
}

export default function PaymentInvoiceDetail() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [records, setRecords] = useState<PaymentInvoiceRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 对话框状态
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  
  // 付款表单数据
  const [paymentForm, setPaymentForm] = useState({
    partner_id: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    remarks: ''
  });

  // 开票表单数据
  const [invoiceForm, setInvoiceForm] = useState({
    partner_id: '',
    amount: '',
    invoice_number: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    remarks: ''
  });

  useEffect(() => {
    loadProjects();
    loadPartners();
    if (requestId) {
      loadPaymentRequestData();
    }
  }, [requestId]);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('加载项目失败:', error);
      toast({
        title: "错误",
        description: "加载项目列表失败",
        variant: "destructive",
      });
    }
  };

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
      // First, get the payment request details
      const { data: requestData, error: requestError } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;

      // Then get the logistics records data for this request
      const { data: recordsData, error: recordsError } = await supabase.rpc('get_payment_request_data_v2', {
        p_record_ids: requestData.logistics_record_ids,
      });

      if (recordsError) throw recordsError;

      // Transform the data to match PaymentInvoiceRecord format
      const responseData = recordsData as any;
      const transformedRecords: PaymentInvoiceRecord[] = (responseData?.records || []).map((rec: any) => {
        const topLevelPartner = rec.partner_costs?.find((cost: any) => cost.level === Math.max(...rec.partner_costs.map((c: any) => c.level)));
        
        return {
          id: rec.id,
          auto_number: rec.auto_number,
          project_name: rec.project_name || '',
          partner_id: topLevelPartner?.partner_id || '',
          partner_name: topLevelPartner?.partner_name || '',
          driver_name: rec.driver_name,
          loading_date: rec.loading_date,
          route: `${rec.loading_location} → ${rec.unloading_location}`,
          loading_weight: rec.loading_weight || 0,
          partner_payable: topLevelPartner?.payable_amount || 0,
          paid_amount: 0, // Would need to calculate from payment_records
          invoiced_amount: 0, // Would need to calculate from invoice_records
          pending_payment: topLevelPartner?.payable_amount || 0,
          pending_invoice: topLevelPartner?.payable_amount || 0,
          payment_status: '待付款',
          invoice_status: '待开票',
          level: topLevelPartner?.level || 1
        };
      });

      setRecords(transformedRecords);
      setTotalCount(transformedRecords.length);
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

  const handleReset = () => {
    setSelectedProjects([]);
    setSelectedPartners([]);
    setDateRange(undefined);
    setRecords([]);
    setSelectedRecords([]);
    setCurrentPage(1);
    setTotalCount(0);
  };

  const handleSelectRecord = (recordId: string, checked: boolean) => {
    if (checked) {
      setSelectedRecords([...selectedRecords, recordId]);
    } else {
      setSelectedRecords(selectedRecords.filter(id => id !== recordId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecords(records.map(r => r.id));
    } else {
      setSelectedRecords([]);
    }
  };

  const handleBatchPayment = () => {
    if (selectedRecords.length === 0) {
      toast({
        title: "提示",
        description: "请先选择要付款的运单",
        variant: "destructive",
      });
      return;
    }
    setPaymentDialogOpen(true);
  };

  const handleBatchInvoice = () => {
    if (selectedRecords.length === 0) {
      toast({
        title: "提示",
        description: "请先选择要开票的运单",
        variant: "destructive",
      });
      return;
    }
    setInvoiceDialogOpen(true);
  };

  const submitPayment = async () => {
    if (!paymentForm.partner_id || !paymentForm.amount) {
      toast({
        title: "错误",
        description: "请填写完整的付款信息",
        variant: "destructive",
      });
      return;
    }

    try {
      // 计算每个运单的付款金额
      const amountPerRecord = parseFloat(paymentForm.amount) / selectedRecords.length;

      // 获取当前用户
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // 为每个选中的运单创建付款记录
      const paymentRecords = selectedRecords.map(recordId => ({
        logistics_record_id: recordId,
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
        description: `已为 ${selectedRecords.length} 条运单记录付款`,
      });

      setPaymentDialogOpen(false);
      setPaymentForm({
        partner_id: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        remarks: ''
      });
      setSelectedRecords([]);
      loadPaymentRequestData(); // 重新查询数据
    } catch (error) {
      console.error('付款失败:', error);
      toast({
        title: "错误",
        description: "付款操作失败",
        variant: "destructive",
      });
    }
  };

  const submitInvoice = async () => {
    if (!invoiceForm.partner_id || !invoiceForm.amount) {
      toast({
        title: "错误",
        description: "请填写完整的开票信息",
        variant: "destructive",
      });
      return;
    }

    try {
      // 计算每个运单的开票金额
      const amountPerRecord = parseFloat(invoiceForm.amount) / selectedRecords.length;

      // 获取当前用户
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // 为每个选中的运单创建开票记录
      const invoiceRecords = selectedRecords.map(recordId => ({
        logistics_record_id: recordId,
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
        description: `已为 ${selectedRecords.length} 条运单记录开票`,
      });

      setInvoiceDialogOpen(false);
      setInvoiceForm({
        partner_id: '',
        amount: '',
        invoice_number: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        remarks: ''
      });
      setSelectedRecords([]);
      loadPaymentRequestData(); // 重新查询数据
    } catch (error) {
      console.error('开票失败:', error);
      toast({
        title: "错误",
        description: "开票操作失败",
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate('/finance/payment-invoice')}>
          ← 返回申请单列表
        </Button>
        <h1 className="text-3xl font-bold">运单财务明细</h1>
        <div />
      </div>


      {/* 操作栏 */}
      <div className="flex gap-2">
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={handleBatchPayment}
              disabled={selectedRecords.length === 0}
              variant="default"
            >
              批量付款 ({selectedRecords.length})
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>付款信息</DialogTitle>
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
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={submitPayment}>
                  确定付款
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={handleBatchInvoice}
              disabled={selectedRecords.length === 0}
              variant="secondary"
            >
              批量开票 ({selectedRecords.length})
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>开票信息</DialogTitle>
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
                <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={submitInvoice}>
                  确定开票
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 数据表格 */}
      <Card>
        <CardHeader>
          <CardTitle>运单财务明细</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedRecords.length === records.length && records.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>运单号</TableHead>
                  <TableHead>合作方</TableHead>
                  <TableHead>司机</TableHead>
                  <TableHead>装车日期</TableHead>
                  <TableHead>路线</TableHead>
                  <TableHead>装货重量</TableHead>
                  <TableHead>应付金额</TableHead>
                  <TableHead>待付金额</TableHead>
                  <TableHead>已付金额</TableHead>
                  <TableHead>待开票金额</TableHead>
                  <TableHead>已开票金额</TableHead>
                  <TableHead>付款状态</TableHead>
                  <TableHead>开票状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRecords.includes(record.id)}
                        onCheckedChange={(checked) => handleSelectRecord(record.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>{record.auto_number}</TableCell>
                    <TableCell>{record.partner_name}</TableCell>
                    <TableCell>{record.driver_name}</TableCell>
                    <TableCell>{record.loading_date}</TableCell>
                    <TableCell>{record.route}</TableCell>
                    <TableCell>{record.loading_weight}吨</TableCell>
                    <TableCell>¥{record.partner_payable.toFixed(2)}</TableCell>
                    <TableCell>¥{record.pending_payment.toFixed(2)}</TableCell>
                    <TableCell>¥{record.paid_amount.toFixed(2)}</TableCell>
                    <TableCell>¥{record.pending_invoice.toFixed(2)}</TableCell>
                    <TableCell>¥{record.invoiced_amount.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(record.payment_status)}</TableCell>
                    <TableCell>{getStatusBadge(record.invoice_status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline">付款</Button>
                        <Button size="sm" variant="outline">开票</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {records.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              暂无数据，请设置筛选条件后点击查询
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}