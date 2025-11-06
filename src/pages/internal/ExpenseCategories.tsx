// PC端 - 费用分类统计（桌面完整版）

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import {
  FileText,
  PieChart,
  RefreshCw,
  Download,
  TrendingUp
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
      // 计算月份范围（处理不同月份的天数）
      const [year, month] = selectedMonth.split('-');
      const startDate = `${selectedMonth}-01`;
      const nextMonth = new Date(parseInt(year), parseInt(month), 1); // 下个月1号
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

  if (loading && categories.length === 0) {
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
            <h1 className="text-xl font-semibold">费用分类统计</h1>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">总费用</span>
                <span className="font-semibold text-lg text-primary">¥{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">总笔数</span>
                <span className="font-semibold">{totalCount}</span>
              </div>
            </div>
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
      </div>

      {/* 筛选栏 */}
      <div className="border-b bg-card px-6 py-3">
        <div className="flex gap-3">
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
                <TableHead>费用类别</TableHead>
                <TableHead className="text-center">笔数</TableHead>
                <TableHead className="text-right">总金额</TableHead>
                <TableHead className="text-right">占比</TableHead>
                <TableHead className="w-[200px]">占比图</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
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
      </div>

      {/* 底部统计 */}
      <div className="border-t bg-card px-6 py-3">
        <div className="text-sm text-muted-foreground">
          {selectedMonth} 费用分类统计
        </div>
      </div>
    </div>
  );
}
