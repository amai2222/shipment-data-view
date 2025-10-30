// 开票申请合计行组件
import { TableCell, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/utils/invoicePaymentFormatters';
import type { Partner } from '@/types/invoiceRequest';

interface InvoiceSummaryRowProps {
  totalInvoiceableCost: number;
  partners: Partner[];
  partnerTotals: any[];
  colSpan: number;
}

export function InvoiceSummaryRow({
  totalInvoiceableCost,
  partners,
  partnerTotals,
  colSpan
}: InvoiceSummaryRowProps) {
  return (
    <TableRow className="bg-muted/30 font-semibold border-t-2">
      <TableCell colSpan={colSpan} className="text-right font-bold whitespace-nowrap">
        合计
      </TableCell>
      <TableCell className="font-mono font-bold text-primary text-center whitespace-nowrap">
        <div>{formatCurrency(totalInvoiceableCost)}</div>
        <div className="text-xs text-muted-foreground font-normal">(司机应收)</div>
      </TableCell>
      {Array.isArray(partners) && partners.map(p => {
        const total = (Array.isArray(partnerTotals) && 
          partnerTotals.find((pp: any) => pp.partner_id === p.id)?.total_payable) || 0;
        return (
          <TableCell key={p.id} className="text-center font-bold font-mono whitespace-nowrap">
            <div>{formatCurrency(total)}</div>
            <div className="text-xs text-muted-foreground font-normal">({p.name})</div>
          </TableCell>
        );
      })}
      <TableCell className="whitespace-nowrap"></TableCell>
      <TableCell className="whitespace-nowrap"></TableCell>
    </TableRow>
  );
}

