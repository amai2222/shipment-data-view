// 移动端 - 司机收入查询页面

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useAuth } from '@/contexts/AuthContext';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import {
  DollarSign,
  Calendar,
  TrendingUp,
  FileText,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface SalaryRecord {
  month: string;
  base_salary: number;
  trip_count: number;
  trip_commission: number;
  total_income: number;
  deductions: number;
  net_salary: number;
  status: string;
}

export default function MobileDriverSalary() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [currentMonthIncome, setCurrentMonthIncome] = useState<SalaryRecord | null>(null);
  const [lastMonthIncome, setLastMonthIncome] = useState<SalaryRecord | null>(null);

  useEffect(() => {
    loadSalaryData();
  }, []);

  const loadSalaryData = async () => {
    setLoading(true);
    try {
      // ✅ 使用 RPC 函数查询收入数据（绕过RLS）
      const currentMonth = format(new Date(), 'yyyy-MM');
      const lastMonth = format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'yyyy-MM');
      
      // 查询当月收入
      const { data: currentData, error: currentError } = await supabase.rpc('get_my_salary', {
        p_year_month: currentMonth
      });
      
      if (currentError) throw currentError;
      
      if (currentData && currentData.length > 0) {
        const record = currentData[0];
        setCurrentMonthIncome({
          month: record.year_month,
          base_salary: record.base_salary || 0,
          trip_count: record.trip_count || 0,
          trip_commission: record.trip_commission || 0,
          total_income: record.total_income || 0,
          deductions: record.deductions || 0,
          net_salary: record.net_salary || 0,
          status: record.status || 'calculating'
        });
      }
      
      // 查询上月收入
      const { data: lastData, error: lastError } = await supabase.rpc('get_my_salary', {
        p_year_month: lastMonth
      });
      
      if (lastError) throw lastError;
      
      if (lastData && lastData.length > 0) {
        const record = lastData[0];
        setLastMonthIncome({
          month: record.year_month,
          base_salary: record.base_salary || 0,
          trip_count: record.trip_count || 0,
          trip_commission: record.trip_commission || 0,
          total_income: record.total_income || 0,
          deductions: record.deductions || 0,
          net_salary: record.net_salary || 0,
          status: record.status || 'calculating'
        });
      }
    } catch (error: any) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: error.message || '无法加载收入数据',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">加载中...</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="我的收入">
      <div className="space-y-4 pb-6">
        {/* 当月收入卡片 */}
        {currentMonthIncome && (
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  本月收入
                </span>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  {currentMonthIncome.status === 'paid' ? '已发放' : '核算中'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="text-sm opacity-90 mb-2">应发收入</div>
                  <div className="text-5xl font-bold">
                    ¥{currentMonthIncome.net_salary.toFixed(2)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                  <div>
                    <div className="text-sm opacity-75">基本收入</div>
                    <div className="text-lg font-semibold">¥{currentMonthIncome.base_salary.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-75">出车次数</div>
                    <div className="text-lg font-semibold">{currentMonthIncome.trip_count} 车次</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-75">车次提成</div>
                    <div className="text-lg font-semibold">¥{currentMonthIncome.trip_commission.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-75">费用扣款</div>
                    <div className="text-lg font-semibold">-¥{currentMonthIncome.deductions.toFixed(0)}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 上月工资对比 */}
        {lastMonthIncome && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  上月收入
                </span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {lastMonthIncome.status === 'paid' ? '已发放' : '待发放'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">应发工资</div>
                  <div className="text-2xl font-bold text-green-600">
                    ¥{lastMonthIncome.net_salary.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">出车次数</div>
                  <div className="text-2xl font-bold">{lastMonthIncome.trip_count} 车次</div>
                </div>
              </div>
              
              {/* 环比增长 */}
              {currentMonthIncome && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">环比上月</span>
                    {currentMonthIncome.net_salary > lastMonthIncome.net_salary ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="h-4 w-4" />
                        +¥{(currentMonthIncome.net_salary - lastMonthIncome.net_salary).toFixed(2)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600">
                        <TrendingUp className="h-4 w-4 rotate-180" />
                        -¥{(lastMonthIncome.net_salary - currentMonthIncome.net_salary).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 查看历史记录按钮 */}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => navigate('/m/internal/salary-records')}
        >
          <FileText className="h-4 w-4 mr-2" />
          查看历史工资记录
          <ChevronRight className="h-4 w-4 ml-auto" />
        </Button>

        {/* 工资说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">工资说明</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>• 基本工资：固定月薪</p>
            <p>• 车次提成：按出车次数计算</p>
            <p>• 费用扣款：已审核通过的费用申请</p>
            <p>• 应发工资 = 基本工资 + 车次提成 - 费用扣款</p>
            <p className="pt-2 border-t text-orange-600">
              ⚠️ 工资数据仅供参考，以财务最终核算为准
            </p>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}

