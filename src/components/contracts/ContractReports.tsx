// 合同统计报表组件
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  Download, 
  Calendar, 
  DollarSign,
  FileText,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3
} from 'lucide-react';
import { relaxedSupabase as supabase } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface ReportData {
  period: string;
  total_contracts: number;
  total_amount: number;
  active_contracts: number;
  expired_contracts: number;
  expiring_soon: number;
  categories: Record<string, number>;
  departments: Record<string, number>;
  priorities: Record<string, number>;
  monthly_trend: Array<{
    month: string;
    contracts: number;
    amount: number;
  }>;
}

interface ContractReportsProps {
  contractId?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function ContractReports({ contractId }: ContractReportsProps) {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: startOfYear(new Date()),
    end: endOfYear(new Date())
  });
  const [reportType, setReportType] = useState('overview');
  const [exportFormat, setExportFormat] = useState('excel');
  
  const { toast } = useToast();

  useEffect(() => {
    loadReportData();
  }, [dateRange, contractId]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('contracts')
        .select('*')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());

      if (contractId) {
        query = query.eq('id', contractId);
      }

      const { data: contracts, error } = await query;
      if (error) throw error;

      // 处理数据统计
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      const stats: ReportData = {
        period: `${format(dateRange.start, 'yyyy-MM-dd', { locale: zhCN })} 至 ${format(dateRange.end, 'yyyy-MM-dd', { locale: zhCN })}`,
        total_contracts: contracts?.length || 0,
        total_amount: 0,
        active_contracts: 0,
        expired_contracts: 0,
        expiring_soon: 0,
        categories: {},
        departments: {},
        priorities: {},
        monthly_trend: []
      };

      const monthlyData: Record<string, { contracts: number; amount: number }> = {};

      contracts?.forEach((contract: any) => {
        const endDate = new Date(contract.end_date);
        const createdDate = new Date(contract.created_at);
        const monthKey = format(createdDate, 'yyyy-MM');

        // 月度趋势
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { contracts: 0, amount: 0 };
        }
        monthlyData[monthKey].contracts++;
        if (contract.contract_amount) {
          monthlyData[monthKey].amount += parseFloat(String(contract.contract_amount));
        }

        // 状态统计
        if (contract.status === 'archived') {
          // 已归档
        } else if (endDate < now) {
          stats.expired_contracts++;
        } else if (endDate <= thirtyDaysFromNow) {
          stats.expiring_soon++;
        } else {
          stats.active_contracts++;
        }

        // 金额统计
        if (contract.contract_amount) {
          stats.total_amount += parseFloat(String(contract.contract_amount));
        }

        // 分类统计
        const category = contract.category || '未分类';
        stats.categories[category] = (stats.categories[category] || 0) + 1;

        // 部门统计
        const department = contract.department || '未指定';
        stats.departments[department] = (stats.departments[department] || 0) + 1;

        // 优先级统计
        const priority = contract.priority || 'normal';
        stats.priorities[priority] = (stats.priorities[priority] || 0) + 1;
      });

      // 转换月度趋势数据
      stats.monthly_trend = Object.entries(monthlyData)
        .map(([month, data]) => ({
          month: format(new Date(month + '-01'), 'MM月', { locale: zhCN }),
          contracts: data.contracts,
          amount: data.amount
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setReportData(stats);
    } catch (error: any) {
      console.error('加载报表数据失败:', error);
      toast({
        title: "加载失败",
        description: "无法加载报表数据",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    if (!reportData) return;

    try {
      if (exportFormat === 'excel') {
        const wb = XLSX.utils.book_new();
        
        // 概览数据
        const overviewData = [
          ['报表期间', reportData.period],
          ['合同总数', reportData.total_contracts],
          ['合同总额', reportData.total_amount],
          ['有效合同', reportData.active_contracts],
          ['已过期', reportData.expired_contracts],
          ['即将到期', reportData.expiring_soon]
        ];
        
        const overviewWS = XLSX.utils.aoa_to_sheet([
          ['合同统计报表'],
          [],
          ...overviewData
        ]);
        XLSX.utils.book_append_sheet(wb, overviewWS, '概览');

        // 分类统计
        const categoryData = [
          ['分类', '数量'],
          ...Object.entries(reportData.categories)
        ];
        const categoryWS = XLSX.utils.aoa_to_sheet(categoryData);
        XLSX.utils.book_append_sheet(wb, categoryWS, '分类统计');

        // 部门统计
        const departmentData = [
          ['部门', '数量'],
          ...Object.entries(reportData.departments)
        ];
        const departmentWS = XLSX.utils.aoa_to_sheet(departmentData);
        XLSX.utils.book_append_sheet(wb, departmentWS, '部门统计');

        // 月度趋势
        const trendData = [
          ['月份', '合同数量', '合同金额'],
          ...reportData.monthly_trend.map(item => [
            item.month,
            item.contracts,
            item.amount
          ])
        ];
        const trendWS = XLSX.utils.aoa_to_sheet(trendData);
        XLSX.utils.book_append_sheet(wb, trendWS, '月度趋势');

        XLSX.writeFile(wb, `合同统计报表_${format(new Date(), 'yyyyMMdd')}.xlsx`);
      } else {
        // JSON 格式导出
        const dataStr = JSON.stringify(reportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `合同统计报表_${format(new Date(), 'yyyyMMdd')}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }

      toast({
        title: "导出成功",
        description: "报表已成功导出"
      });
    } catch (error: any) {
      toast({
        title: "导出失败",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载报表数据中...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">暂无报表数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              合同统计报表
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportReport}>
                <Download className="h-4 w-4 mr-2" />
                导出报表
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium">开始日期</label>
              <DatePicker
                selected={dateRange.start}
                onSelect={(date) => date && setDateRange(prev => ({ ...prev, start: date }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">结束日期</label>
              <DatePicker
                selected={dateRange.end}
                onSelect={(date) => date && setDateRange(prev => ({ ...prev, end: date }))}
              />
            </div>
            <Button 
              variant="outline" 
              onClick={() => setDateRange({
                start: startOfMonth(subMonths(new Date(), 11)),
                end: endOfMonth(new Date())
              })}
            >
              近12个月
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setDateRange({
                start: startOfYear(new Date()),
                end: endOfYear(new Date())
              })}
            >
              本年度
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 概览统计 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">合同总数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.total_contracts}</div>
            <p className="text-xs text-muted-foreground">
              报表期间内的合同数量
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">合同总额</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(reportData.total_amount)}</div>
            <p className="text-xs text-muted-foreground">
              所有合同的总金额
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">有效合同</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{reportData.active_contracts}</div>
            <p className="text-xs text-muted-foreground">
              正在执行的合同
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">风险合同</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {reportData.expired_contracts + reportData.expiring_soon}
            </div>
            <p className="text-xs text-muted-foreground">
              已过期 {reportData.expired_contracts} + 即将到期 {reportData.expiring_soon}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={reportType} onValueChange={setReportType}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="trend">趋势</TabsTrigger>
          <TabsTrigger value="category">分类</TabsTrigger>
          <TabsTrigger value="department">部门</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* 状态分布饼图 */}
            <Card>
              <CardHeader>
                <CardTitle>合同状态分布</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: '有效合同', value: reportData.active_contracts, color: '#00C49F' },
                        { name: '即将到期', value: reportData.expiring_soon, color: '#FFBB28' },
                        { name: '已过期', value: reportData.expired_contracts, color: '#FF8042' }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        { name: '有效合同', value: reportData.active_contracts, color: '#00C49F' },
                        { name: '即将到期', value: reportData.expiring_soon, color: '#FFBB28' },
                        { name: '已过期', value: reportData.expired_contracts, color: '#FF8042' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 优先级分布 */}
            <Card>
              <CardHeader>
                <CardTitle>优先级分布</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(reportData.priorities).map(([key, value]) => ({
                    priority: key === 'urgent' ? '紧急' : key === 'high' ? '高' : key === 'normal' ? '普通' : '低',
                    count: value
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="priority" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>月度趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={reportData.monthly_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'amount' ? formatCurrency(value as number) : value,
                      name === 'contracts' ? '合同数量' : '合同金额'
                    ]}
                  />
                  <Bar yAxisId="left" dataKey="contracts" fill="#8884d8" name="contracts" />
                  <Line yAxisId="right" type="monotone" dataKey="amount" stroke="#82ca9d" name="amount" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>合同分类统计</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={Object.entries(reportData.categories).map(([key, value]) => ({
                  category: key,
                  count: value
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="department" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>部门分布统计</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={Object.entries(reportData.departments).map(([key, value], index) => ({
                      name: key,
                      value,
                      color: COLORS[index % COLORS.length]
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {Object.entries(reportData.departments).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
