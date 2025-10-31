import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, CheckCircle, Clock, AlertCircle, RefreshCw } from "lucide-react";

interface GeocodingStatsCardProps {
  stats: {
    total: number;
    success: number;
    pending: number;
    failed: number;
    retry: number;
  };
}

export function GeocodingStatsCard({ stats }: GeocodingStatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          地理编码统计
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">总数</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-2xl font-bold text-green-600">{stats.success}</p>
            </div>
            <p className="text-sm text-muted-foreground">成功</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Clock className="h-4 w-4 text-gray-400" />
              <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
            </div>
            <p className="text-sm text-muted-foreground">待处理</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <p className="text-sm text-muted-foreground">失败</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <RefreshCw className="h-4 w-4 text-yellow-600" />
              <p className="text-2xl font-bold text-yellow-600">{stats.retry}</p>
            </div>
            <p className="text-sm text-muted-foreground">重试</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

