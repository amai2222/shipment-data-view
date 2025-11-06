// PC端 - 车辆收支流水（桌面完整版）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
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
      // 模拟数据（实际应该从数据库查询）
      const mockData: LedgerRecord[] = [
        {
          id: '1',
          vehicle_id: '1',
          vehicle_plate: '云F97310',
          date: '2025-11-05',
          type: 'income',
          category: '运费收入',
          amount: 2000,
          description: '天兴芦花项目运费',
          month: '2025-11'
        },
        {
          id: '2',
          vehicle_id: '1',
          vehicle_plate: '云F97310',
          date: '2025-11-03',
          type: 'expense',
          category: '加油费',
          amount: 551,
          description: '2月份公司加油',
          month: '2025-11'
        },
        {
          id: '3',
          vehicle_id: '1',
          vehicle_plate: '云F97310',
          date: '2025-11-01',
          type: 'income',
          category: '运费收入',
          amount: 1800,
          description: '铁路配送项目',
          month: '2025-11'
        }
      ];
      
      setRecords(mockData);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = selectedVehicle === 'all' 
    ? records 
    : records.filter(r => r.vehicle_id === selectedVehicle);

  const stats = {
    totalIncome: filteredRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0),
    totalExpense: filteredRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0),
    balance: 0
  };
  stats.balance = stats.totalIncome - stats.totalExpense;

  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶部操作栏 */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold">车辆收支流水</h1>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">收入</span>
                <span className="font-semibold text-green-600">¥{stats.totalIncome.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-muted-foreground">支出</span>
                <span className="font-semibold text-red-600">¥{stats.totalExpense.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="text-muted-foreground">余额</span>
                <span className={`font-semibold ${stats.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  ¥{stats.balance.toFixed(2)}
                </span>
              </div>
            </div>
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
      </div>

      {/* 筛选栏 */}
      <div className="border-b bg-card px-6 py-3">
        <div className="flex gap-3">
          <div className="w-48">
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="选择车辆" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部车辆</SelectItem>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.license_plate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="w-48 h-9"
          />
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[100px]">日期</TableHead>
                <TableHead>车辆</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>分类</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead className="max-w-[300px]">说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    暂无流水记录
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map(record => (
                  <TableRow key={record.id} className="hover:bg-muted/50">
                    <TableCell className="text-sm">{format(new Date(record.date), 'MM-dd')}</TableCell>
                    <TableCell className="font-medium">{record.vehicle_plate}</TableCell>
                    <TableCell>
                      {record.type === 'income' ? (
                        <Badge className="bg-green-100 text-green-800">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          收入
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          支出
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
      </div>

      {/* 底部统计 */}
      <div className="border-t bg-card px-6 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            共 {filteredRecords.length} 条流水
          </div>
          <div className="flex gap-4">
            <span className="text-green-600">收入：¥{stats.totalIncome.toFixed(2)}</span>
            <span className="text-red-600">支出：¥{stats.totalExpense.toFixed(2)}</span>
            <span className={stats.balance >= 0 ? 'text-blue-600 font-semibold' : 'text-red-600 font-semibold'}>
              余额：¥{stats.balance.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
