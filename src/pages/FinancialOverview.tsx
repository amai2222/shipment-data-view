import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// 从项目中正确的位置导入已经初始化好的 supabase 客户端
import { supabase } from "@/integrations/supabase/client";

// 用于存储卡片数据的状态类型
interface FinancialStats {
  totalReceivables: number;
  monthlyReceivables: number;
  pendingPayment: number;
  pendingInvoice: number;
}

export default function FinancialOverview() {
  const [stats, setStats] = useState<FinancialStats>({
    totalReceivables: 0,
    monthlyReceivables: 0,
    pendingPayment: 0,
    pendingInvoice: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFinancialStats = async () => {
      setLoading(true);

      try {
        // 并行调用所有四个 RPC 函数以提高性能
        const [
          { data: totalReceivables, error: totalError },
          { data: monthlyReceivables, error: monthlyError },
          { data: pendingPayment, error: pendingError },
          { data: pendingInvoice, error: invoiceError }
        ] = await Promise.all([
          supabase.rpc('get_total_receivables'),
          supabase.rpc('get_monthly_receivables'),
          supabase.rpc('get_pending_payments'),
          supabase.rpc('get_pending_invoicing')
        ]);

        // 统一错误处理
        if (totalError) throw totalError;
        if (monthlyError) throw monthlyError;
        if (pendingError) throw pendingError;
        if (invoiceError) throw invoiceError;

        // 更新状态
        setStats({
          totalReceivables: totalReceivables || 0,
          monthlyReceivables: monthlyReceivables || 0,
          pendingPayment: pendingPayment || 0,
          pendingInvoice: pendingInvoice || 0,
        });

      } catch (error) {
        console.error("获取财务数据失败:", error);
        // 您可以在这里添加更友好的用户错误提示，例如使用 Toaster
      } finally {
        setLoading(false);
      }
    };

    fetchFinancialStats();
  }, []);

  // 格式化货币显示的辅助函数
  const formatCurrency = (value: number) => {
    if (loading) {
        // 显示一个加载动画，提升用户体验
        return <span className="animate-pulse">计算中...</span>;
    }
    return `¥${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">财务概览</h1>
        <p className="text-muted-foreground">运输财务统计分析</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* 卡片1: 总应收 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应收</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalReceivables)}</div>
            <p className="text-xs text-muted-foreground">所有运单最高级合作方的应付总额</p>
          </CardContent>
        </Card>
        
        {/* 卡片2: 本月应收 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月应收</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.monthlyReceivables)}</div>
            <p className="text-xs text-muted-foreground">本月运单最高级合作方的应付总额</p>
          </C
