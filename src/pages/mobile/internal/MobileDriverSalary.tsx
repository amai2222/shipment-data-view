// 移动端 - 司机工资查询页面

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
  const [currentMonthSalary, setCurrentMonthSalary] = useState<SalaryRecord | null>(null);
  const [lastMonthSalary, setLastMonthSalary] = useState<SalaryRecord | null>(null);

  useEffect(() => {
    loadSalaryData();
  }, []);

  const loadSalaryData = async () => {
    setLoading(true);
    try {
      // ✅ 调用真实的数据库查询
      const currentMonth = format(new Date(), 'yyyy-MM');
      const lastMonth = format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'yyyy-MM');
      
      // 获取当前司机ID
      const { data: driverData } = await supabase
        .from('internal_drivers')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();
      
      if (!driverData) {
        throw new Error('未找到司机档案');
      }
      
      // 查询当月工资
      const { data: currentData } = await supabase
        .from('internal_driver_monthly_salary')
        .select('*')
        .eq('driver_id', driverData.id)
        .eq('year_month', currentMonth)
        .single();
      
      if (currentData) {
        setCurrentMonthSalary({
          month: currentData.year_month,
          base_salary: currentData.base_salary || 0,
          trip_count: currentData.trip_count || 0,
          trip_commission: currentData.trip_commission || 0,
          total_income: currentData.total_income || 0,
          deductions: currentData.deductions || 0,
          net_salary: currentData.net_salary || 0,
          status: currentData.status || 'calculating'
        });
      }
      
      // 查询上月工资
      const { data: lastData } = await supabase
        .from('internal_driver_monthly_salary')
        .select('*')
        .eq('driver_id', driverData.id)
        .eq('year_month', lastMonth)
        .single();
      
      if (lastData) {
        setLastMonthSalary({
          month: lastData.year_month,
          base_salary: lastData.base_salary || 0,
          trip_count: lastData.trip_count || 0,
          trip_commission: lastData.trip_commission || 0,
          total_income: lastData.total_income || 0,
          deductions: lastData.deductions || 0,
          net_salary: lastData.net_salary || 0,
          status: lastData.status || 'paid'
        });
      }
    } catch (error: any) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: error.message || '无法加载工资数据',
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
    <MobileLayout>
      <div className="space-y-4 pb-6">
        {/* 当月工资卡片 */}
        {currentMonthSalary && (
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  本月工资
                </span>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  {currentMonthSalary.status === 'paid' ? '已发放' : '核算中'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="text-sm opacity-90 mb-2">应发工资</div>
                  <div className="text-5xl font-bold">
                    ¥{currentMonthSalary.net_salary.toFixed(2)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                  <div>
                    <div className="text-sm opacity-75">基本工资</div>
                    <div className="text-lg font-semibold">¥{currentMonthSalary.base_salary.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-75">出车次数</div>
                    <div className="text-lg font-semibold">{currentMonthSalary.trip_count} 车次</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-75">车次提成</div>
                    <div className="text-lg font-semibold">¥{currentMonthSalary.trip_commission.toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-75">费用扣款</div>
                    <div className="text-lg font-semibold">-¥{currentMonthSalary.deductions.toFixed(0)}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 上月工资对比 */}
        {lastMonthSalary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  上月工资
                </span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {lastMonthSalary.status === 'paid' ? '已发放' : '待发放'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">应发工资</div>
                  <div className="text-2xl font-bold text-green-600">
                    ¥{lastMonthSalary.net_salary.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">出车次数</div>
                  <div className="text-2xl font-bold">{lastMonthSalary.trip_count} 车次</div>
                </div>
              </div>
              
              {/* 环比增长 */}
              {currentMonthSalary && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">环比上月</span>
                    {currentMonthSalary.net_salary > lastMonthSalary.net_salary ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="h-4 w-4" />
                        +¥{(currentMonthSalary.net_salary - lastMonthSalary.net_salary).toFixed(2)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600">
                        <TrendingUp className="h-4 w-4 rotate-180" />
                        -¥{(lastMonthSalary.net_salary - currentMonthSalary.net_salary).toFixed(2)}
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

