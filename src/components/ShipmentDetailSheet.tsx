// --- 文件: src/components/ShipmentDetailSheet.tsx ---

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FullShipmentDetails } from "@/types";
import { Separator } from "@/components/ui/separator";

interface ShipmentDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  shipmentDetails: FullShipmentDetails | null;
  isLoading: boolean;
}

export function ShipmentDetailSheet({ isOpen, onClose, shipmentDetails, isLoading }: ShipmentDetailSheetProps) {

  const getFinancialStatusBadge = (status: '待支付' | '已支付' | '审核中') => {
    switch (status) {
      case '已支付': return <Badge variant="default" className="bg-green-600">已支付</Badge>;
      case '待支付': return <Badge variant="destructive">待支付</Badge>;
      case '审核中': return <Badge variant="secondary">审核中</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };
  
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>运单详情: {shipmentDetails?.baseInfo.id}</SheetTitle>
          <SheetDescription>
            查看该运单的所有基础信息、财务明细和运输日志。
          </SheetDescription>
        </SheetHeader>
        {isLoading ? (
          <div className="flex items-center justify-center h-64"> <p>正在加载详细信息...</p> </div>
        ) : shipmentDetails ? (
          <div className="space-y-6 mt-6">
            <div>
              <h4 className="text-lg font-semibold mb-2">基础信息</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span>项目名称:</span> <span className="font-medium">{shipmentDetails.baseInfo.project_name}</span>
                <span>车牌号:</span> <span className="font-medium">{shipmentDetails.baseInfo.license_plate}</span>
                <span>司机:</span> <span className="font-medium">{shipmentDetails.baseInfo.driver_name} ({shipmentDetails.baseInfo.driver_phone})</span>
                <span>应付成本:</span> <span className="font-bold text-base text-red-600">{new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(shipmentDetails.baseInfo.payable_cost)}</span>
                <span>装车日期:</span> <span>{new Date(shipmentDetails.baseInfo.loading_date).toLocaleDateString()}</span>
                <span>创建时间:</span> <span>{new Date(shipmentDetails.baseInfo.created_at).toLocaleString()}</span>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-lg font-semibold mb-2">财务明细</h4>
              <Table>
                <TableHeader><TableRow><TableHead>类型</TableHead><TableHead>状态</TableHead><TableHead className="text-right">金额</TableHead><TableHead>日期</TableHead></TableRow></TableHeader>
                <TableBody>
                  {shipmentDetails.financials.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.type}</TableCell>
                      <TableCell>{getFinancialStatusBadge(entry.status)}</TableCell>
                      <TableCell className="text-right">{entry.amount.toFixed(2)}</TableCell>
                      <TableCell>{new Date(entry.transaction_date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Separator />
            <div>
                <h4 className="text-lg font-semibold mb-2">运输日志</h4>
                <div className="space-y-4">
                {shipmentDetails.events.map(event => (
                    <div key={event.id} className="flex gap-4">
                        <div className="text-xs text-muted-foreground whitespace-nowrap pt-1">{new Date(event.timestamp).toLocaleString()}</div>
                        <div className="relative w-full">
                            <div className="h-full w-px bg-border absolute left-1.5 -z-10"></div>
                            <div className="w-3 h-3 rounded-full bg-primary absolute left-0 top-1.5"></div>
                            <p className="ml-6 font-medium text-sm">{event.status}</p>
                            <p className="ml-6 text-sm text-muted-foreground">{event.description}</p>
                        </div>
                    </div>
                ))}
                </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64"> <p>未能加载运单详情。</p> </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
