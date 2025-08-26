import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useFilterState } from '@/hooks/useFilterState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';

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
  driverName: string;
  dateRange: DateRange | undefined;
}

const initialFilterState: FilterState = {
  projectId: 'all',
  requestId: '',
  driverName: 'all',
  dateRange: undefined,
};

export default function PaymentInvoice() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [drivers, setDrivers] = useState<Array<{ name: string }>>([]);
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

  const loadDrivers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('logistics_records')
        .select('driver_name')
        .not('driver_name', 'is', null);
      
      if (error) throw error;
      
      const uniqueDrivers = [...new Set(data?.map(record => record.driver_name).filter(Boolean) || [])];
      setDrivers(uniqueDrivers.map(name => ({ name })));
    } catch (error) {
      console.error('加载司机失败:', error);
      toast({ 
        title: "错误", 
        description: `加载司机失败: ${(error as any).message}`, 
        variant: "destructive" 
      });
    }
  }, [toast]);

  // --- 核心修改：调用数据库 RPC 函数 ---
  const loadPaymentRequests = useCallback(async () => {
    setLoading(true);
    try {
      // 1. 准备要发送到数据库函数的参数
      //    键名必须与 SQL 函数中定义的参数名完全匹配
      const params = {
        p_request_id: activeFilters.requestId || null,
        p_project_id: activeFilters.projectId === 'all' ? null : activeFilters.projectId,
        p_driver_name: activeFilters.driverName === 'all' ? null : activeFilters.driverName,
        p_start_date: activeFilters.dateRange?.from ? activeFilters.dateRange.from.toISOString() : null,
        p_end_date: activeFilters.dateRange?.to ? activeFilters.dateRange.to.toISOString() : null,
      };

      // 2. 如果有结束日期，调整其时间以确保包含当天的所有记录
      if (params.p_end_date) {
          const toDate = new Date(params.p_end_date);
          toDate.setUTCHours(23, 59, 59, 999);
          params.p_end_date = toDate.toISOString();
      }

      // 3. 调用 RPC 函数
      const { data, error } = await supabase.rpc('get_filtered_payment_requests', params);

      if (error) {
        throw error;
      }

      setRequests((data as PaymentRequest[]) || []);
    } catch (error) {
      console.error('加载付款申请失败:', error);
      toast({
        title: "错误",
        description: `加载付款申请失败: ${(error as any).message}`,
        variant: "destructive"
      });
      setRequests([]); // 出错时清空列表
    } finally {
      setLoading(false);
    }
  }, [activeFilters, toast]);

  useEffect(() => {
    loadProjects();
    loadDrivers();
  }, [loadProjects, loadDrivers]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">付款与开票</h1>
        <p className="text-muted-foreground">选择付款申请单查看运单财务明细并进行批量付款与开票操作。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">项目</label>
              <Select
                value={uiFilters.projectId}
                onValueChange={(value) => 
                  setUiFilters(prev => ({ ...prev, projectId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部项目</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">申请单号</label>
              <Input
                type="text"
                placeholder="输入申请单号"
                value={uiFilters.requestId}
                onChange={(e) => 
                  setUiFilters(prev => ({ ...prev, requestId: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">司机</label>
              <Select
                value={uiFilters.driverName}
                onValueChange={(value) => 
                  setUiFilters(prev => ({ ...prev, driverName: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择司机" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部司机</SelectItem>
                  {drivers.map((driver, index) => (
                    <SelectItem key={index} value={driver.name}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">装货日期范围</label>
              <DateRangePicker
                date={uiFilters.dateRange}
                setDate={(range) => 
                  setUiFilters(prev => ({ ...prev, dateRange: range }))
                }
                className="w-full"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleSearch} 
              disabled={!isStale}
              className={isStale ? '' : 'opacity-50'}
            >
              搜索
            </Button>
            <Button variant="outline" onClick={handleClear}>
              清除
            </Button>
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
