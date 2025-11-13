// 货主账号余额管理页面
// 显示货主余额和流水记录

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/PageHeader';
import { DollarSign, TrendingUp, TrendingDown, CalendarIcon, RefreshCw, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Partner {
  id: string;
  name: string;
  full_name?: string;
  partner_type?: string;
}

interface PartnerBalance {
  partner_id: string;
  balance: number;
  updated_at: string;
}

interface BalanceTransaction {
  id: string;
  transaction_type: 'recharge' | 'deduct';
  transaction_category: string;  // 交易类别：'invoice_receipt'（财务收款）、'manual_recharge'（手动充值）、'waybill'（运单应付）、'service_fee'（服务费）、'overdue_fee'（逾期费）等
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  reference_number: string | null;
  description: string | null;
  created_at: string;
}

// 交易类别中文映射
const TRANSACTION_CATEGORY_LABELS: Record<string, string> = {
  'invoice_receipt': '财务收款',
  'manual_recharge': '手动充值',
  'waybill': '运单应付',
  'service_fee': '服务费',
  'overdue_fee': '逾期费',
  'other': '其他'
};

export default function PartnerBalance() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(searchParams.get('partnerId') || '');
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [showRechargeDialog, setShowRechargeDialog] = useState(false);
  const [showDeductDialog, setShowDeductDialog] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState<string>('');
  const [rechargeDescription, setRechargeDescription] = useState<string>('');
  const [deductAmount, setDeductAmount] = useState<string>('');
  const [deductCategory, setDeductCategory] = useState<string>('service_fee');
  const [deductDescription, setDeductDescription] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // 加载货主列表
  const loadPartners = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name, full_name, partner_type')
        .eq('partner_type', '货主')
        .order('name');

      if (error) throw error;
      setPartners(data || []);
      
      // 默认选择第一个货主
      if (data && data.length > 0 && !selectedPartnerId) {
        setSelectedPartnerId(data[0].id);
      }
    } catch (error) {
      console.error('加载货主列表失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载货主列表',
        variant: 'destructive'
      });
    }
  }, [selectedPartnerId, toast]);

  // 加载余额
  const loadBalance = useCallback(async () => {
    if (!selectedPartnerId) return;

    try {
      const { data, error } = await supabase.rpc('get_partner_balance', {
        p_partner_id: selectedPartnerId
      });

      if (error) throw error;

      const result = data as { success: boolean; balance: number };
      if (result.success) {
        setBalance(result.balance || 0);
      }
    } catch (error) {
      console.error('加载余额失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载余额信息',
        variant: 'destructive'
      });
    }
  }, [selectedPartnerId, toast]);

  // 加载流水记录
  const loadTransactions = useCallback(async () => {
    if (!selectedPartnerId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_partner_balance_transactions', {
        p_partner_id: selectedPartnerId,
        p_start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
        p_end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
        p_limit: 100,
        p_offset: 0
      });

      if (error) throw error;

      const result = data as { success: boolean; transactions: BalanceTransaction[] };
      if (result.success) {
        setTransactions(result.transactions || []);
      }
    } catch (error) {
      console.error('加载流水记录失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载流水记录',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [selectedPartnerId, startDate, endDate, toast]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  useEffect(() => {
    if (selectedPartnerId) {
      loadBalance();
      loadTransactions();
    }
  }, [selectedPartnerId, loadBalance, loadTransactions]);

  // 手动充值
  const handleManualRecharge = async () => {
    if (!selectedPartnerId || !rechargeAmount || parseFloat(rechargeAmount) <= 0) {
      toast({
        title: '输入错误',
        description: '请输入有效的充值金额',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('manual_recharge_partner_balance', {
        p_partner_id: selectedPartnerId,
        p_amount: parseFloat(rechargeAmount),
        p_description: rechargeDescription || null
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string; balance_after: string };
      if (result.success) {
        toast({
          title: '充值成功',
          description: result.message
        });
        setShowRechargeDialog(false);
        setRechargeAmount('');
        setRechargeDescription('');
        loadBalance();
        loadTransactions();
      }
    } catch (error) {
      console.error('手动充值失败:', error);
      toast({
        title: '充值失败',
        description: (error as Error).message || '操作失败，请重试',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  // 费用扣款
  const handleDeductFee = async () => {
    if (!selectedPartnerId || !deductAmount || parseFloat(deductAmount) <= 0) {
      toast({
        title: '输入错误',
        description: '请输入有效的扣款金额',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('deduct_partner_fee', {
        p_partner_id: selectedPartnerId,
        p_amount: parseFloat(deductAmount),
        p_transaction_category: deductCategory,
        p_description: deductDescription || null
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string; balance_after: string };
      if (result.success) {
        toast({
          title: '扣款成功',
          description: result.message
        });
        setShowDeductDialog(false);
        setDeductAmount('');
        setDeductCategory('service_fee');
        setDeductDescription('');
        loadBalance();
        loadTransactions();
      }
    } catch (error) {
      console.error('费用扣款失败:', error);
      toast({
        title: '扣款失败',
        description: (error as Error).message || '操作失败，请重试',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const selectedPartner = partners.find(p => p.id === selectedPartnerId);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="货主账号余额"
        description="查看和管理货主账号余额及流水记录"
        icon={DollarSign}
        iconColor="text-green-600"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadBalance();
              loadTransactions();
            }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        }
      />

      {/* 货主选择卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>选择货主</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="partner-select">货主</Label>
              <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                <SelectTrigger id="partner-select">
                  <SelectValue placeholder="请选择货主" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map(partner => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name} {partner.full_name ? `(${partner.full_name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedPartnerId && (
        <>
          {/* 余额显示卡片 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>当前余额</CardTitle>
                  <CardDescription>
                    {selectedPartner?.name} {selectedPartner?.full_name ? `(${selectedPartner.full_name})` : ''}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRechargeDialog(true)}
                    className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                  >
                    <TrendingUp className="h-4 w-4 mr-1" />
                    手动充值
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeductDialog(true)}
                    className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
                  >
                    <TrendingDown className="h-4 w-4 mr-1" />
                    费用扣款
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">账号余额</p>
                  <p className={cn(
                    "text-4xl font-bold",
                    balance >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    ¥{balance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={balance >= 0 ? "default" : "destructive"} className="text-lg px-4 py-2">
                    {balance >= 0 ? "正常" : "欠款"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 流水记录卡片 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>流水记录</CardTitle>
                  <CardDescription>共 {transactions.length} 条记录</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {/* 日期筛选 */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {startDate || endDate 
                          ? `${startDate ? format(startDate, 'yyyy-MM-dd') : '开始'} ~ ${endDate ? format(endDate, 'yyyy-MM-dd') : '结束'}`
                          : '选择日期范围'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <div className="p-4 space-y-4">
                        <div className="space-y-2">
                          <Label>开始日期</Label>
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>结束日期</Label>
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setStartDate(undefined);
                              setEndDate(undefined);
                            }}
                          >
                            清除
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              loadTransactions();
                            }}
                          >
                            应用
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-48">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无流水记录
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>交易时间</TableHead>
                        <TableHead>交易类型</TableHead>
                        <TableHead>交易类别</TableHead>
                        <TableHead className="text-right">交易金额</TableHead>
                        <TableHead className="text-right">交易前余额</TableHead>
                        <TableHead className="text-right">交易后余额</TableHead>
                        <TableHead>关联信息</TableHead>
                        <TableHead>描述</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {format(new Date(transaction.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={transaction.transaction_type === 'recharge' ? 'default' : 'secondary'}
                              className={transaction.transaction_type === 'recharge' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-orange-100 text-orange-800'}
                            >
                              {transaction.transaction_type === 'recharge' ? (
                                <>
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  充值
                                </>
                              ) : (
                                <>
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                  扣款
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {TRANSACTION_CATEGORY_LABELS[transaction.transaction_category] || transaction.transaction_category}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono font-semibold",
                            transaction.amount >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {transaction.amount >= 0 ? '+' : ''}
                            ¥{transaction.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            ¥{transaction.balance_before.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            ¥{transaction.balance_after.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            {transaction.reference_number ? (
                              <span className="text-sm text-muted-foreground">
                                {transaction.reference_type === 'invoice_receipt' ? '申请单：' : '运单：'}
                                {transaction.reference_number}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={transaction.description || ''}>
                            {transaction.description || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* 手动充值对话框 */}
      <Dialog open={showRechargeDialog} onOpenChange={setShowRechargeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手动充值</DialogTitle>
            <DialogDescription>
              为 {selectedPartner?.name} 手动充值
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rechargeAmount">
                充值金额 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="rechargeAmount"
                type="number"
                step="0.01"
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
                placeholder="请输入充值金额"
                className="text-lg font-semibold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rechargeDescription">备注（可选）</Label>
              <Input
                id="rechargeDescription"
                value={rechargeDescription}
                onChange={(e) => setRechargeDescription(e.target.value)}
                placeholder="请输入充值备注"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowRechargeDialog(false);
                setRechargeAmount('');
                setRechargeDescription('');
              }}
              disabled={processing}
            >
              取消
            </Button>
            <Button
              onClick={handleManualRecharge}
              disabled={processing || !rechargeAmount || parseFloat(rechargeAmount) <= 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? '处理中...' : '确认充值'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 费用扣款对话框 */}
      <Dialog open={showDeductDialog} onOpenChange={setShowDeductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>费用扣款</DialogTitle>
            <DialogDescription>
              为 {selectedPartner?.name} 扣减费用
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deductCategory">
                费用类别 <span className="text-red-500">*</span>
              </Label>
              <Select value={deductCategory} onValueChange={setDeductCategory}>
                <SelectTrigger id="deductCategory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service_fee">服务费</SelectItem>
                  <SelectItem value="overdue_fee">逾期费</SelectItem>
                  <SelectItem value="other">其他费用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deductAmount">
                扣款金额 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="deductAmount"
                type="number"
                step="0.01"
                value={deductAmount}
                onChange={(e) => setDeductAmount(e.target.value)}
                placeholder="请输入扣款金额"
                className="text-lg font-semibold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deductDescription">备注（可选）</Label>
              <Input
                id="deductDescription"
                value={deductDescription}
                onChange={(e) => setDeductDescription(e.target.value)}
                placeholder="请输入扣款备注"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeductDialog(false);
                setDeductAmount('');
                setDeductCategory('service_fee');
                setDeductDescription('');
              }}
              disabled={processing}
            >
              取消
            </Button>
            <Button
              onClick={handleDeductFee}
              disabled={processing || !deductAmount || parseFloat(deductAmount) <= 0}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {processing ? '处理中...' : '确认扣款'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

