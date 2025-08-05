import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { Loader2 } from "lucide-react";

// --- 类型定义 ---
interface FinancialStats {
  totalReceivables: number; monthlyReceivables: number;
  pendingPayment: number; pendingInvoice: number;
}
interface MonthlyTrendData { month_start: string; total_receivables: number; }
interface PartnerRankingData { partner_name: string; total_payable: number; }
interface ProjectContributionData { project_name: string; total_receivables: number; }

// --- 常量 ---
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

// --- 主组件 ---
export default function FinancialOverview() {
  // --- State 管理 ---
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendData[]>([]);
  const [partnerRanking, setPartnerRanking] = useState<PartnerRankingData[]>([]);
  const [projectContribution, setProjectContribution] = useState<ProjectContributionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- 数据获取 ---
  const fetchAllDataInOneGo = useCallback(async () => {
    setLoading(true);
    setError(null); // 重置错误状态
    try {
      const { data, error: rpcError } = await supabase.rpc('get_financial_overview');
      if (rpcError) throw rpcError;
      if (!data) throw new Error("函数返回了空数据，请检查数据库函数逻辑和权限。");
      
      setStats(data.stats);
      setMonthlyTrend(data.monthlyTrend);
      setPartnerRanking(data.partnerRanking);
      setProjectContribution(data.projectContribution);

    } catch (err: any) {
      console.error("获取财务概览数据失败:", err);
      setError(err.message || "发生未知错误，请检查浏览器控制台。");
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Effect Hook ---
  useEffect(() => {
    fetchAllDataInOneGo();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAllDataInOneGo();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchAllDataInOneGo]);

  // --- 辅助函数 ---
  const formatCurrency = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatCompact = (value: number) => {
    if (value >= 10000) return `¥${(value/10000).toFixed(1)}万`;
    if (value >= 1000) return `¥${(value/1000).toFixed(1)}千`;
    return `¥${value.toFixed(0)}`;
  }

  // --- 派生数据 ---
  const financialStatusData = stats ? [
    { name: '待开票', value: stats.pendingInvoice },
    { name: '待付款', value: stats.pendingPayment },
    { name: '已支付', value: Math.max(0, stats.totalReceivables - stats.pendingInvoice - stats.pendingPayment) },
  ].filter(item => item.value > 0) : [];

  // --- 渲染组件 ---
  if (loading && !stats) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <span className="ml-4 text-lg text-muted-foreground">正在加载财务数据...</span>
      </div>
    );
  }

  if (error) {
      return (
          <div className="flex flex-col justify-center items-center h-screen text-center p-4">
              <h2 className="text-xl font-semibold text-destructive">数据加载失败</h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">无法获取财务概览数据，这可能是由于数据库权限或函数错误导致的。</p>
              <code className="mt-4 p-2 bg-muted text-muted-foreground rounded-md text-xs">{error}</code>
          </div>
      )
  }

  return (
    <div className="space-y-6 p-4 md:p-6 relative">
      {loading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex justify-center items-center z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-foreground">财务概览</h1>
        <p className="text-muted-foreground">运输财务统计分析</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm font-medium">总应收</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats?.totalReceivables || 0)}</div><p className="text-xs text-muted-foreground">所有运单最高级合作方的应付总额</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">本月应收</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats?.monthlyReceivables || 0)}</div><p className="text-xs text-muted-foreground">按装货日期统计的本月应收</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">待付金额</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats?.pendingPayment || 0)}</div><p className="text-xs text-muted-foreground">状态为“待付款(Unpaid)”的应付总额</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">待开票</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats?.pendingInvoice || 0)}</div><p className="text-xs text-muted-foreground">状态为“未开票”的应付总额</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader><CardTitle>月度应收趋势 (最近12个月)</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month_start" /><YAxis tickFormatter={formatCompact} /><Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }} formatter={(value: number) => [formatCurrency(value), '月应收']} /><Legend formatter={() => '月应收金额'} /><Bar dataKey="total_receivables" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>合作方应付金额排名 (Top 10)</CardTitle></CardHeader>
          <CardContent className="h-96">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={partnerRanking} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={formatCompact}/><YAxis dataKey="partner_name" type="category" width={80} tick={{ fontSize: 12 }}/><Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }} formatter={(value: number) => [formatCurrency(value), '应付总额']} /><Bar dataKey="total_payable" fill="#10b981" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>财务状态分布</CardTitle></CardHeader>
          <CardContent className="h-96">
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={financialStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={120} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => { const radius = innerRadius + (outerRadius - innerRadius) * 0.5; const x = cx + radius * Math.cos(-midAngle * Math.PI / 180); const y = cy + radius * Math.sin(-midAngle * Math.PI / 180); return ( <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={14}> {`${(percent * 100).toFixed(0)}%`} </text> ); }}>{financialStatusData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}</Pie><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /></PieChart></ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {projectContribution.length > 0 && (
          <Card>
              <CardHeader><CardTitle>项目应收贡献度</CardTitle></CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={projectContribution} dataKey="total_receivables" nameKey="project_name" cx="50%" cy="50%" outerRadius={150} label={(props) => `${props.project_name} (${formatCompact(props.total_receivables)})`}>{projectContribution.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}</Pie><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /></PieChart></ResponsiveContainer>
              </CardContent>
          </Card>
      )}
    </div>
  );
}
