import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, TrendingUp, Truck, Package } from "lucide-react";
import { LocalStorage } from "@/utils/storage";
import { LogisticsRecord, DailyTransportStats, DailyCostStats } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const [records, setRecords] = useState<LogisticsRecord[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  // 加载数据
  useEffect(() => {
    setRecords(LocalStorage.getLogisticsRecords());
    
    // 设置默认日期范围（最近7天）
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    setDateRange({
      startDate: sevenDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
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

      {/* 每日运输量统计图表 */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>每日运输量统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTransportStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                  formatter={(value, name) => [`${value} 吨`, name === 'actualTransport' ? '实际运输' : '退货']}
                />
                <Legend formatter={(value) => value === 'actualTransport' ? '实际运输' : '退货'} />
                <Bar dataKey="actualTransport" fill="hsl(217 91% 60%)" name="actualTransport" />
                <Bar dataKey="returns" fill="hsl(38 92% 50%)" name="returns" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 每日运输成本分析图表 */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>每日运输成本分析</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyCostStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                  formatter={(value) => [`¥${Number(value).toFixed(2)}`, '总成本']}
                />
                <Legend formatter={() => '总成本'} />
                <Bar dataKey="totalCost" fill="hsl(142 76% 36%)" name="totalCost" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}