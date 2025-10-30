// 付款申请预览对话框组件
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/utils/invoicePaymentFormatters';
import type { PaymentPreviewData } from '@/types/paymentRequest';

interface PaymentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: PaymentPreviewData | null;
  onConfirm: () => void;
  isSaving: boolean;
}

export function PaymentPreviewDialog({
  open,
  onOpenChange,
  previewData,
  onConfirm,
  isSaving
}: PaymentPreviewDialogProps) {
  if (!previewData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>付款申请预览</DialogTitle>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>付款方 (收款人)</TableHead>
              <TableHead>收款银行账号</TableHead>
              <TableHead>开户行</TableHead>
              <TableHead>支行网点</TableHead>
              <TableHead className="text-right">运单数</TableHead>
              <TableHead className="text-right">合计金额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewData.sheets.map(sheet => (
              <TableRow key={sheet.paying_partner_id}>
                <TableCell className="font-medium">{sheet.paying_partner_full_name}</TableCell>
                <TableCell>{sheet.paying_partner_bank_account}</TableCell>
                <TableCell>{sheet.paying_partner_bank_name}</TableCell>
                <TableCell>{sheet.paying_partner_branch_name}</TableCell>
                <TableCell className="text-right">{sheet.record_count}</TableCell>
                <TableCell className="text-right font-mono font-bold text-primary">
                  {formatCurrency(sheet.total_payable)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="text-sm text-muted-foreground mt-4">
          总计: {previewData.processed_record_ids.length} 条运单
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            取消
          </Button>
          <Button onClick={onConfirm} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            确认创建付款申请
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

