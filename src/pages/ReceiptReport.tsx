// 收款报表页面
import { useState, useEffect, useCallback } from 'react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Calendar, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { PaginationControl } from '@/components/common';

interface ReceiptStatistics {
  total_invoiced: number;
  total_received: number;
  total_unreceived: number;
  receipt_rate: number;
  overdue_amount: number;
  overdue_count: number;
}

interface ReceiptDetail {
  id: string;
  request_number: string;
  partner_name: string;
  invoicing_partner_full_name: string;
  total_amount: number;
  total_received_amount: number;
  remaining_amount: number;
  receipt_rate: number;
  status: string;
  payment_due_date: string | null;
  overdue_days: number;
  reminder_count: number;
  reconciliation_status: string;
  created_at: string;
  received_at: string | null;
}

export default function ReceiptReport() {
  const [statistics, setStatistics] = useState<ReceiptStatistics | null>(null);
  const [details, setDetails] = useState<ReceiptDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const { toast } = useToast();

  // 筛选器状态
  const [filters, setFilters] = useState({
    startDate: null as Date | null,
    endDate: null as Date | null,
    partnerId: '',
    status: '' as '' | 'Completed' | 'Received' | 'Overdue'
  });

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // 货主列表
  const [partners, setPartners] = useState<Array<{id: string, name: string}>>([]);

  // 加载货主列表
  useEffect(() => {
    const loadPartners = async () => {
      try {
        const { data, error } = await supabase
          .from('partners')
          .select('id, full_name')
          .eq('partner_type', '货主')
          .order('full_name');
        
        if (error) throw error;
        setPartners((data || []).map(p => ({ id: p.id, name: p.full_name || '' })));
      } catch (error) {
        console.error('加载货主列表失败:', error);
      }
    };
    loadPartners();
  }, []);

  // 加载统计数据
  const loadStatistics = useCallback(async () => {
    setLoadingStats(true);
    try {
      const { data, error } = await supabase.rpc('get_receipt_statistics_1114', {
        p_start_date: filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : null,
        p_end_date: filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : null,
        p_partner_id: filters.partnerId || null
      });

      if (error) throw error;

      const result = data as { success: boolean; statistics: ReceiptStatistics };
      if (result.success && result.statistics) {
        setStatistics(result.statistics);
      } else {
        // 如果返回的数据为空，设置默认值
        setStatistics({
          total_invoiced: 0,
          total_received: 0,
          total_unreceived: 0,
          receipt_rate: 0,
          overdue_amount: 0,
          overdue_count: 0
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
      toast({
        title: "错误",
        description: "加载统计数据失败",
        variant: "destructive"
      });
    } finally {
      setLoadingStats(false);
    }
  }, [filters.startDate, filters.endDate, filters.partnerId, toast]);

  // 加载明细数据
  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_receipt_details_report_1114', {
        p_start_date: filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : null,
        p_end_date: filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : null,
        p_partner_id: filters.partnerId || null,
        p_status: filters.status || null,
        p_page_number: currentPage,
        p_page_size: pageSize
      });

      if (error) throw error;

      const result = data as { 
        success: boolean; 
        records: ReceiptDetail[]; 
        total_count: number;
        total_pages: number;
      };
      
      if (result.success) {
        setDetails(result.records || []);
        setTotalCount(result.total_count || 0);
        setTotalPages(result.total_pages || 1);
      }
    } catch (error) {
      console.error('加载明细数据失败:', error);
      toast({
        title: "错误",
        description: "加载明细数据失败",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, pageSize, toast]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="收款报表与分析"
        description="查看收款统计、明细和逾期情况"
      />

      {/* 筛选器 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 开始日期 */}
            <div className="space-y-2">
              <Label>开始日期</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.startDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {filters.startDate ? format(filters.startDate, 'yyyy-MM-dd', { locale: zhCN }) : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={filters.startDate || undefined}
                    onSelect={(date) => setFilters(prev => ({ ...prev, startDate: date || null }))}
                    locale={zhCN}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* 结束日期 */}
            <div className="space-y-2">
              <Label>结束日期</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.endDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {filters.endDate ? format(filters.endDate, 'yyyy-MM-dd', { locale: zhCN }) : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={filters.endDate || undefined}
                    onSelect={(date) => setFilters(prev => ({ ...prev, endDate: date || null }))}
                    locale={zhCN}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* 货主 */}
            <div className="space-y-2">
              <Label>货主</Label>
              <Select value={filters.partnerId} onValueChange={(value) => setFilters(prev => ({ ...prev, partnerId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="全部货主" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部货主</SelectItem>
                  {partners.map(partner => (
                    <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 状态 */}
            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value as any }))}>
                <SelectTrigger>
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部状态</SelectItem>
                  <SelectItem value="Completed">未全额收款</SelectItem>
                  <SelectItem value="Received">已全额收款</SelectItem>
                  <SelectItem value="Overdue">逾期未收款</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      {loadingStats ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : statistics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">总开票金额</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ¥{statistics.total_invoiced.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">总收款金额</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ¥{statistics.total_received.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">未收款金额</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                ¥{statistics.total_unreceived.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                收款率
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.receipt_rate.toFixed(2)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                逾期金额
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                ¥{statistics.overdue_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                逾期数量
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {statistics.overdue_count}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 明细表格 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">收款明细</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : details.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无数据
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>申请单号</TableHead>
                      <TableHead>货主</TableHead>
                      <TableHead className="text-right">开票金额</TableHead>
                      <TableHead className="text-right">已收款</TableHead>
                      <TableHead className="text-right">未收款</TableHead>
                      <TableHead className="text-right">收款率</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>收款期限</TableHead>
                      <TableHead>逾期天数</TableHead>
                      <TableHead>对账状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.map((detail) => (
                      <TableRow key={detail.id}>
                        <TableCell className="font-mono">{detail.request_number}</TableCell>
                        <TableCell>{detail.invoicing_partner_full_name || detail.partner_name || '-'}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ¥{detail.total_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">
                          ¥{detail.total_received_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-orange-600 font-semibold">
                          ¥{detail.remaining_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={detail.receipt_rate >= 100 ? 'default' : detail.receipt_rate >= 80 ? 'secondary' : 'outline'}>
                            {detail.receipt_rate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={detail.status === 'Received' ? 'default' : 'outline'}>
                            {detail.status === 'Received' ? '已全额收款' : '未全额收款'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {detail.payment_due_date ? format(new Date(detail.payment_due_date), 'yyyy-MM-dd') : '-'}
                        </TableCell>
                        <TableCell>
                          {detail.overdue_days > 0 ? (
                            <Badge variant="destructive">{detail.overdue_days}天</Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={detail.reconciliation_status === 'Reconciled' ? 'default' : detail.reconciliation_status === 'Exception' ? 'destructive' : 'outline'}>
                            {detail.reconciliation_status === 'Reconciled' ? '已对账' : detail.reconciliation_status === 'Exception' ? '异常' : '未对账'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <PaginationControl
                currentPage={currentPage}
                pageSize={pageSize}
                totalPages={totalPages}
                totalCount={totalCount}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

