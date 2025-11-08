// 移动端 - 工资发放记录（历史查询）

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Loader2,
  CheckCircle,
  Clock
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface SalaryRecord {
  year_month: string;
  base_salary: number;
  trip_count: number;
  trip_commission: number;
  total_income: number;
  deductions: number;
  net_salary: number;
  status: string;
  payment_date: string | null;
}

export default function MobileSalaryRecords() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    loadSalaryRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const loadSalaryRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_my_salary', {
        p_year_month: selectedMonth || null
      });
      
      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: '无法加载工资记录',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 生成最近12个月的选项
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const date = subMonths(new Date(), i);
    const yearMonth = format(date, 'yyyy-MM');
    monthOptions.push({
      value: yearMonth,
      label: format(date, 'yyyy年MM月', { locale: zhCN })
    });
  }

  const totalEarned = records.reduce((sum, r) => sum + r.net_salary, 0);
  const avgSalary = records.length > 0 ? totalEarned / records.length : 0;

  return (
    <MobileLayout>
      <div className="space-y-4 pb-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-blue-600 mb-1">累计收入</div>
              <div className="text-2xl font-bold text-blue-700">
                ¥{totalEarned.toFixed(0)}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4 text-center">
              <div className="text-xs text-green-600 mb-1">月均工资</div>
              <div className="text-2xl font-bold text-green-700">
                ¥{avgSalary.toFixed(0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 筛选器 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">查询月份：</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="最近3个月" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">最近3个月</SelectItem>
                  {monthOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 工资记录列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              工资明细
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                暂无工资记录
              </div>
            ) : (
              records.map((record, index) => {
                const prevRecord = index < records.length - 1 ? records[index + 1] : null;
                const salaryChange = prevRecord ? record.net_salary - prevRecord.net_salary : 0;
                
                return (
                  <Card key={record.year_month} className="border-2">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* 月份和状态 */}
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">
                            {format(new Date(record.year_month + '-01'), 'yyyy年MM月', { locale: zhCN })}
                          </div>
                          <Badge className={
                            record.status === 'paid' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }>
                            {record.status === 'paid' ? (
                              <><CheckCircle className="h-3 w-3 mr-1" />已发放</>
                            ) : (
                              <><Clock className="h-3 w-3 mr-1" />核算中</>
                            )}
                          </Badge>
                        </div>
                        
                        {/* 实发工资 */}
                        <div className="text-center py-2 bg-blue-50 rounded">
                          <div className="text-sm text-blue-600 mb-1">实发工资</div>
                          <div className="text-3xl font-bold text-blue-700">
                            ¥{record.net_salary.toFixed(2)}
                          </div>
                          {prevRecord && (
                            <div className="text-xs mt-1">
                              {salaryChange > 0 ? (
                                <span className="text-green-600 flex items-center justify-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  环比上月 +¥{salaryChange.toFixed(0)}
                                </span>
                              ) : salaryChange < 0 ? (
                                <span className="text-red-600 flex items-center justify-center gap-1">
                                  <TrendingDown className="h-3 w-3" />
                                  环比上月 -¥{Math.abs(salaryChange).toFixed(0)}
                                </span>
                              ) : (
                                <span className="text-gray-600">环比持平</span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* 明细 */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-muted-foreground">基本工资</div>
                            <div className="font-medium">¥{record.base_salary.toFixed(0)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">出车次数</div>
                            <div className="font-medium">{record.trip_count} 车次</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">车次提成</div>
                            <div className="font-medium text-green-600">+¥{record.trip_commission.toFixed(0)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">费用扣款</div>
                            <div className="font-medium text-red-600">-¥{record.deductions.toFixed(0)}</div>
                          </div>
                        </div>
                        
                        {record.payment_date && (
                          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                            发放日期：{format(new Date(record.payment_date), 'yyyy-MM-dd')}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* 说明 */}
        <Card>
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
            <p>• 工资数据仅供参考，以财务最终核算为准</p>
            <p>• 实发工资 = 基本工资 + 车次提成 - 费用扣款</p>
            <p>• 已发放：工资已转入您的银行账户</p>
            <p>• 核算中：工资正在核算，尚未发放</p>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}

