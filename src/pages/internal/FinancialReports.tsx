// PC端 - 财务报表（参考操作日志布局）

import { useState, useEffect } from 'react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/PageHeader';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Truck,
  Users,
  RefreshCw,
  Download,
  Calendar
} from 'lucide-react';

export default function FinancialReports() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    vehicleCount: 0,
    driverCount: 0,
    tripCount: 0
  });

  useEffect(() => {
    loadStats();
  }, [selectedMonth]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${selectedMonth}-01`;
      const nextMonth = new Date(parseInt(year), parseInt(month), 1);
      const endDate = nextMonth.toISOString().slice(0, 10);
      
      // ✅ 1. 查询总收入（从logistics_records）
      const { data: incomeData } = await supabase
        .from('logistics_records')
        .select('payable_cost')
        .gte('loading_date', startDate)
        .lt('loading_date', endDate);
      
      const totalIncome = (incomeData || []).reduce((sum, r) => sum + (r.payable_cost || 0), 0);
      
      // ✅ 2. 查询总支出（从internal_driver_expense_applications）
      const { data: expenseData } = await supabase
        .from('internal_driver_expense_applications')
        .select('amount')
        .eq('status', 'approved')
        .gte('expense_date', startDate)
        .lt('expense_date', endDate);
      
      const totalExpense = (expenseData || []).reduce((sum, r) => sum + (r.amount || 0), 0);
      
      // ✅ 3. 查询车辆数
      const { count: vehicleCount } = await supabase
        .from('internal_vehicles')
        .select('id', { count: 'estimated', head: true })
        .eq('is_active', true);
      
      // ✅ 4. 查询司机数
      const { count: driverCount } = await supabase
        .from('internal_drivers')
        .select('id', { count: 'estimated', head: true });
      
      // ✅ 5. 查询本月运单数
      const { count: tripCount } = await supabase
        .from('logistics_records')
        .select('id', { count: 'estimated', head: true })
        .gte('loading_date', startDate)
        .lt('loading_date', endDate);
      
      setStats({
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense,
        vehicleCount: vehicleCount || 0,
        driverCount: driverCount || 0,
        tripCount: tripCount || 0
      });
    } catch (error) {
      console.error('加载统计失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="财务报表"
        description="内部车辆月度财务分析报表"
        icon={BarChart3}
        iconColor="text-purple-600"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                月度报表
              </CardTitle>
            </div>
            <div className="flex gap-2">
              <Input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-40 h-9"
              />
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />总收入
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">¥{stats.totalIncome.toFixed(0)}</div>
            <p className="text-xs text-green-600 mt-2">本月运费收入</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />总支出
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700">¥{stats.totalExpense.toFixed(0)}</div>
            <p className="text-xs text-red-600 mt-2">本月费用支出</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />净利润
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">¥{stats.netProfit.toFixed(0)}</div>
            <p className="text-xs text-blue-600 mt-2">收入 - 支出</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-600" />车辆数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.vehicleCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />司机数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.driverCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />出车次数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tripCount}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
