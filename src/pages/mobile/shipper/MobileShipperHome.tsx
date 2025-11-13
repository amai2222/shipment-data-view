// 货主移动端首页 - 看板
// 显示余额、待付款、运单统计等信息

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShipperMobileLayout } from '@/components/mobile/ShipperMobileLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Truck,
  Wallet,
  CreditCard,
  ArrowRight,
  RefreshCw,
  FileText,
  Calendar,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DashboardStats {
  balance: number;
  pendingPayments: number;
  pendingAmount: number;
  overduePayments: number;
  overdueAmount: number;
  todayWaybills: number;
  monthlyWaybills: number;
  recentInvoices: Array<{
    id: string;
    request_number: string;
    total_amount: number;
    total_received_amount: number;
    remaining_amount: number;
    payment_due_date?: string;
    overdue_days?: number;
    status: string;
  }>;
}

export default function MobileShipperHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  // 获取货主余额
  const { data: balance = 0, refetch: refetchBalance } = useQuery({
    queryKey: ['shipper-balance', user?.partnerId],
    queryFn: async () => {
      if (!user?.partnerId) return 0;
      const { data, error } = await supabase.rpc('get_partner_balance', {
        p_partner_id: user.partnerId
      });
      if (error) throw error;
      const result = data as { success: boolean; balance: number };
      return result.balance || 0;
    },
    enabled: !!user?.partnerId
  });

  // 获取待付款统计
  const { data: stats, refetch: refetchStats } = useQuery<DashboardStats>({
    queryKey: ['shipper-dashboard-stats', user?.partnerId],
    queryFn: async () => {
      if (!user?.partnerId) {
        return {
          balance: 0,
          pendingPayments: 0,
          pendingAmount: 0,
          overduePayments: 0,
          overdueAmount: 0,
          todayWaybills: 0,
          monthlyWaybills: 0,
          recentInvoices: []
        };
      }

      // 获取待付款申请单
      const { data: invoicesData, error: invoicesError } = await supabase.rpc(
        'get_invoice_requests_filtered_1114',
        {
          p_invoicing_partner_id: user.partnerId,
          p_status: 'Completed',
          p_page_number: 1,
          p_page_size: 100
        }
      );

      if (invoicesError) throw invoicesError;

      const invoices = (invoicesData as { records?: Array<{
        id: string;
        request_number: string;
        total_amount: number;
        total_received_amount?: number;
        received_amount?: number;
        payment_due_date?: string;
        overdue_days?: number;
        status: string;
      }> })?.records || [];
      
      // 筛选未全额收款的
      const pendingInvoices = invoices.filter((inv) => {
        const received = (inv.total_received_amount || 0) + (inv.received_amount || 0);
        return received < inv.total_amount;
      });

      // 计算待付款金额
      const pendingAmount = pendingInvoices.reduce((sum, inv) => {
        const received = (inv.total_received_amount || 0) + (inv.received_amount || 0);
        return sum + (inv.total_amount - received);
      }, 0);

      // 筛选逾期
      const overdueInvoices = pendingInvoices.filter((inv) => {
        if (!inv.payment_due_date) return false;
        const dueDate = new Date(inv.payment_due_date);
        return dueDate < new Date();
      });

      const overdueAmount = overdueInvoices.reduce((sum, inv) => {
        const received = (inv.total_received_amount || 0) + (inv.received_amount || 0);
        return sum + (inv.total_amount - received);
      }, 0);

      // 获取今日和本月运单数（简化版，实际应该调用专门的统计函数）
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      return {
        balance: balance,
        pendingPayments: pendingInvoices.length,
        pendingAmount,
        overduePayments: overdueInvoices.length,
        overdueAmount,
        todayWaybills: 0, // TODO: 调用统计函数
        monthlyWaybills: 0, // TODO: 调用统计函数
        recentInvoices: pendingInvoices.slice(0, 5).map((inv) => ({
          id: inv.id,
          request_number: inv.request_number,
          total_amount: inv.total_amount,
          total_received_amount: (inv.total_received_amount || 0) + (inv.received_amount || 0),
          remaining_amount: inv.total_amount - ((inv.total_received_amount || 0) + (inv.received_amount || 0)),
          payment_due_date: inv.payment_due_date,
          overdue_days: inv.overdue_days,
          status: inv.status
        }))
      };
    },
    enabled: !!user?.partnerId
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchBalance(), refetchStats()]);
      toast({
        title: '刷新成功',
        description: '数据已更新'
      });
    } catch (error) {
      console.error('刷新失败:', error);
      toast({
        title: '刷新失败',
        description: '请重试',
        variant: 'destructive'
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ShipperMobileLayout>
      <div className="p-4 space-y-4">
        {/* 刷新按钮 */}
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            刷新
          </Button>
        </div>

        {/* 余额卡片 */}
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-blue-100 text-sm mb-1">账户余额</p>
                <p className="text-3xl font-bold">
                  ¥{balance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <Wallet className="h-12 w-12 text-blue-200" />
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => navigate('/m/shipper/recharge')}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                充值
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => navigate('/m/shipper/transactions')}
              >
                <FileText className="h-4 w-4 mr-2" />
                流水
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 待付款统计 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">待付款</p>
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.pendingPayments || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ¥{(stats?.pendingAmount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">已逾期</p>
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.overduePayments || 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                ¥{(stats?.overdueAmount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 快速操作 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">快速操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => navigate('/m/shipper/pending-payments')}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span>查看待付款</span>
                {stats?.pendingPayments > 0 && (
                  <Badge className="ml-2 bg-orange-500">
                    {stats.pendingPayments}
                  </Badge>
                )}
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => navigate('/m/shipper/submit-receipt')}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-500" />
                <span>提交电子回单</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => navigate('/m/shipper/waybills')}
            >
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-green-500" />
                <span>运单查询</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* 最近待付款 */}
        {stats?.recentInvoices && stats.recentInvoices.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">最近待付款</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/m/shipper/pending-payments')}
                >
                  查看全部
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.recentInvoices.map((invoice) => {
                const isOverdue = invoice.overdue_days && invoice.overdue_days > 0;
                return (
                  <div
                    key={invoice.id}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/m/shipper/pending-payments/${invoice.id}`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {invoice.request_number}
                        </p>
                        {invoice.payment_due_date && (
                          <p className="text-xs text-gray-500 mt-1">
                            到期日：{format(new Date(invoice.payment_due_date), 'yyyy-MM-dd', { locale: zhCN })}
                          </p>
                        )}
                      </div>
                      {isOverdue && (
                        <Badge variant="destructive" className="ml-2">
                          逾期{invoice.overdue_days}天
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">未收款金额</p>
                        <p className="text-lg font-bold text-gray-900">
                          ¥{invoice.remaining_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/m/shipper/submit-receipt?requestNumber=${invoice.request_number}`);
                        }}
                      >
                        提交回单
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* 空状态 */}
        {stats?.recentInvoices && stats.recentInvoices.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600">暂无待付款</p>
            </CardContent>
          </Card>
        )}
      </div>
    </ShipperMobileLayout>
  );
}

