// 文件路径: src/components/business/BusinessEntrySummary.tsx
// 【终极加固版 v2】- 采用最直接的 null/undefined 检查，确保不再崩溃

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, Landmark, List, Layers } from "lucide-react";

interface SummaryData {
  totalWeight: number;
  totalCost: number;
  totalRecords: number;
}

interface BusinessEntrySummaryProps {
  summary?: SummaryData; // 将 prop 标记为可选
  totalDbRecords: number;
}

export function BusinessEntrySummary({ summary, totalDbRecords }: BusinessEntrySummaryProps) {
  
  // 【核心修复】: 在组件的最开始进行最直接、最可靠的检查。
  // 如果 summary prop 不存在 (是 null 或 undefined), 我们就无法渲染任何有意义的东西。
  // 直接返回一个安全的“加载中”或“空”状态的UI，而不是继续向下执行，从而避免崩溃。
  if (!summary) {
    // 渲染一个安全的占位符UI
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/2"></div>
              <div className="h-3 bg-muted rounded w-full mt-2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // 只有在确保 summary 存在的情况下，才执行下面的渲染逻辑
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">数据库总记录数</CardTitle>
          <Layers className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{(totalDbRecords || 0).toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">符合筛选条件的记录总数</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">当前页记录数</CardTitle>
           <List className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{(summary.totalRecords || 0).toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">当前页面上显示的记录条数</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">当前页总重量 (吨)</CardTitle>
          <Scale className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {/* 现在这里的 `summary` 绝对不可能是 undefined */}
          <div className="text-2xl font-bold">{(summary.totalWeight || 0).toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">当前页所有记录的装货重量合计</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">当前页总金额 (元)</CardTitle>
          <Landmark className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">¥{(summary.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground">当前页所有记录的运费金额合计</p>
        </CardContent>
      </Card>
    </div>
  );
}
