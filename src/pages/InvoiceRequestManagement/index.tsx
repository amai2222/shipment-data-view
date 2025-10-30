// 财务开票管理 - 重构版本
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { FileText } from 'lucide-react';
import { useSelection } from '@/hooks/useSelection';
import { usePagination } from '@/hooks/usePagination';
import { useInvoiceRequestData } from './hooks/useInvoiceRequestData';
import { useInvoiceRequestActions } from './hooks/useInvoiceRequestActions';
import { BulkActionBar, StatusBadge, INVOICE_REQUEST_STATUS_CONFIG, LoadingState, type BulkAction } from '@/components/common';
import { formatCurrency, formatDate } from '@/utils/auditFormatters';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, RotateCcw, Trash2 } from 'lucide-react';
import { InvoiceRequestFilterBar } from './components/InvoiceRequestFilterBar';

export default function InvoiceRequestManagement() {
  const [filters, setFilters] = useState<any>({});
  const { currentPage, pageSize, goToPage } = usePagination(20);
  const { invoiceRequests, loading, loadInvoiceRequests } = useInvoiceRequestData();
  const { selection, handleToggle, handleSelectAll, clearSelection } = useSelection();
  const { handleBatchInvoice, handleBatchCancelInvoice, handleBatchVoid, isBatchProcessing } = useInvoiceRequestActions();

  useEffect(() => {
    loadInvoiceRequests(filters, currentPage, pageSize);
  }, [filters, currentPage, pageSize, loadInvoiceRequests]);

  const selectionCount = selection.mode === 'all_filtered' ? invoiceRequests.length : selection.selectedIds.size;

  const bulkActions: BulkAction[] = useMemo(() => [
    {
      key: 'invoice',
      label: '批量开票',
      icon: <CheckCircle className="mr-2 h-4 w-4" />,
      className: 'bg-green-600 hover:bg-green-700 text-white',
      needConfirm: true,
      confirmTitle: `确认批量开票 ${selectionCount} 个申请单`,
      confirmDescription: '此操作将完成选中申请单的开票。',
      onClick: async () => {
        const ids = Array.from(selection.selectedIds);
        const success = await handleBatchInvoice(ids);
        if (success) {
          clearSelection();
          loadInvoiceRequests(filters, currentPage, pageSize);
        }
      }
    },
    {
      key: 'cancel',
      label: '批量取消付款',
      icon: <RotateCcw className="mr-2 h-4 w-4" />,
      className: 'bg-orange-600 hover:bg-orange-700 text-white',
      needConfirm: true,
      confirmTitle: `确认批量取消付款 ${selectionCount} 个申请单`,
      confirmDescription: '此操作将把已完成的申请单回滚到已审批状态。',
      onClick: async () => {
        const ids = Array.from(selection.selectedIds);
        const success = await handleBatchCancelInvoice(ids);
        if (success) {
          clearSelection();
          loadInvoiceRequests(filters, currentPage, pageSize);
        }
      }
    },
    {
      key: 'void',
      label: '一键作废',
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      variant: 'destructive',
      needConfirm: true,
      confirmTitle: `确认作废 ${selectionCount} 个申请单`,
      confirmDescription: '⚠️ 此操作不可逆！',
      onClick: async () => {
        const ids = Array.from(selection.selectedIds);
        const success = await handleBatchVoid(ids);
        if (success) {
          clearSelection();
          loadInvoiceRequests(filters, currentPage, pageSize);
        }
      }
    }
  ], [selectionCount, selection.selectedIds, handleBatchInvoice, handleBatchCancelInvoice, handleBatchVoid, clearSelection, filters, currentPage, pageSize, loadInvoiceRequests]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="财务开票" description="开票申请单管理" icon={FileText} />
      
      <InvoiceRequestFilterBar filters={filters} onFilterChange={setFilters} />

      {selectionCount > 0 && (
        <BulkActionBar
          selectedCount={selectionCount}
          actions={bulkActions}
          isProcessing={isBatchProcessing}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>开票申请单列表 ({invoiceRequests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <LoadingState /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selection.mode === 'all_filtered'}
                      onCheckedChange={() => handleSelectAll(invoiceRequests.map(r => r.id))}
                    />
                  </TableHead>
                  <TableHead>申请单号</TableHead>
                  <TableHead>合作方</TableHead>
                  <TableHead className="text-right">开票金额</TableHead>
                  <TableHead className="text-right">运单数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoiceRequests.map((request: any) => (
                  <TableRow key={request.id} data-state={selection.selectedIds.has(request.id) && "selected"}>
                    <TableCell>
                      <Checkbox
                        checked={selection.mode === 'all_filtered' || selection.selectedIds.has(request.id)}
                        onCheckedChange={() => handleToggle(request.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{request.request_number}</TableCell>
                    <TableCell>{request.partner_name}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(request.total_amount)}</TableCell>
                    <TableCell className="text-right">{request.record_count}条</TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} customConfig={INVOICE_REQUEST_STATUS_CONFIG} />
                    </TableCell>
                    <TableCell>{formatDate(request.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

