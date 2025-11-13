// 货主移动端 - 待付款列表页面

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ShipperMobileLayout } from '@/components/mobile/ShipperMobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Search,
  ArrowRight,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface InvoiceRequest {
  id: string;
  request_number: string;
  total_amount: number;
  total_received_amount: number;
  remaining_amount: number;
  payment_due_date?: string;
  overdue_days?: number;
  status: string;
  created_at: string;
}

export default function MobileShipperPendingPayments() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 获取待付款列表（必须在条件判断之前调用Hook）
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['shipper-pending-payments', user?.partnerId, currentPage, searchKeyword],
    queryFn: async () => {
      if (!user?.partnerId) return { records: [], total_count: 0 };

      const { data: invoicesData, error } = await supabase.rpc(
        'get_invoice_requests_filtered_1114',
        {
          p_invoicing_partner_id: user.partnerId,
          p_status: 'Completed',
          p_request_number: searchKeyword || null,
          p_page_number: currentPage,
          p_page_size: pageSize
        }
      );

      if (error) throw error;

      const result = invoicesData as {
        success: boolean;
        records?: Array<{
          id: string;
          request_number: string;
          total_amount: number;
          total_received_amount?: number;
          received_amount?: number;
          payment_due_date?: string;
          overdue_days?: number;
          status: string;
          created_at: string;
        }>;
        total_count?: number;
      };
      const allInvoices = result.records || [];
      
      // 筛选未全额收款的
      const pendingInvoices = allInvoices.filter((inv) => {
        const received = (inv.total_received_amount || 0) + (inv.received_amount || 0);
        return received < inv.total_amount;
      });

      return {
        records: pendingInvoices.map((inv) => {
          const received = (inv.total_received_amount || 0) + (inv.received_amount || 0);
          return {
            id: inv.id,
            request_number: inv.request_number,
            total_amount: inv.total_amount,
            total_received_amount: received,
            remaining_amount: inv.total_amount - received,
            payment_due_date: inv.payment_due_date,
            overdue_days: inv.overdue_days,
            status: inv.status,
            created_at: inv.created_at
          };
        }),
        total_count: pendingInvoices.length
      };
    },
    enabled: !!user?.partnerId
  });

  const invoices = data?.records || [];
  const totalCount = data?.total_count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <ShipperMobileLayout>
      <div className="p-4 space-y-4">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索申请单号..."
            value={searchKeyword}
            onChange={(e) => {
              setSearchKeyword(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 mb-1">待付款数量</p>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 mb-1">待付款总额</p>
              <p className="text-2xl font-bold text-gray-900">
                ¥{invoices.reduce((sum, inv) => sum + inv.remaining_amount, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 待付款列表 */}
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-500 mt-2">加载中...</p>
            </CardContent>
          </Card>
        ) : invoices.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600">暂无待付款</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => {
              const isOverdue = invoice.overdue_days && invoice.overdue_days > 0;
              return (
                <Card
                  key={invoice.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/m/shipper/pending-payments/${invoice.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900">
                            {invoice.request_number}
                          </p>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              逾期{invoice.overdue_days}天
                            </Badge>
                          )}
                        </div>
                        {invoice.payment_due_date && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            <span>
                              到期日：{format(new Date(invoice.payment_due_date), 'yyyy-MM-dd', { locale: zhCN })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">未收款金额</p>
                        <p className="text-lg font-bold text-gray-900">
                          ¥{invoice.remaining_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/m/shipper/submit-receipt?requestNumber=${invoice.request_number}`);
                        }}
                      >
                        提交回单
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <span className="text-sm text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              下一页
            </Button>
          </div>
        )}
      </div>
    </ShipperMobileLayout>
  );
}

// 待付款详情组件
function MobileShipperPaymentDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['shipper-payment-detail', id],
    queryFn: async () => {
      // 获取申请单详情
      const { data, error } = await supabase
        .from('invoice_requests')
        .select('*')
        .eq('id', id)
        .eq('invoicing_partner_id', user?.partnerId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user?.partnerId
  });

  if (isLoading) {
    return (
      <ShipperMobileLayout>
        <div className="p-4">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-500 mt-2">加载中...</p>
            </CardContent>
          </Card>
        </div>
      </ShipperMobileLayout>
    );
  }

  if (!invoice) {
    return (
      <ShipperMobileLayout>
        <div className="p-4">
          <Card>
            <CardContent className="p-8 text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
              <p className="text-gray-600">申请单不存在</p>
              <Button className="mt-4" onClick={() => navigate('/m/shipper/pending-payments')}>
                返回列表
              </Button>
            </CardContent>
          </Card>
        </div>
      </ShipperMobileLayout>
    );
  }

  const received = (invoice.total_received_amount || 0) + (invoice.received_amount || 0);
  const remaining = invoice.total_amount - received;
  const isOverdue = invoice.overdue_days && invoice.overdue_days > 0;

  return (
    <ShipperMobileLayout>
      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">申请单号</p>
              <p className="font-semibold text-gray-900">{invoice.request_number}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">开票金额</p>
                <p className="text-lg font-bold text-gray-900">
                  ¥{invoice.total_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">已收款</p>
                <p className="text-lg font-bold text-green-600">
                  ¥{received.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">未收款金额</p>
              <p className="text-2xl font-bold text-orange-600">
                ¥{remaining.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            {invoice.payment_due_date && (
              <div>
                <p className="text-sm text-gray-500 mb-1">到期日</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <p className="text-gray-900">
                    {format(new Date(invoice.payment_due_date), 'yyyy-MM-dd', { locale: zhCN })}
                  </p>
                  {isOverdue && (
                    <Badge variant="destructive">
                      逾期{invoice.overdue_days}天
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200">
              <Button
                className="w-full"
                onClick={() => navigate(`/m/shipper/submit-receipt?requestNumber=${invoice.request_number}`)}
              >
                <FileText className="h-4 w-4 mr-2" />
                提交电子回单
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ShipperMobileLayout>
  );
}

