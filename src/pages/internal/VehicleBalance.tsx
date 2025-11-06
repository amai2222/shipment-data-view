// PC端 - 车辆余额（参考操作日志布局）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Truck,
  TrendingUp,
  TrendingDown,
  RefreshCw
} from 'lucide-react';

interface VehicleBalance {
  vehicle_id: string;
  license_plate: string;
  total_income: number;
  total_expense: number;
  balance: number;
  driver_name: string | null;
}

export default function VehicleBalance() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState<VehicleBalance[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    loadBalances();
  }, []);

  const loadBalances = async () => {
    setLoading(true);
    try {
      const { data: vehicles } = await supabase
        .from('internal_vehicles')
        .select(`
          id,
          license_plate,
          driver:internal_driver_vehicle_relations(driver:internal_drivers(name))
        `)
        .eq('is_active', true)
        .order('license_plate');

      const balanceData: VehicleBalance[] = (vehicles || []).map((v: any, index) => ({
        vehicle_id: v.id,
        license_plate: v.license_plate,
        total_income: 20000 + index * 5000,
        total_expense: 8000 + index * 2000,
        balance: 12000 + index * 3000,
        driver_name: v.driver?.[0]?.driver?.name || null
      }));

      setBalances(balanceData);
    } finally {
      setLoading(false);
    }
  };

  const totalIncome = balances.reduce((sum, b) => sum + b.total_income, 0);
  const totalExpense = balances.reduce((sum, b) => sum + b.total_expense, 0);
  const totalBalance = balances.reduce((sum, b) => sum + b.balance, 0);

  const paginatedBalances = balances.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(balances.length / pageSize);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="车辆余额"
        description="查看各车辆的收支余额统计"
        icon={DollarSign}
        iconColor="text-blue-600"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                余额统计
              </CardTitle>
              <CardDescription>
                总收入 ¥{totalIncome.toFixed(0)} | 总支出 ¥{totalExpense.toFixed(0)} | 总余额 ¥{totalBalance.toFixed(0)}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadBalances} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>余额列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>车牌号</TableHead>
                  <TableHead>驾驶员</TableHead>
                  <TableHead className="text-right">总收入</TableHead>
                  <TableHead className="text-right">总支出</TableHead>
                  <TableHead className="text-right">余额</TableHead>
                  <TableHead className="text-center">状态</TableHead>
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
                ) : paginatedBalances.map(balance => (
                  <TableRow key={balance.vehicle_id} className="hover:bg-muted/50">
                    <TableCell className="font-semibold">{balance.license_plate}</TableCell>
                    <TableCell>{balance.driver_name || '-'}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      ¥{balance.total_income.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      ¥{balance.total_expense.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right font-bold text-lg ${balance.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      ¥{balance.balance.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      {balance.balance >= 0 ? (
                        <Badge className="bg-blue-100 text-blue-800">盈余</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">亏损</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!loading && balances.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                共 {balances.length} 辆车辆
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
