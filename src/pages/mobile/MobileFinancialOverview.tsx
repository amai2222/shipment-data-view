import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Loader2, TrendingUp, Banknote, CreditCard, FileText } from "lucide-react";
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { MobileCard } from '@/components/mobile/MobileCard';
import { useToast } from "@/hooks/use-toast";

interface FinancialStats {
  totalReceivables: number;
  monthlyReceivables: number;
  pendingPayment: number;
  pendingInvoice: number;
}

interface MonthlyTrendData {
  month_start: string;
  total_receivables: number;
}

interface PartnerRankingData {
  partner_name: string;
  total_payable: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function MobileFinancialOverview() {
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendData[]>([]);
  const [partnerRanking, setPartnerRanking] = useState<PartnerRankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 获取基础统计数据
      const [totalReceivables, monthlyReceivables, pendingPayment, pendingInvoice] = await Promise.all([
        supabase.rpc('get_total_receivables'),
        supabase.rpc('get_monthly_receivables'),
        supabase.rpc('get_pending_payments'),
        supabase.rpc('get_pending_invoicing')
      ]);
      
      setStats({
        totalReceivables: totalReceivables.data || 0,
        monthlyReceivables: monthlyReceivables.data || 0,
        pendingPayment: pendingPayment.data || 0,
        pendingInvoice: pendingInvoice.data || 0
      });

      // 获取月度趋势数据（最近6个月）
      const { data: trendsData } = await supabase.rpc('get_monthly_trends');
      setMonthlyTrend((trendsData || []).slice(-6));

      // 获取合作方排名数据（前5名）
      const { data: rankingData } = await supabase.rpc('get_partner_ranking');
      setPartnerRanking((rankingData || []).slice(0, 5));
    } catch (err: any) {
      console.error("获取财务概览数据失败:", err);
      setError(err.message || "发生未知错误");
      toast({
        title: "数据加载失败",
        description: "无法加载财务数据",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const formatCurrency = (value: number | null | undefined) => 
    `¥${(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const formatCompact = (value: number) => {
    if (value >= 10000) return `¥${(value/10000).toFixed(1)}万`;
    if (value >= 1000) return `¥${(value/1000).toFixed(1)}千`;
    return `¥${value.toFixed(0)}`;
  };

  // 财务状态分布数据
  const financialStatusData = stats ? [
    { name: '待开票', value: stats.pendingInvoice },
    { name: '待付款', value: stats.pendingPayment },
    { name: '已支付', value: Math.max(0, stats.totalReceivables - stats.pendingInvoice - stats.pendingPayment) }
  ].filter(item => item.value > 0) : [];

  if (loading && !stats) {
    return (
      <MobileLayout>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MobileLayout>
    );
  }

  if (error) {
    return (
      <MobileLayout>
        <MobileCard>
          <CardContent className="text-center py-8">
            <h2 className="text-lg font-semibold text-destructive mb-2">数据加载失败</h2>
            <p className="text-sm text-muted-foreground">无法获取财务概览数据</p>
          </CardContent>
        </MobileCard>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <MobileCard>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              财务概览
            </CardTitle>
            <p className="text-sm text-muted-foreground">运输财务统计分析</p>
          </CardHeader>
        </MobileCard>

        {/* 核心指标 */}
        <div className="grid grid-cols-2 gap-3">
          <MobileCard>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Banknote className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">总应收</p>
                  <p className="text-sm font-bold">{formatCurrency(stats?.totalReceivables || 0)}</p>
                </div>
              </div>
            </CardContent>
          </MobileCard>

          <MobileCard>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">本月应收</p>
                  <p className="text-sm font-bold">{formatCurrency(stats?.monthlyReceivables || 0)}</p>
                </div>
              </div>
            </CardContent>
          </MobileCard>

          <MobileCard>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <CreditCard className="h-4 w-4 text-yellow-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">待付金额</p>
                  <p className="text-sm font-bold">{formatCurrency(stats?.pendingPayment || 0)}</p>
                </div>
              </div>
            </CardContent>
          </MobileCard>

          <MobileCard>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText className="h-4 w-4 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">待开票</p>
                  <p className="text-sm font-bold">{formatCurrency(stats?.pendingInvoice || 0)}</p>
                </div>
              </div>
            </CardContent>
          </MobileCard>
        </div>

        {/* 月度应收趋势 */}
        <MobileCard>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">月度应收趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month_start" 
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}月`;
                    }}
                    fontSize={12}
                  />
                  <YAxis tickFormatter={formatCompact} fontSize={12} />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), '应收款']}
                    labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
                  />
                  <Bar dataKey="total_receivables" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </MobileCard>

        {/* 财务状态分布 */}
        {financialStatusData.length > 0 && (
          <MobileCard>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">财务状态分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={financialStatusData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={40} 
                      outerRadius={80}
                      labelLine={false}
                      label={({ name, percent }) => `${name}\n${(percent * 100).toFixed(0)}%`}
                      fontSize={12}
                    >
                      {financialStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </MobileCard>
        )}

        {/* 合作方应付排名 */}
        {partnerRanking.length > 0 && (
          <MobileCard>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">合作方应付排名 (Top 5)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {partnerRanking.map((partner, index) => (
                  <div key={partner.partner_name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                        {index + 1}
                      </div>
                      <span className="text-sm font-medium truncate">{partner.partner_name}</span>
                    </div>
                    <span className="text-sm font-bold text-primary">
                      {formatCurrency(partner.total_payable)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </MobileCard>
        )}
      </div>
    </MobileLayout>
  );
}