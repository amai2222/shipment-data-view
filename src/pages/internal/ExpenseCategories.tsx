// PC端 - 费用分类统计（参考操作日志布局）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  FileText,
  PieChart,
  RefreshCw,
  Download
} from 'lucide-react';
import { format } from 'date-fns';

interface ExpenseCategory {
  category: string;
  category_label: string;
  count: number;
  total_amount: number;
  percentage: number;
}

const EXPENSE_TYPES: Record<string, string> = {
  fuel: '🛢️ 加油费',
  parking: '🅿️ 停车费',
  toll: '🛣️ 过路费',
  maintenance: '🔧 维修费',
  fine: '⚠️ 罚款',
  meal: '🍔 餐费',
  accommodation: '🏨 住宿费',
  other: '📝 其他'
};

export default function ExpenseCategories() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    loadCategories();
  }, [selectedMonth]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${selectedMonth}-01`;
      const nextMonth = new Date(parseInt(year), parseInt(month), 1);
      const endDate = nextMonth.toISOString().slice(0, 10);
      
      const { data, error } = await supabase
        .from('internal_driver_expense_applications')
        .select('expense_type, amount')
        .gte('expense_date', startDate)
        .lt('expense_date', endDate);

      if (error) throw error;

      const categoryMap = new Map<string, { count: number; total: number }>();
      
      (data || []).forEach(item => {
        const existing = categoryMap.get(item.expense_type) || { count: 0, total: 0 };
        existing.count += 1;
        existing.total += item.amount;
        categoryMap.set(item.expense_type, existing);
      });

      const totalAmount = Array.from(categoryMap.values()).reduce((sum, v) => sum + v.total, 0);

      const categoryList: ExpenseCategory[] = Array.from(categoryMap.entries()).map(([type, stats]) => ({
        category: type,
        category_label: EXPENSE_TYPES[type] || type,
        count: stats.count,
        total_amount: stats.total,
        percentage: totalAmount > 0 ? (stats.total / totalAmount) * 100 : 0
      }));

      categoryList.sort((a, b) => b.total_amount - a.total_amount);
      setCategories(categoryList);
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = categories.reduce((sum, c) => sum + c.total_amount, 0);
  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="p-4 space-y-4">
      <PageHeader
        title="费用分类统计"
        description="按类别统计分析费用支出情况"
        icon={PieChart}
        iconColor="text-purple-600"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                费用分析
              </CardTitle>
              <CardDescription>
                总费用 ¥{totalAmount.toFixed(2)} | 总笔数 {totalCount}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadCategories} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div>
            <Label>选择月份</Label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-48 h-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>分类明细</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>费用类别</TableHead>
                  <TableHead className="text-center">笔数</TableHead>
                  <TableHead className="text-right">总金额</TableHead>
                  <TableHead className="text-right">占比</TableHead>
                  <TableHead className="w-[200px]">占比图</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      本月暂无费用数据
                    </TableCell>
                  </TableRow>
                ) : (
                  categories.map((cat, index) => (
                    <TableRow key={index} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{cat.category_label}</TableCell>
                      <TableCell className="text-center">{cat.count}笔</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        ¥{cat.total_amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">{cat.percentage.toFixed(1)}%</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-blue-600 h-full rounded-full transition-all"
                              style={{ width: `${cat.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
