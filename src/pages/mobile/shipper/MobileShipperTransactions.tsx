// 货主移动端 - 余额流水记录页面

import { useState } from 'react';
import { ShipperMobileLayout } from '@/components/mobile/ShipperMobileLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  TrendingUp,
  TrendingDown,
  CalendarIcon,
  RefreshCw,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface BalanceTransaction {
  id: string;
  transaction_type: 'recharge' | 'deduct';
  transaction_category: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type: string | null;
  reference_number: string | null;
  description: string | null;
  created_at: string;
}

const TRANSACTION_CATEGORY_LABELS: Record<string, string> = {
  'invoice_receipt': '财务收款',
  'manual_recharge': '手动充值',
  'waybill': '运单应付',
  'service_fee': '服务费',
  'overdue_fee': '逾期费',
  'other': '其他'
};

export default function MobileShipperTransactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 获取流水记录
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['shipper-transactions', user?.partnerId, startDate, endDate, currentPage],
    queryFn: async () => {
      if (!user?.partnerId) return { transactions: [], total_count: 0 };

      const { data: transactionsData, error } = await supabase.rpc(
        'get_partner_balance_transactions',
        {
          p_partner_id: user.partnerId,
          p_start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
          p_end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
          p_limit: pageSize,
          p_offset: (currentPage - 1) * pageSize
        }
      );

      if (error) throw error;

      const result = transactionsData as { success: boolean; transactions: BalanceTransaction[] };
      return {
        transactions: result.transactions || [],
        total_count: result.transactions?.length || 0
      };
    },
    enabled: !!user?.partnerId
  });

  const transactions = data?.transactions || [];
  const totalCount = data?.total_count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <ShipperMobileLayout>
      <div className="p-4 space-y-4">
        {/* 筛选器 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">日期筛选</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'yyyy-MM-dd', { locale: zhCN }) : '开始日期'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'yyyy-MM-dd', { locale: zhCN }) : '结束日期'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => {
                  setStartDate(undefined);
                  setEndDate(undefined);
                  setCurrentPage(1);
                }}
              >
                清除筛选
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 流水列表 */}
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-500 mt-2">加载中...</p>
            </CardContent>
          </Card>
        ) : transactions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">暂无流水记录</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => {
              const isRecharge = transaction.transaction_type === 'recharge';
              return (
                <Card key={transaction.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {isRecharge ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                          <p className="font-semibold text-gray-900">
                            {TRANSACTION_CATEGORY_LABELS[transaction.transaction_category] || transaction.transaction_category}
                          </p>
                          <Badge
                            variant={isRecharge ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {isRecharge ? '充值' : '扣款'}
                          </Badge>
                        </div>
                        {transaction.description && (
                          <p className="text-sm text-gray-600 mb-1">
                            {transaction.description}
                          </p>
                        )}
                        {transaction.reference_number && (
                          <p className="text-xs text-gray-500">
                            关联单号：{transaction.reference_number}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-lg font-bold",
                          isRecharge ? "text-green-600" : "text-red-600"
                        )}>
                          {isRecharge ? '+' : '-'}¥{transaction.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          余额：¥{transaction.balance_after.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        {format(new Date(transaction.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                      </p>
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

