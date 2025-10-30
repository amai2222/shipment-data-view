// 合同列表表格组件
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, FileText } from 'lucide-react';
import { formatCurrency, formatDateShort } from '@/utils/auditFormatters';
import type { Contract } from '@/types/managementPages';

interface ContractTableProps {
  contracts: Contract[];
  onEdit: (contract: Contract) => void;
  onView: (contract: Contract) => void;
}

export function ContractTable({ contracts, onEdit, onView }: ContractTableProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>合同编号</TableHead>
            <TableHead>合同标题</TableHead>
            <TableHead>甲方</TableHead>
            <TableHead>乙方</TableHead>
            <TableHead>起始日期</TableHead>
            <TableHead>结束日期</TableHead>
            <TableHead className="text-right">合同金额</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-center">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                暂无合同数据
              </TableCell>
            </TableRow>
          ) : (
            contracts.map((contract) => (
              <TableRow key={contract.id} className="hover:bg-muted/50">
                <TableCell className="font-mono font-medium">{contract.contract_number}</TableCell>
                <TableCell className="max-w-[200px] truncate font-medium">{contract.title}</TableCell>
                <TableCell>{contract.party_a || '-'}</TableCell>
                <TableCell>{contract.party_b || '-'}</TableCell>
                <TableCell>{formatDateShort(contract.start_date)}</TableCell>
                <TableCell>{formatDateShort(contract.end_date)}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(contract.amount)}</TableCell>
                <TableCell>
                  <Badge 
                    variant={contract.status === '有效' ? 'default' : contract.status === '已到期' ? 'outline' : 'secondary'}
                    className={contract.status === '有效' ? 'bg-green-600' : ''}
                  >
                    {contract.status || '未知'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => onView(contract)}>
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onEdit(contract)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

