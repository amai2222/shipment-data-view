import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, TrendingUp, Truck, Package } from "lucide-react";
import { LocalStorage } from "@/utils/storage";
import { LogisticsRecord, DailyTransportStats, DailyCostStats } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

// 每日运输次数统计
interface DailyCountStats {
  date: string;
  count: number;
}

export default function Dashboard() {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  // 加载数据
  useEffect(() => {
    const allRecords = LocalStorage.getLogisticsRecords();
    setRecords(allRecords);
    
    // 设置默认日期范围（2024年7月，因为数据是7月的）
    const startDate = "2024-07-01";
    const endDate = "2024-07-31";
    
    setDateRange({
      startDate,
      endDate,
    });
  }, []);

  // 根据日期范围过滤记录
  const filteredRecords = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return records;
    
    return records.filter(record => {
      const recordDate = new Date(record.loadingTime).toISOString().split('T')[0];
      return recordDate >= dateRange.startDate && recordDate <= dateRange.endDate;
    });
  }, [records, dateRange]);

  // 每日运输量统计
  const dailyTransportStats: DailyTransportStats[] = useMemo(() => {
    const statsMap = new Map<string, { actualTransport: number; returns: number }>();
    
    filteredRecords.forEach(record => {
      const date = new Date(record.loadingTime).toISOString().split('T')[0];
      const current = statsMap.get(date) || { actualTransport: 0, returns: 0 };
      
      if (record.transportType === "实际运输") {
        current.actualTransport += record.loadingWeight;
      } else {
        current.returns += record.loadingWeight;
      }
      
      statsMap.set(date, current);
    });
    
    return Array.from(statsMap.entries()).map(([date, stats]) => ({
      date,
      ...stats,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRecords]);

  // 每日成本统计
  const dailyCostStats: DailyCostStats[] = useMemo(() => {
    const statsMap = new Map<string, number>();
    
    filteredRecords.forEach(record => {
      const date = new Date(record.loadingTime).toISOString().split('T')[0];
      const current = statsMap.get(date) || 0;
      const cost = (record.currentCost || 0) + (record.extraCost || 0);
      statsMap.set(date, current + cost);
    });
    
    return Array.from(statsMap.entries()).map(([date, totalCost]) => ({
      date,
      totalCost,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRecords]);

  // 每日运输次数统计
  const dailyCountStats: DailyCountStats[] = useMemo(() => {
    const statsMap = new Map<string, number>();
    
    filteredRecords.forEach(record => {
      const date = new Date(record.loadingTime).toISOString().split('T')[0];
      const current = statsMap.get(date) || 0;
      statsMap.set(date, current + 1);
    });
    
    return Array.from(statsMap.entries()).map(([date, count]) => ({
      date,
      count,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRecords]);

  // 统计概览
  const overviewStats = useMemo(() => {
    const totalRecords = filteredRecords.length;
    const totalWeight = filteredRecords.reduce((sum, record) => sum + record.loadingWeight, 0);
    const totalCost = filteredRecords.reduce((sum, record) => 
      sum + (record.currentCost || 0) + (record.extraCost || 0), 0);
    const actualTransportCount = filteredRecords.filter(r => r.transportType === "实际运输").length;
    
    return {
      totalRecords,
      totalWeight,
      totalCost,
      actualTransportCount,
      returnCount: totalRecords - actualTransportCount,
    };
  }, [filteredRecords]);

  // 计算图例显示的汇总数据
  const legendTotals = useMemo(() => {
    const actualTransportTotal = dailyTransportStats.reduce((sum, day) => sum + day.actualTransport, 0);
    const returnsTotal = dailyTransportStats.reduce((sum, day) => sum + day.returns, 0);
    const totalCostSum = dailyCostStats.reduce((sum, day) => sum + day.totalCost, 0);
    const totalTrips = dailyCountStats.reduce((sum, day) => sum + day.count, 0);
    
    return {
      actualTransportTotal,
      returnsTotal,
      totalCostSum,
      totalTrips,
    };
  }, [dailyTransportStats, dailyCostStats, dailyCountStats]);

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="bg-gradient-primary p-6 rounded-lg shadow-primary text-primary-foreground">
        <h1 className="text-2xl font-bold mb-2 flex items-center">
          <BarChart3 className="mr-2" />
          数据看板
        </h1>
        <p className="opacity-90">运输数据统计分析与可视化</p>
      </div>

      {/* 日期筛选器 */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>数据筛选</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">开始日期</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({...prev, startDate: e.target.value}))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">结束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({...prev, endDate: e.target.value}))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-card">
          <CardContent className="flex items-center p-6">
            <div className="p-2 bg-blue-100 rounded-lg mr-4">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">总运输次数</p>
              <p className="text-2xl font-bold">{overviewStats.totalRecords}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="flex items-center p-6">
            <div className="p-2 bg-green-100 rounded-lg mr-4">
              <Truck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">总运输重量</p>
              <p className="text-2xl font-bold">{overviewStats.totalWeight.toFixed(1)}吨</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="flex items-center p-6">
            <div className="p-2 bg-yellow-100 rounded-lg mr-4">
              <TrendingUp className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">总运输成本</p>
              <p className="text-2xl font-bold">¥{overviewStats.totalCost.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="flex items-center p-6">
            <div className="p-2 bg-purple-100 rounded-lg mr-4">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">实际运输/退货</p>
              <p className="text-2xl font-bold">{overviewStats.actualTransportCount}/{overviewStats.returnCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 每日运输量统计图表 - 按模板样式 */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>每日运输量统计 (吨)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={dailyTransportStats}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                  }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis 
                  domain={[0, 'dataMax + 20']}
                  tickFormatter={(value) => value.toString()}
                />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                  formatter={(value, name) => {
                    const label = name === 'actualTransport' ? '有效运输量' : '退货量';
                    return [`${Number(value).toFixed(2)}`, label];
                  }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
                <Legend 
                  formatter={(value) => {
                    if (value === 'actualTransport') {
                      return `有效运输量 (${legendTotals.actualTransportTotal.toFixed(1)}吨)`;
                    }
                    return `退货量 (${legendTotals.returnsTotal.toFixed(1)}吨)`;
                  }}
                  wrapperStyle={{ 
                    paddingTop: '20px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                />
                <Bar 
                  dataKey="actualTransport" 
                  fill="#4ade80" 
                  name="actualTransport"
                  radius={[2, 2, 0, 0]}
                  label={{
                    position: 'top',
                    fontSize: 12,
                    fill: '#374151',
                    formatter: (value: number) => value.toFixed(1)
                  }}
                />
                <Bar 
                  dataKey="returns" 
                  fill="#ef4444" 
                  name="returns"
                  radius={[2, 2, 0, 0]}
                  label={{
                    position: 'top',
                    fontSize: 12,
                    fill: '#374151',
                    formatter: (value: number) => value.toFixed(1)
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 镇赉-大安运输日报 - 折线图 */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>
            镇赉-大安运输日报 ({dateRange.startDate} 至 {dateRange.endDate})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={dailyCountStats}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                  }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis 
                  domain={[0, 'dataMax + 1']}
                  tickFormatter={(value) => value.toString()}
                />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                  formatter={(value) => [`${value} 次`, '运输次数']}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
                <Legend 
                  formatter={() => `运输次数 (总计${legendTotals.totalTrips}次)`}
                  wrapperStyle={{ 
                    paddingTop: '20px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#3b82f6' }}
                  label={{
                    position: 'top',
                    fontSize: 12,
                    fill: '#374151',
                    formatter: (value: number) => value.toString()
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 每日运输成本分析图表 */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>每日运输成本分析 (元)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={dailyCostStats}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                  }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis 
                  tickFormatter={(value) => `¥${(value/1000).toFixed(1)}k`}
                />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                  formatter={(value) => [`¥${Number(value).toFixed(2)}`, '总成本']}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
                <Legend 
                  formatter={() => `总成本 (¥${legendTotals.totalCostSum.toLocaleString('zh-CN', { maximumFractionDigits: 0 })})`}
                  wrapperStyle={{ 
                    paddingTop: '20px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                />
                <Bar 
                  dataKey="totalCost" 
                  fill="#10b981" 
                  name="totalCost"
                  radius={[2, 2, 0, 0]}
                  label={{
                    position: 'top',
                    fontSize: 12,
                    fill: '#374151',
                    formatter: (value: number) => `¥${(value/1000).toFixed(1)}k`
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}