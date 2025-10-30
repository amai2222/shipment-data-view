// 开票申请预览对话框组件
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/utils/invoicePaymentFormatters';
import type { InvoicePreviewData } from '@/types/invoiceRequest';

interface InvoicePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: InvoicePreviewData | null;
  onConfirm: () => void;
  isSaving: boolean;
}

export function InvoicePreviewDialog({
  open,
  onOpenChange,
  previewData,
  onConfirm,
  isSaving
}: InvoicePreviewDialogProps) {
  if (!previewData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>开票申请预览</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {previewData.sheets.map((sheet, idx) => (
            <Card key={sheet.invoicing_partner_id}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{sheet.invoicing_partner_full_name}</span>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>运单数量: {sheet.record_count} 条</div>
                    <div>开票金额: {formatCurrency(sheet.total_invoiceable)}</div>
                  </div>
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>运单编号</TableHead>
                      <TableHead>项目</TableHead>
                      <TableHead>司机</TableHead>
                      <TableHead>路线</TableHead>
                      <TableHead>装货日期</TableHead>
                      <TableHead className="text-right">开票金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sheet.records.map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono">{record.auto_number}</TableCell>
                        <TableCell>{record.project_name}</TableCell>
                        <TableCell>{record.driver_name}</TableCell>
                        <TableCell className="text-sm">
                          {record.loading_location} → {record.unloading_location}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(record.loading_date)}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {formatCurrency(record.total_invoiceable_for_partner || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-sm text-muted-foreground">
          总计: {previewData.processed_record_ids.length} 条运单，
          金额合计: {formatCurrency(previewData.sheets.reduce((sum, sheet) => sum + sheet.total_invoiceable, 0))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            取消
          </Button>
          <Button onClick={onConfirm} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            确认创建开票申请
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

