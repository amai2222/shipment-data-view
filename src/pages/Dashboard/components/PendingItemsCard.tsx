import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, DollarSign, Download } from "lucide-react";

interface PendingData {
  pendingPayments: number;
  pendingInvoices: number;
  overduePayments: number;
}

interface PendingItemsCardProps {
  pending: PendingData;
}

export function PendingItemsCard({ pending }: PendingItemsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          待处理事项
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">待付款</p>
              <p className="text-2xl font-bold">{pending.pendingPayments}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Download className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium">待开票</p>
              <p className="text-2xl font-bold">{pending.pendingInvoices}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium">逾期付款</p>
              <p className="text-2xl font-bold">{pending.overduePayments}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

