// 运单详情对话框组件（付款申请）
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/utils/invoicePaymentFormatters';
import type { LogisticsRecord } from '@/types/paymentRequest';

interface RecordDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: LogisticsRecord | null;
}

const getPaymentStatusBadge = (status: string) => {
  switch (status) {
    case 'Unpaid': return <Badge variant="outline" className="bg-gray-50">未支付</Badge>;
    case 'Processing': return <Badge variant="outline" className="bg-orange-50 text-orange-700">已申请支付</Badge>;
    case 'Paid': return <Badge variant="outline" className="bg-green-50 text-green-700">已完成支付</Badge>;
    default: return <Badge variant="outline">未知</Badge>;
  }
};

export function RecordDetailDialog({ open, onOpenChange, record }: RecordDetailDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>运单详情 (编号: {record.auto_number})</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-4 gap-x-4 gap-y-6 py-4 text-sm">
          <div className="space-y-1">
            <Label className="text-muted-foreground">项目</Label>
            <p>{record.project_name}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">合作链路</Label>
            <p>{record.chain_name || '未指定'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">装货日期</Label>
            <p>{formatDate(record.loading_date)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">支付状态</Label>
            <p>{getPaymentStatusBadge(record.payment_status)}</p>
          </div>
          
          <div className="space-y-1">
            <Label className="text-muted-foreground">司机</Label>
            <p>{record.driver_name}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">车牌号</Label>
            <p>{record.license_plate || '未填写'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">司机电话</Label>
            <p>{record.driver_phone || '未填写'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">应付金额（司机）</Label>
            <p className="font-mono font-bold text-primary">{formatCurrency(record.payable_cost)}</p>
          </div>

          <div className="space-y-1">
            <Label className="text-muted-foreground">装货地点</Label>
            <p className="text-sm">{record.loading_location}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">卸货地点</Label>
            <p className="text-sm">{record.unloading_location}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">装货重量</Label>
            <p>{record.loading_weight ? `${record.loading_weight}吨` : '-'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">卸货重量</Label>
            <p>{record.unloading_weight ? `${record.unloading_weight}吨` : '-'}</p>
          </div>

          {record.current_cost && (
            <div className="space-y-1">
              <Label className="text-muted-foreground">运费金额</Label>
              <p className="font-mono">{formatCurrency(record.current_cost)}</p>
            </div>
          )}
          {record.extra_cost && (
            <div className="space-y-1">
              <Label className="text-muted-foreground">额外费用</Label>
              <p className="font-mono">{formatCurrency(record.extra_cost)}</p>
            </div>
          )}
          {record.remarks && (
            <div className="space-y-1 col-span-2">
              <Label className="text-muted-foreground">备注</Label>
              <p className="text-sm text-muted-foreground">{record.remarks}</p>
            </div>
          )}
        </div>

        {record.partner_costs && record.partner_costs.length > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">合作方成本明细</h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 border-b">合作方</th>
                    <th className="text-center p-2 border-b">层级</th>
                    <th className="text-right p-2 border-b">应付金额</th>
                    <th className="text-center p-2 border-b">支付状态</th>
                  </tr>
                </thead>
                <tbody>
                  {record.partner_costs.map((cost, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="p-2">{cost.partner_name}</td>
                      <td className="text-center p-2">{cost.level}级</td>
                      <td className="text-right font-mono p-2">{formatCurrency(cost.payable_amount)}</td>
                      <td className="text-center p-2">{getPaymentStatusBadge(cost.payment_status || 'Unpaid')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

