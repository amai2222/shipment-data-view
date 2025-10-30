// 付款申请运单列表表格组件
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatCurrency, formatDate, simplifyRoute, formatQuantity } from '@/utils/invoicePaymentFormatters';
import { PaymentSummaryRow } from '@/components/common/PaymentSummaryRow';
import type { LogisticsRecord, Partner, SelectionState } from '@/types/paymentRequest';

interface PaymentRecordsTableProps {
  records: LogisticsRecord[];
  partners: Partner[];
  selection: SelectionState;
  onToggleRecord: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onSelectAllFiltered: () => void;
  onRecordClick: (record: LogisticsRecord) => void;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  overview: any;
  partnerTotals: any[];
  totalRecords: number;
}

const getPaymentStatusBadge = (status: string) => {
  switch (status) {
    case 'Unpaid': return <Badge variant="outline" className="bg-gray-50">未支付</Badge>;
    case 'Processing': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">已申请支付</Badge>;
    case 'Paid': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">已完成支付</Badge>;
    default: return <Badge variant="outline">未知</Badge>;
  }
};

export function PaymentRecordsTable({
  records,
  partners,
  selection,
  onToggleRecord,
  onSelectAll,
  onSelectAllFiltered,
  onRecordClick,
  sortField,
  sortDirection,
  onSort,
  overview,
  partnerTotals,
  totalRecords
}: PaymentRecordsTableProps) {
  const allCurrentPageSelected = records.every(r => selection.selectedIds.has(r.id));

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 sticky left-0 bg-background z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Checkbox
                    checked={selection.mode === 'all_filtered' || allCurrentPageSelected}
                    onCheckedChange={() => onSelectAll(records.map(r => r.id))}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => onSelectAll(records.map(r => r.id))}>
                    选择当前页 {records.length} 条
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onSelectAllFiltered}>
                    选择所有 {totalRecords} 条记录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableHead>
            <TableHead className="min-w-[120px] sticky left-12 bg-background z-10 cursor-pointer hover:bg-muted/50" onClick={() => onSort('auto_number')}>
              <div className="flex items-center gap-1">
                运单号 {sortField === 'auto_number' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
              </div>
            </TableHead>
            <TableHead className="min-w-[100px]">项目</TableHead>
            <TableHead className="min-w-[80px] cursor-pointer hover:bg-muted/50" onClick={() => onSort('driver_name')}>
              <div className="flex items-center gap-1">
                司机 {sortField === 'driver_name' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
              </div>
            </TableHead>
            <TableHead className="min-w-[140px]">路线</TableHead>
            <TableHead className="min-w-[100px] hidden sm:table-cell">装/卸数量</TableHead>
            <TableHead className="min-w-[120px] hidden md:table-cell cursor-pointer hover:bg-muted/50" onClick={() => onSort('loading_date')}>
              <div className="flex items-center gap-1">
                日期 {sortField === 'loading_date' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
              </div>
            </TableHead>
            <TableHead className="min-w-[100px] font-bold text-primary cursor-pointer hover:bg-muted/50" onClick={() => onSort('payable_cost')}>
              <div className="flex items-center gap-1">
                司机应收 {sortField === 'payable_cost' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
              </div>
            </TableHead>
            {partners.map(p => (
              <TableHead key={p.id} className="min-w-[100px] text-center">
                <div className="text-xs font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">({p.level}级)</div>
              </TableHead>
            ))}
            <TableHead className="min-w-[80px]">合作链路</TableHead>
            <TableHead className="min-w-[80px]">支付状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <TableRow key={r.id} data-state={selection.selectedIds.has(r.id) && "selected"}>
              <TableCell className="sticky left-0 bg-background z-10">
                <Checkbox
                  checked={selection.mode === 'all_filtered' || selection.selectedIds.has(r.id)}
                  onCheckedChange={() => onToggleRecord(r.id)}
                />
              </TableCell>
              <TableCell className="font-mono cursor-pointer sticky left-12 bg-background z-10 font-medium" onClick={() => onRecordClick(r)}>
                {r.auto_number}
              </TableCell>
              <TableCell className="cursor-pointer" onClick={() => onRecordClick(r)}>
                <div className="max-w-[100px] truncate" title={r.project_name}>{r.project_name}</div>
              </TableCell>
              <TableCell className="cursor-pointer" onClick={() => onRecordClick(r)}>
                <div className="max-w-[80px] truncate" title={r.driver_name}>{r.driver_name}</div>
              </TableCell>
              <TableCell className="text-sm cursor-pointer" onClick={() => onRecordClick(r)}>
                <div className="max-w-[140px] truncate" title={`${r.loading_location} → ${r.unloading_location}`}>
                  {simplifyRoute(r.loading_location, r.unloading_location)}
                </div>
              </TableCell>
              <TableCell className="cursor-pointer hidden sm:table-cell" onClick={() => onRecordClick(r)}>
                {formatQuantity(r)}
              </TableCell>
              <TableCell className="cursor-pointer hidden md:table-cell" onClick={() => onRecordClick(r)}>
                {formatDate(r.loading_date)}
              </TableCell>
              <TableCell className="font-mono cursor-pointer font-bold text-primary" onClick={() => onRecordClick(r)}>
                {formatCurrency(r.payable_cost)}
              </TableCell>
              {partners.map(p => {
                const cost = r.partner_costs?.find(c => c.partner_id === p.id);
                return (
                  <TableCell key={p.id} className="font-mono text-center cursor-pointer" onClick={() => onRecordClick(r)}>
                    {formatCurrency(cost?.payable_amount)}
                  </TableCell>
                );
              })}
              <TableCell className="cursor-pointer" onClick={() => onRecordClick(r)}>
                <span className="text-xs truncate max-w-[80px]">{r.chain_name || '默认链路'}</span>
              </TableCell>
              <TableCell className="cursor-pointer" onClick={() => onRecordClick(r)}>
                {getPaymentStatusBadge(r.payment_status)}
              </TableCell>
            </TableRow>
          ))}
          <PaymentSummaryRow
            totalPayableCost={overview?.total_payable_cost || 0}
            partners={partners}
            partnerTotals={partnerTotals}
            colSpan={7}
          />
        </TableBody>
      </Table>
    </div>
  );
}

