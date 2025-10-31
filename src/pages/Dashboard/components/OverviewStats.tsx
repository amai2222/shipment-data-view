import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, TrendingUp, Truck, Package } from "lucide-react";

interface OverviewStatsProps {
  totalRecords: number;
  totalWeight: number;
  totalCost: number;
  actualTransportCount: number;
  returnCount: number;
}

export function OverviewStats({
  totalRecords,
  totalWeight,
  totalCost,
  actualTransportCount,
  returnCount,
}: OverviewStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="shadow-card">
        <CardContent className="flex items-center p-6">
          <div className="p-2 bg-blue-100 rounded-lg mr-4">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">总运输次数</p>
            <p className="text-2xl font-bold">{totalRecords}</p>
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
            <p className="text-2xl font-bold">{totalWeight.toFixed(1)}吨</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="flex items-center p-6">
          <div className="p-2 bg-yellow-100 rounded-lg mr-4">
            <TrendingUp className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">司机应收汇总</p>
            <p className="text-2xl font-bold">¥{totalCost.toFixed(2)}</p>
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
            <p className="text-2xl font-bold">{actualTransportCount}/{returnCount}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

