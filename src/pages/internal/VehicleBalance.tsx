// PC端 - 车辆余额（桌面完整版）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
          driver:internal_driver_vehicle_relations(
            driver:internal_drivers(name)
          )
        `)
        .eq('is_active', true)
        .order('license_plate');

      // 模拟余额数据
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

  if (loading) {
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
            <h1 className="text-xl font-semibold">车辆余额</h1>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">总收入</span>
                <span className="font-semibold text-green-600">¥{totalIncome.toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-muted-foreground">总支出</span>
                <span className="font-semibold text-red-600">¥{totalExpense.toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="text-muted-foreground">总余额</span>
                <span className="font-semibold text-blue-600 text-lg">¥{totalBalance.toFixed(0)}</span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadBalances} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>车牌号</TableHead>
                <TableHead>驾驶员</TableHead>
                <TableHead className="text-right">总收入</TableHead>
                <TableHead className="text-right">总支出</TableHead>
                <TableHead className="text-right">余额</TableHead>
                <TableHead className="text-center">状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map(balance => (
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
      </div>

      {/* 底部统计 */}
      <div className="border-t bg-card px-6 py-3">
        <div className="text-sm text-muted-foreground">
          共 {balances.length} 辆车辆
        </div>
      </div>
    </div>
  );
}
