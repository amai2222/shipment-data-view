import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ListPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useFilterState } from '@/hooks/useFilterState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { BatchInputDialog } from '@/components/ui/BatchInputDialog';

interface PaymentRequest {
  id: string;
  created_at: string;
  request_id: string;
  status: 'Pending' | 'Approved' | 'Paid' | 'Rejected';
  notes: string | null;
  logistics_record_ids: string[];
  record_count: number;
}

interface FilterState {
  projectId: string;
  requestId: string;
  driverQuery: string; // 确保这里是 driverQuery
  loadingDateRange: DateRange | undefined;
  applicationDateRange: DateRange | undefined;
  logisticsRecordNumbers: string[];
}

const initialFilterState: FilterState = {
  projectId: 'all',
  requestId: '',
  driverQuery: '', // 确保这里是 driverQuery
  loadingDateRange: undefined,
  applicationDateRange: undefined,
  logisticsRecordNumbers: [],
};

export default function PaymentInvoice() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const {
    uiFilters,
    setUiFilters,
    activeFilters,
    isStale,
    handleSearch,
    handleClear,
  } = useFilterState(initialFilterState);

  const loadProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('加载项目失败:', error);
      toast({ 
        title: "错误", 
        description: `加载项目失败: ${(error as any).message}`, 
        variant: "destructive" 
      });
    }
  }, [toast]);

  const loadPaymentRequests = useCallback(async () => {
    setLoading(true);
    try {
      // --- 关键修正点在这里 ---
      const params = {
        p_request_id: activeFilters.requestId || null,
        p_project_id: activeFilters.projectId === 'all' ? null : activeFilters.projectId,
        p_driver_query: activeFilters.driverQuery || null, // 必须使用 p_driver_query
        p_start_date: activeFilters.loadingDateRange?.from ? activeFilters.loadingDateRange.from.toISOString() : null,
        p_end_date: activeFilters.loadingDateRange?.to ? activeFilters.loadingDateRange.to.toISOString() : null,
        p_application_start_date: activeFilters.applicationDateRange?.from ? activeFilters.applicationDateRange.from.toISOString() : null,
        p_application_end_date: activeFilters.applicationDateRange?.to ? activeFilters.applicationDateRange.to.toISOString() : null,
        p_record_autonumbers: activeFilters.logisticsRecordNumbers.length > 0 ? activeFilters.logisticsRecordNumbers : null,
      };

      if (params.p_end_date) {
          const toDate = new Date(params.p_end_date);
          toDate.setUTCHours(23, 59, 59, 999);
          params.p_end_date = toDate.toISOString();
      }
      if (params.p_application_end_date) {
          const toDate = new Date(params.p_application_end_date);
          toDate.setUTCHours(23, 59, 59, 999);
          params.p_application_end_date = toDate.toISOString();
      }

      const { data, error } = await supabase.rpc('get_filtered_payment_requests', params);

      if (error) throw error;
      setRequests((data as PaymentRequest[]) || []);
    } catch (error) {
      console.error('加载付款申请失败:', error);
      toast({
        title: "错误",
        description: `加载付款申请失败: ${(error as any).message}`,
        variant: "destructive"
      });
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilters, toast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadPaymentRequests();
  }, [loadPaymentRequests]);

  const getStatusBadge = (status: PaymentRequest['status']) => {
    switch (status) {
      case 'Pending': return <Badge variant="secondary">待审批</Badge>;
      case 'Approved': return <Badge variant="default">已审批</Badge>;
      case 'Paid': return <Badge variant="outline">已支付</Badge>;
      case 'Rejected': return <Badge variant="destructive">已驳回</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const handleRequestClick = (request: PaymentRequest) => {
    navigate(`/finance/payment-invoice/${request.id}`);
  };

  const handleBatchConfirm = (values: string[]) => {
    setUiFilters(prev => ({ ...prev, logisticsRecordNumbers: values }));
  };

  return (
    <div className="space-y-6">
      <BatchInputDialog
        isOpen={isBatchDialogOpen}
        onClose={() => setIsBatchDialogOpen(false)}
        onConfirm={handleBatchConfirm}
      />
      <div>
        <h1 className="text-3xl font-bold text-foreground">付款与开票</h1>
        <p className="text-muted-foreground">选择付款申请单查看运单财务明细并进行批量付款与开票操作。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">项目</label>
              <Select value={uiFilters.projectId} onValueChange={(value) => setUiFilters(prev => ({ ...prev, projectId: value }))}>
                <SelectTrigger><SelectValue placeholder="选择项目" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部项目</SelectItem>
                  {projects.map((project) => (<SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">申请单号</label>
              <Input type="text" placeholder="输入申请单号" value={uiFilters.requestId} onChange={(e) => setUiFilters(prev => ({ ...prev, requestId: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">司机/车牌/电话</label>
              <Input
                type="text"
                placeholder="输入司机信息"
                value={uiFilters.driverQuery}
                onChange={(e) => setUiFilters(prev => ({ ...prev, driverQuery: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">运单号</label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder={uiFilters.logisticsRecordNumbers.length > 1 ? `已输入 ${uiFilters.logisticsRecordNumbers.length} 个` : "输入单个运单号"}
                  value={uiFilters.logisticsRecordNumbers.length === 1 ? uiFilters.logisticsRecordNumbers[0] : ''}
                  onChange={(e) => setUiFilters(prev => ({ ...prev, logisticsRecordNumbers: e.target.value ? [e.target.value] : [] }))}
                  disabled={uiFilters.logisticsRecordNumbers.length > 1}
                />
                <Button variant="outline" size="icon" onClick={() => setIsBatchDialogOpen(true)}>
                  <ListPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">装货日期范围</label>
              <DateRangePicker date={uiFilters.loadingDateRange} setDate={(range) => setUiFilters(prev => ({ ...prev, loadingDateRange: range }))} className="w-full" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">申请日期范围</label>
              <DateRangePicker date={uiFilters.applicationDateRange} setDate={(range) => setUiFilters(prev => ({ ...prev, applicationDateRange: range }))} className="w-full" />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={!isStale} className={isStale ? '' : 'opacity-50'}>搜索</Button>
            <Button variant="outline" onClick={handleClear}>清除</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>付款申请单列表</CardTitle>
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
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length > 0 ? (
                    requests.map((request) => (
                      <TableRow 
                        key={request.id} 
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleRequestClick(request)}
                      >
                        <TableCell className="font-mono">{request.request_id}</TableCell>
                        <TableCell>
                          {format(new Date(request.created_at), 'yyyy-MM-dd HH:mm')}
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell className="text-right">{request.record_count}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {request.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        没有找到符合条件的付款申请记录。
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
