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
import { PaginationControl } from '@/components/common';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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

      // ✅ 为每个车辆查询真实的收支数据
      interface Vehicle {
        license_plate: string;
      }

      const balanceData: VehicleBalance[] = await Promise.all(
        (vehicles || []).map(async (v: Vehicle) => {
          // 查询该车辆的运费收入
          const { data: incomeData } = await supabase
            .from('logistics_records')
            .select('payable_cost')
            .eq('license_plate', v.license_plate);
          
          const total_income = (incomeData || []).reduce((sum, r) => sum + (r.payable_cost || 0), 0);
          
          // 查询该车辆司机的费用支出（通过司机姓名关联）
          const driverName = v.driver?.[0]?.driver?.name;
          let total_expense = 0;
          
          if (driverName) {
            const { data: expenseData } = await supabase
              .from('internal_driver_expense_applications')
              .select('amount')
              .eq('driver_name', driverName)
              .eq('status', 'approved');
            
            total_expense = (expenseData || []).reduce((sum, r) => sum + (r.amount || 0), 0);
          }
          
          return {
            vehicle_id: v.id,
            license_plate: v.license_plate,
            total_income,
            total_expense,
            balance: total_income - total_expense,
            driver_name: driverName || null
          };
        })
      );

      setBalances(balanceData);
    } catch (error) {
      console.error('加载余额失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载车辆余额',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const totalIncome = balances.reduce((sum, b) => sum + b.total_income, 0);
  const totalExpense = balances.reduce((sum, b) => sum + b.total_expense, 0);
  const totalBalance = balances.reduce((sum, b) => sum + b.balance, 0);

  const paginatedBalances = balances.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(balances.length / pageSize);
  
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // 重置到第一页
  };

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
            <PaginationControl
              currentPage={currentPage}
              pageSize={pageSize}
              totalPages={totalPages}
              totalCount={balances.length}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
