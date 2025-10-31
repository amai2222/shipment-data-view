import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";

interface ShipperSelectorProps {
  selectedShipperId: string | null;
  setSelectedShipperId: (id: string) => void;
  availableShippers: Array<{id: string, name: string}>;
  dateRange: string;
  setDateRange: (range: '7days' | '30days' | 'thisMonth' | 'lastMonth') => void;
  shipperScope: string;
  setShipperScope: (scope: 'all' | 'self' | 'direct') => void;
  onExport: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  isPartnerRole: boolean;
}

export function ShipperSelector({
  selectedShipperId,
  setSelectedShipperId,
  availableShippers,
  dateRange,
  setDateRange,
  shipperScope,
  setShipperScope,
  onExport,
  onRefresh,
  isLoading,
  isPartnerRole,
}: ShipperSelectorProps) {
  return (
    <div className="flex items-center gap-4">
      {/* 货主选择（非合作方角色显示） */}
      {!isPartnerRole && availableShippers.length > 0 && (
        <Select value={selectedShipperId || ''} onValueChange={setSelectedShipperId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="选择货主" />
          </SelectTrigger>
          <SelectContent>
            {availableShippers.map(shipper => (
              <SelectItem key={shipper.id} value={shipper.id}>
                {shipper.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 时间范围筛选 */}
      <Select value={dateRange} onValueChange={(value: '7days' | '30days' | 'thisMonth' | 'lastMonth') => setDateRange(value)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7days">最近7天</SelectItem>
          <SelectItem value="30days">最近30天</SelectItem>
          <SelectItem value="thisMonth">本月</SelectItem>
          <SelectItem value="lastMonth">上月</SelectItem>
        </SelectContent>
      </Select>

      {/* 货主范围筛选 */}
      <Select value={shipperScope} onValueChange={(value: 'all' | 'self' | 'direct') => setShipperScope(value)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部</SelectItem>
          <SelectItem value="self">仅本级</SelectItem>
          <SelectItem value="direct">仅下级</SelectItem>
        </SelectContent>
      </Select>

      {/* 操作按钮 */}
      <Button onClick={onExport} variant="outline" size="sm">
        <Download className="h-4 w-4 mr-2" />
        导出报表
      </Button>
      
      <Button onClick={onRefresh} variant="outline" size="sm" disabled={isLoading}>
        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
        刷新
      </Button>
    </div>
  );
}

