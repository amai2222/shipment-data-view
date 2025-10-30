// 付款申请列表表格组件
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FileText, Banknote, RotateCcw } from 'lucide-react';
import { StatusBadge, PAYMENT_REQUEST_STATUS_CONFIG } from '@/components/common';
import { formatCurrency, formatDate } from '@/utils/auditFormatters';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface PaymentRequestsTableProps {
  requests: any[];
  selection: any;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onViewDetail: (req: any) => void;
  onGeneratePDF: (req: any) => void;
  onPayment: (req: any) => void;
  onCancelPayment: (req: any) => void;
  onRollbackApproval: (requestId: string) => void;
  exportingId: string | null;
}

export function PaymentRequestsTable({
  requests,
  selection,
  onToggle,
  onSelectAll,
  onViewDetail,
  onGeneratePDF,
  onPayment,
  onCancelPayment,
  onRollbackApproval,
  exportingId
}: PaymentRequestsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox 
              checked={selection.mode === 'all_filtered'} 
              onCheckedChange={onSelectAll} 
            />
          </TableHead>
          <TableHead>申请编号</TableHead>
          <TableHead>申请时间</TableHead>
          <TableHead>付款申请单状态</TableHead>
          <TableHead className="text-right">运单数</TableHead>
          <TableHead className="text-right">申请金额</TableHead>
          <TableHead className="max-w-[200px]">备注</TableHead>
          <TableHead className="text-center">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((req) => (
          <TableRow 
            key={req.id}
            data-state={selection.selectedIds.has(req.id) ? "selected" : undefined}
            className="hover:bg-muted/50"
          >
            <TableCell onClick={(e) => e.stopPropagation()}>
              <Checkbox 
                checked={selection.mode === 'all_filtered' || selection.selectedIds.has(req.id)} 
                onCheckedChange={() => onToggle(req.id)} 
              />
            </TableCell>
            <TableCell className="font-mono cursor-pointer" onClick={() => onViewDetail(req)}>
              {req.request_id}
            </TableCell>
            <TableCell className="cursor-pointer" onClick={() => onViewDetail(req)}>
              {formatDate(req.created_at)}
            </TableCell>
            <TableCell className="cursor-pointer" onClick={() => onViewDetail(req)}>
              <StatusBadge status={req.status} customConfig={PAYMENT_REQUEST_STATUS_CONFIG} />
            </TableCell>
            <TableCell className="text-right cursor-pointer" onClick={() => onViewDetail(req)}>
              {req.record_count ?? 0}
            </TableCell>
            <TableCell className="text-right cursor-pointer" onClick={() => onViewDetail(req)}>
              {formatCurrency(req.max_amount)}
            </TableCell>
            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground cursor-pointer" onClick={() => onViewDetail(req)}>
              {req.notes || '-'}
            </TableCell>
            <TableCell className="text-center">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button
                  variant="default"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onGeneratePDF(req); }}
                  disabled={exportingId === req.id}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  查看申请单
                </Button>

                {req.status === 'Approved' && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onPayment(req); }}
                      disabled={exportingId === req.id}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Banknote className="mr-2 h-4 w-4" />
                      付款
                    </Button>
                    <ConfirmDialog
                      title="确认取消审批"
                      description={`确定要取消审批付款申请 ${req.request_id} 吗？`}
                      onConfirm={() => onRollbackApproval(req.request_id)}
                    >
                      <Button
                        variant="default"
                        size="sm"
                        disabled={exportingId === req.id}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        取消审批
                      </Button>
                    </ConfirmDialog>
                  </>
                )}

                {req.status === 'Paid' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onCancelPayment(req); }}
                    disabled={exportingId === req.id}
                    className="border-orange-300 text-orange-700 hover:bg-orange-50"
                  >
                    <Banknote className="mr-2 h-4 w-4" />
                    取消付款
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

