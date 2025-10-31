import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Weight, DollarSign, Briefcase } from "lucide-react";

interface SummaryData {
  totalRecords: number;
  totalWeight: number;
  totalAmount: number;
  selfRecords: number;
  selfWeight: number;
  selfAmount: number;
  subordinatesRecords: number;
  subordinatesWeight: number;
  subordinatesAmount: number;
  activeProjects: number;
  activeDrivers: number;
}

interface ShipperStatsCardsProps {
  summary: SummaryData;
}

// 格式化数字
const formatNumber = (num: number) => {
  if (num >= 10000) return `${(num / 10000).toFixed(2)}万`;
  return num.toLocaleString('zh-CN');
};

// 格式化金额
const formatCurrency = (num: number) => {
  if (num >= 10000) return `¥${(num / 10000).toFixed(2)}万`;
  return `¥${num.toLocaleString('zh-CN')}`;
};

// 格式化重量
const formatWeight = (num: number) => {
  return `${num.toFixed(2)}吨`;
};

export function ShipperStatsCards({ summary }: ShipperStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总运单数</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(summary.totalRecords)}</div>
          <p className="text-xs text-muted-foreground">
            本级: {formatNumber(summary.selfRecords)} | 下级: {formatNumber(summary.subordinatesRecords)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总重量</CardTitle>
          <Weight className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatWeight(summary.totalWeight)}</div>
          <p className="text-xs text-muted-foreground">
            本级: {formatWeight(summary.selfWeight)} | 下级: {formatWeight(summary.subordinatesWeight)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总金额</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.totalAmount)}</div>
          <p className="text-xs text-muted-foreground">
            本级: {formatCurrency(summary.selfAmount)} | 下级: {formatCurrency(summary.subordinatesAmount)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">活跃项目</CardTitle>
          <Briefcase className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.activeProjects}</div>
          <p className="text-xs text-muted-foreground">
            活跃司机: {summary.activeDrivers}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

