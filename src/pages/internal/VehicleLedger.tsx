// PC端 - 车辆收支流水（参考操作日志布局）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { PageHeader } from '@/components/PageHeader';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Truck,
  RefreshCw,
  Download,
  Search
} from 'lucide-react';
import { format } from 'date-fns';

interface LedgerRecord {
  id: string;
  vehicle_id: string;
  vehicle_plate: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  month: string;
}

export default function VehicleLedger() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    loadLedger();
  }, [selectedVehicle, selectedMonth]);

  const loadVehicles = async () => {
    const { data } = await supabase
      .from('internal_vehicles')
      .select('id, license_plate')
      .eq('is_active', true)
      .order('license_plate');
    setVehicles(data || []);
  };

  const loadLedger = async () => {
    setLoading(true);
    try {
      const records: LedgerRecord[] = [];
      
      // ✅ 1. 查询运费收入（从logistics_records）
      const { data: incomeData, error: incomeError } = await supabase
        .from('logistics_records')
        .select('id, auto_number, loading_date, payable_cost, project_name, license_plate')
        .order('loading_date', { ascending: false })
        .limit(100);
      
      if (incomeError) throw incomeError;
      
      // 处理收入数据
      (incomeData || []).forEach(item => {
        if (item.payable_cost && item.payable_cost > 0) {
          records.push({
            id: item.id,
            vehicle_id: item.license_plate || '',
            vehicle_plate: item.license_plate || '未知',
            date: item.loading_date,
            type: 'income',
            category: '运费收入',
            amount: item.payable_cost,
            description: `${item.project_name || ''} - ${item.auto_number || ''}`,
            month: item.loading_date.slice(0, 7) // YYYY-MM
          });
        }
      });
      
      // ✅ 2. 查询费用支出（从internal_driver_expense_applications）
      const { data: expenseData, error: expenseError } = await supabase
        .from('internal_driver_expense_applications')
        .select('id, expense_date, expense_type, amount, description, driver_name')
        .eq('status', 'approved')
        .order('expense_date', { ascending: false })
        .limit(100);
      
      if (expenseError) throw expenseError;
      
      // 费用类型映射
      const expenseTypeMap: Record<string, string> = {
        fuel: '加油费',
        parking: '停车费',
        toll: '过路费',
        maintenance: '维修费',
        fine: '罚款',
        meal: '餐费',
        accommodation: '住宿费',
        other: '其他'
      };
      
      // 处理支出数据
      (expenseData || []).forEach(item => {
        if (item.amount && item.amount > 0) {
          records.push({
            id: item.id,
            vehicle_id: item.driver_name || '',
            vehicle_plate: item.driver_name || '未知',
            date: item.expense_date,
            type: 'expense',
            category: expenseTypeMap[item.expense_type] || item.expense_type,
            amount: item.amount,
            description: item.description || '',
            month: item.expense_date.slice(0, 7) // YYYY-MM
          });
        }
      });
      
      // 按日期排序
      records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setRecords(records);
    } catch (error) {
      console.error('加载流水失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载收支流水',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = selectedVehicle === 'all' ? records : records.filter(r => r.vehicle_id === selectedVehicle);
  const stats = {
    totalIncome: filteredRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0),
    totalExpense: filteredRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0),
    balance: 0
  };
  stats.balance = stats.totalIncome - stats.totalExpense;

  const paginatedRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filteredRecords.length / pageSize);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="车辆收支流水"
        description="查看车辆的收入和支出明细流水账"
        icon={DollarSign}
        iconColor="text-green-600"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                收支查询
              </CardTitle>
              <CardDescription>
                收入 ¥{stats.totalIncome.toFixed(2)} | 支出 ¥{stats.totalExpense.toFixed(2)} | 余额 ¥{stats.balance.toFixed(2)}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadLedger} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>车辆</Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部车辆</SelectItem>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.license_plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>月份</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>流水明细</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">日期</TableHead>
                  <TableHead>车辆</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>说明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : paginatedRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      暂无流水记录
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRecords.map(record => (
                    <TableRow key={record.id} className="hover:bg-muted/50">
                      <TableCell className="text-sm">{format(new Date(record.date), 'MM-dd')}</TableCell>
                      <TableCell className="font-medium">{record.vehicle_plate}</TableCell>
                      <TableCell>
                        {record.type === 'income' ? (
                          <Badge className="bg-green-100 text-green-800">
                            <TrendingUp className="h-3 w-3 mr-1" />收入
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <TrendingDown className="h-3 w-3 mr-1" />支出
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{record.category}</TableCell>
                      <TableCell className={`text-right font-semibold ${record.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {record.type === 'income' ? '+' : '-'}¥{record.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {record.description}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && filteredRecords.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                共 {filteredRecords.length} 条流水
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一页</Button>
                <span className="text-sm flex items-center">第 {page} / {totalPages} 页</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>下一页</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
