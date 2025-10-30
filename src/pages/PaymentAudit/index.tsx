// 付款审核 - 重构版本
import { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/PageHeader';
import { Banknote, ClipboardList, RotateCcw, Trash2 } from 'lucide-react';
import { useSelection } from '@/hooks/useSelection';
import { usePagination } from '@/hooks/usePagination';
import { useAuditData } from '@/hooks/useAuditData';
import { BulkActionBar, StatusBadge, PAYMENT_REQUEST_STATUS_CONFIG, LoadingState, type BulkAction } from '@/components/common';
import { formatCurrency, formatDate } from '@/utils/auditFormatters';
import { useState } from 'react';

export default function PaymentAudit() {
  const [filters, setFilters] = useState<any>({});
  const { currentPage, pageSize } = usePagination(20);
  const { requests, loading, fetchRequests } = useAuditData('get_payment_requests_filtered');
  const { selection, handleToggle, handleSelectAll } = useSelection();

  useEffect(() => {
    fetchRequests(filters, currentPage, pageSize);
  }, [filters, currentPage, pageSize, fetchRequests]);

  const selectionCount = selection.mode === 'all_filtered' ? requests.length : selection.selectedIds.size;

  const bulkActions: BulkAction[] = useMemo(() => [
    {
      key: 'approve',
      label: '批量审批',
      icon: <ClipboardList className="mr-2 h-4 w-4" />,
      variant: 'destructive',
      needConfirm: true,
      onClick: async () => {}
    },
    {
      key: 'rollback',
      label: '批量取消审批',
      icon: <RotateCcw className="mr-2 h-4 w-4" />,
      className: 'bg-orange-600 hover:bg-orange-700 text-white',
      needConfirm: true,
      onClick: async () => {}
    },
    {
      key: 'void',
      label: '一键作废',
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      variant: 'destructive',
      needConfirm: true,
      onClick: async () => {}
    }
  ], [selectionCount]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="付款审核" description="审核付款申请单" icon={Banknote} />
      
      {selectionCount > 0 && <BulkActionBar selectedCount={selectionCount} actions={bulkActions} />}

      <Card>
        <CardHeader><CardTitle>申请单列表</CardTitle></CardHeader>
        <CardContent>
          {loading ? <LoadingState /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"><Checkbox checked={selection.mode === 'all_filtered'} onCheckedChange={() => handleSelectAll(requests.map((r: any) => r.id))} /></TableHead>
                  <TableHead>申请编号</TableHead>
                  <TableHead className="text-right">申请金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>申请时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req: any) => (
                  <TableRow key={req.id} data-state={selection.selectedIds.has(req.id) && "selected"}>
                    <TableCell><Checkbox checked={selection.mode === 'all_filtered' || selection.selectedIds.has(req.id)} onCheckedChange={() => handleToggle(req.id)} /></TableCell>
                    <TableCell className="font-medium">{req.request_id}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(req.max_amount)}</TableCell>
                    <TableCell><StatusBadge status={req.status} customConfig={PAYMENT_REQUEST_STATUS_CONFIG} /></TableCell>
                    <TableCell>{formatDate(req.created_at)}</TableCell>
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

